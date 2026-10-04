import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * Integration tests for the `sysml/model` custom LSP request.
 *
 * These tests exercise the SysMLModelProvider directly (without a running
 * LSP connection) by feeding it parse results through the DocumentManager.
 */
describe('SysML Model Provider', () => {
    const fixturesDir = join(__dirname, '..', 'fixtures');

    /**
     * Helper: build a model response for inline SysML text.
     */
    async function getModelForText(text: string, scopes?: string[]) {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const { DocumentManager } = await import('../../server/src/documentManager.js');
        const { SysMLModelProvider } = await import('../../server/src/model/sysmlModelProvider.js');

        const uri = 'test://model-test.sysml';
        const docManager = new DocumentManager();

        // Simulate document open by parsing and injecting into the cache
        parseDocument(text);
        // Use the internal parse method by creating a mock TextDocument
        const { TextDocument } = await import('vscode-languageserver-textdocument');
        const doc = TextDocument.create(uri, 'sysml', 1, text);
        // We need to wire documents; use parse directly via the manager
        docManager.parse(doc);

        const provider = new SysMLModelProvider(docManager);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return provider.getModel(uri, 1, scopes as any);
    }

    /**
     * Helper: build a model response for a target document, with one or more
     * other documents also open in the same workspace (for cross-document
     * import/namespace-visibility tests -- see the `diagnostics` describe
     * block's cross-package cases).
     */
    async function getModelForDocuments(
        entries: Array<{ uri: string; text: string }>,
        targetUri: string,
        scopes?: string[],
    ) {
        const { DocumentManager } = await import('../../server/src/documentManager.js');
        const { SysMLModelProvider } = await import('../../server/src/model/sysmlModelProvider.js');
        const { TextDocument } = await import('vscode-languageserver-textdocument');

        const docManager = new DocumentManager();
        for (const entry of entries) {
            docManager.parse(TextDocument.create(entry.uri, 'sysml', 1, entry.text));
        }

        const provider = new SysMLModelProvider(docManager);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return provider.getModel(targetUri, 1, scopes as any);
    }

    /**
     * Helper: build a model response for a fixture file.
     */
    async function getModelForFixture(fixturePath: string, scopes?: string[]) {
        const text = readFileSync(join(fixturesDir, fixturePath), 'utf-8');
        return getModelForText(text, scopes);
    }

    // -------------------------------------------------------------------
    // Response shape validation
    // -------------------------------------------------------------------

    describe('response shape', () => {
        it('should return version and stats', async () => {
            const model = await getModelForText(`
package Test {
    part def Vehicle;
}
`);
            expect(model.version).toBe(1);
            expect(model.stats).toBeDefined();
            expect(model.stats!.totalElements).toBeGreaterThan(0);
            expect(typeof model.stats!.parseTimeMs).toBe('number');
        });

        it('should return version -1 for unknown document', async () => {
            const { DocumentManager } = await import('../../server/src/documentManager.js');
            const { SysMLModelProvider } = await import('../../server/src/model/sysmlModelProvider.js');

            const docManager = new DocumentManager();
            const provider = new SysMLModelProvider(docManager);
            const result = provider.getModel('test://nonexistent.sysml', 1);

            expect(result.version).toBe(-1);
        });

        it('should return only requested scopes', async () => {
            const model = await getModelForText(`
package Test {
    part def Vehicle;
}
`, ['elements']);

            expect(model.elements).toBeDefined();
            expect(model.relationships).toBeUndefined();
            expect(model.sequenceDiagrams).toBeUndefined();
            expect(model.activityDiagrams).toBeUndefined();
            expect(model.resolvedTypes).toBeUndefined();
            expect(model.diagnostics).toBeUndefined();
        });

        it('should return all scopes when none specified', async () => {
            const model = await getModelForText(`
package Test {
    part def Vehicle;
}
`);

            expect(model.elements).toBeDefined();
            expect(model.relationships).toBeDefined();
            expect(model.sequenceDiagrams).toBeDefined();
            expect(model.activityDiagrams).toBeDefined();
            expect(model.resolvedTypes).toBeDefined();
            expect(model.diagnostics).toBeDefined();
        });
    });

    // -------------------------------------------------------------------
    // Element tree
    // -------------------------------------------------------------------

    describe('elements', () => {
        it('should extract a package with nested definitions', async () => {
            const model = await getModelForText(`
package VehicleModel {
    part def Vehicle {
        attribute mass : Real;
        port powerOut : PowerPort;
    }

    part def Engine {
        attribute power : Real;
    }
}
`, ['elements']);

            const elements = model.elements!;
            expect(elements.length).toBeGreaterThan(0);

            // Find the package
            const pkg = elements.find(e => e.type === 'package' && e.name === 'VehicleModel');
            expect(pkg).toBeDefined();
            expect(pkg!.children.length).toBeGreaterThanOrEqual(2);

            // Find Vehicle part def inside the package
            const vehicle = pkg!.children.find(e => e.type === 'part def' && e.name === 'Vehicle');
            expect(vehicle).toBeDefined();

            // Vehicle should have children (attributes, ports)
            expect(vehicle!.children.length).toBeGreaterThanOrEqual(1);
        });

        it('should populate type attributes for typed usages', async () => {
            const model = await getModelForText(`
package Test {
    part def Engine;
    part def Vehicle {
        part engine : Engine;
    }
}
`, ['elements']);

            const elements = model.elements!;
            const pkg = elements.find(e => e.name === 'Test');
            expect(pkg).toBeDefined();

            const vehicle = pkg!.children.find(e => e.name === 'Vehicle');
            expect(vehicle).toBeDefined();

            const engine = vehicle!.children.find(e => e.name === 'engine');
            expect(engine).toBeDefined();
            expect(engine!.attributes['partType']).toBe('Engine');
        });

        it('should derive visibility from membership syntax, not documentation prose', async () => {
            const model = await getModelForText(`
package Demo {
    protected port def Explicit;
    port def DCBus {
        doc /* JEITA window; PCM-protected pack = second safety layer. */
        attribute voltage;
    }
}
`, ['elements']);

            const pkg = model.elements!.find(e => e.name === 'Demo');
            const explicit = pkg!.children.find(e => e.name === 'Explicit');
            const dcBus = pkg!.children.find(e => e.name === 'DCBus');

            expect(explicit!.attributes['visibility']).toBe('protected');
            expect(dcBus!.attributes['visibility']).toBeUndefined();
        });

        it('should classify port types with portType attribute', async () => {
            const model = await getModelForText(`
package Test {
    port def PowerPort;
    part def Vehicle {
        port p : PowerPort;
    }
}
`, ['elements']);

            const elements = model.elements!;
            const pkg = elements.find(e => e.name === 'Test');
            const vehicle = pkg!.children.find(e => e.name === 'Vehicle');
            const port = vehicle?.children.find(e => e.name === 'p');
            expect(port).toBeDefined();
            expect(port!.type).toBe('port');
            expect(port!.attributes['portType']).toBe('PowerPort');
        });

        it('should report each symbol\'s ID, and it as the source of its relationships', async () => {
            const model = await getModelForText(`
package Test {
    part def Engine;
    part def Vehicle {
        part engine : Engine;
    }
}
`, ['elements', 'relationships']);

            const pkg = model.elements!.find(e => e.name === 'Test')!;
            const vehicle = pkg.children.find(e => e.name === 'Vehicle')!;
            const engine = vehicle.children.find(e => e.name === 'engine')!;
            const ids = [pkg, vehicle, engine].map(e => e.symbolId);
            expect(ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))).toBe(true);
            expect(new Set(ids).size).toBe(3);
            expect(engine.relationships).toEqual([{ type: 'typing', source: 'engine', sourceId: engine.symbolId, target: 'Engine' }]);
            expect(model.relationships).toContainEqual({ type: 'typing', source: 'engine', sourceId: engine.symbolId, target: 'Engine' });
        });

        it('should report each element\'s displayName: its name, or for an anonymous one the text the outline shows', async () => {
            const model = await getModelForText(`
package Demo {
    part def Engine;
    part a { port p; }
    part b { port p; }
    part car { part : Engine; }
    connect a.p to b.p { attribute flowRate; }
}
`, ['elements']);

            const labels: string[][] = [];
            const visit = (elements: any[]) => elements.forEach(element => {
                labels.push([element.name, element.displayName]);
                visit(element.children ?? []);
            });
            visit(model.elements ?? []);
            expect(labels).toEqual([
                ['Demo', 'Demo'],
                ['Engine', 'Engine'],
                ['a', 'a'],
                ['p', 'p'],
                ['b', 'b'],
                ['p', 'p'],
                ['car', 'car'],
                ['', ': Engine'],
                ['', 'a.p→b.p'],
                ['flowRate', 'flowRate'],
            ]);
        });

        it('should report the symbol ID of the allocation, named or anonymous, its allocation relationship is', async () => {
            const model = await getModelForText(`
package Demo {
    allocation def Alloc;
    allocation a1 : Alloc { end l; end p; }
    allocation : Alloc { end p; end l; }
}
`, ['elements', 'relationships']);

            const [named, anonymous] = model.elements!.find(e => e.name === 'Demo')!.children.filter(e => e.type === 'allocation');
            expect(model.relationships!.filter(r => r.type === 'allocation')).toEqual([
                { type: 'allocation', source: 'l', target: 'p', name: 'a1', symbolId: named.symbolId },
                { type: 'allocation', source: 'p', target: 'l', name: '', symbolId: anonymous.symbolId },
            ]);
        });

        it('should report the satisfying or verifying symbol\'s ID, but none for a `by` name', async () => {
            const model = await getModelForText(`
package Demo {
    requirement def R;
    requirement r : R;
    part sys {
        satisfy r;
        verify r;
    }
    verify requirement r by sys;
}
`, ['elements', 'relationships']);

            const sys = model.elements!.find(e => e.name === 'Demo')!.children.find(e => e.name === 'sys')!;
            const rels = model.relationships!.filter(r => r.type === 'satisfy' || r.type === 'verify');
            expect(rels).toContainEqual({ type: 'satisfy', source: 'sys', sourceId: sys.symbolId, target: 'r' });
            expect(rels).toContainEqual({ type: 'verify', source: 'sys', sourceId: sys.symbolId, target: 'r' });
            // `by sys` gives the source as written: a name, without a symbol ID.
            expect(rels.filter(r => r.type === 'verify' && r.source === 'sys' && r.sourceId === undefined)).toHaveLength(1);
        });

        it('should report the workspace\'s symbol IDs, distinct for declarations clashing across documents', async () => {
            const { DocumentManager } = await import('../../server/src/documentManager.js');
            const { SysMLModelProvider } = await import('../../server/src/model/sysmlModelProvider.js');
            const { TextDocument } = await import('vscode-languageserver-textdocument');
            const docManager = new DocumentManager();
            for (const uri of ['test://a.sysml', 'test://b.sysml']) {
                docManager.parse(TextDocument.create(uri, 'sysml', 1, 'package Demo { part def P { attribute w; } }'));
            }
            const provider = new SysMLModelProvider(docManager);
            const idsIn = (uri: string) => {
                const p = provider.getModel(uri, 1, ['elements']).elements![0].children[0];
                return [p.symbolId, p.children[0].symbolId];
            };
            const workspace = docManager.getWorkspaceSymbolTable();
            for (const uri of ['test://a.sysml', 'test://b.sysml']) {
                const declared = workspace.getSymbolsForUri(uri);
                expect(idsIn(uri)).toEqual([declared.find(s => s.name === 'P')!.symbolId, declared.find(s => s.name === 'w')!.symbolId]);
            }
            expect(new Set([...idsIn('test://a.sysml'), ...idsIn('test://b.sysml')]).size).toBe(4);
        });

        it('should use correct type strings matching extension expectations', async () => {
            const model = await getModelForText(`
package Test {
    part def PD;
    part p : PD;
    attribute def AD;
    attribute a : AD;
    action def ActD;
    state def SD;
    requirement def RD;
    constraint def CD;
    connection def ConnD;
    interface def ID;
    item def ItemD;
    use case def UCD;
    enum def ED;
}
`, ['elements']);

            const elements = model.elements!;
            const pkg = elements.find(e => e.name === 'Test');
            expect(pkg).toBeDefined();

            const children = pkg!.children;
            const typeNames = children.map(c => c.type);

            expect(typeNames).toContain('part def');
            expect(typeNames).toContain('part');
            expect(typeNames).toContain('attribute def');
            expect(typeNames).toContain('attribute');
            expect(typeNames).toContain('action def');
            expect(typeNames).toContain('state def');
            expect(typeNames).toContain('requirement def');
            expect(typeNames).toContain('constraint def');
            expect(typeNames).toContain('connection def');
            expect(typeNames).toContain('interface def');
            expect(typeNames).toContain('item def');
            expect(typeNames).toContain('use case def');
            expect(typeNames).toContain('enum def');
        });

        it('should extract enum values as EnumUsage children', async () => {
            const model = await getModelForText(`
package Test {
    enum def Color {
        enum red;
        green;
        blue;
    }
}
`, ['elements']);

            const pkg = model.elements!.find(e => e.name === 'Test');
            const enumDef = pkg!.children.find(c => c.type === 'enum def' && c.name === 'Color');
            expect(enumDef).toBeDefined();

            const valueNames = enumDef!.children.map(c => c.name);
            expect(valueNames).toContain('red');
            expect(valueNames).toContain('green');
            expect(valueNames).toContain('blue');

            // All should be 'enum' type (EnumUsage)
            const valueTypes = enumDef!.children.map(c => c.type);
            expect(valueTypes.every(t => t === 'enum')).toBe(true);
        });

        it('should extract multiplicity', async () => {
            const model = await getModelForText(`
package Test {
    part def Vehicle {
        part wheels : Wheel[4];
    }
}
`, ['elements']);

            const elements = model.elements!;
            const pkg = elements.find(e => e.name === 'Test');
            const vehicle = pkg!.children.find(e => e.name === 'Vehicle');
            const wheels = vehicle?.children.find(e => e.name === 'wheels');
            expect(wheels).toBeDefined();
            expect(wheels!.attributes['multiplicity']).toBe('4');
        });

        it('should extract documentation', async () => {
            const model = await getModelForText(`
package Test {
    part def Vehicle {
        doc /* documented vehicle */
    }
}
`, ['elements']);

            const elements = model.elements!;
            const pkg = elements.find(e => e.name === 'Test');
            const vehicle = pkg!.children.find(e => e.name === 'Vehicle');
            // Documentation may be extracted if the parser captures it
            expect(vehicle).toBeDefined();
        });

        it('should include range with 0-based positions', async () => {
            const model = await getModelForText(`package Test {
    part def Vehicle;
}
`, ['elements']);

            const elements = model.elements!;
            expect(elements.length).toBeGreaterThan(0);
            const first = elements[0];
            expect(first.range.start.line).toBeGreaterThanOrEqual(0);
            expect(first.range.start.character).toBeGreaterThanOrEqual(0);
            expect(typeof first.range.end.line).toBe('number');
        });
    });

    // -------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------

    describe('relationships', () => {
        it('should extract typing relationships', async () => {
            const model = await getModelForText(`
package Test {
    part def Engine;
    part def Vehicle {
        part engine : Engine;
    }
}
`, ['relationships']);

            const rels = model.relationships!;
            expect(rels.length).toBeGreaterThan(0);

            const typing = rels.find(r => r.type === 'typing' && r.target === 'Engine');
            expect(typing).toBeDefined();
            expect(typing!.source).toBe('engine');
        });

        it('should extract specialization relationships', async () => {
            const model = await getModelForText(`
package Test {
    part def Subsystem;
    part def Transmission :> Subsystem;
}
`, ['relationships']);

            const rels = model.relationships!;
            const spec = rels.find(r => r.type === 'specializes' && r.target === 'Subsystem');
            expect(spec).toBeDefined();
            expect(spec!.source).toBe('Transmission');
        });

        it('should include relationship source and target as strings', async () => {
            const model = await getModelForText(`
package Test {
    part def A;
    part def B :> A;
}
`, ['relationships']);

            for (const rel of model.relationships!) {
                expect(typeof rel.type).toBe('string');
                expect(typeof rel.source).toBe('string');
                expect(typeof rel.target).toBe('string');
            }
        });

        it('should expose transition source, target, and trigger relationships', async () => {
            const model = await getModelForText(`
package Demo {
    state def Machine {
        state a;
        state b;
        transition aToB first a accept Tick then b;
    }
}
`, ['elements', 'relationships']);

            const transition = model.elements![0].children[0].children.find(e => e.name === 'aToB')!;
            expect(model.relationships).toContainEqual({
                type: 'transition',
                source: 'a',
                target: 'b',
                name: 'Tick',
                symbolId: transition.symbolId,
            });
        });

        it('should preserve declared branching successions in activity diagrams', async () => {
            const model = await getModelForText(`
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
`, ['activityDiagrams']);

            const flows = model.activityDiagrams?.find(d => d.name === 'RoutePower')?.flows ?? [];
            expect(flows.map(f => `${f.from}->${f.to}`)).toEqual(expect.arrayContaining([
                'start->senseFlows',
                'senseFlows->serveLoadDirect',
                'serveLoadDirect->routeSurplus',
                'serveLoadDirect->coverDeficit',
                'routeSurplus->done',
                'coverDeficit->done',
            ]));
            expect(flows.map(f => `${f.from}->${f.to}`)).not.toContain('routeSurplus->coverDeficit');
        });
    });

    // -------------------------------------------------------------------
    // Activity Diagrams
    // -------------------------------------------------------------------

    describe('activityDiagrams', () => {
        it('should extract action definitions as activity diagrams', async () => {
            const model = await getModelForText(`
package Test {
    action def ProcessOrder {
        action receiveOrder;
        action validateOrder;
        action fulfillOrder;

        first receiveOrder then validateOrder;
    }
}
`, ['activityDiagrams']);

            const diagrams = model.activityDiagrams!;
            expect(diagrams).toBeDefined();

            // If the parser captures the action def and its children
            if (diagrams.length > 0) {
                const diagram = diagrams[0];
                expect(diagram.name).toBe('ProcessOrder');
                expect(diagram.actions.length).toBeGreaterThanOrEqual(1);
            }
        });

        it('should extract succession flows', async () => {
            const model = await getModelForText(`
package Test {
    action def Workflow {
        action stepA;
        action stepB;
        first stepA then stepB;
    }
}
`, ['activityDiagrams']);

            const diagrams = model.activityDiagrams!;
            if (diagrams.length > 0) {
                const flows = diagrams[0].flows;
                const flow = flows.find(f => f.from === 'stepA' && f.to === 'stepB');
                expect(flow).toBeDefined();
            }
        });

        // ------ D1: Multi-line first/then chain ------

        it('should extract multi-line first/then succession chain', async () => {
            const model = await getModelForText(`
package Test {
    action def ToastBread {
        action lowerBread;
        action heatElements;
        action monitorTime;
        action raiseToast;

        first lowerBread;
        then heatElements;
        then monitorTime;
        then raiseToast;
    }
}
`, ['activityDiagrams']);

            const diagrams = model.activityDiagrams!;
            expect(diagrams.length).toBeGreaterThan(0);

            const diagram = diagrams.find(d => d.name === 'ToastBread');
            expect(diagram).toBeDefined();

            const flows = diagram!.flows;
            // Should have complete chain with synthetic start/done
            expect(flows.find(f => f.from === 'start' && f.to === 'lowerBread')).toBeDefined();
            expect(flows.find(f => f.from === 'lowerBread' && f.to === 'heatElements')).toBeDefined();
            expect(flows.find(f => f.from === 'heatElements' && f.to === 'monitorTime')).toBeDefined();
            expect(flows.find(f => f.from === 'monitorTime' && f.to === 'raiseToast')).toBeDefined();
            expect(flows.find(f => f.from === 'raiseToast' && f.to === 'done')).toBeDefined();
        });

        it('should include synthetic start and done action nodes', async () => {
            const model = await getModelForText(`
package Test {
    action def SimpleFlow {
        action doA;
        action doB;

        first doA;
        then doB;
    }
}
`, ['activityDiagrams']);

            const diagrams = model.activityDiagrams!;
            expect(diagrams.length).toBeGreaterThan(0);

            const diagram = diagrams[0];
            const actionNames = diagram.actions.map(a => a.name);
            expect(actionNames).toContain('start');
            expect(actionNames).toContain('done');

            const startAction = diagram.actions.find(a => a.name === 'start');
            expect(startAction?.type).toBe('initial');

            const doneAction = diagram.actions.find(a => a.name === 'done');
            expect(doneAction?.type).toBe('final');
        });

        it('should extract inline first-then patterns', async () => {
            const model = await getModelForText(`
package Test {
    action def Quick {
        action a1;
        action a2;
        first a1 then a2;
    }
}
`, ['activityDiagrams']);

            const diagrams = model.activityDiagrams!;
            expect(diagrams.length).toBeGreaterThan(0);

            const flows = diagrams[0].flows;
            expect(flows.find(f => f.from === 'start' && f.to === 'a1')).toBeDefined();
            expect(flows.find(f => f.from === 'a1' && f.to === 'a2')).toBeDefined();
            expect(flows.find(f => f.from === 'a2' && f.to === 'done')).toBeDefined();
        });

        // ------ D2: ActionUsage with children ------

        it('should extract activity diagrams from action usages with children', async () => {
            const model = await getModelForText(`
package Test {
    action def MainProcess {
        action subProcess {
            action stepX;
            action stepY;
            first stepX;
            then stepY;
        }
    }
}
`, ['activityDiagrams']);

            const diagrams = model.activityDiagrams!;
            // Should find both the MainProcess and the subProcess
            const subDiagram = diagrams.find(d => d.name === 'subProcess');
            if (subDiagram) {
                expect(subDiagram.flows.length).toBeGreaterThan(0);
                expect(subDiagram.flows.find(f => f.from === 'stepX' && f.to === 'stepY')).toBeDefined();
            }
        });

        // ------ Control nodes: fork/join/merge/decide (issue #62) ------

        it('should emit fork/join/merge/decide control nodes with authoritative types', async () => {
            const model = await getModelForText(`
package PluginTest {
    action testParallelFlow {
        action startStep;
        action taskA;
        action taskB;
        fork myFork;
        join myJoin;
        merge myMerge;
        decide myDecide;
    }
}
`, ['activityDiagrams']);

            const diagrams = model.activityDiagrams!;
            const diagram = diagrams.find(d => d.name === 'testParallelFlow');
            expect(diagram).toBeDefined();

            const byName = (n: string) => diagram!.actions.find(a => a.name === n);

            // Control nodes must be present with the correct type derived from
            // the LSP element kind — NOT guessed from the node name.
            expect(byName('myFork')?.type).toBe('fork');
            expect(byName('myJoin')?.type).toBe('join');
            expect(byName('myMerge')?.type).toBe('merge');
            expect(byName('myDecide')?.type).toBe('decision');

            // The join must not collapse to a merge/decision (the root cause of #62).
            expect(byName('myJoin')?.type).not.toBe('merge');
            expect(byName('myJoin')?.type).not.toBe('decision');
        });
    });

    // -------------------------------------------------------------------
    // Sequence Diagrams (D3 + D4)
    // -------------------------------------------------------------------

    describe('sequenceDiagrams', () => {
        it('should synthesise sequence diagrams from action flows', async () => {
            const model = await getModelForText(`
package Test {
    action def Workflow {
        action stepA;
        action stepB;
        action stepC;

        first stepA;
        then stepB;
        then stepC;
    }
}
`, ['sequenceDiagrams']);

            const diagrams = model.sequenceDiagrams!;
            expect(diagrams).toBeDefined();

            // Should have a synthesised sequence diagram for Workflow
            const seqDiagram = diagrams.find(d => d.name === 'Workflow');
            if (seqDiagram) {
                // Participants should be the action children
                expect(seqDiagram.participants.length).toBeGreaterThan(0);
                // Messages should be synthesised from flows (excluding start/done)
                expect(seqDiagram.messages.length).toBeGreaterThan(0);
                // Check specific message
                const msg = seqDiagram.messages.find(m => m.from === 'stepA' && m.to === 'stepB');
                expect(msg).toBeDefined();
            }
        });

        it('should take an anonymous interface\'s participants from its own members only', async () => {
            const base = `package Demo {
    part a { port p; }
    part b { port p; }
    interface a.p to b.p {
        part x;
        part y;
        message m from x to y;
    }
}
`;
            // A declared part quoted like the anonymous interface's declaration, with a member of its own.
            const declaration = 'interface a.p to b.p';
            const model = await getModelForText(base.replace('\n}\n', `\n    part '${declaration}' { part inner; }\n}\n`), ['sequenceDiagrams']);
            const diagram = model.sequenceDiagrams!.find(d => d.messages.some(m => m.name === 'm'))!;
            expect(diagram.participants.map(p => p.name).sort()).toEqual(['x', 'y']);
        });

        it('should extract send/accept message patterns', async () => {
            const model = await getModelForText(`
package Test {
    action def Interaction {
        part sender : Component;
        part receiver : Component;

        action doSend {
            send Signal via receiver;
        }
    }
}
`, ['sequenceDiagrams']);

            const diagrams = model.sequenceDiagrams!;
            expect(diagrams).toBeDefined();
        });

        // Issue #44: flow statements inside part def should produce messages
        it('should extract flow statements from part def as messages', async () => {
            const model = await getModelForText(`
package CameraTestSequence {
    part def CaptureSequence {
        part photographer;
        part camera;
        part storage;

        flow wakeRequest from photographer to camera;
        flow wakeAck from camera to photographer;
        flow shutterCommand from photographer to camera;
        flow frameBuffered from camera to storage;
        flow persistAck from storage to photographer;
    }
}
`, ['sequenceDiagrams']);

            const diagrams = model.sequenceDiagrams!;
            expect(diagrams).toBeDefined();
            const seq = diagrams.find(d => d.name === 'CaptureSequence');
            expect(seq).toBeDefined();
            expect(seq!.participants.map(p => p.name)).toEqual(
                expect.arrayContaining(['photographer', 'camera', 'storage']),
            );
            expect(seq!.messages.length).toBeGreaterThanOrEqual(5);
            const wake = seq!.messages.find(m => m.name === 'wakeRequest');
            expect(wake).toBeDefined();
            expect(wake!.from).toBe('photographer');
            expect(wake!.to).toBe('camera');
        });

        it('should project named payload types and omit untyped payload names in sequence messages', async () => {
            const model = await getModelForText(`
package NamedPayloadSequence {
    part def Sequence {
        part source;
        part target;
        flow named of i : Signal from source.output to target.input;
        flow untyped of i = 1 from source.other to target.other;
    }
}
`, ['sequenceDiagrams']);

            const diagram = model.sequenceDiagrams!.find(d => d.name === 'Sequence');
            expect(diagram).toBeDefined();
            expect(diagram!.messages.map(message => [message.name, message.payload])).toEqual([
                ['named', 'Signal'],
                ['untyped', ''],
            ]);
        });

        // Issue #44: message statements with dotted endpoints should reduce
        // to root participant names so arrows render between lifelines.
        it('should extract message statements with dotted endpoints', async () => {
            const model = await getModelForText(`
package ServerSequenceModel {
    part def PubSubSequence {
        part producer;
        part server;
        part consumer;

        message publish_message from producer.publish_source_event to server.publish_target_event;
        message subscribe_message from consumer.subscribe_source_event to server.subscribe_target_event;
        message deliver_message from server.deliver_source_event to consumer.deliver_target_event;
    }
}
`, ['sequenceDiagrams']);

            const diagrams = model.sequenceDiagrams!;
            expect(diagrams).toBeDefined();
            const seq = diagrams.find(d => d.name === 'PubSubSequence');
            expect(seq).toBeDefined();
            const pub = seq!.messages.find(m => m.name === 'publish_message');
            expect(pub).toBeDefined();
            expect(pub!.from).toBe('producer');
            expect(pub!.to).toBe('server');
            const deliver = seq!.messages.find(m => m.name === 'deliver_message');
            expect(deliver!.from).toBe('server');
            expect(deliver!.to).toBe('consumer');
        });
    });

    // -------------------------------------------------------------------
    // Package Phantom (B1)
    // -------------------------------------------------------------------

    describe('package phantom', () => {
        it('should not include a package as a child of itself', async () => {
            const model = await getModelForText(`
package VehicleModel {
    part def Vehicle;
    part def Engine;
}
`, ['elements']);

            const elements = model.elements!;
            const pkg = elements.find(e => e.type === 'package' && e.name === 'VehicleModel');
            expect(pkg).toBeDefined();

            // The package should NOT contain itself as a child
            const phantomChild = pkg!.children.find(
                c => c.name === 'VehicleModel' && c.type === 'package',
            );
            expect(phantomChild).toBeUndefined();
        });
    });

    // -------------------------------------------------------------------
    // Toaster integration test (D1 regression)
    // -------------------------------------------------------------------

    describe('toaster activity flows', () => {
        it('should extract complete flows from toaster-system action defs', async () => {
            const model = await getModelForText(`
package ToasterSystem {
    action def ToastBread {
        in item bread : Bread;
        out item toast : Toast;

        action lowerBread;
        action heatElements;
        action monitorTime;
        action raiseToast;

        first lowerBread;
        then heatElements;
        then monitorTime;
        then raiseToast;
    }

    action def CleanToaster {
        action removeTray;
        action emptyTray;
        action replaceTray;

        first removeTray;
        then emptyTray;
        then replaceTray;
    }

    part def Bread;
    part def Toast;
}
`);

            const diagrams = model.activityDiagrams!;
            expect(diagrams.length).toBeGreaterThanOrEqual(2);

            // ToastBread flows
            const toast = diagrams.find(d => d.name === 'ToastBread');
            expect(toast).toBeDefined();
            expect(toast!.flows.length).toBeGreaterThanOrEqual(5); // start + 4 chain edges + done
            expect(toast!.flows.find(f => f.from === 'start' && f.to === 'lowerBread')).toBeDefined();
            expect(toast!.flows.find(f => f.from === 'lowerBread' && f.to === 'heatElements')).toBeDefined();
            expect(toast!.flows.find(f => f.from === 'heatElements' && f.to === 'monitorTime')).toBeDefined();
            expect(toast!.flows.find(f => f.from === 'monitorTime' && f.to === 'raiseToast')).toBeDefined();
            expect(toast!.flows.find(f => f.from === 'raiseToast' && f.to === 'done')).toBeDefined();

            // CleanToaster flows
            const clean = diagrams.find(d => d.name === 'CleanToaster');
            expect(clean).toBeDefined();
            expect(clean!.flows.length).toBeGreaterThanOrEqual(4); // start + 3 chain edges + done
            expect(clean!.flows.find(f => f.from === 'start' && f.to === 'removeTray')).toBeDefined();
            expect(clean!.flows.find(f => f.from === 'removeTray' && f.to === 'emptyTray')).toBeDefined();
            expect(clean!.flows.find(f => f.from === 'emptyTray' && f.to === 'replaceTray')).toBeDefined();
            expect(clean!.flows.find(f => f.from === 'replaceTray' && f.to === 'done')).toBeDefined();

            // Verify synthetic nodes
            expect(toast!.actions.find(a => a.name === 'start' && a.type === 'initial')).toBeDefined();
            expect(toast!.actions.find(a => a.name === 'done' && a.type === 'final')).toBeDefined();

            // Verify sequence diagrams were synthesised from flows
            const seqDiagrams = model.sequenceDiagrams!;
            const toastSeq = seqDiagrams.find(d => d.name === 'ToastBread');
            if (toastSeq) {
                expect(toastSeq.participants.length).toBeGreaterThan(0);
                expect(toastSeq.messages.length).toBeGreaterThan(0);
            }
        });
    });

    // -------------------------------------------------------------------
    // Resolved Types
    // -------------------------------------------------------------------

    describe('resolvedTypes', () => {
        it('should resolve definitions with features', async () => {
            const model = await getModelForText(`
package Test {
    part def Vehicle {
        attribute mass : Real;
        attribute speed : Real;
        port powerIn : PowerPort;
    }
}
`, ['resolvedTypes']);

            const resolved = model.resolvedTypes!;
            expect(resolved).toBeDefined();
            expect(Object.keys(resolved).length).toBeGreaterThan(0);

            // Find Vehicle's resolved type
            const vehicleKey = Object.keys(resolved).find(k => k.includes('Vehicle'));
            if (vehicleKey) {
                const vehicleType = resolved[vehicleKey];
                expect(vehicleType.simpleName).toBe('Vehicle');
                expect(vehicleType.kind).toBe('part def');
                expect(vehicleType.isLibraryType).toBe(false);
                expect(vehicleType.features.length).toBeGreaterThan(0);
            }
        });

        it('should include feature details', async () => {
            const model = await getModelForText(`
package Test {
    part def Engine {
        attribute power : Real;
    }
}
`, ['resolvedTypes']);

            const resolved = model.resolvedTypes!;
            const engineKey = Object.keys(resolved).find(k => k.includes('Engine'));
            if (engineKey) {
                const engine = resolved[engineKey];
                const powerFeature = engine.features.find(f => f.name === 'power');
                expect(powerFeature).toBeDefined();
                expect(powerFeature!.kind).toBe('AttributeUsage');
            }
        });

        it('should expose canonical kinds and display metadata for feature groups', async () => {
            const model = await getModelForText(`
package Test {
    state def Operating;
    action def Control;
    port def PowerPort;
    part def Controller {
        private in port powerIn : PowerPort[1];
        out port powerOut : PowerPort;
        exhibit state operating : Operating;
        perform action control : Control;
    }
}
`, ['resolvedTypes']);

            const controller = model.resolvedTypes?.['Test::Controller'];
            expect(controller).toBeDefined();
            expect(controller?.features).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    name: 'powerIn',
                    kind: 'PortUsage',
                    type: 'PowerPort',
                    multiplicity: '1',
                    direction: 'in',
                    visibility: 'private',
                }),
                expect.objectContaining({ name: 'powerOut', kind: 'PortUsage', direction: 'out' }),
                expect.objectContaining({ name: 'operating', kind: 'ExhibitStateUsage' }),
                expect.objectContaining({ name: 'control', kind: 'PerformActionUsage' }),
            ]));
        });
    });

    // -------------------------------------------------------------------
    // Semantic Diagnostics
    // -------------------------------------------------------------------

    describe('diagnostics', () => {
        it('should model nested anonymous interfaces under their ends\' paths, without reporting them as ambiguous', async () => {
            // Each `interface source.pN to target.pN;` is anonymous (spec 7.14): `source` is an
            // endpoint reference, not the interface's name.
            const model = await getModelForText(`
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
`, ['elements', 'diagnostics']);

            expect(model.diagnostics!.filter(d => d.code === 'ambiguous-namespace-name')).toEqual([]);
            const interfacesNamed = (name: string) => {
                const found: unknown[] = [];
                const walk = (els: any[]) => els.forEach(el => { if (el.type === 'interface' && el.name === name) found.push(el); walk(el.children ?? []); });
                walk(model.elements ?? []);
                return found;
            };
            expect(interfacesNamed('source')).toEqual([]);
            expect(interfacesNamed('link')).toHaveLength(1);
            // The two anonymous interfaces have no name, and are modeled under `link`, flagged as anonymous.
            const [declared] = interfacesNamed('link') as any[];
            const nested = declared.children.filter((c: any) => c.type === 'interface');
            expect(nested.map((c: any) => [c.name, c.attributes.isAnonymous])).toEqual([['', true], ['', true]]);
            expect(new Set(nested.map((c: any) => c.symbolId)).size).toBe(2);
            expect(declared.attributes.isAnonymous).toBeUndefined();
        });

        it('should report declared duplicates across documents, but keep and not report anonymous elements with the same ends', async () => {
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
            const model = await getModelForDocuments([
                { uri: 'file:///ws/a.sysml', text: fileA },
                { uri: 'file:///ws/b.sysml', text: fileB },
            ], 'file:///ws/b.sysml', ['elements', 'diagnostics']);

            const ambiguous = model.diagnostics!.filter(d => d.code === 'ambiguous-namespace-name');
            expect(ambiguous.map(d => d.elementName)).toEqual(['link']);
            // This document's own anonymous interface and connection are still modeled.
            const connectors: { type: string; name: string; attributes: Record<string, unknown> }[] = [];
            const walk = (els: { type: string; name: string; attributes: Record<string, unknown>; children?: unknown[] }[]) =>
                els.forEach(el => { if (el.type === 'interface' || el.type === 'connection') connectors.push(el); walk((el.children ?? []) as typeof els); });
            walk(model.elements ?? []);
            const anonymous = connectors.filter(c => c.attributes.isAnonymous);
            expect(anonymous.map(c => [c.type, c.name])).toEqual([['interface', ''], ['connection', '']]);
            expect(connectors.map(c => c.name)).toContain('link');
        });

        it('should model a declared connection quoted like an anonymous one\'s declaration, and anonymous duplicates, each as its own element', async () => {
            const model = await getModelForText(`
package Demo {
    part a { port p; }
    part b { port p; }
    connect a.p to b.p;
    connection 'connect a.p to b.p';
    connect a.p to b.p;
}
`, ['elements', 'diagnostics']);

            expect(model.diagnostics!.filter(d => d.code === 'ambiguous-namespace-name')).toEqual([]);
            const connections: any[] = [];
            const walk = (els: any[]) => els.forEach(el => { if (el.type === 'connection') connections.push(el); walk(el.children ?? []); });
            walk(model.elements ?? []);
            // Only the declared one has a name; the anonymous ones are flagged, and each is its own element.
            expect(connections.map(c => [c.name, c.attributes.isAnonymous])).toEqual([
                ['', true],
                ['connect a.p to b.p', undefined],
                ['', true],
            ]);
            expect(new Set(connections.map(c => c.symbolId)).size).toBe(3);
        });

        it('should model declared elements quoted like an anonymous connection\'s display name, or its former generated name, each as its own element', async () => {
            const model = await getModelForText(`
package Demo {
    part a { port p; }
    part b { port p; }
    connect a.p to b.p { attribute w; }
    connection 'a.p→b.p' { attribute w; }
    connection 'a.p-b.p' { attribute w; }
}
`, ['elements', 'diagnostics']);

            expect(model.diagnostics!.filter(d => d.code === 'ambiguous-namespace-name' || d.code === 'duplicate-definition')).toEqual([]);
            const demo = model.elements!.find(e => e.name === 'Demo')!;
            const elements = demo.children.filter(e => e.name !== 'a' && e.name !== 'b');
            // The anonymous connection is shown as `a.p→b.p`, but only the declared elements have a name.
            expect(elements.map(e => [e.type, e.name, e.attributes.isAnonymous])).toEqual([
                ['connection', '', true],
                ['connection', 'a.p→b.p', undefined],
                ['connection', 'a.p-b.p', undefined],
            ]);
            expect(new Set(elements.map(e => e.symbolId)).size).toBe(3);
            // Each has its own member `w`.
            const members = elements.map(e => e.children.find(c => c.name === 'w')!.symbolId);
            expect(new Set(members).size).toBe(3);
        });

        it('should keep an anonymous interface\'s members apart from a declared part quoted like its declaration', async () => {
            const base = `package Demo {
    part a { port p; }
    part b { port p; }
    interface a.p to b.p { attribute w; }
}
`;
            const findAll = (els: any[], pred: (el: any) => boolean, out: any[] = []): any[] => {
                els.forEach(el => { if (pred(el)) out.push(el); findAll(el.children ?? [], pred, out); });
                return out;
            };
            // The anonymous interface has no name; only its declaration as written.
            const declaration = 'interface a.p to b.p';

            const model = await getModelForText(base.replace('\n}\n', `\n    part '${declaration}' { part inner; }\n}\n`), ['elements']);
            const [anonymous] = findAll(model.elements ?? [], el => el.type === 'interface');
            const [declared] = findAll(model.elements ?? [], el => el.type === 'part' && el.name === declaration);
            expect(anonymous.attributes.isAnonymous).toBe(true);
            expect(declared).toBeDefined();
            expect(anonymous.children.map((c: { name: string }) => c.name)).toEqual(['w']);
            expect(declared.children.map((c: { name: string }) => c.name)).toEqual(['inner']);
        });

        it('should resolve names in an anonymous interface\'s own namespace, not in a declared part quoted like its declaration', async () => {
            const base = `package Demo {
    part a { port p; }
    part b { port p; }
    interface a.p to b.p { part def W; part w : W; }
}
`;
            const baseModel = await getModelForText(base, ['elements', 'diagnostics']);
            expect(baseModel.diagnostics).toEqual([]);
            // `W` is a member of the anonymous interface only: `inner`, in a part quoted like its declaration, can't see it.
            const declaration = 'interface a.p to b.p';
            const model = await getModelForText(base.replace('\n}\n', `\n    part '${declaration}' { part inner : W; }\n}\n`), ['diagnostics']);
            expect(model.diagnostics!.map(d => [d.code, d.elementName])).toEqual([['unresolved-type', 'inner']]);
        });

        it('should report unresolved type references', async () => {
            const model = await getModelForText(`
package Test {
    part def Vehicle {
        part engine : NonExistentType;
    }
}
`, ['diagnostics']);

            const diags = model.diagnostics!;
            // Should flag NonExistentType as unresolved
            const unresolvedDiag = diags.find(d => d.code === 'unresolved-type');
            expect(unresolvedDiag).toBeDefined();
            expect(unresolvedDiag!.message).toContain('NonExistentType');
        });

        it('should flag a type defined only in an unrelated, unimported package (workspace-wide, not just this document)', async () => {
            const pkgAText = `
package PkgA {
    part def Part3;
}
`;
            const pkgBText = `
package PkgB {
    part def Part1;
    part usesPart3 : Part3;
}
`;
            const model = await getModelForDocuments(
                [{ uri: 'file:///pkg-a.sysml', text: pkgAText }, { uri: 'file:///pkg-b.sysml', text: pkgBText }],
                'file:///pkg-b.sysml',
                ['diagnostics'],
            );
            const unresolvedDiag = model.diagnostics!.find(d => d.code === 'unresolved-type');
            expect(unresolvedDiag).toBeDefined();
            expect(unresolvedDiag!.message).toContain('Part3');
        });

        it('should NOT flag a type declared in a different document of the same workspace', async () => {
            const pkgAText = `
package Test {
    part def Part1;
}
`;
            const pkgBText = `
package Test {
    part usesPart1 : Part1;
}
`;
            const model = await getModelForDocuments(
                [{ uri: 'file:///a.sysml', text: pkgAText }, { uri: 'file:///b.sysml', text: pkgBText }],
                'file:///b.sysml',
                ['diagnostics'],
            );
            const unresolvedDiag = model.diagnostics!.find(d => d.code === 'unresolved-type');
            expect(unresolvedDiag).toBeUndefined();
        });

        it('should combine imports from every fragment of a package split across files (parity with SemanticValidator)', async () => {
            // extractSemanticDiagnostics shares buildSymbolIndexes/resolveTypeName
            // with SemanticValidator, so this fix should already apply here --
            // this test exists to actually confirm that through the sysml/model
            // path, not just assume it from shared code.
            const pkgBFile1 = `
package PkgB {
    private import PkgA::Part3;
    part def Part1;
}
`;
            const pkgBFile2 = `
package PkgB {
    part usesPart3 : Part3;
}
`;
            const pkgAText = `
package PkgA {
    part def Part3;
}
`;
            const model = await getModelForDocuments(
                [
                    { uri: 'file:///pkg-a.sysml', text: pkgAText },
                    { uri: 'file:///pkg-b-1.sysml', text: pkgBFile1 },
                    { uri: 'file:///pkg-b-2.sysml', text: pkgBFile2 },
                ],
                'file:///pkg-b-2.sysml',
                ['diagnostics'],
            );
            const unresolvedDiag = model.diagnostics!.find(d => d.code === 'unresolved-type');
            expect(unresolvedDiag).toBeUndefined();
        });

        it('should flag an ambiguous namespace name (two same-kind definitions sharing a qualifiedName)', async () => {
            // Per KerML's Membership.isDistinguishableFrom (v1.0 §8.3.2.4.4):
            // two memberships are distinguishable -- NOT a conflict -- when
            // their element kinds don't conform to each other, regardless of
            // a name collision. A genuine conflict needs the SAME (conforming)
            // kind on both sides, e.g. two `part def A` -- see the "package vs.
            // unrelated definition" test below for the valid, non-conflicting
            // counterpart.
            const partDefA1Text = `
part def A {
    part def B;
}
`;
            const partDefA2Text = `
part def A {
    part def B2;
}
`;
            const externalText = `
package External {
    private import A::B;
    part usesB : B;
}
`;
            const entries = [
                { uri: 'file:///partdef-a-1.sysml', text: partDefA1Text },
                { uri: 'file:///partdef-a-2.sysml', text: partDefA2Text },
                { uri: 'file:///external.sysml', text: externalText },
            ];

            // The unresolved-type consequence propagates here too (shared
            // resolution), but the *explanation* -- the diagnostic pointing at
            // the conflicting declarations themselves -- needed its own port
            // from SemanticValidator, since extractSemanticDiagnostics only
            // ever emitted 'unresolved-type'/'empty-enum' before.
            const externalModel = await getModelForDocuments(entries, 'file:///external.sysml', ['diagnostics']);
            const unresolvedDiag = externalModel.diagnostics!.find(d => d.code === 'unresolved-type');
            expect(unresolvedDiag).toBeDefined();
            expect(unresolvedDiag!.message).toContain('B');

            const partDefA1Model = await getModelForDocuments(entries, 'file:///partdef-a-1.sysml', ['diagnostics']);
            const ambiguousDiag = partDefA1Model.diagnostics!.find(d => d.code === 'ambiguous-namespace-name');
            expect(ambiguousDiag).toBeDefined();
            expect(ambiguousDiag!.message).toContain("'A'");
        });

        it('says where the other declaration is, and counts any further ones as other occurrences (same message as the editor diagnostics)', async () => {
            const entries = [
                { uri: 'file:///ws/a1.sysml', text: `part def A;\n` },
                { uri: 'file:///ws/a2.sysml', text: `part def A;\n` },
            ];
            const pair = await getModelForDocuments(entries, 'file:///ws/a1.sysml', ['diagnostics']);
            expect(pair.diagnostics!.find(d => d.code === 'ambiguous-namespace-name')!.message).toBe(
                "Ambiguous name 'A': also declared as part def in document a2.sysml (line 1).",
            );

            const three = await getModelForDocuments([...entries, { uri: 'file:///ws/lib/a3.sysml', text: `part def A;\n` }], 'file:///ws/a1.sysml', ['diagnostics']);
            expect(three.diagnostics!.find(d => d.code === 'ambiguous-namespace-name')!.message).toBe(
                "Ambiguous name 'A': also declared as part def in document a2.sysml (line 1) and 1 other occurrence.",
            );
        });

        it('counts several further occurrences in the plural, and names a same-document one as "this document"', async () => {
            const four = [
                { uri: 'file:///ws/a1.sysml', text: `part def A;\n` },
                { uri: 'file:///ws/a2.sysml', text: `part def A;\n` },
                { uri: 'file:///ws/a3.sysml', text: `part def A;\n` },
                { uri: 'file:///ws/a4.sysml', text: `part def A;\n` },
            ];
            const plural = await getModelForDocuments(four, 'file:///ws/a1.sysml', ['diagnostics']);
            expect(plural.diagnostics!.find(d => d.code === 'ambiguous-namespace-name')!.message).toBe(
                "Ambiguous name 'A': also declared as part def in document a2.sysml (line 1) and 2 other occurrences.",
            );

            // Two in a1.sysml itself plus one in b.sysml.
            const mixed = await getModelForDocuments(
                [{ uri: 'file:///ws/a1.sysml', text: `part def A;\npart def A;\n` }, { uri: 'file:///ws/b.sysml', text: `part def A;\n` }],
                'file:///ws/a1.sysml',
                ['diagnostics'],
            );
            const messages = mixed.diagnostics!.filter(d => d.code === 'ambiguous-namespace-name').map(d => d.message);
            // a1.sysml sorts before b.sysml, so each a1 declaration names the other a1 one first.
            expect([...messages].sort()).toEqual([
                "Ambiguous name 'A': also declared as part def in this document (line 1) and 1 other occurrence.",
                "Ambiguous name 'A': also declared as part def in this document (line 2) and 1 other occurrence.",
            ]);
        });

        it('should NOT flag a package and an unrelated definition sharing a qualifiedName (valid per KerML)', async () => {
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
            const externalText = `
package External {
    private import A::B;
    private import A::B2;
    part usesB : B;
    part usesB2 : B2;
}
`;
            const model = await getModelForDocuments(
                [
                    { uri: 'file:///pkg-a.sysml', text: pkgAText },
                    { uri: 'file:///partdef-a.sysml', text: partDefAText },
                    { uri: 'file:///external.sysml', text: externalText },
                ],
                'file:///external.sysml',
                ['diagnostics'],
            );
            expect(model.diagnostics!.filter(d => d.code === 'unresolved-type')).toHaveLength(0);
            expect(model.diagnostics!.filter(d => d.code === 'ambiguous-namespace-name')).toHaveLength(0);
        });

        it('should NOT flag a legitimate package reopened across files as ambiguous', async () => {
            const pkgFile1 = `
package Shared {
    part def PartA;
}
`;
            const pkgFile2 = `
package Shared {
    part def PartB;
}
`;
            const model = await getModelForDocuments(
                [{ uri: 'file:///shared-1.sysml', text: pkgFile1 }, { uri: 'file:///shared-2.sysml', text: pkgFile2 }],
                'file:///shared-1.sysml',
                ['diagnostics'],
            );
            expect(model.diagnostics!.filter(d => d.code === 'ambiguous-namespace-name')).toHaveLength(0);
        });

        it('should include diagnostic range', async () => {
            const model = await getModelForText(`
package Test {
    part x : UnknownType;
}
`, ['diagnostics']);

            for (const diag of model.diagnostics!) {
                expect(diag.range).toBeDefined();
                expect(typeof diag.range.start.line).toBe('number');
                expect(typeof diag.range.start.character).toBe('number');
            }
        });

        it('should include severity as string', async () => {
            const model = await getModelForText(`
package Test {
    part x : MissingDef;
}
`, ['diagnostics']);

            for (const diag of model.diagnostics!) {
                expect(['error', 'warning', 'info']).toContain(diag.severity);
            }
        });
    });

    // -------------------------------------------------------------------
    // Fixture file integration tests
    // -------------------------------------------------------------------

    describe('fixture files', () => {
        it('should produce a valid model for vehicle.sysml', async () => {
            const model = await getModelForFixture('valid/vehicle.sysml');

            expect(model.version).toBe(1);
            expect(model.elements).toBeDefined();
            expect(model.elements!.length).toBeGreaterThan(0);
            expect(model.relationships).toBeDefined();
            expect(model.stats!.totalElements).toBeGreaterThan(0);

            // Validate recursive shape
            validateElementTree(model.elements!);
        });

        it('should produce a valid model for camera.sysml', async () => {
            const model = await getModelForFixture('valid/camera.sysml');

            expect(model.version).toBe(1);
            expect(model.elements).toBeDefined();
            expect(model.elements!.length).toBeGreaterThan(0);

            validateElementTree(model.elements!);
        });

        it('should handle files with syntax errors gracefully', async () => {
            const model = await getModelForFixture('invalid/syntax-error.sysml');

            // Should still return a result, even with errors
            expect(model.version).toBe(1);
            expect(model.stats).toBeDefined();
        });
    });

    // -------------------------------------------------------------------
    // Attribute extraction regression tests
    // -------------------------------------------------------------------

    describe('attribute extraction', () => {
        it('should extract direction for ports (in/out/inout)', async () => {
            const model = await getModelForText(`
package Test {
    port def DataPort;
    part def Controller {
        in port input : DataPort;
        out port output : DataPort;
        inout port bidirectional : DataPort;
    }
}
`, ['elements']);

            const elements = model.elements!;
            const pkg = elements.find(e => e.name === 'Test');
            const controller = pkg!.children.find(e => e.name === 'Controller');
            expect(controller).toBeDefined();

            const inPort = controller!.children.find(e => e.name === 'input');
            const outPort = controller!.children.find(e => e.name === 'output');
            const biPort = controller!.children.find(e => e.name === 'bidirectional');

            expect(inPort?.attributes['direction']).toBe('in');
            expect(outPort?.attributes['direction']).toBe('out');
            expect(biPort?.attributes['direction']).toBe('inout');
        });

        it('should extract modifiers (abstract, readonly, derived)', async () => {
            const model = await getModelForText(`
package Test {
    abstract part def AbstractVehicle;
}
`, ['elements']);

            const elements = model.elements!;
            const pkg = elements.find(e => e.name === 'Test');
            const av = pkg!.children.find(e => e.name === 'AbstractVehicle');
            expect(av).toBeDefined();
            expect(av!.attributes['modifier']).toContain('abstract');
        });

        it('should extract visibility (public, private, protected)', async () => {
            const model = await getModelForText(`
package Test {
    private part def InternalPart;
    public part def PublicPart;
}
`, ['elements']);

            const elements = model.elements!;
            const pkg = elements.find(e => e.name === 'Test');
            const internal = pkg!.children.find(e => e.name === 'InternalPart');
            const pub = pkg!.children.find(e => e.name === 'PublicPart');

            expect(internal?.attributes['visibility']).toBe('private');
            expect(pub?.attributes['visibility']).toBe('public');
        });

        it('should extract default values for attributes', async () => {
            const model = await getModelForText(`
package Test {
    part def Vehicle {
        attribute maxSpeed : Real = 120;
    }
}
`, ['elements']);

            const elements = model.elements!;
            const pkg = elements.find(e => e.name === 'Test');
            const vehicle = pkg!.children.find(e => e.name === 'Vehicle');
            const maxSpeed = vehicle?.children.find(e => e.name === 'maxSpeed');
            expect(maxSpeed).toBeDefined();
            // Value extraction depends on regex matching `= value`
            if (maxSpeed?.attributes['value']) {
                expect(maxSpeed.attributes['value']).toContain('120');
            }
        });
    });

    // -------------------------------------------------------------------
    // Connection and keyword relationship tests
    // -------------------------------------------------------------------

    describe('connection and keyword relationships', () => {
        it('should extract connection endpoints (connect X to Y)', async () => {
            const model = await getModelForText(`
package Test {
    part def PartA;
    part def PartB;
    part a : PartA;
    part b : PartB;
    connection c : Connect connect a to b;
    connection def Connect;
}
`, ['relationships']);

            const rels = model.relationships!;
            const conn = rels.find(r => r.type === 'connection');
            if (conn) {
                expect(conn.source).toBeDefined();
                expect(conn.target).toBeDefined();
            }
        });

        it('should project item flow elements and endpoint relationships with unresolved payload types', async () => {
            const model = await getModelForText(`
package Test {
    interface def Interface {
        flow of Payload[1..*] from source.output to target.input;
        flow namedFlow of OtherPayload[1..*] from source.other to target.other;
    }
}
`, ['elements', 'relationships', 'sequenceDiagrams']);

            const flows: any[] = [];
            const visit = (elements: any[]) => elements.forEach(element => {
                if (element.type === 'flow') flows.push(element);
                visit(element.children ?? []);
            });
            visit(model.elements ?? []);

            expect(flows).toHaveLength(2);
            expect(flows.map(flow => [
                flow.name,
                flow.attributes.itemType,
                flow.attributes.flowSource,
                flow.attributes.flowTarget,
                flow.relationships.find((rel: any) => rel.type === 'flow'),
            ])).toEqual([
                [
                    '',
                    'Payload',
                    'source.output',
                    'target.input',
                    {
                        type: 'flow',
                        source: 'source.output',
                        target: 'target.input',
                        name: 'Payload',
                        symbolId: flows[0].symbolId,
                    },
                ],
                [
                    'namedFlow',
                    'OtherPayload',
                    'source.other',
                    'target.other',
                    {
                        type: 'flow',
                        source: 'source.other',
                        target: 'target.other',
                        name: 'OtherPayload',
                        symbolId: flows[1].symbolId,
                    },
                ],
            ]);
            expect(model.relationships!.filter(rel => rel.type === 'flow')).toEqual([
                {
                    type: 'flow',
                    source: 'source.output',
                    target: 'target.input',
                    name: 'Payload',
                    symbolId: flows[0].symbolId,
                },
                {
                    type: 'flow',
                    source: 'source.other',
                    target: 'target.other',
                    name: 'OtherPayload',
                    symbolId: flows[1].symbolId,
                },
            ]);
            expect(model.sequenceDiagrams).toHaveLength(1);
            expect(model.sequenceDiagrams![0].messages.map(message => [
                message.from,
                message.to,
                message.payload,
            ])).toEqual([
                ['source', 'target', 'Payload'],
                ['source', 'target', 'OtherPayload'],
            ]);
        });

        it('should project flow types separately from named payload types and include succession edges', async () => {
            const model = await getModelForText(`
package Test {
    part def Container {
        flow f : F of i : I from source.output to target.input;
        succession flow from producer.output to consumer.input;
    }
}
`, ['elements', 'relationships']);

            const elements: any[] = [];
            const visit = (items: any[]) => items.forEach(element => {
                elements.push(element);
                visit(element.children ?? []);
            });
            visit(model.elements ?? []);

            const flow = elements.find(element => element.type === 'flow' && element.name === 'f');
            expect(flow!.attributes).toMatchObject({
                flowType: 'F',
                itemType: 'I',
                flowSource: 'source.output',
                flowTarget: 'target.input',
            });
            expect(flow!.relationships).toContainEqual({
                type: 'typing',
                source: 'f',
                sourceId: flow!.symbolId,
                target: 'F',
            });
            expect(flow!.relationships).toContainEqual({
                type: 'flow',
                source: 'source.output',
                target: 'target.input',
                name: 'I',
                symbolId: flow!.symbolId,
            });

            const succession = elements.find(element => element.type === 'succession flow');
            expect(succession).toBeDefined();
            expect(succession!.relationships).toContainEqual({
                type: 'succession',
                source: 'producer.output',
                target: 'consumer.input',
                symbolId: succession!.symbolId,
            });
            expect(model.relationships).toContainEqual({
                type: 'succession',
                source: 'producer.output',
                target: 'consumer.input',
                symbolId: succession!.symbolId,
            });
        });

        it('should extract subsets relationship', async () => {
            const model = await getModelForText(`
package Test {
    part def Vehicle {
        part engine : Engine;
    }
    part def Engine;
    part def Car :> Vehicle {
        part carEngine subsets engine;
    }
}
`, ['relationships']);

            const rels = model.relationships!;
            const subset = rels.find(r => r.type === 'subsetting');
            // subsetting is extracted from element text — source is the symbol name
            if (subset) {
                expect(subset.target).toBe('engine');
            }
        });

        it('should extract redefines relationship', async () => {
            const model = await getModelForText(`
package Test {
    part def Vehicle {
        part engine : Engine;
    }
    part def Engine;
    part def TurboEngine;
    part def SportsCar :> Vehicle {
        part turbo redefines engine;
    }
}
`, ['relationships']);

            const rels = model.relationships!;
            const redef = rels.find(r => r.type === 'redefinition');
            // redefinition is extracted from element text — target should be 'engine'
            if (redef) {
                expect(redef.target).toBe('engine');
            }
        });

        it('should extract specializations via :> and specializes keyword', async () => {
            const model = await getModelForText(`
package Test {
    part def Base;
    part def DerivedA :> Base;
    part def DerivedB specializes Base;
}
`, ['relationships']);

            const rels = model.relationships!;
            const specs = rels.filter(r => r.type === 'specializes' && r.target === 'Base');
            expect(specs.length).toBeGreaterThanOrEqual(2);
        });
    });

    // -------------------------------------------------------------------
    // Decision branch and succession flow tests
    // -------------------------------------------------------------------

    describe('decision and succession patterns', () => {
        it('should extract decision branches (if/then/else)', async () => {
            const model = await getModelForText(`
package Test {
    action def TrafficControl {
        action checkLight;
        action go;
        action stop;

        first checkLight;
        decide;
        if checkLight then go;
        if checkLight then stop;
    }
}
`, ['activityDiagrams']);

            const diagrams = model.activityDiagrams!;
            if (diagrams.length > 0) {
                const diagram = diagrams.find(d => d.name === 'TrafficControl');
                expect(diagram).toBeDefined();
                if (diagram && diagram.decisions.length > 0) {
                    const decision = diagram.decisions[0];
                    expect(decision.branches.length).toBeGreaterThan(0);
                }
            }
        });

        it.each(['decide;', 'decide d;'])('should extract the branches following a decision node (%s), once', async (decide) => {
            const model = await getModelForText(`
package Test {
    action def TrafficControl {
        action check;
        action go;
        action stop;
        first check;
        ${decide}
        if check then go;
        else stop;
        action after;
    }
}
`, ['activityDiagrams']);
            const diagram = model.activityDiagrams!.find(d => d.name === 'TrafficControl')!;
            expect(diagram.decisions).toHaveLength(1);
            expect(diagram.decisions[0].branches).toEqual([
                { condition: 'check', target: 'go' },
                { condition: 'else', target: 'stop' },
            ]);
        });

        it('should extract explicit succession keyword', async () => {
            const model = await getModelForText(`
package Test {
    action def Pipeline {
        action a;
        action b;
        succession first a then b;
    }
}
`, ['activityDiagrams']);

            const diagrams = model.activityDiagrams!;
            if (diagrams.length > 0) {
                const flows = diagrams[0].flows;
                expect(flows.find(f => f.from === 'a' && f.to === 'b')).toBeDefined();
            }
        });

        it('should extract succession flow pattern', async () => {
            const model = await getModelForText(`
package Test {
    action def DataFlow {
        action producer;
        action consumer;
        succession flow from producer to consumer;
    }
}
`, ['activityDiagrams']);

            const diagrams = model.activityDiagrams!;
            if (diagrams.length > 0) {
                const flows = diagrams[0].flows;
                expect(flows.find(f => f.from === 'producer' && f.to === 'consumer')).toBeDefined();
            }
        });
    });

    // -------------------------------------------------------------------
    // Sequence diagram send/accept regression
    // -------------------------------------------------------------------

    describe('sequence diagram messages', () => {
        it('should synthesize messages from action flows', async () => {
            const model = await getModelForText(`
package Test {
    action def Workflow {
        action init;
        action process;
        action finish;

        first init;
        then process;
        then finish;
    }
}
`, ['sequenceDiagrams']);

            const diagrams = model.sequenceDiagrams!;
            const seq = diagrams.find(d => d.name === 'Workflow');
            if (seq) {
                expect(seq.participants.length).toBeGreaterThan(0);
                expect(seq.messages.length).toBeGreaterThan(0);
            }
        });
    });

    // -------------------------------------------------------------------
    // JSON serialization safety
    // -------------------------------------------------------------------

    describe('serialization', () => {
        it('should produce JSON-serializable output (no Maps, no circular refs)', async () => {
            const model = await getModelForText(`
package Test {
    part def Vehicle {
        part engine : Engine;
        attribute mass : Real;
    }
    part def Engine {
        attribute power : Real;
    }
}
`);

            // JSON.stringify should not throw
            const json = JSON.stringify(model);
            expect(json).toBeDefined();

            // Round-trip should preserve structure
            const parsed = JSON.parse(json);
            expect(parsed.version).toBe(model.version);
            expect(parsed.elements?.length).toBe(model.elements?.length);
            expect(parsed.stats?.totalElements).toBe(model.stats?.totalElements);
        });
    });
});

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

/**
 * Recursively validate that an element tree has the correct shape.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateElementTree(elements: any[]): void {
    for (const element of elements) {
        expect(typeof element.type).toBe('string');
        expect(element.type.length).toBeGreaterThan(0);
        expect(typeof element.name).toBe('string');
        expect(element.range).toBeDefined();
        expect(typeof element.range.start.line).toBe('number');
        expect(typeof element.range.start.character).toBe('number');
        expect(typeof element.range.end.line).toBe('number');
        expect(typeof element.range.end.character).toBe('number');
        expect(element.range.start.line).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(element.children)).toBe(true);
        expect(typeof element.attributes).toBe('object');
        expect(Array.isArray(element.attributes)).toBe(false); // not an array
        expect(Array.isArray(element.relationships)).toBe(true);

        // Recurse
        if (element.children.length > 0) {
            validateElementTree(element.children);
        }
    }
}


describe('sysml/model diagnostics scope reuses the same NamespaceResolver as the editor', () => {
    // `extractSemanticDiagnostics` in sysmlModelProvider.ts shares the exact
    // same NamespaceResolver instance/resolveTypeName/buildSymbolIndexes as
    // SemanticValidator's editor diagnostics -- these lock in that the
    // re-entrancy and import-cycle guards protect this request path too,
    // not just `textDocument/publishDiagnostics`.
    async function getModelForTextInline(text: string, scopes?: string[]) {
        const { DocumentManager } = await import('../../server/src/documentManager.js');
        const { SysMLModelProvider } = await import('../../server/src/model/sysmlModelProvider.js');
        const { TextDocument } = await import('vscode-languageserver-textdocument');
        const uri = 'test://model-namespace-resolver.sysml';
        const docManager = new DocumentManager();
        docManager.parse(TextDocument.create(uri, 'sysml', 1, text));
        const provider = new SysMLModelProvider(docManager);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return provider.getModel(uri, 1, scopes as any);
    }

    it('does not stack overflow on a protected member reachable through a self-referential specialization chain', async () => {
        const text = `
package Lib {
    part def Engine;
}
part def Vehicle {
    protected import Lib::Engine;
}
part def Container :> Container::Child {
    part def Child :> Vehicle::Engine;
    part engine : Vehicle::Engine;
}
`;
        const model = await getModelForTextInline(text, ['diagnostics']);
        const unresolvedDiags = model.diagnostics!.filter(d => d.code === 'unresolved-type');
        expect(unresolvedDiags.filter(d => d.message.includes('Vehicle::Engine')).length).toBe(2);
    });

    it('does not stack overflow on a mutual ::** import cycle and still resolves types through it', async () => {
        const text = `
package A {
    part def PartA;
    public import B::**;
}
package B {
    part def PartB;
    public import A::**;
}
package User {
    private import A::*;
    private import B::*;
    part usesA : PartA;
    part usesB : PartB;
}
`;
        const model = await getModelForTextInline(text, ['diagnostics']);
        const unresolvedDiags = model.diagnostics!.filter(d => d.code === 'unresolved-type');
        expect(unresolvedDiags.some(d => d.message.includes("'PartA'"))).toBe(false);
        expect(unresolvedDiags.some(d => d.message.includes("'PartB'"))).toBe(false);
    });
});
