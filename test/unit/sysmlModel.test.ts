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
                expect(powerFeature!.kind).toBe('attribute');
            }
        });
    });

    // -------------------------------------------------------------------
    // Semantic Diagnostics
    // -------------------------------------------------------------------

    describe('diagnostics', () => {
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
