import { describe, expect, it } from 'vitest';
import { parseDocument } from '../../server/src/parser/parseDocument.js';
import type { RegistryRelationship } from '../../server/src/symbols/elementRegistry.js';
import { SymbolTable } from '../../server/src/symbols/symbolTable.js';

/** The targets of the relationships in `documents`, as `document:line` of the element each resolves to. */
function targets(documents: Array<{ uri: string; text: string }>) {
    const st = new SymbolTable();
    st.buildAll(documents.map(({ uri, text }) => [uri, parseDocument(text)]));
    const registry = st.getElementRegistry();
    const indexes = st.getIndexes();
    const resolver = st.getResolver();
    const relationshipsAt = (uri: string, line: number, kind?: RegistryRelationship['kind']) => registry.getRelationships()
        .filter(r => r.declarations.some(d => d.uri === uri && d.range.start.line === line) && (!kind || r.kind === kind));
    return {
        /** Where the target of the relationship of `kind` written at `line` of `uri` is declared, if it resolves. */
        at(uri: string, line: number, kind?: RegistryRelationship['kind']): string | undefined {
            const [relationship, ...others] = relationshipsAt(uri, line, kind);
            expect(relationship, `a relationship at ${uri}:${line}`).toBeDefined();
            expect(others, `one relationship at ${uri}:${line}`).toHaveLength(0);
            const { targetId } = resolver.resolveTarget(relationship, indexes);
            const element = targetId === undefined ? undefined : registry.getElement(targetId);
            return element && `${element.declarations[0].uri}:${element.declarations[0].range.start.line}`;
        },
        /** Whether that relationship's target is ambiguous. */
        ambiguousAt(uri: string, line: number, kind?: RegistryRelationship['kind']): boolean {
            return resolver.resolveTarget(relationshipsAt(uri, line, kind)[0], indexes).ambiguous;
        },
    };
}

const doc = (text: string) => ({ uri: 'file:///w/a.sysml', text });
const A = 'file:///w/a.sysml';

describe('relationship targets (SysML 7.2.3, 8.2.3.5)', () => {
    it('resolves SysML Table 4 "Redefinition" to the inherited feature, not a same-named one elsewhere', () => {
        const { at } = targets([doc(`package Redefinition {
    part def Part1;
    part def Part1S :> Part1;
    part def Part2;
    part def Part2R :> Part2;
    part part1 : Part1 [0..*] {
        part part2 : Part2 [0..*];
    }
    part part1S : Part1S [1] :> part1 {
        part part2R : Part2R :>> part2;
        part :>> part2;
    }
    part other {
        part part2 : Part2;
    }
}
`)]);
        expect(at(A, 9, 'redefinition')).toBe(`${A}:6`);
        expect(at(A, 10, 'redefinition')).toBe(`${A}:6`);
        expect(at(A, 9, 'typing')).toBe(`${A}:4`);
        expect(at(A, 8, 'subsetting')).toBe(`${A}:5`);
    });

    it('resolves a typing and a subclassification by name, qualified name and quoted name', () => {
        const { at } = targets([doc(`package P {
    package Q { part def 'Wheel Hub'; part def W; }
    part def S :> Q::W;
    part a : Q::'Wheel Hub';
    part b : S;
}
`)]);
        expect(at(A, 2)).toBe(`${A}:1`);
        expect(at(A, 3)).toBe(`${A}:1`);
        expect(at(A, 4)).toBe(`${A}:2`);
    });

    it('resolves a general named like a package and a definition to the definition, in either order', () => {
        for (const [first, second] of [['package A { part def x; }', 'part def A;'], ['part def A;', 'package A { part def x; }']]) {
            const { at } = targets([doc(`package P {\n    ${first}\n    ${second}\n    part a : A;\n    part def D :> A;\n}\n`)]);
            const definitionLine = first.startsWith('part def') ? 1 : 2;
            expect(at(A, 3)).toBe(`${A}:${definitionLine}`);
            expect(at(A, 4)).toBe(`${A}:${definitionLine}`);
        }
    });

    it('resolves a subsetting\'s feature chain through the features of each feature\'s type', () => {
        const { at } = targets([doc(`package P {
    part def Engine;
    part def Vehicle { part engine : Engine; }
    part v : Vehicle;
    part e :> v.engine;
}
`)]);
        expect(at(A, 4)).toBe(`${A}:2`);
    });

    it('resolves a redefinition owned by a package by the basic resolution (SysML 7.5.1)', () => {
        const { at } = targets([doc('package P {\n    part w;\n    part x :>> w;\n}\n')]);
        expect(at(A, 2)).toBe(`${A}:1`);
    });

    it('resolves a global name in the global namespace, past a local element of that name', () => {
        const { at } = targets([doc(`package G { part def T; }
package P {
    package G { part def T; }
    part a : $::G::T;
    part b : G::T;
}
`)]);
        expect(at(A, 3)).toBe(`${A}:0`);
        expect(at(A, 4)).toBe(`${A}:2`);
    });

    it('resolves a target declared in another document', () => {
        const { at } = targets([
            { uri: 'file:///w/b.sysml', text: 'package Lib { part def E; }\n' },
            doc('package P {\n    private import Lib::*;\n    part e : E;\n}\n'),
        ]);
        expect(at(A, 2)).toBe('file:///w/b.sysml:0');
        expect(at(A, 1, 'import')).toBe('file:///w/b.sysml:0');
    });

    it('gives no target for an unresolved, an ambiguous and a conjugated port typing target', () => {
        const { at, ambiguousAt } = targets([doc(`package P {
    part def A;
    part def A;
    port def Pt;
    part a : A;
    part u : Missing;
    port p : ~Pt;
}
`)]);
        expect(at(A, 4)).toBeUndefined();
        expect(ambiguousAt(A, 4)).toBe(true);
        expect(at(A, 5)).toBeUndefined();
        expect(ambiguousAt(A, 5)).toBe(false);
        expect(at(A, 6)).toBeUndefined();
    });

    it('follows a chain through a feature that only redefines, its name as written or quoted', () => {
        const { at } = targets([doc(`package P {
    part def W { part ib; }
    part def B { part w : W; }
    part def B2 :> B { part x :>> w; part y :>> 'w'; }
    part b : B2;
    part c :> b.x.ib;
    part d :> b.y.ib;
}
`)]);
        expect(at(A, 5)).toBe(`${A}:1`);
        expect(at(A, 6)).toBe(`${A}:1`);
    });

    it('ends a self-referential and a mutually referential chain, leaving it unresolved', () => {
        const { at } = targets([doc(`package P {
    part a :>> a.x;
    part p :>> q.x :> q;
    part q :>> p.y :> p;
}
`)]);
        expect(at(A, 1)).toBeUndefined();
        expect(at(A, 2, 'redefinition')).toBeUndefined();
        expect(at(A, 3, 'redefinition')).toBeUndefined();
    });

    it('resolves a chain repeating a feature through its own type (KerML 8.3.3.3.5)', () => {
        const { at } = targets([doc(`package P {
    part def N { part next : N; attribute val; }
    part n : N;
    part z :> n.next.next.val;
}
`)]);
        expect(at(A, 3)).toBe(`${A}:1`);
    });

    it('resolves through circular specializations the same in every declaration order', () => {
        const declarations = ['part def X :> Y { part a; }', 'part def Y :> X { part b; }', 'part x : X;'];
        const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
        for (const order of orders) {
            const lines = order.map(i => declarations[i]);
            const text = `package P {\n${lines.map(l => `    ${l}`).join('\n')}\n    part u :> x.a;\n    part v :> x.b;\n}\n`;
            const { at } = targets([doc(text)]);
            const lineOf = (i: number) => order.indexOf(i) + 1;
            expect(at(A, 4), `order ${order}`).toBe(`${A}:${lineOf(0)}`);
            expect(at(A, 5), `order ${order}`).toBe(`${A}:${lineOf(1)}`);
        }
    });

    it('never resolves a feature to itself', () => {
        const { at } = targets([doc('package P {\n    part def W { part w; }\n    part def V :> W { part w :>> w; }\n}\n')]);
        expect(at(A, 2, 'redefinition')).toBe(`${A}:1`);
    });
});

/** Every order of `items`. */
function permutations<T>(items: readonly T[]): T[][] {
    if (items.length <= 1) return [[...items]];
    return items.flatMap((item, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map(rest => [item, ...rest]));
}

describe('relationship targets through imports of a namespace whose table is still being computed (KerML 8.2.3.5.1)', () => {
    /** The targets of the typings at `lines` of `documents`, in every order of querying them, each on a fresh table. */
    function inEveryQueryOrder(documents: Array<{ uri: string; text: string }>, lines: Array<[string, number]>): Set<string> {
        const results = new Set<string>();
        for (const order of permutations(lines)) {
            const { at } = targets(documents);
            const found = new Map(order.map(([uri, line]) => [`${uri}:${line}`, at(uri, line, 'typing')]));
            results.add(JSON.stringify(lines.map(([uri, line]) => found.get(`${uri}:${line}`))));
        }
        return results;
    }

    it('resolves a name imported at the top level through a package re-exporting it, in every declaration and query order', () => {
        const declarations = ['package X { part def xm; }', 'package A { public import X::*; part s2 : xm; }', 'private import A::*;', 'part useXm : xm;'];
        for (const order of permutations([0, 1, 2, 3])) {
            const text = order.map(i => declarations[i]).join('\n') + '\n';
            const lineOf = (i: number) => order.indexOf(i);
            const results = inEveryQueryOrder([doc(text)], [[A, lineOf(1)], [A, lineOf(3)]]);
            expect([...results], `order ${order}`).toEqual([JSON.stringify([`${A}:${lineOf(0)}`, `${A}:${lineOf(0)}`])]);
        }
    });

    it('resolves it in every document order and query order when the declarations are in two documents', () => {
        const lib = 'package Lib { part def LibT; }\npackage M { public import Lib::*; part useLib : LibT; }\n';
        const top = 'private import M::*;\npart topC3 : LibT;\n';
        for (const [libUri, topUri] of [['file:///w/a.sysml', 'file:///w/b.sysml'], ['file:///w/b.sysml', 'file:///w/a.sysml']]) {
            const results = inEveryQueryOrder([{ uri: libUri, text: lib }, { uri: topUri, text: top }], [[libUri, 1], [topUri, 1]]);
            expect([...results], `${libUri} ${topUri}`).toEqual([JSON.stringify([`${libUri}:0`, `${libUri}:0`])]);
        }
    });

    it('resolves it through a nested package\'s import of a sibling re-exporting it, in every declaration and query order', () => {
        for (const sFirst of [true, false]) {
            const members = ['    package A { public import X::*; part s : xm; }', '    part u : xm;'];
            const text = ['package T {', '    private import T::A::*;', ...(sFirst ? members : [...members].reverse()), '}', 'package X { part def xm; }', ''].join('\n');
            const [sLine, uLine] = sFirst ? [2, 3] : [3, 2];
            const results = inEveryQueryOrder([doc(text)], [[A, sLine], [A, uLine]]);
            expect([...results], `s first: ${sFirst}`).toEqual([JSON.stringify([`${A}:5`, `${A}:5`])]);
        }
    });

    it('resolves names through mutual public imports in every declaration and query order', () => {
        const declarations = ['package B {\n    public import A::*;\n    public import C::*;\n    part u : a1;\n}', 'package A {\n    public import B::*;\n    part def a1;\n    part w : c1;\n}', 'package C {\n    part def c1;\n}'];
        for (const order of permutations([0, 1, 2])) {
            const blocks = order.map(i => declarations[i]);
            const start = (i: number) => blocks.slice(0, order.indexOf(i)).reduce((lines, block) => lines + block.split('\n').length, 0);
            const text = blocks.join('\n') + '\n';
            const results = inEveryQueryOrder([doc(text)], [[A, start(0) + 3], [A, start(1) + 3]]);
            expect([...results], `order ${order}`).toEqual([JSON.stringify([`${A}:${start(1) + 2}`, `${A}:${start(2) + 1}`])]);
        }
    });
});

describe('relationship targets of a type specializing itself (KerML 8.2.3.5.1, 8.2.3.5.2)', () => {
    it('resolves a definition specializing itself to itself, and a nested one of the outer\'s name to the nested one', () => {
        const { at } = targets([doc('package O {\n    part def S :> S;\n    part def A {\n        part def A :> A;\n    }\n}\n')]);
        expect(at(A, 1)).toBe(`${A}:1`);
        expect(at(A, 3)).toBe(`${A}:3`);
    });

    it('resolves a feature subsetting its own name in its owning type to itself, as the basic resolution does', () => {
        const { at } = targets([doc('package O {\n    part x;\n    part def D {\n        part x :> x;\n    }\n}\n')]);
        expect(at(A, 3)).toBe(`${A}:3`);
    });

    it('still resolves a usage named after its reference to the feature it references, never to itself', () => {
        const { at } = targets([doc('package O {\n    action a;\n    part p {\n        perform a;\n    }\n}\n')]);
        expect(at(A, 3)).toBe(`${A}:1`);
    });
});

describe('relationship targets on the corpus', () => {
    it('resolves every relationship of the standard library, examples and fixtures to an element, never a type to a package', async () => {
        const { readdirSync, readFileSync } = await import('fs');
        const { join, resolve } = await import('path');
        const { pathToFileURL } = await import('url');
        const { SysMLElementKind } = await import('../../server/src/symbols/sysmlElements.js');
        const root = resolve(__dirname, '..', '..');
        const files = ['sysml.library', 'examples', join('test', 'fixtures', 'valid')].flatMap(dir =>
            readdirSync(join(root, dir), { withFileTypes: true, recursive: true })
                .filter(entry => entry.isFile() && /\.(sysml|kerml)$/.test(entry.name))
                .map(entry => join(entry.parentPath, entry.name)));
        const st = new SymbolTable();
        st.buildAll(files.map(file => [pathToFileURL(file).href, parseDocument(readFileSync(file, 'utf8'))]));
        const registry = st.getElementRegistry();
        const indexes = st.getIndexes();
        const resolver = st.getResolver();
        let resolved = 0;
        for (const relationship of registry.getRelationships()) {
            const { targetId } = resolver.resolveTarget(relationship, indexes);
            if (targetId === undefined) continue;
            resolved++;
            const target = registry.getElement(targetId);
            expect(target, relationship.target).toBeDefined();
            if (relationship.kind === 'typing' || relationship.kind === 'specializes') {
                expect(target!.kind, `${relationship.kind} ${relationship.target}`).not.toBe(SysMLElementKind.Package);
            }
        }
        expect(resolved).toBeGreaterThan(registry.getRelationships().length / 2);
    }, 300_000);
});

describe('sysml/model from the element registry', () => {
    /** `sysml/model`'s elements of `uri` in a workspace of `documents`. */
    async function modelOf(documents: Array<{ uri: string; text: string }>, uri: string) {
        const { DocumentManager } = await import('../../server/src/documentManager.js');
        const { SysMLModelProvider } = await import('../../server/src/model/sysmlModelProvider.js');
        const { TextDocument } = await import('vscode-languageserver-textdocument');
        const dm = new DocumentManager();
        for (const d of documents) dm.parse(TextDocument.create(d.uri, 'sysml', 1, d.text));
        return new SysMLModelProvider(dm).getModel(uri, 1, ['elements', 'relationships']);
    }

    it('reports the element a specialization targets by its ID, the inherited feature of SysML Table 4 "Redefinition" among them', async () => {
        const model = await modelOf([{ uri: A, text: `package R {
    part def Part1;
    part part1 : Part1 { part part2; }
    part part1S :> part1 { part part2R :>> part2; }
    part other { part part2; }
}
` }], A);
        const r = model.elements![0];
        const [part1, part1S] = [r.children[1], r.children[2]];
        const redefinition = part1S.children[0].relationships.find(rel => rel.type === 'redefinition')!;
        expect(redefinition.target).toBe('part2');
        expect(redefinition.targetId).toBe(part1.children[0].symbolId);
        expect(part1.relationships.find(rel => rel.type === 'typing')!.targetId).toBe(r.children[0].symbolId);
        expect(model.relationships!.find(rel => rel.type === 'redefinition')!.targetId).toBe(part1.children[0].symbolId);
    });

    it('gives every node of a package declared in two documents its one symbol ID and its declarations', async () => {
        const documents = [
            { uri: 'file:///w/a.sysml', text: 'package P { part def E; }\n' },
            { uri: 'file:///w/b.sysml', text: 'package P { part e : E; }\n' },
        ];
        const [a, b] = await Promise.all(documents.map(d => modelOf(documents, d.uri)));
        const [pa, pb] = [a.elements![0], b.elements![0]];
        expect(pa.symbolId).toBe(pb.symbolId);
        expect(pa.declarations!.map(d => d.uri)).toEqual(['file:///w/a.sysml', 'file:///w/b.sysml']);
        expect(pb.declarations).toEqual(pa.declarations);
        // An element declared once has no declarations of its own to list.
        expect(pa.children[0].declarations).toBeUndefined();
        // Its members are owned by it, whichever document declares them.
        expect(pb.children[0].relationships[0].targetId).toBe(pa.children[0].symbolId);
    });
});
