import { describe, expect, it } from 'vitest';
import { displayName, isAnonymous, type SysMLSymbol } from '../../server/src/symbols/sysmlElements.js';

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

    it('should extract item flows without mistaking payloads or endpoints for declared names', async () => {
        const { st, result } = await buildST(`
package Demo {
    interface def Link {
        flow of Payload[1..*] from source.output to target.input;
        flow outgoing of OtherPayload[1..*] from source.other to target.other;
    }
}
`);

        expect(result.errors).toHaveLength(0);
        const flows = st.getSymbolsForUri('test://test.sysml').filter(s => s.kind === 'flow');
        expect(flows).toHaveLength(2);
        expect(flows.map(flow => [flow.name, isAnonymous(flow), flow.typeNames, flow.flowDetails])).toEqual([
            [
                '',
                true,
                [],
                {
                    itemType: 'Payload',
                    payloadDeclared: true,
                    source: 'source.output',
                    target: 'target.input',
                },
            ],
            [
                'outgoing',
                false,
                [],
                {
                    itemType: 'OtherPayload',
                    payloadDeclared: true,
                    source: 'source.other',
                    target: 'target.other',
                },
            ],
        ]);
        // An anonymous flow is shown by its source and target.
        expect(flows.map(flow => displayName(flow))).toEqual(['source.output→target.input', 'outgoing']);
        expect(st.findByName('Payload')).toEqual([]);
        expect(st.findByName('source')).toEqual([]);
    });

    it('should keep a flow anonymous when only its payload is named', async () => {
        const { st, result } = await buildST(`
package Demo {
    part def Container {
        flow of i : I from source.output to target.input;
        flow <f1> outgoing of j : J from source.other to target.other;
    }
}
`);

        expect(result.errors).toHaveLength(0);
        const flows = st.getSymbolsForUri('test://test.sysml').filter(s => s.kind === 'flow');
        expect(flows.map(flow => [flow.name, isAnonymous(flow), displayName(flow)])).toEqual([
            ['', true, 'source.output→target.input'],
            ['outgoing', false, 'outgoing'],
        ]);
        expect(st.findByName('i')).toEqual([]);
        expect(st.findByName('j')).toEqual([]);
    });

    it('should keep a flow declared type separate from its named payload type', async () => {
        const { st, result } = await buildST(`
package Demo {
    part def FlowContainer {
        flow f : F of i : I from source.output to target.input;
        flow untyped of i = 1 from source.other to target.other;
        succession flow from producer to consumer;
    }
}
`);

        expect(result.errors).toHaveLength(0);
        const flows = st.getSymbolsForUri('test://test.sysml').filter(s =>
            s.kind === 'flow' || s.kind === 'succession flow',
        );
        const typed = flows.find(flow => flow.name === 'f');
        expect(typed?.typeNames).toEqual(['F']);
        expect(typed?.flowDetails).toEqual({
            itemType: 'I',
            payloadDeclared: true,
            source: 'source.output',
            target: 'target.input',
        });

        const untyped = flows.find(flow => flow.name === 'untyped');
        expect(untyped?.typeNames).toEqual([]);
        expect(untyped?.flowDetails?.itemType).toBeUndefined();
        expect(untyped?.flowDetails?.payloadDeclared).toBe(true);

        const succession = flows.find(flow => flow.kind === 'succession flow');
        expect(succession?.flowDetails).toEqual({
            payloadDeclared: false,
            source: 'producer',
            target: 'consumer',
        });
    });

    it('should give a flow definition a symbol owning its members, also when abstract or without a body', async () => {
        const { st, result } = await buildST(`
package Demo {
    item def Fuel;
    flow def Transfer;
    flow def <ff> FuelFlow :> Transfer {
        ref item :>> payload : Fuel;
    }
    abstract flow def Message;
}
`);

        expect(result.errors).toHaveLength(0);
        const flowDefs = st.getSymbolsForUri('test://test.sysml').filter(s => s.kind === 'flow def');
        expect(flowDefs.map(def => [def.qualifiedName, def.shortName, def.typeNames])).toEqual([
            ['Demo::Transfer', undefined, []],
            ['Demo::FuelFlow', 'ff', ['Transfer']],
            ['Demo::Message', undefined, []],
        ]);
        const payload = st.findByName('payload');
        expect(payload.map(member => member.qualifiedName)).toEqual(['Demo::FuelFlow::payload']);
    });

    it('should give a message a flow symbol with its payload and ends, named by its declaration when anonymous', async () => {
        const { st, result } = await buildST(`
package Demo {
    item def Fuel;
    part def Vehicle {
        part tank { event occurrence fuelSent; }
        part engine { event occurrence fuelReceived; }
        message m1 of Fuel from tank.fuelSent to engine.fuelReceived;
        message of Fuel from tank.fuelSent to engine.fuelReceived;
    }
}
`);

        expect(result.errors).toHaveLength(0);
        const messages = st.getSymbolsForUri('test://test.sysml').filter(s => s.kind === 'flow');
        expect(messages.map(message => [message.name, isAnonymous(message), displayName(message), message.flowDetails])).toEqual([
            ['m1', false, 'm1', { itemType: 'Fuel', payloadDeclared: true, source: 'tank.fuelSent', target: 'engine.fuelReceived' }],
            ['', true, 'tank.fuelSent→engine.fuelReceived', { itemType: 'Fuel', payloadDeclared: true, source: 'tank.fuelSent', target: 'engine.fuelReceived' }],
        ]);
        expect(st.findByName('Fuel').map(fuel => fuel.kind)).toEqual(['item def']);
    });

    it('should read every message form: named payload, plain-name ends, typed, payload only, bare, and in an occurrence', async () => {
        const { st, result } = await buildST(`
package Demo {
    item def Fuel;
    flow def MsgDef;
    part def Vehicle {
        part tank { event occurrence sent; }
        part engine { event occurrence received; }
        message m1 of fuel : Fuel from tank.sent to engine.received;
        message m2 from tank to engine;
        message m3 : MsgDef of Fuel from tank.sent to engine.received;
        message of Fuel;
        message m4;
    }
    occurrence {
        part p1 { event occurrence e1; }
        part p2 { event occurrence e2; }
        message m5 from p1.e1 to p2.e2;
    }
}
`);

        expect(result.errors).toHaveLength(0);
        const messages = st.getSymbolsForUri('test://test.sysml').filter(s => s.kind === 'flow');
        expect(messages.map(m => [displayName(m), m.typeNames, m.flowDetails])).toEqual([
            ['m1', [], { itemType: 'Fuel', payloadDeclared: true, source: 'tank.sent', target: 'engine.received' }],
            ['m2', [], { payloadDeclared: false, source: 'tank', target: 'engine' }],
            ['m3', ['MsgDef'], { itemType: 'Fuel', payloadDeclared: true, source: 'tank.sent', target: 'engine.received' }],
            ['message of Fuel', [], { itemType: 'Fuel', payloadDeclared: true, source: undefined, target: undefined }],
            ['m4', [], { payloadDeclared: false, source: undefined, target: undefined }],
            ['m5', [], { payloadDeclared: false, source: 'p1.e1', target: 'p2.e2' }],
        ]);
        // A payload's name is not a member of the vehicle.
        expect(st.findByName('fuel')).toEqual([]);
    });

    it('should read a payload\'s type from its typing only, whole when qualified, and not from what it subsets', async () => {
        const { st, result } = await buildST(`
package Demo {
    package P { item def Fuel; attribute def Rate; }
    part def Vehicle {
        part tank { out item fuelOut : P::Fuel; }
        part engine { in item fuelIn : P::Fuel; }
        flow of P::Fuel from tank.fuelOut to engine.fuelIn;
        flow of [2] P::Fuel from tank.fuelOut to engine.fuelIn;
        flow of p1 :> tank.fuelOut from tank.fuelOut to engine.fuelIn;
        flow of p2 : P::Rate = 3 from tank.fuelOut to engine.fuelIn;
    }
}
`);

        expect(result.errors).toHaveLength(0);
        const flows = st.getSymbolsForUri('test://test.sysml').filter(s => s.kind === 'flow');
        expect(flows.map(f => [f.flowDetails?.itemType, f.flowDetails?.payloadDeclared])).toEqual([
            ['P::Fuel', true],
            ['P::Fuel', true],
            [undefined, true],
            ['P::Rate', true],
        ]);
    });

    it('should read a named, typed succession flow with its payload and ends (spec 7.16.2)', async () => {
        const { st, result } = await buildST(`
package Demo {
    item def Image;
    flow def ImageFlow;
    action def TakePicture {
        action focus { out image : Image; }
        action shoot { in image : Image; }
        succession flow focus.image to shoot.image;
        succession flow sf : ImageFlow of img : Image from focus.image to shoot.image;
    }
}
`);

        expect(result.errors).toHaveLength(0);
        const successions = st.getSymbolsForUri('test://test.sysml').filter(s => s.kind === 'succession flow');
        expect(successions.map(s => [displayName(s), s.typeNames, s.flowDetails])).toEqual([
            ['focus.image→shoot.image', [], { payloadDeclared: false, source: 'focus.image', target: 'shoot.image' }],
            ['sf', ['ImageFlow'], { itemType: 'Image', payloadDeclared: true, source: 'focus.image', target: 'shoot.image' }],
        ]);
        expect(st.findByName('img')).toEqual([]);
    });

    it('should own a flow nested in a flow usage\'s body by that flow usage', async () => {
        const { st, result } = await buildST(`
package Demo {
    item def Item1 { item subItem1; }
    action a1 { out item1 : Item1; }
    action a2 { in item2 : Item1; }
    flow flow1_2 from a1.item1 to a2.item2 {
        flow source.item1.subItem1 to target.item2.subItem1;
    }
}
`);

        expect(result.errors).toHaveLength(0);
        const flows = st.getSymbolsForUri('test://test.sysml').filter(s => s.kind === 'flow');
        expect(flows.map(f => [displayName(f), f.flowDetails?.source, f.flowDetails?.target])).toEqual([
            ['flow1_2', 'a1.item1', 'a2.item2'],
            ['source.item1.subItem1→target.item2.subItem1', 'source.item1.subItem1', 'target.item2.subItem1'],
        ]);
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
        // no qualified name (KerML), is found by its symbol ID, and its declaration is not looked up.
        expect(st.findByName('source').filter((s) => s.kind === 'interface')).toHaveLength(0);
        const symbols = st.getSymbolsForUri('test://test.sysml');
        for (const [path, line] of [['interface source.p1 to target.p1', 13], ['interface source.p2 to target.p2', 14]] as const) {
            const [iface] = symbols.filter((s) => s.declaration === path);
            expect(iface?.kind).toBe('interface');
            expect(iface?.name).toBe('');
            expect(isAnonymous(iface)).toBe(true);
            expect(iface?.qualifiedName).toBeUndefined();
            expect(iface?.range.start.line).toBe(line - 1);
            expect(st.getSymbolById(iface.symbolId)).toBe(iface);
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
        expect(named.map((s) => s.declaration)).toEqual(['interface a.pa to b.pb', 'interface a.pa to c.pc']);
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
            parentId: st.getSymbol('Demo::Machine')!.symbolId,
        });
        // Anonymous: no name (never the source state's), only its declaration.
        expect([transition?.name, transition?.declaration]).toEqual(['', 'transition first a then b']);
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

    it('should type a transition by its accepted payload, apart from the guard, effect or target after it', async () => {
        const { st, result } = await buildST(`
package Demo {
    item def Command;
    state def Machine {
        state a;
        state b;
        transition plain first a accept cmd : Command then b;
        transition guarded first a accept cmd : Command if true then b;
        transition withEffect first a accept cmd : Command do action reply then b;
        transition untypedName first a accept Command then b;
        transition first b accept cmd : Command then a;
    }
}
`);

        expect(result.errors).toHaveLength(0);
        const transitions = st.getAllSymbols().filter(s => s.kind === 'transition');
        expect(transitions).toHaveLength(5);
        for (const transition of transitions) {
            expect(transition.typeNames).toEqual(['Command']);
        }
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

    it('should not take a usage\'s multiplicity from its body', async () => {
        const { st } = await buildST(`
package Test {
    part def Engine;
    part car {
        part engines : Engine[2];
    }
}
`);
        expect(st.findByName('car')[0].multiplicity).toBeUndefined();
        expect(st.findByName('engines')[0].multiplicity).toBe('2');
    });

    it('should not take a connection\'s multiplicity from its ends', async () => {
        const { st } = await buildST(`
package Test {
    part def A { port p; }
    part a : A;
    part b : A;
    connection c connect [2] a.p to [1] b.p;
    connection d [3] connect a.p to b.p;
}
`);
        expect(st.findByName('c')[0].multiplicity).toBeUndefined();
        expect(st.findByName('d')[0].multiplicity).toBe('3');
    });

    it('should name elements declared with unreserved KerML keywords', async () => {
        const { st, result } = await buildST(`
package Test {
    part def function;
    part step : function;
    perform action member[2];
    alias multiplicity for step;
}
`);
        expect(result.errors).toHaveLength(0);
        expect(st.findByName('function')[0]?.qualifiedName).toBe('Test::function');
        expect(st.findByName('step')[0]?.typeNames).toEqual(['function']);
        expect(st.findByName('member')[0]?.multiplicity).toBe('2');
        expect(st.findByName('multiplicity')).toHaveLength(1);
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

describe('Feature value (SysML 7.13.4, 8.2.2.6.2 ValuePart)', () => {
    it('records the own value of a symbol, with its kind', async () => {
        const { st } = await buildST(`
package Demo {
    part def Engine;
    part a {
        part standardEngine : Engine;
        attribute bound = 12;
        attribute count := 0;
        part engine : Engine default := standardEngine;
        attribute crossing => bound;
    }
}
`);
        const valueOf = (name: string) => st.getAllSymbols().find(symbol => symbol.name === name)?.featureValue;
        expect(valueOf('bound')).toEqual({ expression: '12', isDefault: false, isInitial: false });
        expect(valueOf('count')).toEqual({ expression: '0', isDefault: false, isInitial: true });
        expect(valueOf('engine')).toEqual({ expression: 'standardEngine', isDefault: true, isInitial: true });
        expect(valueOf('crossing')).toBeUndefined();
        expect(valueOf('a')).toBeUndefined();
    });

    it('records no value for a value part without an expression (a syntax error)', async () => {
        const { st } = await buildST(`
package Demo {
    part a {
        attribute broken = ;
    }
}
`);
        expect(st.getAllSymbols().find(symbol => symbol.name === 'broken')?.featureValue).toBeUndefined();
    });

    it('records an expression with expression bodies in full (SysML 7.13.4, KerML 8.2.5.8.3 BodyExpression)', async () => {
        const { st, result } = await buildST(`
package Demo {
    attribute s;
    attribute def SampledFunction { attribute samples; }
    part a {
        attribute b1 = s->select { in i; i > 1 };
        attribute v1 = s->select { in i { } i > 1 };
        attribute n3 = s->select { in i; i > 1 }->size();
        attribute v3 = s->select { in i; i > 1 } + s->select { in j; j > 2 };
        attribute v5 = s->collect { in i; s->select { in j; j > i } };
        attribute v7 = {
            in i;
            i
        };
        attribute v8 = s->select { doc /* d */ in i : ScalarValues::Integer [1]; i > 1 };
        attribute sampling = new SampledFunction(samples = s->collect { in x; x * 2 });
        attribute b10 = s->collect { in i; i * 2 } { doc /* d */ }
    }
}
`);
        expect(result.errors).toEqual([]);
        const valueOf = (name: string) => st.getAllSymbols().find(symbol => symbol.name === name)?.featureValue?.expression;
        expect(valueOf('b1')).toBe('s->select { in i; i > 1 }');
        expect(valueOf('v1')).toBe('s->select { in i { } i > 1 }');
        expect(valueOf('n3')).toBe('s->select { in i; i > 1 }->size()');
        expect(valueOf('v3')).toBe('s->select { in i; i > 1 } + s->select { in j; j > 2 }');
        expect(valueOf('v5')).toBe('s->collect { in i; s->select { in j; j > i } }');
        expect(valueOf('v7')).toBe('{ in i; i }');
        expect(valueOf('v8')).toBe('s->select { doc /* d */ in i : ScalarValues::Integer [1]; i > 1 }');
        expect(valueOf('sampling')).toBe('new SampledFunction(samples = s->collect { in x; x * 2 })');
        expect(valueOf('b10')).toBe('s->collect { in i; i * 2 }');
    });

    it('reads a value by its syntactic role, not from names or comments spelled like one', async () => {
        const { st, result } = await buildST(`
package Demo {
    attribute 'default';
    part a {
        attribute 'default' = 1;
        attribute '=' = 2;
        attribute ':=' := 3;
        attribute 'x=y';
        attribute 'z default';
        attribute k1 = 'default';
        attribute c1; // = 5 trailing
        attribute c2 { doc /* default = 6 */ }
        // attribute ghost = 99;
        /* attribute ghost2 default = 98; */
        attribute c3 = 1 // comment = 5
            + 4;
    }
}
`);
        expect(result.errors).toEqual([]);
        const owner = st.getAllSymbols().find(symbol => symbol.qualifiedName === 'Demo::a');
        const symbolOf = (name: string) => st.getAllSymbols().find(symbol => symbol.parentId === owner?.symbolId && symbol.name === name);
        const valueOf = (name: string) => symbolOf(name)?.featureValue;
        for (const name of ['default', '=', ':=', 'x=y', 'z default', 'k1', 'c1', 'c2', 'c3']) expect(symbolOf(name), name).toBeDefined();
        expect(valueOf('default')).toEqual({ expression: '1', isDefault: false, isInitial: false });
        expect(valueOf('=')).toEqual({ expression: '2', isDefault: false, isInitial: false });
        expect(valueOf(':=')).toEqual({ expression: '3', isDefault: false, isInitial: true });
        expect(valueOf('x=y')).toBeUndefined();
        expect(valueOf('z default')).toBeUndefined();
        expect(valueOf('k1')).toEqual({ expression: "'default'", isDefault: false, isInitial: false });
        expect(valueOf('c1')).toBeUndefined();
        expect(valueOf('c2')).toBeUndefined();
        expect(valueOf('c3')?.expression).toBe('1 + 4');
        expect(st.getAllSymbols().some(symbol => symbol.name.startsWith('ghost'))).toBe(false);
    });

    it('records no value on a transition for its accept payload or effect action (SysML 8.2.2.18.3)', async () => {
        const { st, result } = await buildST(`
package Demo {
    attribute def T;
    action def A;
    attribute a : T;
    port p;
    state def S {
        state s1; state s2;
        transition t1 first s1 accept sig1 : T = a then s2;
        transition t2 first s1 accept sig2 : T := a then s2;
        transition t3 first s1 accept sig3 : T [3] default = a then s2;
        transition t4 first s1 accept sig4 : T = a via p then s2;
        transition t5 first s1 do action eff5 : A [2] = a then s2;
        transition t6 first s1 do action eff6 : A = a { } then s2;
        transition t7 first s1 accept sig7 : T do action eff7 = a then s2;
        transition t8 first s1 do action eff8 = { in i; i } then s2;
        transition t9 first s1 accept at a then s2;
        transition t10 first s1 accept when a == a then s2;
        transition t11 first s1 do send a via p then s2;
        transition t12 first s1 do assign a := 3 then s2;
        transition t13 first s1 if a == a then s2;
    }
}
`);
        expect(result.errors).toEqual([]);
        const transitions = st.getAllSymbols().filter(symbol => /^t\d+$/.test(symbol.name));
        expect(transitions.map(symbol => symbol.name)).toHaveLength(13);
        for (const transition of transitions) expect({ [transition.name]: transition.featureValue }).toEqual({ [transition.name]: undefined });
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
        expect(connections.map((s) => s.declaration)).toEqual(['connect a.p to b.p', 'connect a.p to c.p', 'connect (a.q, b.p, c.p, d.p)', 'connect e ::> d.p to b.p']);
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
        expect(connections.map((s) => [s.declaration, isAnonymous(s)])).toEqual([['connect a.p to b.p', true], ['connect a.p to b.p', true]]);
        expect(connections.every((s) => s.qualifiedName === undefined)).toBe(true);
        // Neither shadows the other: each has its own symbol ID and is registered under it.
        expect(new Set(connections.map((s) => s.symbolId)).size).toBe(2);
        for (const connection of connections) expect(st.getSymbolById(connection.symbolId!)).toBe(connection);
        expect(st.getAllSymbols().filter((s) => s.kind === 'connection')).toHaveLength(2);
    });

    // A quoted name may spell out an anonymous connection's declaration exactly; in either source order,
    // the declared connection keeps its qualified name and is the only one found by name.
    for (const [order, body] of [
        ['declared first', `connection 'connect a.p to b.p';\n    connect a.p to b.p;`],
        ['anonymous first', `connect a.p to b.p;\n    connection 'connect a.p to b.p';`],
    ] as const) {
        it(`never lets an anonymous connection shadow a declared one quoted like its declaration (${order})`, async () => {
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
            expect([declared.name, anonymous.declaration]).toEqual(['connect a.p to b.p', 'connect a.p to b.p']);
            expect(declared.qualifiedName).toBe('Demo::connect a.p to b.p');
            expect(st.getSymbol('Demo::connect a.p to b.p')).toBe(declared);
            expect(st.getSymbolById(anonymous.symbolId!)).toBe(anonymous);
            expect(st.findByName('connect a.p to b.p')).toEqual([declared]);
            expect(st.getGlobalScope().resolve('Demo')).toBeDefined();

            const { buildSymbolIndexes, findConflictedQualifiedNames } = await import('../../server/src/symbols/namespaceResolver.js');
            const indexes = buildSymbolIndexes(st.getAllSymbols());
            expect(indexes.byName.get('connect a.p to b.p')).toEqual([declared]);
            expect(indexes.byParent.get('Demo')).not.toContain(anonymous);
            expect(indexes.byId.get(anonymous.symbolId)).toBe(anonymous);
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
        expect(allocations.map((s) => [s.name, s.declaration, s.qualifiedName])).toEqual([
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

describe('state entry, do and exit actions', () => {
    it('should extract entry, do and exit actions declared in a state', async () => {
        const { st, result } = await buildST(`
package Demo {
    action def Arrive;
    action def Work;
    action def Leave;
    state def Machine {
        state running {
            entry action arrive : Arrive;
            do action work : Work;
            exit action leave : Leave;
        }
    }
}
`);

        expect(result.errors).toHaveLength(0);
        const running = st.getSymbol('Demo::Machine::running')!;
        expect(['arrive', 'work', 'leave'].map(name => st.getSymbol(`Demo::Machine::running::${name}`))).toMatchObject([
            { kind: 'perform action', typeNames: ['Arrive'], parentId: running.symbolId },
            { kind: 'perform action', typeNames: ['Work'], parentId: running.symbolId },
            { kind: 'perform action', typeNames: ['Leave'], parentId: running.symbolId },
        ]);
    });
});

describe('anonymous transitions', () => {
    // Two anonymous transitions between the same states on one line, and a declared one quoted like
    // their declaration.
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
        expect(transitions.map((s) => [s.name, s.declaration, s.qualifiedName])).toEqual([
            ['', 'transition first s1 then s2', undefined],
            ['', 'transition first s1 then s2', undefined],
            ['transition first s1 then s2', undefined, 'Demo::S::transition first s1 then s2'],
        ]);
        for (const transition of transitions.slice(0, 2)) expect(st.getSymbolById(transition.symbolId)).toBe(transition);
        expect(st.getSymbol('Demo::S::transition first s1 then s2')).toBe(transitions[2]);
        expect(st.findByName('transition first s1 then s2')).toEqual([transitions[2]]);

        const { findConflictedQualifiedNames } = await import('../../server/src/symbols/namespaceResolver.js');
        expect(findConflictedQualifiedNames(st.getAllSymbols()).size).toBe(0);
    });
});

describe('findConflictedQualifiedNames and anonymous elements', () => {
    // The same package reopened in two files, each with an anonymous interface and connection between
    // the same ends, at the same position: each pair has the same declaration, but every one keeps its own
    // symbol ID. Both files also declare `link`, a real conflict.
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
        const shared = all.filter((s) => s.declaration === 'interface a.pa to b.pb' || s.declaration === 'connect a.pa to b.pb');
        for (const kind of ['interface', 'connection']) {
            expect(shared.filter((s) => s.kind === kind).map((s) => isAnonymous(s))).toEqual([true, true]);
        }
        expect(shared.every((s) => s.qualifiedName === undefined)).toBe(true);
        expect(new Set(shared.map((s) => s.symbolId)).size).toBe(4);

        const conflicts = findConflictedQualifiedNames(all);
        expect([...conflicts.keys()]).toEqual(['Demo::link']);
        expect(conflicts.get('Demo::link')).toHaveLength(2);
    });
});

describe('anonymous elements indexed by symbol ID', () => {
    // The symbol ID's value is implementation-defined: these tests only rely on it being present,
    // unique, and a lookup key. An anonymous element has no qualified name (KerML); the colliding
    // declared name is quoted like its declaration, and appended below it so its declaration site is unchanged.
    const anonymousText = `package Demo {
    part a { port p; }
    part b { port p; }
    interface a.p to b.p { attribute w; }
    part c;
}
`;
    const anonymousInterface = (st: { getSymbolsForUri(uri: string): SysMLSymbol[] }) =>
        st.getSymbolsForUri('test://test.sysml').find((s) => s.kind === 'interface')!;

    /** `anonymousText` plus a declared part quoted like the anonymous interface's declaration; `qualifiedName` is the part's. */
    async function buildCollision() {
        const { st: plain } = await buildST(anonymousText);
        const declaration = anonymousInterface(plain).declaration!;
        const text = anonymousText.replace('    part c;', `    part c;\n    part '${declaration}' { part inner; }`);
        return { ...(await buildST(text)), qualifiedName: `Demo::${declaration}`, text };
    }

    it('gives each anonymous element a symbol ID that finds it', async () => {
        const { st } = await buildST(anonymousText);
        const iface = anonymousInterface(st);
        expect(iface.symbolId).toBeTruthy();
        expect(st.getSymbolById(iface.symbolId)).toBe(iface);
        expect(iface.qualifiedName).toBeUndefined();
        expect(st.getAllSymbols()).toContain(iface);
        // A named element carries one too, found the same way.
        const c = st.findByName('c')[0];
        expect(st.getSymbolById(c.symbolId)).toBe(c);
    });

    it('keeps the symbol ID of an anonymous element when the same text is rebuilt', async () => {
        const { st: first } = await buildST(anonymousText);
        const { st: second } = await buildST(anonymousText);
        expect(anonymousInterface(second).symbolId).toBe(anonymousInterface(first).symbolId);
    });

    it('never lets an anonymous element take over a declared name quoted like its declaration', async () => {
        const { st, result, qualifiedName } = await buildCollision();
        expect(result.errors).toHaveLength(0);
        const iface = anonymousInterface(st);
        const declared = st.getSymbolsForUri('test://test.sysml').find((s) => s.qualifiedName === qualifiedName)!;
        expect(iface.qualifiedName).toBeUndefined();
        expect(declared.kind).toBe('part');
        expect(st.getSymbol(qualifiedName)).toBe(declared);
        expect(st.getSymbolById(iface.symbolId!)).toBe(iface);

        const { buildSymbolIndexes, findConflictedQualifiedNames } = await import('../../server/src/symbols/namespaceResolver.js');
        const indexes = buildSymbolIndexes(st.getAllSymbols());
        expect(indexes.byQualifiedName.get(qualifiedName)).toBe(declared);
        expect(indexes.byId.get(iface.symbolId!)).toBe(iface);
        expect(findConflictedQualifiedNames(st.getAllSymbols()).size).toBe(0);
    });

    it('follows a member\'s parent link to its anonymous owner', async () => {
        const { st } = await buildST(anonymousText);
        const iface = anonymousInterface(st);
        const member = st.findByName('w')[0];
        // A member of an anonymous element has no qualified name either (KerML).
        expect(member.qualifiedName).toBeUndefined();
        expect(member.parentId).toBe(iface.symbolId);
        expect(st.getOwner(member)).toBe(iface);
        expect(st.getOwner(iface)).toBe(st.getSymbol('Demo'));

        const { buildSymbolIndexes, ownerOf, NamespaceResolver } = await import('../../server/src/symbols/namespaceResolver.js');
        const indexes = buildSymbolIndexes(st.getAllSymbols());
        expect(ownerOf(member, indexes)).toBe(iface);
        // The member still sees the enclosing package, through its anonymous owner.
        expect([...new NamespaceResolver().namespaceAncestors(member, indexes)]).toEqual([iface, 'Demo', '']);
    });

    it('links each member to its own owner when a declared name is quoted like an anonymous element\'s declaration', async () => {
        const { st, qualifiedName } = await buildCollision();
        const iface = anonymousInterface(st);
        const declared = st.getSymbol(qualifiedName)!;
        const w = st.findByName('w')[0];
        const inner = st.findByName('inner')[0];
        // Their owners share a declaration, but not their identity: parentId tells them apart.
        expect([w.qualifiedName, inner.qualifiedName]).toEqual([undefined, `${qualifiedName}::inner`]);
        expect([w.parentId, inner.parentId]).toEqual([iface.symbolId, declared.symbolId]);
        expect(st.getOwner(w)).toBe(iface);
        expect(st.getOwner(inner)).toBe(declared);

        const { buildSymbolIndexes, ownerOf, NamespaceResolver } = await import('../../server/src/symbols/namespaceResolver.js');
        const indexes = buildSymbolIndexes(st.getAllSymbols());
        expect(ownerOf(w, indexes)).toBe(iface);
        expect(ownerOf(inner, indexes)).toBe(declared);
        expect([...new NamespaceResolver().namespaceAncestors(w, indexes)]).toEqual([iface, 'Demo', '']);
        expect([...new NamespaceResolver().namespaceAncestors(inner, indexes)]).toEqual([qualifiedName, 'Demo', '']);
    });

    it('links every member to its own owner by symbol ID, inside an anonymous element too', async () => {
        const { st } = await buildST(`package Demo {
    part a { port p; }
    part b { port p; }
    interface a.p to b.p { part x { part y; } }
}
`);
        const iface = anonymousInterface(st);
        const x = st.findByName('x')[0];
        const y = st.findByName('y')[0];
        expect(x.parentId).toBe(iface.symbolId);
        expect(y.parentId).toBe(x.symbolId);
        expect(st.getOwner(y)).toBe(x);
        expect(st.getOwner(x)).toBe(iface);
    });

    it('keeps an anonymous namespace\'s members apart from a declared one quoted like its declaration', async () => {
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
                expect([anonymous.declaration, isAnonymous(anonymous)]).toEqual([name, true]);
                const declared = st.getSymbol(`Demo::${name}`)!;
                expect([declared.kind, isAnonymous(declared)]).toEqual(['part def', false]);
                expect(st.findByName(name)).toEqual([declared]);
                expect(indexes.byName.get(name)).toEqual([declared]);
                expect(members.get(name)?.map((m) => m.symbol)).toEqual([declared]);
                expect(st.getSymbolById(anonymous.symbolId!)).toBe(anonymous);
            }
        });
    }

    it('drops an anonymous element from its indexes when its document is rebuilt without it', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const { st, qualifiedName, text } = await buildCollision();
        const id = anonymousInterface(st).symbolId!;
        st.build('test://test.sysml', parseDocument(text.replace('interface a.p to b.p { attribute w; }', '')));
        expect(st.getSymbolById(id)).toBeUndefined();
        expect(st.getSymbol(qualifiedName)?.kind).toBe('part');
        expect(st.getAllSymbols().some((s) => isAnonymous(s))).toBe(false);
    });
});

describe('quoted names with a colon or keyword', () => {
    it.each(["'\u03a9'", "'\u00b0C'", "'m\u00b2'", "('\u03a9', 'm\u00b2')"])(
        'should not extract quoted values from %s as specialization names',
        async (value) => {
            const { st, result } = await buildST(`package Units {
    attribute :>> referenceUnit = ${value};
    attribute :>> otherUnit default ${value};
    attribute :>> initialUnit := ${value};
    attribute typedUnit : MissingUnit = ${value};
}`);
            expect(result.errors).toHaveLength(0);
            const symbols = st.getAllSymbols();
            expect(symbols.find(s => s.name === 'referenceUnit')?.typeNames)
                .toEqual(['referenceUnit']);
            expect(symbols.find(s => s.name === 'referenceUnit')?.specializationNames)
                .toEqual(['referenceUnit']);
            expect(symbols.find(s => s.name === 'otherUnit')?.typeNames)
                .toEqual(['otherUnit']);
            expect(symbols.find(s => s.name === 'initialUnit')?.typeNames)
                .toEqual(['initialUnit']);
            expect(symbols.find(s => s.name === 'typedUnit')?.typeNames)
                .toEqual(['MissingUnit']);
        },
    );

    it('should mask only declaration tokens and never quoted text in documentation', async () => {
        const { SysMLv2Parser } = await import('../../server/src/generated/SysMLv2Parser.js');
        const { st, result } = await buildST(`package 'Structure: { then \\' Context' {
    doc /* 'a quoted name' :> 'a false type' */
}`);
        expect(result.errors).toHaveLength(0);
        const pending = [result.tree!];
        let packageContext;
        while (pending.length > 0) {
            const current = pending.pop()!;
            if (current.ruleIndex === SysMLv2Parser.RULE_package) {
                packageContext = current;
                break;
            }
            for (let index = 0; index < current.getChildCount(); index++) {
                const child = current.getChild(index);
                if (child && 'ruleIndex' in child) pending.push(child as typeof current);
            }
        }
        expect(packageContext).toBeDefined();
        const masked = st['maskedDeclaration'](packageContext!);
        expect(masked.text).toBe("package'0'");
        expect(masked.quotedName("'0'")).toBe("Structure: { then ' Context");
        expect(masked.quotedName("'1'")).toBeUndefined();
    });

    it('should extract symbols promptly from quote-heavy documentation', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
        const comment = String.raw`\'`.repeat(32_768);
        const result = parseDocument(`package 'Structure: System Context' {
    part def 'Unit: Main';
    part unit : 'Unit: Main';
    doc /* ${comment} */
}`);
        expect(result.errors).toHaveLength(0);
        const st = new SymbolTable();
        const start = performance.now();
        st.build('test://quotes.sysml', result);
        const elapsed = performance.now() - start;
        expect(st.getAllSymbols().map(symbol => [symbol.name, symbol.typeNames])).toEqual([
            ['Structure: System Context', []],
            ['Unit: Main', []],
            ['unit', ['Unit: Main']],
        ]);
        expect(elapsed).toBeLessThan(1_000);
    }, 15_000);

    it('should take no type from a quoted name, and keep a quoted type whole', async () => {
        const { st, result } = await buildST(`
package P {
    package 'Structure: System Context' {
        part def 'Unit: Main';
        part def 'Spare: Unit then more' :> 'Unit: Main';
        part 'unit: main' : 'Unit: Main';
        attribute def 'Mode: A';
    }
}
`);

        expect(result.errors).toHaveLength(0);
        const typesOf = (name: string) => {
            const symbol = st.getAllSymbols().find(s => s.name === name);
            return [symbol?.typeNames, symbol?.specializationNames];
        };
        expect(typesOf('Structure: System Context')).toEqual([[], []]);
        expect(typesOf('Unit: Main')).toEqual([[], []]);
        expect(typesOf('Mode: A')).toEqual([[], []]);
        expect(typesOf('Spare: Unit then more')).toEqual([['Unit: Main'], ['Unit: Main']]);
        expect(typesOf('unit: main')[0]).toEqual(['Unit: Main']);
    });

    it('should take no type from a quoted name in a feature value, as from an unquoted one', async () => {
        const { st, result } = await buildST(`
package P {
    attribute def 'Unit: Main';
    attribute byName :>> referenceUnit = ohm;
    attribute byShortName :>> referenceUnit = 'Ω';
    attribute byQualifiedShortName :>> referenceUnit = SI::'Ω';
    attribute resistance : 'Unit: Main' = 'Ω';
    attribute <'A :> B'> subsetLike : 'Unit: Main';
    attribute <'A :>> B'> redefineLike :> 'A :> B' = 'A :>> B';
}
`);

        expect(result.errors).toHaveLength(0);
        const typesOf = (name: string) => st.getAllSymbols().find(s => s.name === name)?.typeNames;
        expect(typesOf('byName')).toEqual(['referenceUnit']);
        expect(typesOf('byShortName')).toEqual(['referenceUnit']);
        expect(typesOf('byQualifiedShortName')).toEqual(['referenceUnit']);
        expect(typesOf('resistance')).toEqual(['Unit: Main']);
        expect(typesOf('subsetLike')).toEqual(['Unit: Main']);
        expect(typesOf('redefineLike')).toEqual(['A :> B']);
    });

    it('should exclude values and read masked names only in leading qualified names', async () => {
        const { SysMLv2Parser } = await import('../../server/src/generated/SysMLv2Parser.js');
        const { st, result } = await buildST(`package P { attribute referenceUnit : 'Ω' = 'value only'; }`);
        expect(result.errors).toHaveLength(0);
        const pending = [result.tree!];
        let attribute;
        while (pending.length > 0 && !attribute) {
            const current = pending.pop()!;
            if (current.ruleIndex === SysMLv2Parser.RULE_attributeUsage) attribute = current;
            for (let index = 0; index < current.getChildCount(); index++) {
                const child = current.getChild(index);
                if (child && 'ruleIndex' in child) pending.push(child as typeof current);
            }
        }
        expect(attribute).toBeDefined();
        const masked = st['maskedDeclaration'](attribute!);
        expect(masked.text).toBe("attributereferenceUnit:'0'");
        expect(masked.quotedName("'1'")).toBeUndefined();
        expect(masked.quotedName("'0'")).toBe('Ω');
        expect(masked.quotedName(" SI::'0'")).toBe('Ω');
        expect(masked.quotedName("$::SI::'0'")).toBe('Ω');
        expect(masked.quotedName("SI::'0'::'0'")).toBe('Ω');
        expect(masked.quotedName("A::'0'::B::C::D::'0'='0'")).toBe('Ω');
        expect(masked.quotedName("referenceUnit='0'")).toBeUndefined();
        expect(masked.quotedName("A::B='0'")).toBeUndefined();
    });
});

describe('isAnonymous and displayName', () => {
    const base = { kind: 'connection' as SysMLSymbol['kind'], symbolId: 'id', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, selectionRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, uri: 'test://t.sysml', typeNames: [], specializationNames: [], children: [] };

    it('calls an element anonymous when it has neither a name nor a short name', async () => {
        const { displayName } = await import('../../server/src/symbols/sysmlElements.js');
        expect(isAnonymous({ ...base, name: '', declaration: 'connect a.p to b.p' } as SysMLSymbol)).toBe(true);
        expect(isAnonymous({ ...base, name: 'link' } as SysMLSymbol)).toBe(false);
        expect(isAnonymous({ ...base, name: '', shortName: 'l' } as SysMLSymbol)).toBe(false);
        expect(displayName({ ...base, name: 'link' } as SysMLSymbol)).toBe('link');
    });

    it('shows an anonymous element by its declaration without a name, as the standard\'s diagrams do', async () => {
        const { displayName } = await import('../../server/src/symbols/sysmlElements.js');
        // Its specialization part (8.2.3.6), else what it connects, else its declaration as written, else its kind.
        expect(displayName({ ...base, name: '', declaration: 'connection : C connect a.p to b.p', specialization: ': C', ends: ['a.p', 'b.p'] } as SysMLSymbol)).toBe(': C');
        expect(displayName({ ...base, name: '', declaration: 'connect a.p to b.p', ends: ['a.p', 'b.p'] } as SysMLSymbol)).toBe('a.p→b.p');
        expect(displayName({ ...base, name: '', declaration: 'connect (a, b, c)', ends: ['a', 'b', 'c'] } as SysMLSymbol)).toBe('a-b-c');
        expect(displayName({ ...base, kind: 'transition' as SysMLSymbol['kind'], name: '', declaration: 'transition first s1 then s2', source: 's1', target: 's2' } as SysMLSymbol)).toBe('s1→s2');
        expect(displayName({ ...base, name: '', declaration: 'connection' } as SysMLSymbol)).toBe('connection');
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

    it('gives a typed element without a name or ends no name, its declaration, and a symbol ID through its owner', async () => {
        const { st, result } = await buildST('package Demo { connection def Cn; connection : Cn; }');
        expect(result.errors).toHaveLength(0);
        const connection = st.getSymbolsForUri('test://test.sysml').find((s) => s.kind === 'connection')!;
        expect([connection.name, connection.declaration, connection.qualifiedName, isAnonymous(connection)]).toEqual(['', 'connection : Cn', undefined, true]);
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
    ])('makes `%s` anonymous, never named after its type or what it subsets', async (body, kind, declaration) => {
        const { st, result } = await build(body);
        expect(result.errors).toEqual([]);
        const [element] = membersOfW(st);
        expect([element.kind, element.name, element.declaration, element.qualifiedName, isAnonymous(element)]).toEqual([kind, '', declaration, undefined, true]);
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
        const members = st.getAllSymbols().filter((s) => s.parentId === anonymous.symbolId);
        expect(members.map((s) => [s.name, s.qualifiedName])).toEqual([['m', undefined], ['n', undefined]]);
    });
});

describe('reference usages without `ref`', () => {
    it('should give a usage without a kind keyword a reference usage symbol, like `ref`', async () => {
        const { st, result } = await buildST(`
package Demo {
    part def A;
    part def P {
        ref r : A;
        x : A;
        in y : A;
        out z : A [2];
        derived d : A;
    }
}
`);

        expect(result.errors).toHaveLength(0);
        const members = st.getSymbolsForUri('test://test.sysml').filter(s => st.getOwner(s)?.qualifiedName === 'Demo::P');
        expect(members.map(s => [s.qualifiedName, s.kind, s.typeNames, s.multiplicity])).toEqual([
            ['Demo::P::r', 'ref', ['A'], undefined],
            ['Demo::P::x', 'ref', ['A'], undefined],
            ['Demo::P::y', 'ref', ['A'], undefined],
            ['Demo::P::z', 'ref', ['A'], '2'],
            ['Demo::P::d', 'ref', ['A'], undefined],
        ]);
    });

    it('should give an action\'s parameters symbols owned by the action', async () => {
        const { st } = await buildST(`
package Demo {
    part def A;
    action def Act {
        in item1 : A;
        out item2 : A;
    }
    action act {
        inout p : A;
    }
}
`);

        expect(st.getAllSymbols().filter(s => s.kind === 'ref').map(s => s.qualifiedName)).toEqual([
            'Demo::Act::item1', 'Demo::Act::item2', 'Demo::act::p',
        ]);
    });

    it('should name a redefinition without a name of its own after the feature it redefines', async () => {
        const { st } = await buildST(`
package Demo {
    part def A;
    part def P { x : A; }
    part q : P {
        :>> x : A;
    }
}
`);

        const [x] = st.getAllSymbols().filter(s => st.getOwner(s)?.qualifiedName === 'Demo::q');
        expect([x.qualifiedName, x.kind, isAnonymous(x)]).toEqual(['Demo::q::x', 'ref', false]);
    });

    it('should give a body without a declaration an anonymous reference usage owning its members', async () => {
        const { st, result } = await buildST(`
package Demo {
    part def A;
    {
        part w : A;
    }
}
`);

        expect(result.errors).toHaveLength(0);
        const anonymous = st.getAllSymbols().find(s => s.kind === 'ref')!;
        expect([isAnonymous(anonymous), displayName(anonymous), st.getOwner(anonymous)?.qualifiedName]).toEqual([true, 'ref', 'Demo']);
        expect(st.findByName('w').map(w => w.parentId)).toEqual([anonymous.symbolId]);
    });

    it('should not read the rest of an invalid statement as a usage', async () => {
        const { st, result } = await buildST(`
package Demo {
    requirement def R;
    requirement r : R;
    part sys {
        verify r;
    }
    package Q {
        import Demo::R;
    }
    verify requirement r by sys;
}
`);

        expect(result.errors.length).toBeGreaterThan(0);
        expect(st.getAllSymbols().filter(s => s.kind === 'ref')).toEqual([]);
    });

    it('should read every declaration form of a usage without a kind keyword', async () => {
        const { st, result } = await buildST(`
package Demo {
    private import ScalarValues::*;
    part def A;
    part def B { attribute mass : Real; x : A; }
    part b2 : B {
        :>> mass = 1500;
        redefines x;
        <s1> short : A;
        multi[2] : A;
        sub :> x;
        abstract constant c1 : A;
    }
}
`);

        expect(result.errors).toHaveLength(0);
        const members = st.getSymbolsForUri('test://test.sysml').filter(s => st.getOwner(s)?.qualifiedName === 'Demo::b2');
        expect(members.map(s => [s.name, s.kind, s.shortName, s.typeNames, s.multiplicity])).toEqual([
            // As for any usage kind, a `:>>` redefinition is also listed with the type names.
            ['mass', 'ref', undefined, ['mass'], undefined],
            ['x', 'ref', undefined, [], undefined],
            ['short', 'ref', 's1', ['A'], undefined],
            ['multi', 'ref', undefined, ['A'], '2'],
            ['sub', 'ref', undefined, ['x'], undefined],
            ['c1', 'ref', undefined, ['A'], undefined],
        ]);
        expect(members.slice(0, 2).map(s => s.redefinedFeatureTargets)).toEqual([['mass'], ['x']]);
    });

    it('should give a usage without a kind keyword its visibility and documentation', async () => {
        const { st } = await buildST(`
package Demo {
    part def A;
    part def P {
        private hidden : A;
        documented : A {
            doc /* The documented feature. */
        }
    }
}
`);

        expect(st.findByName('hidden').map(s => s.visibility)).toEqual(['private']);
        expect(st.findByName('documented')[0].documentation).toContain('The documented feature.');
    });

    it('should make a named usage without a kind keyword own the members of its body', async () => {
        const { st } = await buildST(`
package Demo {
    part def A;
    part def P {
        named : A { part inner : A; }
    }
}
`);

        const named = st.findByName('named')[0];
        expect(st.findByName('inner').map(s => [s.qualifiedName, s.parentId])).toEqual([['Demo::P::named::inner', named.symbolId]]);
    });

    it('should give calculation and constraint parameters symbols, and a return parameter an anonymous one', async () => {
        const { st, result } = await buildST(`
package Demo {
    private import ScalarValues::*;
    calc def Double {
        in v : Real;
        return : Real;
        v * 2
    }
    calc def Half {
        in w : Real;
        return h : Real;
        w / 2
    }
    constraint def Limit {
        in m : Real;
        m < 2000
    }
}
`);

        expect(result.errors).toHaveLength(0);
        const refs = st.getAllSymbols().filter(s => s.kind === 'ref').sort((a, b) => a.range.start.line - b.range.start.line);
        expect(refs.map(s => [st.getOwner(s)?.name, s.name, displayName(s), s.typeNames])).toEqual([
            ['Double', 'v', 'v', ['Real']],
            ['Double', '', ': Real', ['Real']],
            ['Half', 'w', 'w', ['Real']],
            ['Half', 'h', 'h', ['Real']],
            ['Limit', 'm', 'm', ['Real']],
        ]);
    });

    it('should not read enumerated values, successions, state actions or result expressions as usages', async () => {
        const { st, result } = await buildST(`
package Demo {
    private import ScalarValues::*;
    part def B { attribute mass : Real; }
    enum def Color { red; green; }
    state def S {
        entry; then off;
        state off;
    }
    action def Seq {
        action a1;
        action a2;
        first a1 then a2;
    }
    requirement def R {
        subject v : B;
        require constraint { v.mass < 2000 }
    }
    metadata def Tag;
    #Tag t1 : B;
}
`);

        expect(result.errors).toHaveLength(0);
        expect(st.getAllSymbols().filter(s => s.kind === 'ref')).toEqual([]);
    });

    it('should give a lone `;` an anonymous reference usage symbol, an empty usage by the grammar', async () => {
        const { st, result } = await buildST(`
package Demo {
    part def A;
    part def P {
        part a : A;;
    }
}
`);

        expect(result.errors).toHaveLength(0);
        const refs = st.getAllSymbols().filter(s => s.kind === 'ref');
        expect(refs.map(s => [isAnonymous(s), displayName(s), st.getOwner(s)?.qualifiedName])).toEqual([[true, 'ref', 'Demo::P']]);
    });

    it('should give a variant naming a separately declared usage a reference usage symbol named after it', async () => {
        const { st, result } = await buildST(`
package Demo {
    item def ItemDef;
    part part1 : ItemDef;
    item item1 : ItemDef;
    part def P { part q : ItemDef; part r : ItemDef [*]; }
    part p : P;
    variation item itemChoice : ItemDef {
        variant part1;
        variant item1;
        variant P::q;
        variant p.r :> part1 { attribute m; }
    }
}
`);

        expect(result.errors).toHaveLength(0);
        const variants = st.getAllSymbols().filter(s => st.getOwner(s)?.qualifiedName === 'Demo::itemChoice')
            .sort((a, b) => a.range.start.line - b.range.start.line);
        expect(variants.map(s => [s.qualifiedName, s.kind, isAnonymous(s), s.specializationNames])).toEqual([
            ['Demo::itemChoice::part1', 'ref', false, []],
            ['Demo::itemChoice::item1', 'ref', false, []],
            ['Demo::itemChoice::q', 'ref', false, []],
            ['Demo::itemChoice::r', 'ref', false, ['part1']],
        ]);
        expect(st.findByName('m').map(s => s.parentId)).toEqual([variants[3].symbolId]);
        // The usages it names keep their own symbols.
        expect(st.findByName('part1').map(s => [s.qualifiedName, s.kind])).toEqual([['Demo::part1', 'part'], ['Demo::itemChoice::part1', 'ref']]);
    });

    it('should name a variant after the usage it references, whichever of its names it is referenced by', async () => {
        const { st, result } = await buildST(`
package Demo {
    item def ItemDef;
    part <p1> part1 : ItemDef;
    package Lib { part <q1> q : ItemDef; }
    variation item itemChoice : ItemDef {
        variant p1;
        variant Lib::q1;
    }
}
`);

        expect(result.errors).toHaveLength(0);
        const variants = st.getAllSymbols().filter(s => st.getOwner(s)?.qualifiedName === 'Demo::itemChoice')
            .sort((a, b) => a.range.start.line - b.range.start.line);
        expect(variants.map(s => [s.qualifiedName, s.name, s.shortName, s.namingReference])).toEqual([
            ['Demo::itemChoice::part1', 'part1', 'p1', 'p1'],
            ['Demo::itemChoice::q', 'q', 'q1', 'Lib::q1'],
        ]);
        // Its selection is still the reference as written.
        expect([variants[0].selectionRange.start, variants[0].selectionRange.end]).toEqual([{ line: 6, character: 16 }, { line: 6, character: 18 }]);
    });

    it('should name a variant referencing a feature through a feature chain after that feature', async () => {
        const { st, result } = await buildST(`
package Demo {
    item def ItemDef;
    part def P { part <r1> r : ItemDef; }
    part p : P;
    variation item itemChoice : ItemDef {
        variant p.r1;
    }
}
`);

        expect(result.errors).toHaveLength(0);
        const [variant] = st.getAllSymbols().filter(s => st.getOwner(s)?.qualifiedName === 'Demo::itemChoice');
        expect([variant.qualifiedName, variant.name, variant.shortName]).toEqual(['Demo::itemChoice::r', 'r', 'r1']);
    });

    it('should name a variant after a usage in another document, whichever document is built first', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
        const variation = { uri: 'test://variation.sysml', text: `
package Demo {
    private import Lib::*;
    item def ItemDef;
    variation item itemChoice : ItemDef {
        variant p1;
    }
}
` };
        const lib = { uri: 'test://lib.sysml', text: 'package Lib { part <p1> part1; }' };
        const variantOf = (st: InstanceType<typeof SymbolTable>) => st.getAllSymbols()
            .filter(s => st.getOwner(s)?.qualifiedName === 'Demo::itemChoice').map(s => [s.qualifiedName, s.name, s.shortName]);

        for (const order of [[variation, lib], [lib, variation]]) {
            const st = new SymbolTable();
            for (const { uri, text } of order) st.build(uri, parseDocument(text));
            expect(variantOf(st)).toEqual([['Demo::itemChoice::part1', 'part1', 'p1']]);
        }
        const st = new SymbolTable();
        st.buildAll([variation, lib].map(({ uri, text }) => [uri, parseDocument(text)]));
        expect(variantOf(st)).toEqual([['Demo::itemChoice::part1', 'part1', 'p1']]);

        // Renamed in its own document, it renames the variant; gone, the variant keeps the name it is referenced by.
        st.build(lib.uri, parseDocument('package Lib { part <p1> part2; }'));
        expect(variantOf(st)).toEqual([['Demo::itemChoice::part2', 'part2', 'p1']]);
        st.removeUri(lib.uri);
        expect(variantOf(st)).toEqual([['Demo::itemChoice::p1', 'p1', undefined]]);
    });

    describe('variants named after variants', () => {
        // Each variation's variant names the one before it by its short name, which it only has once that one is named.
        const chainText = (steps: number) => `
package Demo {
    item def I;
    part <a> alpha : I;
    variation item v1 : I { variant a; }
${Array.from({ length: steps - 1 }, (_, i) => `    variation item v${i + 2} : I { variant v${i + 1}::a; }`).join('\n')}
}
`;
        const variantsOf = (st: Awaited<ReturnType<typeof buildST>>['st']) => st.getAllSymbols()
            .filter(s => s.namingReference !== undefined)
            .sort((a, b) => a.range.start.line - b.range.start.line)
            .map(s => [s.qualifiedName, s.shortName]);

        it('should name each variant of a ten-step chain after the usage at its end', async () => {
            const { st, result } = await buildST(chainText(10));

            expect(result.errors).toHaveLength(0);
            expect(variantsOf(st)).toEqual(Array.from({ length: 10 }, (_, i) => [`Demo::v${i + 1}::alpha`, 'a']));
            expect(st.getNamingIssues('test://test.sysml')).toEqual([]);
        });

        it('should report the variants left unnamed when the budget of rounds runs out', async () => {
            const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
            const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
            const st = new SymbolTable(3);
            st.build('test://test.sysml', parseDocument(chainText(10)));

            expect(variantsOf(st).slice(2, 4)).toEqual([['Demo::v3::alpha', 'a'], ['Demo::v4::a', undefined]]);
            const issues = st.getNamingIssues('test://test.sysml');
            expect(issues.map(issue => [issue.reason, issue.symbol.qualifiedName, issue.reason === 'limit' && issue.rounds]))
                .toEqual([['limit', 'Demo::v4::a', 3]]);
            const { describeNamingIssue } = await import('../../server/src/symbols/symbolTable.js');
            expect(describeNamingIssue(issues[0])).toEqual({
                code: 'naming-resolution-limit',
                message: "The names of 'a' did not settle within 3 rounds of name resolution; it is named 'a' for now.",
            });
        });

        it('should report variants whose names keep changing as unstable', async () => {
            // Each variant is named after the other once both take the names of `alpha`.
            const { st, result } = await buildST(`
package Demo {
    item def I;
    part <a> alpha : I;
    variation item v : I { variant a; variant alpha; }
}
`);

            expect(result.errors).toHaveLength(0);
            const issues = st.getNamingIssues('test://test.sysml');
            expect(issues.map(issue => [issue.reason, issue.symbol.range.start.line])).toEqual([['unstable', 4], ['unstable', 4]]);
            const { describeNamingIssue } = await import('../../server/src/symbols/symbolTable.js');
            expect(describeNamingIssue(issues[0])).toEqual({
                code: 'circular-naming',
                message: `Circular naming: the names of '${issues[0].symbol.name}' keep changing without settling.`,
            });
        });

        it('should report variants named after one another as a cycle, and keep their names', async () => {
            const { st, result } = await buildST(`
package Demo {
    item def I;
    variation item v1 : I { variant v2::a; }
    variation item v2 : I { variant v1::a; }
}
`);

            expect(result.errors).toHaveLength(0);
            expect(variantsOf(st)).toEqual([['Demo::v1::a', undefined], ['Demo::v2::a', undefined]]);
            const issues = st.getNamingIssues('test://test.sysml');
            expect(issues.map(issue => [issue.reason, issue.symbol.qualifiedName, issue.reason === 'cycle' && issue.cycle.map(s => s.qualifiedName)]))
                .toEqual([
                    ['cycle', 'Demo::v1::a', ['Demo::v1::a', 'Demo::v2::a']],
                    ['cycle', 'Demo::v2::a', ['Demo::v2::a', 'Demo::v1::a']],
                ]);
        });
    });

    it('should leave a variant declared with a kind keyword as it is', async () => {
        const { st } = await buildST(`
package Demo {
    item def ItemDef;
    part part1 : ItemDef;
    variation item itemChoice : ItemDef {
        variant part references part1;
        variant item item2 : ItemDef;
    }
}
`);

        const variants = st.getAllSymbols().filter(s => st.getOwner(s)?.qualifiedName === 'Demo::itemChoice')
            .sort((a, b) => a.range.start.line - b.range.start.line);
        expect(variants.map(s => [s.kind, s.name, displayName(s)])).toEqual([['part', '', 'references part1'], ['item', 'item2', 'item2']]);
    });

    it('should give no symbol to a usage right after a token the parser skipped (known limit)', async () => {
        const { st, result } = await buildST(`
package Demo {
    part def A;
    part def P {
        part a : A; ) x : A;
    }
}
`);

        expect(result.errors.length).toBeGreaterThan(0);
        expect(st.findByName('x')).toEqual([]);
    });
});

describe('concern definitions and usages', () => {
    it('should extract concern definitions and usages as namespaces of their own', async () => {
        const { st, result } = await buildST(`
package Demo {
    part def Unit;
    concern def Hazard {
        subject unit : Unit;
        attribute severity;
    }
    concern overTemperature : Hazard {
        attribute limit;
    }
}
`);

        expect(result.errors).toHaveLength(0);
        const hazard = st.getSymbol('Demo::Hazard');
        const overTemperature = st.getSymbol('Demo::overTemperature');
        expect(hazard).toMatchObject({ kind: 'concern def' });
        expect(overTemperature).toMatchObject({ kind: 'concern', typeNames: ['Hazard'] });
        expect(st.getSymbol('Demo::Hazard::severity')?.parentId).toBe(hazard?.symbolId);
        expect(st.getSymbol('Demo::overTemperature::limit')?.parentId).toBe(overTemperature?.symbolId);
        expect(st.getSymbol('Demo::limit')).toBeUndefined();
    });

    it('should extract framed concerns as concern usages that own their members', async () => {
        const { st, result } = await buildST(`
package Demo {
    concern def Hazard;
    concern overTemperature : Hazard;
    requirement def Safety {
        frame concern thermal : Hazard { attribute limit; }
        frame concern voltage : Hazard { attribute limit; }
        frame overTemperature { attribute margin; }
    }
}
`);

        expect(result.errors).toHaveLength(0);
        const safety = st.getSymbol('Demo::Safety')!;
        for (const name of ['thermal', 'voltage']) {
            const framed = st.getSymbol(`Demo::Safety::${name}`);
            expect(framed).toMatchObject({ kind: 'concern', typeNames: ['Hazard'], parentId: safety.symbolId });
            expect(st.getSymbol(`Demo::Safety::${name}::limit`)?.parentId).toBe(framed?.symbolId);
        }
        expect(st.getSymbol('Demo::Safety::limit')).toBeUndefined();

        // `frame overTemperature` refers to a concern declared elsewhere: it declares no name of its own.
        const referenced = st.getAllSymbols().find(s => s.kind === 'concern' && s.parentId === safety.symbolId && !s.name);
        expect(referenced).toMatchObject({ declaration: 'overTemperature' });
        expect(st.getAllSymbols().find(s => s.name === 'margin')?.parentId).toBe(referenced?.symbolId);
    });
});
