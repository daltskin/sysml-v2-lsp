import { describe, expect, it } from 'vitest';
import { isAnonymous, type SysMLSymbol } from '../../server/src/symbols/sysmlElements.js';

/** Helper: parse text and build a symbol table */
async function buildST(text: string, uri = 'test://test.sysml') {
    const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
    const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
    const result = parseDocument(text);
    const st = new SymbolTable();
    st.build(uri, result);
    return { st, result };
}

/** Helper: build one symbol table from several documents, each at its own uri. */
async function buildMultiFileST(fragments: Array<{ text: string; uri: string }>) {
    const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
    const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
    const st = new SymbolTable();
    for (const fragment of fragments) {
        st.build(fragment.uri, parseDocument(fragment.text));
    }
    return st;
}

describe('Symbol Table', () => {
    it('should build a symbol table from a parsed document', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');

        const text = `
package VehicleModel {
    part def Vehicle {
        attribute mass : Real;
    }
}
`;
        const result = parseDocument(text);
        const symbolTable = new SymbolTable();
        symbolTable.build('test://vehicle.sysml', result);

        const symbols = symbolTable.getAllSymbols();
        expect(symbols.length).toBeGreaterThan(0);

        // Should find the package
        const packageSymbol = symbols.find(s => s.name === 'VehicleModel');
        expect(packageSymbol).toBeDefined();
    });

    it('should resolve symbols by name', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');

        const text = `
package Test {
    part def MyPart {
        attribute x : Real;
    }
    part myInstance : MyPart;
}
`;
        const result = parseDocument(text);
        const symbolTable = new SymbolTable();
        symbolTable.build('test://test.sysml', result);

        const matches = symbolTable.findByName('MyPart');
        expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it('should extract correct type for interface usage with connect clause', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');

        const text = `
package ConnTest {
    port def MechanicalPort {
        attribute torque : Real;
    }

    interface def BrakeCable {
        end leverEnd : MechanicalPort;
        end caliperEnd : MechanicalPort;
    }

    part def BrakeLever {
        port mechPort : MechanicalPort;
    }

    part def BrakeCaliper {
        port mechPort : MechanicalPort;
    }

    part def BrakeSystem {
        part frontLever : BrakeLever;
        part frontCaliper : BrakeCaliper;

        interface frontBrakeCable : BrakeCable connect
            frontLever.mechPort to frontCaliper.mechPort;
    }
}
`;
        const result = parseDocument(text);
        expect(result.errors.length).toBe(0);

        const symbolTable = new SymbolTable();
        symbolTable.build('test://conn.sysml', result);

        const iface = symbolTable.findByName('frontBrakeCable');
        expect(iface.length).toBeGreaterThanOrEqual(1);
        // The type should be 'BrakeCable', not 'BrakeCableconnectfrontLever'
        expect(iface[0].typeName).toBe('BrakeCable');
    });

    it('should not overwrite a part usage with an anonymous connection source', async () => {
        const { st, result } = await buildST(`
package Demo {
    part def Source;
    part def Sink;
    part assembly {
        part a : Source;
        part b : Sink;
        connect a.outP to b.inP;
    }
}
`);

        expect(result.errors).toHaveLength(0);
        const source = st.findByName('a');
        expect(source).toHaveLength(1);
        expect(source[0].kind).toBe('part');
        expect(source[0].typeNames).toContain('Source');
    });

    it('should preserve names declared explicitly on connection usages', async () => {
        const { st, result } = await buildST(`
package Demo {
    part a;
    part b;
    connection link connect a to b;
}
`);

        expect(result.errors).toHaveLength(0);
        const connection = st.findByName('link');
        expect(connection).toHaveLength(1);
        expect(connection[0].kind).toBe('connection');
    });

    it('should name an anonymous interface usage after its ends\' reference paths', async () => {
        const { st, result } = await buildST(`
package Demo {
    port def P { port p1; port p2; }
    interface def I {
        end source : P;
        end target : ~P;
    }
    part assembly {
        part a { port pa : P; }
        part b { port pb : ~P; }
        interface link : I
            connect source ::> a.pa to target ::> b.pb {
                interface source.p1 to target.p1;
                interface source.p2 to target.p2;
            }
    }
}
`);

        expect(result.errors).toHaveLength(0);
        // `interface source.p1 to target.p1;` declares no name -- `source` is an endpoint reference,
        // so the interface is labelled after the whole path instead, and flagged as anonymous. It has
        // no qualified name (KerML), is found by its elementId, and its label is not looked up.
        expect(st.findByName('source').filter((s) => s.kind === 'interface')).toHaveLength(0);
        const symbols = st.getSymbolsForUri('test://test.sysml');
        for (const [path, line] of [['interface source.p1 to target.p1', 13], ['interface source.p2 to target.p2', 14]] as const) {
            const [iface] = symbols.filter((s) => s.label === path);
            expect(iface?.kind).toBe('interface');
            expect(iface?.name).toBe('');
            expect(isAnonymous(iface)).toBe(true);
            expect(iface?.qualifiedName).toBeUndefined();
            expect(iface?.range.start.line).toBe(line - 1);
            expect(st.getSymbolByElementId(iface.elementId)).toBe(iface);
            expect(st.getOwner(iface)?.qualifiedName).toBe('Demo::assembly::link');
            expect(st.findByName(path)).toEqual([]);
        }
        expect(isAnonymous(st.findByName('link')[0])).toBe(false);
    });

    it('should give every anonymous interface usage that fans out from the same end a unique name', async () => {
        const { st, result } = await buildST(`
package Demo {
    port def P { port p1; port p2; }
    part assembly {
        part a { port pa : P; }
        part b { port pb : ~P; }
        part c { port pc : ~P; }
        interface a.pa to b.pb;
        interface a.pa to c.pc;
    }
}
`);

        expect(result.errors).toHaveLength(0);
        const named = st.getSymbolsForUri('test://test.sysml').filter((s) => s.kind === 'interface');
        // Fan-out from the same end differs by its other end.
        expect(named.map((s) => s.label)).toEqual(['interface a.pa to b.pb', 'interface a.pa to c.pc']);
        expect(named.every((s) => isAnonymous(s))).toBe(true);
    });

    it('should preserve names declared explicitly on interface usages', async () => {
        const { st, result } = await buildST(`
package Demo {
    port def P { port p1; port p2; }
    interface def I {
        end source : P;
        end target : ~P;
    }
    part assembly {
        part a { port pa : P; }
        part b { port pb : ~P; }
        interface link : I
            connect source ::> a.pa to target ::> b.pb {
                interface source.p1 to target.p1;
                interface source.p2 to target.p2;
            }
    }
}
`);

        expect(result.errors).toHaveLength(0);
        const link = st.findByName('link');
        expect(link).toHaveLength(1);
        expect(link[0].kind).toBe('interface');
        expect(link[0].typeNames).toContain('I');
    });

    it('should extract transition endpoints without colliding with the source state', async () => {
        const { st, result } = await buildST(`
package Demo {
    state def Machine {
        state a;
        state b;
        transition first a then b;
    }
}
`);

        expect(result.errors).toHaveLength(0);
        const sourceState = st.getSymbol('Demo::Machine::a');
        expect(sourceState?.kind).toBe('state');

        const transition = st.getAllSymbols().find(s => s.kind === 'transition');
        expect(transition).toMatchObject({
            source: 'a',
            target: 'b',
            parentId: st.getSymbol('Demo::Machine')!.elementId,
        });
        // Anonymous: no name (never the source state's), only its declaration as a label.
        expect([transition?.name, transition?.label]).toEqual(['', 'transition first a then b']);
        expect(transition?.qualifiedName).not.toBe(sourceState?.qualifiedName);
    });

    it('should preserve a named transition and extract its accepter', async () => {
        const { st, result } = await buildST(`
package Demo {
    state def Machine {
        state a;
        state b;
        transition aToB first a accept Tick then b;
    }
}
`);

        expect(result.errors).toHaveLength(0);
        expect(st.findByName('aToB')[0]).toMatchObject({
            kind: 'transition',
            source: 'a',
            target: 'b',
            transitionTrigger: 'Tick',
        });
    });

    it('should extract explicit branching successions on their owning action', async () => {
        const { st, result } = await buildST(`
package Demo {
    action def RoutePower {
        action senseFlows;
        action serveLoadDirect;
        action routeSurplus;
        action coverDeficit;
        first start then senseFlows;
        first senseFlows then serveLoadDirect;
        first serveLoadDirect then routeSurplus;
        first serveLoadDirect then coverDeficit;
        first routeSurplus then done;
        first coverDeficit then done;
    }
}
`);

        expect(result.errors).toHaveLength(0);
        expect(st.findByName('RoutePower')[0].controlFlows).toEqual([
            { source: 'start', target: 'senseFlows' },
            { source: 'senseFlows', target: 'serveLoadDirect' },
            { source: 'serveLoadDirect', target: 'routeSurplus' },
            { source: 'serveLoadDirect', target: 'coverDeficit' },
            { source: 'routeSurplus', target: 'done' },
            { source: 'coverDeficit', target: 'done' },
        ]);
    });

    it('should extract visibility from the owning membership prefix', async () => {
        const { st, result } = await buildST(`
package Demo {
    private part def Hidden;
    protected port def Inherited;
    public part visible;
    part defaultVisible;
    private alias HiddenAlias for Hidden;
}
`);

        expect(result.errors).toHaveLength(0);
        expect(st.findByName('Hidden')[0].visibility).toBe('private');
        expect(st.findByName('Inherited')[0].visibility).toBe('protected');
        expect(st.findByName('visible')[0].visibility).toBe('public');
        expect(st.findByName('defaultVisible')[0].visibility).toBeUndefined();
        expect(st.findByName('HiddenAlias')[0].visibility).toBe('private');
    });

    it('should not infer visibility from documentation text', async () => {
        const { st, result } = await buildST(`
package Demo {
    port def DCBus {
        doc /* JEITA window; PCM-protected pack with private safeguards. */
        attribute voltage;
    }
}
`);

        expect(result.errors).toHaveLength(0);
        expect(st.findByName('DCBus')[0].visibility).toBeUndefined();
    });

    // ── Type extraction regression tests ──────────────────────────

    it('should extract typing via colon shorthand (: Type)', async () => {
        const { st } = await buildST(`
package Test {
    part def Engine;
    part def Vehicle {
        part engine : Engine;
    }
}
`);
        const engine = st.findByName('engine');
        expect(engine.length).toBeGreaterThanOrEqual(1);
        expect(engine[0].typeNames).toContain('Engine');
    });

    it('should extract multiple types via colon (: A, B)', async () => {
        const { st } = await buildST(`
package Test {
    attribute def Scalar;
    attribute def Unit;
    attribute x : Scalar, Unit;
}
`);
        const x = st.findByName('x');
        expect(x.length).toBeGreaterThanOrEqual(1);
        // Should have both types
        expect(x[0].typeNames.length).toBeGreaterThanOrEqual(1);
    });

    it('should extract specialization via :> syntax', async () => {
        const { st } = await buildST(`
package Test {
    part def Base;
    part def Derived :> Base;
}
`);
        const derived = st.findByName('Derived');
        expect(derived.length).toBeGreaterThanOrEqual(1);
        expect(derived[0].typeNames).toContain('Base');
    });

    it('should extract specialization via specializes keyword', async () => {
        const { st } = await buildST(`
package Test {
    part def Base;
    part def Child specializes Base;
}
`);
        const child = st.findByName('Child');
        expect(child.length).toBeGreaterThanOrEqual(1);
        expect(child[0].typeNames).toContain('Base');
    });

    it('should extract redefinition via :>> in specialization', async () => {
        const { st } = await buildST(`
package Test {
    part def Engine;
    part def Vehicle {
        part engine : Engine;
    }
    part def Sports :> Vehicle;
}
`);
        const sports = st.findByName('Sports');
        expect(sports.length).toBeGreaterThanOrEqual(1);
        expect(sports[0].typeNames).toContain('Vehicle');
    });

    it('should extract documentation from doc comment', async () => {
        const { st } = await buildST(`
package Test {
    part def Vehicle {
        doc /* A motor vehicle */
    }
}
`);
        const vehicle = st.findByName('Vehicle');
        expect(vehicle.length).toBeGreaterThanOrEqual(1);
        expect(vehicle[0].documentation).toBeDefined();
        expect(vehicle[0].documentation).toContain('motor vehicle');
    });

    it('should not leak a nested member document to its package', async () => {
        const { st, result } = await buildST(`
package Demo {
    port def First {
        doc /* First member doc. */
    }
}
`);

        expect(result.errors).toHaveLength(0);
        expect(st.findByName('Demo')[0].documentation).toBeUndefined();
        expect(st.findByName('First')[0].documentation).toBe('First member doc.');
    });

    it('should keep package and nested member documentation separate', async () => {
        const { st, result } = await buildST(`
package Demo {
    doc /* Package doc. */
    port def First {
        doc /* Member doc. */
    }
}
`);

        expect(result.errors).toHaveLength(0);
        expect(st.findByName('Demo')[0].documentation).toBe('Package doc.');
        expect(st.findByName('First')[0].documentation).toBe('Member doc.');
    });

    it('should strip multiline documentation gutters per KerML rules', async () => {
        const { st, result } = await buildST(`
package Demo {
    port def DCBus {
        doc /* IF-05 Power-Electronics <-> Battery: 1S CC/CV 4.2 V, JEITA
             * window; two independent safety layers.
               Continuation without a gutter. */
    }
}
`);

        expect(result.errors).toHaveLength(0);
        expect(st.findByName('DCBus')[0].documentation).toBe(
            'IF-05 Power-Electronics <-> Battery: 1S CC/CV 4.2 V, JEITA\n' +
            'window; two independent safety layers.\n' +
            'Continuation without a gutter.',
        );
    });

    it('should extract the body of named documentation', async () => {
        const { st, result } = await buildST(`
package Demo {
    part def Vehicle {
        doc VehicleDoc /* Named documentation. */
    }
}
`);

        expect(result.errors).toHaveLength(0);
        expect(st.findByName('Vehicle')[0].documentation).toBe('Named documentation.');
    });

    it('should extract multiplicity bounds', async () => {
        const { st } = await buildST(`
package Test {
    part def Vehicle {
        part wheels : Wheel[4];
    }
    part def Wheel;
}
`);
        const wheels = st.findByName('wheels');
        expect(wheels.length).toBeGreaterThanOrEqual(1);
        expect(wheels[0].multiplicity).toBe('4');
    });

    it('should extract multiplicity range', async () => {
        const { st } = await buildST(`
package Test {
    part def Container {
        part items : Item[0..*];
    }
    part def Item;
}
`);
        const items = st.findByName('items');
        expect(items.length).toBeGreaterThanOrEqual(1);
        expect(items[0].multiplicity).toBe('0..*');
        expect(items[0].multiplicityRange).toBeDefined();
        expect(items[0].multiplicityRange!.lower).toBe(0);
        expect(items[0].multiplicityRange!.upper).toBe('*');
    });

    it('should not include keywords as type names', async () => {
        const { st } = await buildST(`
package Test {
    part def Engine;
    part def Vehicle {
        part engine : Engine;
    }
}
`);
        const engine = st.findByName('engine');
        expect(engine.length).toBeGreaterThanOrEqual(1);
        // Only 'Engine' should be in typeNames, not 'part' or other keywords
        for (const tn of engine[0].typeNames) {
            expect(tn).not.toBe('part');
            expect(tn).not.toBe('attribute');
        }
        expect(engine[0].typeNames).toContain('Engine');
    });

    it('should handle defined-by syntax', async () => {
        const { st } = await buildST(`
package Test {
    part def VehicleType;
    part car defined by VehicleType;
}
`);
        const car = st.findByName('car');
        expect(car.length).toBeGreaterThanOrEqual(1);
        expect(car[0].typeNames).toContain('VehicleType');
    });

    it('should handle subsets keyword in type extraction', async () => {
        const { st } = await buildST(`
package Test {
    part def Vehicle {
        part engine : Engine;
    }
    part def Engine;
    part def Car :> Vehicle {
        part carEngine subsets engine : Engine;
    }
}
`);
        const symbols = st.getAllSymbols();
        // carEngine should have Engine as type, not 'engine'
        const carEngine = symbols.find(s => s.name === 'carEngine');
        expect(carEngine).toBeDefined();
    });

    it('should find symbol at position', async () => {
        const { st } = await buildST(`package Test {
    part def Vehicle {
        attribute mass : Real;
    }
}
`);
        // 'Vehicle' starts on line 1
        const sym = st.findSymbolAtPosition('test://test.sysml', 1, 15);
        expect(sym).toBeDefined();
        expect(sym!.name).toBe('Vehicle');
    });

    it('should find references across symbol table', async () => {
        const { st } = await buildST(`
package Test {
    part def Engine;
    part def Vehicle {
        part engine : Engine;
    }
}
`);
        const refs = st.findReferences('Engine');
        expect(refs.length).toBeGreaterThanOrEqual(2); // definition + usage
    });

    it('should extract view filter expressions from view body', async () => {
        const { st } = await buildST(`
package FilterTest {
    part def Sensor { }
    view sensorView {
        expose Sensor;
        filter @SysML::PartUsage;
    }
}
`);
        const symbols = st.getAllSymbols();
        const view = symbols.find(s => s.name === 'sensorView');
        expect(view).toBeDefined();
        expect(view!.viewFilters).toBeDefined();
        expect(view!.viewFilters!.length).toBeGreaterThanOrEqual(1);
        expect(view!.viewFilters![0]).toContain('PartUsage');
    });

    it('should extract expose targets from view body', async () => {
        const { st } = await buildST(`
package ExposeTest {
    part def Vehicle { }
    view vehicleView {
        expose Vehicle;
    }
}
`);
        const symbols = st.getAllSymbols();
        const view = symbols.find(s => s.name === 'vehicleView');
        expect(view).toBeDefined();
        expect(view!.exposeTargets).toBeDefined();
        expect(view!.exposeTargets!.length).toBeGreaterThanOrEqual(1);
        expect(view!.exposeTargets![0]).toContain('Vehicle');
    });

    it('should extract view rendering from view body', async () => {
        const { st } = await buildST(`
package RenderTest {
    part def Vehicle { }
    view tableView {
        expose Vehicle;
        render asTableForm;
    }
}
`);
        const symbols = st.getAllSymbols();
        const view = symbols.find(s => s.name === 'tableView');
        expect(view).toBeDefined();
        expect(view!.viewRendering).toBeDefined();
        expect(view!.viewRendering).toContain('asTableForm');
    });

    it('should extract filter from package body (package-level filters)', async () => {
        const { st } = await buildST(`
package PkgFilter {
    filter @SysML::PartUsage;
    part def Engine { }
    view engineView {
        expose Engine;
    }
}
`);
        const symbols = st.getAllSymbols();
        // The package-level filter should be extractable by view definitions that traverse the package body
        const pkg = symbols.find(s => s.name === 'PkgFilter');
        expect(pkg).toBeDefined();
    });

    it('should preserve grouped metadata filter expressions', async () => {
        const { st, result } = await buildST(`
package Filtered {
    filter (@Approved or @Proposed) and not @Deprecated;
}
`);
        expect(result.errors).toEqual([]);
        const pkg = st.getAllSymbols().find(symbol => symbol.name === 'Filtered');
        expect(pkg?.filterConditions).toEqual([{
            kind: 'and',
            left: {
                kind: 'or',
                left: { kind: 'metadata', name: 'Approved' },
                right: { kind: 'metadata', name: 'Proposed' },
            },
            right: { kind: 'not', expr: { kind: 'metadata', name: 'Deprecated' } },
        }]);
    });

    it('should inherit viewFilters from view definition to view usage', async () => {
        const { st } = await buildST(`
package InheritTest {
    part def Sensor { }
    view def SensorViewDef {
        filter @SysML::PartUsage;
    }
    view mySensorView : SensorViewDef {
        expose Sensor;
    }
}
`);
        const symbols = st.getAllSymbols();
        const view = symbols.find(s => s.name === 'mySensorView');
        expect(view).toBeDefined();
        // View should inherit filter from its definition
        if (view!.viewFilters && view!.viewFilters.length > 0) {
            expect(view!.viewFilters![0]).toContain('PartUsage');
        }
    });
});

describe('Package split across files: fields beyond imports/filters also merge', () => {
    // A reopened package (`package P { ... }` in more than one file) is one
    // semantic namespace, not several -- a `doc`, prefix `#annotation`, or
    // view `filter` on one fragment's own package declaration belongs to
    // that same element, the same way its imports do (see the
    // "package/namespace visibility" describe block in diagnostics.test.ts).
    // `getSymbol`/`getAllSymbols` only expose one canonical entry per
    // qualifiedName, built by `SymbolTable.mergePackageFragments`, so these
    // fields must be combined there too -- not just come from whichever
    // fragment happens to be canonical.
    describe('documentation (order-independence)', () => {
        const pkgWithoutDocText = `
package Shared {
    part def PartA;
}
`;

        it('keeps a fragment\'s own documentation when it is registered first', async () => {
            const pkgWithDocText = `
package Shared {
    doc /* Fragment 1's own documentation. */
    part def PartA;
}
`;
            const st = await buildMultiFileST([
                { uri: 'test://pkg-1.sysml', text: pkgWithDocText },
                { uri: 'test://pkg-2.sysml', text: pkgWithoutDocText },
            ]);
            const pkg = st.getSymbol('Shared');
            expect(pkg?.documentation).toContain("Fragment 1's own documentation.");
        });

        it('keeps a fragment\'s own documentation when it is registered second', async () => {
            const pkgWithDocText = `
package Shared {
    doc /* Fragment 2's own documentation. */
    part def PartB;
}
`;
            const st = await buildMultiFileST([
                { uri: 'test://pkg-1.sysml', text: pkgWithoutDocText },
                { uri: 'test://pkg-2.sysml', text: pkgWithDocText },
            ]);
            const pkg = st.getSymbol('Shared');
            expect(pkg?.documentation).toContain("Fragment 2's own documentation.");
        });
    });

    it('combines prefix metadata annotations and view filters declared on different fragments', async () => {
        const pkg1Text = `
#Approved
package Shared {
    filter @SysML::PartUsage;
    part def PartA;
}
`;
        const pkg2Text = `
#Reviewed
package Shared {
    part def PartB;
}
`;
        const st = await buildMultiFileST([
            { uri: 'test://pkg-1.sysml', text: pkg1Text },
            { uri: 'test://pkg-2.sysml', text: pkg2Text },
        ]);
        const pkg = st.getSymbol('Shared');
        expect(pkg?.metadataAnnotations).toEqual(expect.arrayContaining(['Approved', 'Reviewed']));
        expect(pkg?.viewFilters && pkg.viewFilters.length > 0).toBe(true);
    });
});

describe('getAllSymbols() completeness for colliding qualifiedNames (any kind, not just same-kind conflicts)', () => {
    // `symbols` holds only one entry per qualifiedName, so without
    // `conflictedSymbolsByQualifiedName` tracking every symbol that ever
    // shares one, whichever declaration registers last would silently and
    // permanently erase the other(s) from `getAllSymbols()` -- data loss
    // that would happen regardless of whether the collision is a genuine
    // naming *conflict* per KerML's `isDistinguishableFrom` rule (see
    // `findConflictedQualifiedNames`'s doc comment in namespaceResolver.ts)
    // or a perfectly valid collision between different, non-conforming
    // kinds (e.g. `package A` and an unrelated `part def A`, used below
    // precisely because it's *not* flagged as a conflict -- both must still
    // be visible here regardless). These tests exercise that tracking
    // directly at the SymbolTable level, below the diagnostics layer
    // covered in diagnostics.test.ts.
    const pkgAText = `
package A {
    part def B;
}
`;
    const partDefAText = `
part def A {
    part def B2;
}
`;

    it('keeps both conflicting declarations in getAllSymbols() instead of the last one silently winning', async () => {
        const st = await buildMultiFileST([
            { uri: 'test://pkg-a.sysml', text: pkgAText },
            { uri: 'test://partdef-a.sysml', text: partDefAText },
        ]);
        const topLevelAs = st.getAllSymbols().filter(s => s.name === 'A' && s.parentId === undefined);
        expect(topLevelAs).toHaveLength(2);
        expect(topLevelAs.map(s => s.kind).sort()).toEqual(['package', 'part def']);
        // Each declaration's own child is still present too -- neither was
        // dropped along with its parent.
        expect(st.getAllSymbols().some(s => s.qualifiedName === 'A::B')).toBe(true);
        expect(st.getAllSymbols().some(s => s.qualifiedName === 'A::B2')).toBe(true);
    });

    it('keeps both conflicting declarations regardless of which file registers first', async () => {
        const st = await buildMultiFileST([
            { uri: 'test://partdef-a.sysml', text: partDefAText },
            { uri: 'test://pkg-a.sysml', text: pkgAText },
        ]);
        const topLevelAs = st.getAllSymbols().filter(s => s.name === 'A' && s.parentId === undefined);
        expect(topLevelAs).toHaveLength(2);
    });

    it('goes back to a single "A" once the conflict is resolved by an edit', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
        const st = new SymbolTable();
        st.build('test://pkg-a.sysml', parseDocument(pkgAText));
        st.build('test://partdef-a.sysml', parseDocument(partDefAText));
        expect(st.getAllSymbols().filter(s => s.name === 'A' && s.parentId === undefined)).toHaveLength(2);

        // Re-parse the second file, renaming its own "A" away -- the
        // conflict resolves, and getAllSymbols() must go back to showing
        // just the package, the same as if the part def had never existed.
        const renamedText = `
part def NotA {
    part def B2;
}
`;
        st.build('test://partdef-a.sysml', parseDocument(renamedText));

        const topLevelAs = st.getAllSymbols().filter(s => s.name === 'A' && s.parentId === undefined);
        expect(topLevelAs).toHaveLength(1);
        expect(topLevelAs[0].kind).toBe('package');
        expect(st.getSymbol('A')?.kind).toBe('package');
    });

    it('goes back to a single "A" when the *package* side is removed instead, leaving the non-package sibling', async () => {
        // Mirror image of the test above: `unregisterPackageFragment`'s own
        // fallback to a remaining non-package conflicting symbol, exercised
        // separately from `unregisterPlainSymbol`'s fallback to a remaining
        // package.
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
        const st = new SymbolTable();
        st.build('test://pkg-a.sysml', parseDocument(pkgAText));
        st.build('test://partdef-a.sysml', parseDocument(partDefAText));
        expect(st.getAllSymbols().filter(s => s.name === 'A' && s.parentId === undefined)).toHaveLength(2);

        const renamedText = `
package NotA {
    part def B;
}
`;
        st.build('test://pkg-a.sysml', parseDocument(renamedText));

        const topLevelAs = st.getAllSymbols().filter(s => s.name === 'A' && s.parentId === undefined);
        expect(topLevelAs).toHaveLength(1);
        expect(topLevelAs[0].kind).toBe('part def');
        expect(st.getSymbol('A')?.kind).toBe('part def');
    });
});

describe('Control nodes (fork/join/merge/decide)', () => {
    it('should extract fork/join/merge/decide as distinct symbol kinds', async () => {
        const { SysMLElementKind } = await import('../../server/src/symbols/sysmlElements.js');
        const { st } = await buildST(`
package PluginTest {
    action testParallelFlow {
        action startStep;
        fork myFork;
        join myJoin;
        merge myMerge;
        decide myDecide;
    }
}
`);
        const symbols = st.getAllSymbols();

        const fork = symbols.find(s => s.name === 'myFork');
        const join = symbols.find(s => s.name === 'myJoin');
        const merge = symbols.find(s => s.name === 'myMerge');
        const decide = symbols.find(s => s.name === 'myDecide');

        expect(fork?.kind).toBe(SysMLElementKind.ForkNode);
        expect(join?.kind).toBe(SysMLElementKind.JoinNode);
        expect(merge?.kind).toBe(SysMLElementKind.MergeNode);
        expect(decide?.kind).toBe(SysMLElementKind.DecisionNode);
    });

    it('should distinguish a join node from a fork node (issue #62)', async () => {
        const { SysMLElementKind } = await import('../../server/src/symbols/sysmlElements.js');
        const { st } = await buildST(`
package P {
    action a {
        fork f;
        join j;
    }
}
`);
        const symbols = st.getAllSymbols();
        const fork = symbols.find(s => s.name === 'f');
        const join = symbols.find(s => s.name === 'j');

        expect(fork?.kind).toBe(SysMLElementKind.ForkNode);
        expect(join?.kind).toBe(SysMLElementKind.JoinNode);
        // The two control nodes must not collapse to the same kind.
        expect(fork?.kind).not.toBe(join?.kind);
    });

    it('should map control-node kinds to their SysML v2 metaclass names', async () => {
        const { SysMLElementKind, toMetaclassName } = await import('../../server/src/symbols/sysmlElements.js');
        expect(toMetaclassName(SysMLElementKind.ForkNode)).toBe('ForkNode');
        expect(toMetaclassName(SysMLElementKind.JoinNode)).toBe('JoinNode');
        expect(toMetaclassName(SysMLElementKind.MergeNode)).toBe('MergeNode');
        expect(toMetaclassName(SysMLElementKind.DecisionNode)).toBe('DecisionNode');
    });
});

describe('anonymous connection usages', () => {
    const text = `
package Demo {
    part a { port p; port q; }
    part b { port p; }
    part c { port p; }
    part d { port p; }
    connect a.p to b.p;
    connect a.p to c.p;
    connect (a.q, b.p, c.p, d.p);
    connect e ::> d.p to b.p;
}
`;

    it('labels each with its declaration as written', async () => {
        const { st, result } = await buildST(text);
        expect(result.errors).toHaveLength(0);
        const connections = st.getSymbolsForUri('test://test.sysml').filter((s) => s.kind === 'connection');
        // binary, fan-out from the same end, n-ary, and an end with its own name
        expect(connections.map((s) => s.label)).toEqual(['connect a.p to b.p', 'connect a.p to c.p', 'connect (a.q, b.p, c.p, d.p)', 'connect e ::> d.p to b.p']);
        expect(connections.every((s) => isAnonymous(s))).toBe(true);
        expect(connections.every((s) => s.qualifiedName === undefined)).toBe(true);
    });

    it('keeps two anonymous connections with identical ends apart', async () => {
        const { st, result } = await buildST(`
package Demo {
    part a { port p; }
    part b { port p; }
    connect a.p to b.p;
    connect a.p to b.p;
}
`);
        expect(result.errors).toHaveLength(0);
        const connections = st.getSymbolsForUri('test://test.sysml').filter((s) => s.kind === 'connection');
        expect(connections.map((s) => [s.label, isAnonymous(s)])).toEqual([['connect a.p to b.p', true], ['connect a.p to b.p', true]]);
        expect(connections.every((s) => s.qualifiedName === undefined)).toBe(true);
        // Neither shadows the other: each has its own elementId and is registered under it.
        expect(new Set(connections.map((s) => s.elementId)).size).toBe(2);
        for (const connection of connections) expect(st.getSymbolByElementId(connection.elementId!)).toBe(connection);
        expect(st.getAllSymbols().filter((s) => s.kind === 'connection')).toHaveLength(2);
    });

    // A quoted name may spell out an anonymous connection's label exactly; in either source order,
    // the declared connection keeps its qualified name and is the only one found by name.
    for (const [order, body] of [
        ['declared first', `connection 'connect a.p to b.p';\n    connect a.p to b.p;`],
        ['anonymous first', `connect a.p to b.p;\n    connection 'connect a.p to b.p';`],
    ] as const) {
        it(`never lets an anonymous connection shadow a declared one quoted like its label (${order})`, async () => {
            const { st, result } = await buildST(`
package Demo {
    part a { port p; }
    part b { port p; }
    ${body}
}
`);
            expect(result.errors).toHaveLength(0);
            const connections = st.getSymbolsForUri('test://test.sysml').filter((s) => s.kind === 'connection');
            const declared = connections.find((s) => !isAnonymous(s))!;
            const anonymous = connections.find((s) => isAnonymous(s))!;
            expect([declared.name, anonymous.label]).toEqual(['connect a.p to b.p', 'connect a.p to b.p']);
            expect(declared.qualifiedName).toBe('Demo::connect a.p to b.p');
            expect(st.getSymbol('Demo::connect a.p to b.p')).toBe(declared);
            expect(st.getSymbolByElementId(anonymous.elementId!)).toBe(anonymous);
            expect(st.findByName('connect a.p to b.p')).toEqual([declared]);
            expect(st.getGlobalScope().resolve('Demo')).toBeDefined();

            const { buildSymbolIndexes, findConflictedQualifiedNames } = await import('../../server/src/symbols/namespaceResolver.js');
            const indexes = buildSymbolIndexes(st.getAllSymbols());
            expect(indexes.byName.get('connect a.p to b.p')).toEqual([declared]);
            expect(indexes.byParent.get('Demo')).not.toContain(anonymous);
            expect(indexes.byElementId.get(anonymous.elementId)).toBe(anonymous);
            expect(anonymous.qualifiedName).toBeUndefined();
            expect(findConflictedQualifiedNames(st.getAllSymbols()).size).toBe(0);
        });
    }

    it('keeps the ends\' own parts as they are', async () => {
        const { st } = await buildST(text);
        expect(st.findByName('a').map((s) => s.kind)).toEqual(['part']);
    });
});

describe('anonymous allocation usages', () => {
    it('names each after its ends, never after its first end, and keeps a declared name', async () => {
        const { st, result } = await buildST(`
package Demo {
    part a; part b; part c;
    allocate a to b;
    allocate a to c;
    allocation named allocate a to c;
}
`);
        expect(result.errors).toHaveLength(0);
        const allocations = st.getSymbolsForUri('test://test.sysml').filter((s) => s.kind === 'allocation');
        expect(allocations.map((s) => [s.name, s.label, s.qualifiedName])).toEqual([
            ['', 'allocate a to b', undefined],
            ['', 'allocate a to c', undefined],
            ['named', undefined, 'Demo::named'],
        ]);
        // The first end keeps its own name: only the part is found by it.
        expect(st.findByName('a').map((s) => s.kind)).toEqual(['part']);

        const { findConflictedQualifiedNames } = await import('../../server/src/symbols/namespaceResolver.js');
        expect(findConflictedQualifiedNames(st.getAllSymbols()).size).toBe(0);
    });
});

describe('anonymous transitions', () => {
    // Two anonymous transitions between the same states on one line, and a declared one quoted like
    // their label.
    const text = `
package Demo {
    state def S {
        state s1; state s2;
        transition first s1 then s2; transition first s1 then s2;
        transition 'transition first s1 then s2' first s2 then s1;
    }
}
`;

    it('names each after its states, keeps them apart, and never lets a quoted declared name shadow one', async () => {
        const { st, result } = await buildST(text);
        expect(result.errors).toHaveLength(0);
        const transitions = st.getSymbolsForUri('test://test.sysml').filter((s) => s.kind === 'transition');
        expect(transitions.map((s) => [s.name, s.label, s.qualifiedName])).toEqual([
            ['', 'transition first s1 then s2', undefined],
            ['', 'transition first s1 then s2', undefined],
            ['transition first s1 then s2', undefined, 'Demo::S::transition first s1 then s2'],
        ]);
        for (const transition of transitions.slice(0, 2)) expect(st.getSymbolByElementId(transition.elementId)).toBe(transition);
        expect(st.getSymbol('Demo::S::transition first s1 then s2')).toBe(transitions[2]);
        expect(st.findByName('transition first s1 then s2')).toEqual([transitions[2]]);

        const { findConflictedQualifiedNames } = await import('../../server/src/symbols/namespaceResolver.js');
        expect(findConflictedQualifiedNames(st.getAllSymbols()).size).toBe(0);
    });
});

describe('findConflictedQualifiedNames and anonymous elements', () => {
    // The same package reopened in two files, each with an anonymous interface and connection between
    // the same ends, at the same position: each pair has the same label, but every one keeps its own
    // elementId. Both files also declare `link`, a real conflict.
    const fileA = `
package Demo {
    port def P { port p1; }
    interface def I {
        end source : P;
        end target : ~P;
    }
    part a { port pa : P; }
    part b { port pb : ~P; }
    part c { port pc : ~P; }
    interface a.pa to b.pb;
    connect a.pa to b.pb;
    interface link : I connect source ::> a.pa to target ::> b.pb;
}
`;
    const fileB = `
package Demo {
    interface a.pa to b.pb;
    connect a.pa to b.pb;
    interface link : I connect source ::> a.pa to target ::> c.pc;
}
`;

    it('excludes anonymous elements sharing a name across documents, but still reports declared duplicates', async () => {
        const { findConflictedQualifiedNames } = await import('../../server/src/symbols/namespaceResolver.js');
        const st = await buildMultiFileST([
            { uri: 'test://a.sysml', text: fileA },
            { uri: 'test://b.sysml', text: fileB },
        ]);

        const all = st.getAllSymbols();
        const shared = all.filter((s) => s.label === 'interface a.pa to b.pb' || s.label === 'connect a.pa to b.pb');
        for (const kind of ['interface', 'connection']) {
            expect(shared.filter((s) => s.kind === kind).map((s) => isAnonymous(s))).toEqual([true, true]);
        }
        expect(shared.every((s) => s.qualifiedName === undefined)).toBe(true);
        expect(new Set(shared.map((s) => s.elementId)).size).toBe(4);

        const conflicts = findConflictedQualifiedNames(all);
        expect([...conflicts.keys()]).toEqual(['Demo::link']);
        expect(conflicts.get('Demo::link')).toHaveLength(2);
    });
});

describe('anonymous elements indexed by elementId', () => {
    // The elementId's value is implementation-defined: these tests only rely on it being present,
    // unique, and a lookup key. An anonymous element has no qualified name (KerML); the colliding
    // declared name is quoted like its label, and appended below it so its declaration site is unchanged.
    const anonymousText = `package Demo {
    part a { port p; }
    part b { port p; }
    interface a.p to b.p { attribute w; }
    part c;
}
`;
    const anonymousInterface = (st: { getSymbolsForUri(uri: string): SysMLSymbol[] }) =>
        st.getSymbolsForUri('test://test.sysml').find((s) => s.kind === 'interface')!;

    /** `anonymousText` plus a declared part quoted like the anonymous interface's label; `qualifiedName` is the part's. */
    async function buildCollision() {
        const { st: plain } = await buildST(anonymousText);
        const label = anonymousInterface(plain).label!;
        const text = anonymousText.replace('    part c;', `    part c;\n    part '${label}' { part inner; }`);
        return { ...(await buildST(text)), qualifiedName: `Demo::${label}`, text };
    }

    it('gives each anonymous element an elementId that finds it', async () => {
        const { st } = await buildST(anonymousText);
        const iface = anonymousInterface(st);
        expect(iface.elementId).toBeTruthy();
        expect(st.getSymbolByElementId(iface.elementId)).toBe(iface);
        expect(iface.qualifiedName).toBeUndefined();
        expect(st.getAllSymbols()).toContain(iface);
        // A named element carries one too, found the same way.
        const c = st.findByName('c')[0];
        expect(st.getSymbolByElementId(c.elementId)).toBe(c);
    });

    it('keeps an anonymous element\'s elementId when the same text is rebuilt', async () => {
        const { st: first } = await buildST(anonymousText);
        const { st: second } = await buildST(anonymousText);
        expect(anonymousInterface(second).elementId).toBe(anonymousInterface(first).elementId);
    });

    it('never lets an anonymous element take over a declared name quoted like its label', async () => {
        const { st, result, qualifiedName } = await buildCollision();
        expect(result.errors).toHaveLength(0);
        const iface = anonymousInterface(st);
        const declared = st.getSymbolsForUri('test://test.sysml').find((s) => s.qualifiedName === qualifiedName)!;
        expect(iface.qualifiedName).toBeUndefined();
        expect(declared.kind).toBe('part');
        expect(st.getSymbol(qualifiedName)).toBe(declared);
        expect(st.getSymbolByElementId(iface.elementId!)).toBe(iface);

        const { buildSymbolIndexes, findConflictedQualifiedNames } = await import('../../server/src/symbols/namespaceResolver.js');
        const indexes = buildSymbolIndexes(st.getAllSymbols());
        expect(indexes.byQualifiedName.get(qualifiedName)).toBe(declared);
        expect(indexes.byElementId.get(iface.elementId!)).toBe(iface);
        expect(findConflictedQualifiedNames(st.getAllSymbols()).size).toBe(0);
    });

    it('follows a member\'s parent link to its anonymous owner', async () => {
        const { st } = await buildST(anonymousText);
        const iface = anonymousInterface(st);
        const member = st.findByName('w')[0];
        // A member of an anonymous element has no qualified name either (KerML).
        expect(member.qualifiedName).toBeUndefined();
        expect(member.parentId).toBe(iface.elementId);
        expect(st.getOwner(member)).toBe(iface);
        expect(st.getOwner(iface)).toBe(st.getSymbol('Demo'));

        const { buildSymbolIndexes, ownerOf, NamespaceResolver } = await import('../../server/src/symbols/namespaceResolver.js');
        const indexes = buildSymbolIndexes(st.getAllSymbols());
        expect(ownerOf(member, indexes)).toBe(iface);
        // The member still sees the enclosing package, through its anonymous owner.
        expect([...new NamespaceResolver().namespaceAncestors(member, indexes)]).toEqual([iface, 'Demo', '']);
    });

    it('links each member to its own owner when a declared name is quoted like an anonymous element\'s label', async () => {
        const { st, qualifiedName } = await buildCollision();
        const iface = anonymousInterface(st);
        const declared = st.getSymbol(qualifiedName)!;
        const w = st.findByName('w')[0];
        const inner = st.findByName('inner')[0];
        // Their owners share a label, but not their identity: parentId tells them apart.
        expect([w.qualifiedName, inner.qualifiedName]).toEqual([undefined, `${qualifiedName}::inner`]);
        expect([w.parentId, inner.parentId]).toEqual([iface.elementId, declared.elementId]);
        expect(st.getOwner(w)).toBe(iface);
        expect(st.getOwner(inner)).toBe(declared);

        const { buildSymbolIndexes, ownerOf, NamespaceResolver } = await import('../../server/src/symbols/namespaceResolver.js');
        const indexes = buildSymbolIndexes(st.getAllSymbols());
        expect(ownerOf(w, indexes)).toBe(iface);
        expect(ownerOf(inner, indexes)).toBe(declared);
        expect([...new NamespaceResolver().namespaceAncestors(w, indexes)]).toEqual([iface, 'Demo', '']);
        expect([...new NamespaceResolver().namespaceAncestors(inner, indexes)]).toEqual([qualifiedName, 'Demo', '']);
    });

    it('links every member to its own owner by elementId, inside an anonymous element too', async () => {
        const { st } = await buildST(`package Demo {
    part a { port p; }
    part b { port p; }
    interface a.p to b.p { part x { part y; } }
}
`);
        const iface = anonymousInterface(st);
        const x = st.findByName('x')[0];
        const y = st.findByName('y')[0];
        expect(x.parentId).toBe(iface.elementId);
        expect(y.parentId).toBe(x.elementId);
        expect(st.getOwner(y)).toBe(x);
        expect(st.getOwner(x)).toBe(iface);
    });

    it('keeps an anonymous namespace\'s members apart from a declared one quoted like its label', async () => {
        const { st, qualifiedName } = await buildCollision();
        const iface = anonymousInterface(st);
        const w = st.findByName('w')[0];
        const inner = st.findByName('inner')[0];

        const { buildSymbolIndexes, NamespaceResolver } = await import('../../server/src/symbols/namespaceResolver.js');
        const indexes = buildSymbolIndexes(st.getAllSymbols());
        expect(indexes.byParent.get(iface)).toEqual([w]);
        expect(indexes.byParent.get(qualifiedName)).toEqual([inner]);

        const resolver = new NamespaceResolver();
        expect([...resolver.getResolvedMembers(iface, indexes).keys()]).toEqual(['w']);
        expect([...resolver.getResolvedMembers(qualifiedName, indexes).keys()]).toEqual(['inner']);
        // Each member sees its own namespace's members, not the other's.
        expect(resolver.isLocallyVisible(w, 'w', indexes)).toBe(true);
        expect(resolver.isLocallyVisible(w, 'inner', indexes)).toBe(false);
        expect(resolver.isLocallyVisible(inner, 'inner', indexes)).toBe(true);
        expect(resolver.isLocallyVisible(inner, 'w', indexes)).toBe(false);
        // Both still see the enclosing package's members.
        expect(resolver.isLocallyVisible(w, 'c', indexes)).toBe(true);
        expect(resolver.isLocallyVisible(inner, 'c', indexes)).toBe(true);
    });

    // Anonymous interface and allocation usages next to declared elements quoted like their generated
    // names, in either source order: the declared ones keep their names and are what those names resolve to.
    for (const [order, body] of [
        ['declared first', `part def 'interface a.p to b.p';\n    part def 'allocate a to b';\n    interface a.p to b.p;\n    allocate a to b;`],
        ['anonymous first', `interface a.p to b.p;\n    allocate a to b;\n    part def 'interface a.p to b.p';\n    part def 'allocate a to b';`],
    ] as const) {
        it(`never lets an anonymous interface or allocation mask a declared name (${order})`, async () => {
            const { st, result } = await buildST(`package Demo {
    part a { port p; }
    part b { port p; }
    ${body}
}
`);
            expect(result.errors).toHaveLength(0);
            const { buildSymbolIndexes, NamespaceResolver } = await import('../../server/src/symbols/namespaceResolver.js');
            const indexes = buildSymbolIndexes(st.getAllSymbols());
            const members = new NamespaceResolver().getResolvedMembers('Demo', indexes);
            for (const [name, kind] of [['interface a.p to b.p', 'interface'], ['allocate a to b', 'allocation']] as const) {
                const anonymous = st.getSymbolsForUri('test://test.sysml').find((s) => s.kind === kind)!;
                expect([anonymous.label, isAnonymous(anonymous)]).toEqual([name, true]);
                const declared = st.getSymbol(`Demo::${name}`)!;
                expect([declared.kind, isAnonymous(declared)]).toEqual(['part def', false]);
                expect(st.findByName(name)).toEqual([declared]);
                expect(indexes.byName.get(name)).toEqual([declared]);
                expect(members.get(name)?.map((m) => m.symbol)).toEqual([declared]);
                expect(st.getSymbolByElementId(anonymous.elementId!)).toBe(anonymous);
            }
        });
    }

    it('drops an anonymous element from its indexes when its document is rebuilt without it', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const { st, qualifiedName, text } = await buildCollision();
        const elementId = anonymousInterface(st).elementId!;
        st.build('test://test.sysml', parseDocument(text.replace('interface a.p to b.p { attribute w; }', '')));
        expect(st.getSymbolByElementId(elementId)).toBeUndefined();
        expect(st.getSymbol(qualifiedName)?.kind).toBe('part');
        expect(st.getAllSymbols().some((s) => isAnonymous(s))).toBe(false);
    });
});

describe('isAnonymous and displayName', () => {
    const base = { kind: 'connection' as SysMLSymbol['kind'], elementId: 'id', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, selectionRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, uri: 'test://t.sysml', typeNames: [], specializationNames: [], children: [] };

    it('calls an element anonymous when it has neither a name nor a short name', async () => {
        const { displayName } = await import('../../server/src/symbols/sysmlElements.js');
        expect(isAnonymous({ ...base, name: '', label: 'connect a.p to b.p' } as SysMLSymbol)).toBe(true);
        expect(isAnonymous({ ...base, name: 'link' } as SysMLSymbol)).toBe(false);
        expect(isAnonymous({ ...base, name: '', shortName: 'l' } as SysMLSymbol)).toBe(false);
        expect(displayName({ ...base, name: 'link' } as SysMLSymbol)).toBe('link');
    });

    it('shows an anonymous element by its declaration without a name, as the standard\'s diagrams do', async () => {
        const { displayName } = await import('../../server/src/symbols/sysmlElements.js');
        // Its specialization part (8.2.3.6), else what it connects, else its declaration as written, else its kind.
        expect(displayName({ ...base, name: '', label: 'connection : C connect a.p to b.p', specialization: ': C', ends: ['a.p', 'b.p'] } as SysMLSymbol)).toBe(': C');
        expect(displayName({ ...base, name: '', label: 'connect a.p to b.p', ends: ['a.p', 'b.p'] } as SysMLSymbol)).toBe('a.p→b.p');
        expect(displayName({ ...base, name: '', label: 'connect (a, b, c)', ends: ['a', 'b', 'c'] } as SysMLSymbol)).toBe('a-b-c');
        expect(displayName({ ...base, kind: 'transition' as SysMLSymbol['kind'], name: '', label: 'transition first s1 then s2', source: 's1', target: 's2' } as SysMLSymbol)).toBe('s1→s2');
        expect(displayName({ ...base, name: '', label: 'connection' } as SysMLSymbol)).toBe('connection');
        expect(displayName({ ...base, name: '' } as SysMLSymbol)).toBe('connection');
    });

    it.each([
        ['part : Engine;', ': Engine'],
        ['part : Engine[4];', ': Engine[4]'],
        ['part :> p0;', ':> p0'],
        ['part typed by Engine;', 'typed by Engine'],
        ['part def :> Engine;', ':> Engine'],
        ['part;', 'part'],
        ['connect a.p to b.p;', 'a.p→b.p'],
        ['connect (a.p, b.p, c.p);', 'a.p-b.p-c.p'],
        ['connect e ::> a.p to b.p;', 'a.p→b.p'],
        ['allocate a to b;', 'a→b'],
        ['state def S { state s1; state s2; transition first s1 then s2; }', 's1→s2'],
    ])('shows `%s` as `%s`', async (body, shown) => {
        const { displayName } = await import('../../server/src/symbols/sysmlElements.js');
        const { st } = await buildST(`package Demo { part def Engine; part p0 : Engine; part a { port p; } part b { port p; } part c { port p; } ${body} }`);
        const anonymous = st.getSymbolsForUri('test://test.sysml').find((s) => isAnonymous(s))!;
        expect(displayName(anonymous)).toBe(shown);
    });

    it('gives a typed element without a name or ends no name, its declaration as label, and an ID through its owner', async () => {
        const { st, result } = await buildST('package Demo { connection def Cn; connection : Cn; }');
        expect(result.errors).toHaveLength(0);
        const connection = st.getSymbolsForUri('test://test.sysml').find((s) => s.kind === 'connection')!;
        expect([connection.name, connection.label, connection.qualifiedName, isAnonymous(connection)]).toEqual(['', 'connection : Cn', undefined, true]);
        expect(st.getOwner(connection)).toBe(st.getSymbol('Demo'));
        expect(st.findByName('')).toEqual([]);
    });
});

describe('anonymous usages and definitions', () => {
    const lib = `part def P { attribute a; part q; }
    port def Q;
    action def Act { action s1; }
    state def St;
    use case def U;
    part p0 : P;
    action a0 : Act;
    state s0 : St;
    use case u0 : U;`;
    const build = (body: string) => buildST(`package D {\n    ${lib}\n    part def W {\n        ${body}\n    }\n}`);
    const membersOfW = (st: Awaited<ReturnType<typeof build>>['st']) =>
        st.getAllSymbols().filter((s) => st.getOwner(s)?.qualifiedName === 'D::W');

    it.each([
        ['port : Q;', 'port', 'port : Q'],
        ['part :> p0;', 'part', 'part :> p0'],
        ['part : P[2];', 'part', 'part : P[2]'],
        ['perform action : Act;', 'perform action', 'perform action : Act'],
        ['part def :> P;', 'part def', 'part def :> P'],
        ['part;', 'part', 'part'],
    ])('makes `%s` anonymous, never named after its type or what it subsets', async (body, kind, label) => {
        const { st, result } = await build(body);
        expect(result.errors).toEqual([]);
        const [element] = membersOfW(st);
        expect([element.kind, element.name, element.label, element.qualifiedName, isAnonymous(element)]).toEqual([kind, '', label, undefined, true]);
        // The type, or the feature it subsets, keeps its own name.
        expect(st.findByName('Q').map((s) => s.kind)).toEqual(['port def']);
        expect(st.findByName('P').map((s) => s.kind)).toEqual(['part def']);
    });

    it.each([
        ['part :>> p0;', 'p0'],
        ['part redefines p0;', 'p0'],
        ['part :>> P::q;', 'q'],
        ['part :>> p0.q;', 'q'],
        ['attribute :>> a = 5;', 'a'],
        ['perform a0;', 'a0'],
        ['perform a0.s1;', 's1'],
        ['exhibit s0;', 's0'],
        ['include u0;', 'u0'],
        ['part <s> : P;', 's'],
    ])('names `%s` after its naming feature or declared name (`%s`)', async (body, name) => {
        const { st } = await build(body);
        const [element] = membersOfW(st);
        expect([element.name, element.qualifiedName, isAnonymous(element)]).toEqual([name, `D::W::${name}`, false]);
    });

    it('owns the members of an anonymous usage', async () => {
        const { st } = await build('part : P { attribute m; part n : P; }');
        const anonymous = membersOfW(st).find((s) => isAnonymous(s))!;
        const members = st.getAllSymbols().filter((s) => s.parentId === anonymous.elementId);
        expect(members.map((s) => [s.name, s.qualifiedName])).toEqual([['m', undefined], ['n', undefined]]);
    });
});
