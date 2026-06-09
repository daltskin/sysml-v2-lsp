import { describe, expect, it } from 'vitest';
import {
    buildSuperTypeGraph,
    classifyFamily,
    EdgeKind,
    IMPLICIT_DEFINITION_SUPERTYPES,
    simpleName,
    SuperTypeGraph,
    TypeFamily,
} from '../../server/src/analysis/typeGraph.js';
import { SysMLElementKind, SysMLSymbol } from '../../server/src/symbols/sysmlElements.js';

/** Minimal symbol factory for graph tests. */
function sym(
    name: string,
    kind: SysMLElementKind,
    opts: { typeNames?: string[]; specializationNames?: string[] } = {},
): SysMLSymbol {
    const range = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
    return {
        name,
        kind,
        qualifiedName: name,
        range,
        selectionRange: range,
        uri: 'file:///t.sysml',
        typeNames: opts.typeNames ?? [],
        specializationNames: opts.specializationNames ?? [],
        children: [],
    };
}

describe('simpleName', () => {
    it('returns the last segment of a qualified name', () => {
        expect(simpleName('ISQ::MassValue')).toBe('MassValue');
        expect(simpleName('A::B::C')).toBe('C');
    });

    it('returns the name unchanged when unqualified', () => {
        expect(simpleName('Part')).toBe('Part');
    });

    it('strips a leading conjugation tilde', () => {
        expect(simpleName('~Port')).toBe('Port');
    });
});

describe('SuperTypeGraph', () => {
    it('does not create self-loops', () => {
        const g = new SuperTypeGraph();
        g.addEdge('A', 'A', EdgeKind.Specialization);
        expect(g.getSupertypeEdges('A')).toHaveLength(0);
    });

    it('de-duplicates identical edges', () => {
        const g = new SuperTypeGraph();
        g.addEdge('A', 'B', EdgeKind.Specialization);
        g.addEdge('A', 'B', EdgeKind.Specialization);
        expect(g.getSupertypeEdges('A')).toHaveLength(1);
    });

    it('records the kind on each edge', () => {
        const g = new SuperTypeGraph();
        g.addEdge('A', 'B', EdgeKind.Subsetting);
        expect(g.getSupertypeEdges('A')[0].kind).toBe(EdgeKind.Subsetting);
    });

    it('finds direct and transitive specialization via DFS', () => {
        const g = new SuperTypeGraph();
        g.addEdge('A', 'B', EdgeKind.Specialization);
        g.addEdge('B', 'C', EdgeKind.Specialization);
        expect(g.specializes('A', 'B')).toBe(true);
        expect(g.specializes('A', 'C')).toBe(true); // transitive
        expect(g.specializes('A', 'A')).toBe(true); // reflexive
        expect(g.specializes('C', 'A')).toBe(false);
    });

    it('terminates on cyclic graphs', () => {
        const g = new SuperTypeGraph();
        g.addEdge('A', 'B', EdgeKind.Specialization);
        g.addEdge('B', 'A', EdgeKind.Specialization);
        expect(g.specializes('A', 'C')).toBe(false);
        expect(g.specializes('A', 'B')).toBe(true);
    });

    it('can restrict traversal to specific edge kinds', () => {
        const g = new SuperTypeGraph();
        g.addEdge('A', 'B', EdgeKind.FeatureTyping);
        g.addEdge('B', 'C', EdgeKind.Specialization);
        // Following only specialization edges, A cannot reach B.
        expect(g.specializes('A', 'C', new Set([EdgeKind.Specialization]))).toBe(false);
        // Following all edges, it can.
        expect(g.specializes('A', 'C')).toBe(true);
    });

    it('collects all transitive supertypes including itself', () => {
        const g = new SuperTypeGraph();
        g.addEdge('A', 'B', EdgeKind.Specialization);
        g.addEdge('B', 'C', EdgeKind.Specialization);
        const supers = g.collectSupertypes('A');
        expect([...supers].sort()).toEqual(['A', 'B', 'C']);
    });
});

describe('buildSuperTypeGraph — implicit default supertypes', () => {
    it('injects Parts::Part for a part def (e.g. part def Wheel -> Part)', () => {
        const g = buildSuperTypeGraph([sym('Wheel', SysMLElementKind.PartDef)]);
        expect(g.specializes('Wheel', 'Part')).toBe(true);
        const implicitEdge = g.getSupertypeEdges('Wheel')
            .find(e => e.target === 'Part');
        expect(implicitEdge?.kind).toBe(EdgeKind.Implicit);
        expect(implicitEdge?.reference).toBe('Parts::Part');
    });

    it('maps every definition kind to a documented implicit supertype', () => {
        expect(IMPLICIT_DEFINITION_SUPERTYPES.get(SysMLElementKind.PartDef)).toBe('Parts::Part');
        expect(IMPLICIT_DEFINITION_SUPERTYPES.get(SysMLElementKind.ItemDef)).toBe('Items::Item');
        expect(IMPLICIT_DEFINITION_SUPERTYPES.get(SysMLElementKind.ActionDef)).toBe('Actions::Action');
        expect(IMPLICIT_DEFINITION_SUPERTYPES.get(SysMLElementKind.AttributeDef)).toBe('Base::DataValue');
    });

    it('walks user specialization through to the injected library root', () => {
        // part def SportsCar :> Car; part def Car;  =>  SportsCar -> Car -> Part
        const g = buildSuperTypeGraph([
            sym('Car', SysMLElementKind.PartDef),
            sym('SportsCar', SysMLElementKind.PartDef, { typeNames: ['Car'] }),
        ]);
        expect(g.specializes('SportsCar', 'Car')).toBe(true);
        expect(g.specializes('SportsCar', 'Part')).toBe(true);
        expect(g.specializes('SportsCar', 'Item')).toBe(true); // Part :> Item (library root)
    });

    it('does not inject an implicit supertype for usages', () => {
        const g = buildSuperTypeGraph([sym('wheel', SysMLElementKind.PartUsage)]);
        expect(g.specializes('wheel', 'Part')).toBe(false);
    });
});

describe('classifyFamily', () => {
    it('classifies a part def as the occurrence family', () => {
        const g = buildSuperTypeGraph([sym('Wheel', SysMLElementKind.PartDef)]);
        expect(classifyFamily(g, 'Wheel')).toBe(TypeFamily.Occurrence);
    });

    it('classifies an attribute def as the data-value family', () => {
        const g = buildSuperTypeGraph([sym('Mass', SysMLElementKind.AttributeDef)]);
        expect(classifyFamily(g, 'Mass')).toBe(TypeFamily.DataValue);
    });

    it('returns undefined for an unconnected/unknown type', () => {
        const g = buildSuperTypeGraph([]);
        expect(classifyFamily(g, 'Mystery')).toBeUndefined();
    });
});
