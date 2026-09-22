import { describe, expect, it } from 'vitest';

describe('Diagnostics', () => {
    it('should produce diagnostics for syntax errors', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');

        const text = 'package Broken { @@@ }';
        const result = parseDocument(text);

        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].line).toBeGreaterThanOrEqual(0);
        expect(result.errors[0].message).toBeTruthy();
    });

    it('should produce zero diagnostics for valid input', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');

        const text = `
package ValidModel {
    part def Sensor {
        attribute reading : Real;
    }
}
`;
        const result = parseDocument(text);
        expect(result.errors.length).toBe(0);
    });

    it('should report reserved keyword used as identifier with a clear message', async () => {
        const { DocumentManager } = await import('../../server/src/documentManager.js');
        const { DiagnosticsProvider } = await import('../../server/src/providers/diagnosticsProvider.js');

        const text = `
package Bikes {
    part def Frame {
        attribute material : String;
    }
    part def Bicycle {
        part frame : Frame[1];
    }
}
`;
        const docManager = new DocumentManager();
        const uri = 'file:///keyword-test.sysml';
        const doc = await makeDoc(text, uri);
        docManager.parse(doc);

        const provider = new DiagnosticsProvider(docManager);
        const diags = provider.getDiagnostics(uri);

        // Should have at least one diagnostic mentioning 'frame' is a reserved keyword
        const keywordDiag = diags.find(d => d.message.includes('reserved SysML keyword'));
        expect(keywordDiag).toBeDefined();
        expect(keywordDiag!.message).toContain("'frame'");
        expect(keywordDiag!.message).toContain('renaming');
    });
});

/** Create a TextDocument from raw SysML text */
async function makeDoc(text: string, uri = 'test://test.sysml') {
    const mod = await import('../../server/node_modules/vscode-languageserver-textdocument/lib/esm/main.js');
    return mod.TextDocument.create(uri, 'sysml', 1, text);
}

// Helper to get semantic diagnostics for a given SysML text
async function getSemanticDiagnostics(text: string) {
    const { DocumentManager } = await import('../../server/src/documentManager.js');
    const { SemanticValidator } = await import('../../server/src/providers/semanticValidator.js');

    const docManager = new DocumentManager();
    const uri = 'file:///test.sysml';
    const doc = await makeDoc(text, uri);
    docManager.parse(doc);

    const validator = new SemanticValidator(docManager);
    return validator.validate(uri);
}

async function getSemanticDiagnosticsForUri(entries: Array<{ uri: string; text: string }>, targetUri: string) {
    const { DocumentManager } = await import('../../server/src/documentManager.js');
    const { SemanticValidator } = await import('../../server/src/providers/semanticValidator.js');

    const docManager = new DocumentManager();
    for (const entry of entries) {
        const doc = await makeDoc(entry.text, entry.uri);
        docManager.parse(doc);
    }

    const validator = new SemanticValidator(docManager);
    return validator.validate(targetUri);
}

describe('Semantic Validation', () => {
    describe('import inside package body', () => {
        it('should NOT produce syntax errors for import inside package body', async () => {
            const text = `
package CircularReferenceExample {
    import CircularReferenceExample::*;

    part def Contained {
        part outer : Container;
    }
    part system : PartA;
}
`;
            const diags = await getSemanticDiagnostics(text);
            const syntaxDiags = diags.filter(d => d.message?.includes('no viable alternative'));
            expect(syntaxDiags.length).toBe(0);
        });
    });

    describe('import inside definition/usage body (§7.5.1: definitions and usages are namespaces too)', () => {
        it('should resolve a reference via an import declared inside a definition body', async () => {
            const text = `
package Lib {
    part def Engine;
}

package User {
    part def Vehicle {
        import Lib::Engine;
        part engine : Engine;
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.some(d => d.message.includes("'Engine'"))).toBe(false);
        });

        it('should resolve a reference via an import declared inside a usage body', async () => {
            const text = `
package Lib {
    part def Engine;
}

package User {
    part def Vehicle;
    part vehicle : Vehicle {
        import Lib::Engine;
        part engine : Engine;
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.some(d => d.message.includes("'Engine'"))).toBe(false);
        });

        it('should still flag an unresolved reference when no enclosing definition/usage/package imports it', async () => {
            const text = `
package Lib {
    part def Engine;
}

package User {
    part def Vehicle {
        part engine : Engine;
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.some(d => d.message.includes("'Engine'"))).toBe(true);
        });

        it('should not leak a definition-body import outside that definition', async () => {
            const text = `
package Lib {
    part def Engine;
}

package User {
    part def Vehicle {
        import Lib::Engine;
        part engine : Engine;
    }
    part def Unrelated {
        part alsoEngine : Engine;
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.some(d => (d.data as { elementName?: string } | undefined)?.elementName === 'engine')).toBe(false);
            expect(unresolvedDiags.some(d => (d.data as { elementName?: string } | undefined)?.elementName === 'alsoEngine')).toBe(true);
        });

        it('should not attribute a nested package\'s own imports to the enclosing definition, replacing the definition\'s own', async () => {
            const text = `
package Lib {
    part def Engine;
    part def Wheel;
}

package User {
    part def Vehicle {
        import Lib::Engine;
        package Sub {
            import Lib::Wheel;
        }
        part engine : Engine;
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.some(d => d.message.includes("'Engine'"))).toBe(false);
        });
    });

    describe('unresolved type references', () => {
        it('should flag a type that does not exist in the document', async () => {
            const text = `
package Test {
    part def Vehicle {
        part engine : Engine[1];
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.length).toBeGreaterThanOrEqual(1);
            expect(unresolvedDiags[0].message).toContain("'Engine'");
        });

        it('should not flag types that are defined in the document', async () => {
            const text = `
package Test {
    part def Engine {
        attribute power : Real;
    }
    part def Vehicle {
        part engine : Engine[1];
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.length).toBe(0);
        });

        it('should not flag standard library types (Real, String, Boolean, Integer)', async () => {
            const text = `
package Test {
    part def Sensor {
        attribute value : Real[1];
        attribute name : String[1];
        attribute active : Boolean[1];
        attribute count : Integer[1];
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.length).toBe(0);
        });

        it('should not flag ISQ quantity value types (LengthValue, MassValue, TorqueValue, etc.)', async () => {
            const text = `
package Test {
    part def Wheel {
        attribute diameter : LengthValue;
    }
    interface def WheelInterface {
        attribute maxTorque : TorqueValue;
    }
    part def FuelTank {
        attribute mass : MassValue;
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            // LengthValue, TorqueValue, MassValue are all recognized ISQ types
            expect(unresolvedDiags.length).toBe(0);
        });

        it('should recognize alias as a valid type definition', async () => {
            const text = `
package Test {
    public import ISQ::*;
    alias Torque for ISQ::TorqueValue;

    part def Engine {
        attribute maxTorque : Torque;
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            // Torque should be resolved via the alias
            const torqueDiag = unresolvedDiags.find(d => d.message.includes("'Torque'"));
            expect(torqueDiag).toBeUndefined();
        });
    });

    describe('invalid multiplicity bounds', () => {
        it('should flag when lower bound exceeds upper bound', async () => {
            const text = `
package Test {
    part def Vehicle {
        part wheels : Wheel[5..2];
    }
    part def Wheel;
}
`;
            const diags = await getSemanticDiagnostics(text);
            const multDiags = diags.filter(d => d.code === 'invalid-multiplicity');
            expect(multDiags.length).toBeGreaterThanOrEqual(1);
            expect(multDiags[0].message).toContain('lower bound');
            expect(multDiags[0].message).toContain('exceeds upper bound');
        });
    });

    describe('redefinition multiplicity', () => {
        it('should flag incompatible multiplicity on a redefined feature', async () => {
            const text = `
package Test {
    part def Vehicle {
        part wheel : Wheel[0..1];
    }
    part def SportsCar :> Vehicle {
        part wheel :>> wheel[2];
    }
    part def Wheel;
}
`;
            const diags = await getSemanticDiagnostics(text);
            const redef = diags.filter(d => d.code === 'invalid-redefinition-multiplicity');
            expect(redef.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('port compatibility', () => {
        it('should flag connect statements that link incompatible port types', async () => {
            const text = `
package Test {
    port def FuelPort {
        out item fuel;
    }
    port def ElectricalPort {
        out item power;
    }

    part def Car {
        port fuel : FuelPort;
        port power : ElectricalPort;
        connection c1 connect fuel to power;
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const portDiags = diags.filter(d => d.code === 'incompatible-port-types');
            expect(portDiags.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('constraint body reference validation', () => {
        it('should flag unresolved identifiers inside require constraint bodies', async () => {
            const text = `
package Test {
    part def Wheel {
        attribute radius : Real;
    }

    requirement def BrakeReq {
        subject wheel : Wheel;
        require constraint {
            wheel.radus > 0
        }
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const constraintDiags = diags.filter(d => d.code === 'unresolved-constraint-reference');
            expect(constraintDiags.length).toBeGreaterThanOrEqual(1);
        });

        it('should emit targeted invalid-constraint-body for documentation text', async () => {
            const text = `
package Test {
    requirement def ViewReq {
        require constraint {
            doc
            /*
             * A system components view shall show the hierarchical
             * part decomposition of a system.
             */
        }
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const invalidBody = diags.filter(d => d.code === 'invalid-constraint-body');
            const unresolved = diags.filter(d => d.code === 'unresolved-constraint-reference');

            expect(invalidBody.length).toBeGreaterThanOrEqual(1);
            expect(unresolved.length).toBe(0);
        });
    });

    describe('empty enumerations', () => {
        it('should flag enum definitions with no values', async () => {
            const text = `
package Test {
    enum def Color;
}
`;
            const diags = await getSemanticDiagnostics(text);
            const enumDiags = diags.filter(d => d.code === 'empty-enum');
            expect(enumDiags.length).toBe(1);
            expect(enumDiags[0].message).toContain("'Color'");
        });

        it('should NOT flag enum definitions with explicit enum values', async () => {
            const text = `
package Test {
    enum def Color {
        enum red;
        enum green;
        enum blue;
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const enumDiags = diags.filter(d => d.code === 'empty-enum');
            expect(enumDiags.length).toBe(0);
        });

        it('should NOT flag enum definitions with bare (implicit) values', async () => {
            const text = `
package Test {
    enum def Color {
        red;
        green;
        blue;
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const enumDiags = diags.filter(d => d.code === 'empty-enum');
            expect(enumDiags.length).toBe(0);
        });

        it('should NOT flag enum definitions with doc and values', async () => {
            const text = `
package Test {
    enum def Severity {
        doc /* Severity levels. */
        low;
        medium;
        high;
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const enumDiags = diags.filter(d => d.code === 'empty-enum');
            expect(enumDiags.length).toBe(0);
        });
    });

    describe('unused definitions scope', () => {
        it('should flag uninstantiated part/action definitions only', async () => {
            const text = `
package Test {
    part def UnusedPart;
    action def UnusedAction;
    port def UnusedPort;
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unused = diags.filter(d => d.code === 'unused-definition');
            expect(unused.length).toBe(2);
            expect(unused.every(d => d.message.includes('workspace'))).toBe(true);
        });

        it('should emit unused-definition diagnostics for the sample fixture', async () => {
            const text = `
package SemanticUnusedDefinitions {
    part def UnusedPart;
    action def UnusedAction;
    part def UsedPart;
    part system : UsedPart;
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unused = diags.filter(d => d.code === 'unused-definition');

            expect(unused.length).toBeGreaterThanOrEqual(2);
            const messages = unused.map(d => d.message).join('\n');
            expect(messages).toContain("'UnusedPart'");
            expect(messages).toContain("'UnusedAction'");
        });

        it('should not leak unused-definition diagnostics from other files', async () => {
            const uriA = 'file:///a.sysml';
            const uriB = 'file:///b.sysml';
            const textA = `
package A {
    part def Camera;
}
`;
            const textB = `
package B {
    part def Sensor;
    part sensor : Sensor;
}
`;

            const diags = await getSemanticDiagnosticsForUri([
                { uri: uriA, text: textA },
                { uri: uriB, text: textB },
            ], uriB);

            const unused = diags.filter(d => d.code === 'unused-definition');
            expect(unused.length).toBe(0);
        });

        it('should count part usages used as connect sources and targets', async () => {
            const text = `
package Demo {
    port def Signal;
    part def Source {
        port outP : Signal;
    }
    part def Sink {
        port inP : Signal;
    }
    part assembly {
        part a : Source;
        part b : Sink;
        connect a.outP to b.inP;
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unused = diags.filter(d => d.code === 'unused-definition');

            expect(unused).toHaveLength(0);
        });
    });

    describe('circular containment', () => {
        it.each(['ref part', 'in part', 'ref', 'part'])(
            'should accept recursive %s typing in both validation entry points',
            async (keyword) => {
                const { DocumentManager } = await import('../../server/src/documentManager.js');
                const { SemanticValidator } = await import(
                    '../../server/src/providers/semanticValidator.js'
                );
                const text = `
package MVCE {
    part def A { ${keyword} b : B[0..1]; }
    part def B { ${keyword} a : A[0..*]; }
}
`;
                const uri = 'file:///issue101.sysml';
                const manager = new DocumentManager();
                const parsed = manager.parse(await makeDoc(text, uri));
                expect(parsed.errors).toHaveLength(0);
                const symbols = manager.getWorkspaceSymbolTable().getAllSymbols();
                const names = new Set(symbols.map(symbol => symbol.name));
                const diagnostics = [
                    ...new SemanticValidator(manager).validate(uri),
                    ...SemanticValidator.validateSymbols(symbols, names, { text, uri }),
                ];
                expect(diagnostics.filter(diagnostic => diagnostic.severity === 1)).toHaveLength(0);
            },
        );

        it('should accept cross-file reference cycles', async () => {
            const entries = [
                {
                    uri: 'file:///a.sysml',
                    text: 'part def A { ref part b : B[0..1]; }',
                },
                {
                    uri: 'file:///b.sysml',
                    text: 'part def B { part a : A[0..*]; }',
                },
            ];
            for (const entry of entries) {
                const diagnostics = await getSemanticDiagnosticsForUri(entries, entry.uri);
                expect(diagnostics.filter(diagnostic => diagnostic.severity === 1)).toHaveLength(0);
            }
        });

        it('should still reject circular specialization', async () => {
            const diagnostics = await getSemanticDiagnostics(`
package Invalid {
    part def A :> B;
    part def B :> A;
}
`);
            expect(diagnostics.some(diagnostic => diagnostic.code === 'circular-specialization'))
                .toBe(true);
        });

        it('should NOT treat referential part typing as containment (issue #101)', async () => {
            const text = `
package MVCE {
    part def A {
        ref part b : B[0..1];
    }
    part def B {
        part a : A[0..*];
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            expect(diags.filter(d => d.code === 'circular-containment')).toHaveLength(0);
        });

        it('should NOT flag valid recursive self-typed features', async () => {
            const text = `
package Test {
    abstract action def Function {
        action subfunctions[*] : Function;
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const circular = diags.filter(d => d.code === 'circular-containment');
            expect(circular.length).toBe(0);
        });

        it('should NOT flag recursive part containment (tree pattern)', async () => {
            const text = `
package Test {
    part def TreeNode {
        part children[*] : TreeNode;
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const circular = diags.filter(d => d.code === 'circular-containment');
            expect(circular.length).toBe(0);
        });

        it('should NOT flag mutually recursive optional composite features', async () => {
            const text = `
package Test {
    part def A {
        part b : B[0..1];
    }
    part def B {
        part a : A[0..*];
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const circular = diags.filter(d => d.code === 'circular-containment');
            expect(circular).toHaveLength(0);
        });
    });

    describe('unsatisfied requirements', () => {
        it('should warn when a requirement usage has no satisfy statement', async () => {
            const text = `
package Test {
    requirement def MassReq {
        attribute massRequired : Real;
    }
    requirement vehicleSpec {
        subject v : Vehicle;
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unsatisfied = diags.filter(d => d.code === 'unsatisfied-requirement');
            expect(unsatisfied.length).toBeGreaterThanOrEqual(1);
            expect(unsatisfied[0].message).toContain('vehicleSpec');
        });

        it('should not warn when a requirement is satisfied', async () => {
            const text = `
package Test {
    part def Vehicle { }
    requirement vehicleSpec {
        subject v : Vehicle;
    }
    part vehicle_b : Vehicle;
    satisfy vehicleSpec by vehicle_b;
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unsatisfied = diags.filter(d => d.code === 'unsatisfied-requirement');
            expect(unsatisfied.length).toBe(0);
        });

        it('should not warn when a qualified satisfy references the requirement', async () => {
            const text = `
package Requirements {
    requirement engineSpec {
        subject e : Engine;
    }
}
package Design {
    part def Engine { }
    part engine_a : Engine;
    satisfy Requirements::engineSpec by engine_a;
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unsatisfied = diags.filter(d => d.code === 'unsatisfied-requirement');
            expect(unsatisfied.length).toBe(0);
        });

        it('should not warn for requirement definitions (only usages)', async () => {
            const text = `
package Test {
    requirement def MassRequirement {
        attribute massRequired : Real;
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unsatisfied = diags.filter(d => d.code === 'unsatisfied-requirement');
            expect(unsatisfied.length).toBe(0);
        });

        it('should not warn for nested sub-requirements inside a parent requirement', async () => {
            const text = `
package Test {
    part def Vehicle { }
    requirement vehicleSpec {
        subject v : Vehicle;
        requirement massReq {
            attribute massRequired : Real;
        }
    }
    part vehicle_b : Vehicle;
    satisfy vehicleSpec by vehicle_b;
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unsatisfied = diags.filter(d => d.code === 'unsatisfied-requirement');
            // massReq is nested inside vehicleSpec and should not be independently flagged
            expect(unsatisfied.length).toBe(0);
        });

        it('should detect satisfy across files in the workspace', async () => {
            const reqText = `
package Requirements {
    requirement engineSpec {
        subject e : Engine;
    }
}
`;
            const designText = `
package Design {
    part def Engine { }
    part engine_a : Engine;
    satisfy Requirements::engineSpec by engine_a;
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [
                    { uri: 'file:///requirements.sysml', text: reqText },
                    { uri: 'file:///design.sysml', text: designText },
                ],
                'file:///requirements.sysml',
            );
            const unsatisfied = diags.filter(d => d.code === 'unsatisfied-requirement');
            expect(unsatisfied.length).toBe(0);
        });

        it('should detect satisfy across files for shorthand satisfy syntax', async () => {
            const reqText = `
package Requirements {
    requirement engineSpec {
        subject e : Engine;
    }
}
`;
            const designText = `
package Design {
    part def Engine { }
    satisfy Requirements::engineSpec;
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [
                    { uri: 'file:///requirements.sysml', text: reqText },
                    { uri: 'file:///design.sysml', text: designText },
                ],
                'file:///requirements.sysml',
            );
            const unsatisfied = diags.filter(d => d.code === 'unsatisfied-requirement');
            expect(unsatisfied.length).toBe(0);
        });

        it('should not warn for requirement redefinitions inside satisfy blocks', async () => {
            const text = `
package Requirements {
    requirement engineSpec {
        requirement torqueReq {
            subject t : GenerateTorque;
        }
        requirement powerReq {
            port outPort { }
        }
    }
}
package Design {
    part def Engine { }
    action def GenerateTorque { }
    part engine_a : Engine;
    satisfy Requirements::engineSpec by engine_a {
        requirement torqueReq :>> torqueReq {
            subject generateTorque redefines generateTorque = engine_a;
        }
        requirement powerReq :>> powerReq {
            port torqueOutPort redefines outPort = engine_a;
        }
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unsatisfied = diags.filter(d => d.code === 'unsatisfied-requirement');
            // torqueReq and powerReq inside the satisfy block should not be flagged
            expect(unsatisfied.length).toBe(0);
        });

        it('should warn when a satisfy statement is commented out with //', async () => {
            const text = `
package Test {
    part def Vehicle { }
    requirement vehicleSpec {
        subject v : Vehicle;
    }
    part vehicle_b : Vehicle;
    //satisfy vehicleSpec by vehicle_b;
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unsatisfied = diags.filter(d => d.code === 'unsatisfied-requirement');
            expect(unsatisfied.length).toBeGreaterThanOrEqual(1);
            expect(unsatisfied[0].message).toContain('vehicleSpec');
        });

        it('should warn when a satisfy statement is inside a block comment', async () => {
            const text = `
package Test {
    part def Vehicle { }
    requirement vehicleSpec {
        subject v : Vehicle;
    }
    part vehicle_b : Vehicle;
    /* satisfy vehicleSpec by vehicle_b; */
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unsatisfied = diags.filter(d => d.code === 'unsatisfied-requirement');
            expect(unsatisfied.length).toBeGreaterThanOrEqual(1);
            expect(unsatisfied[0].message).toContain('vehicleSpec');
        });
    });

    describe('unverified requirements', () => {
        it('should warn when a satisfied requirement has no verify statement', async () => {
            const text = `
package Test {
    part def Vehicle { }
    requirement vehicleSpec {
        subject v : Vehicle;
    }
    part vehicle_a : Vehicle;
    satisfy vehicleSpec by vehicle_a;
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unverified = diags.filter(d => d.code === 'unverified-requirement');
            expect(unverified.length).toBeGreaterThanOrEqual(1);
            expect(unverified[0].message).toContain('vehicleSpec');
            expect(unverified[0].message).toContain('verification case');
        });

        it('should not warn when a requirement is both satisfied and verified', async () => {
            const text = `
package Test {
    part def Vehicle { }
    requirement vehicleSpec {
        subject v : Vehicle;
    }
    part vehicle_a : Vehicle;
    satisfy vehicleSpec by vehicle_a;
    verification case def VehicleTest { }
    verify vehicleSpec by VehicleTest;
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unverified = diags.filter(d => d.code === 'unverified-requirement');
            expect(unverified.length).toBe(0);
        });

        it('should warn when a requirement is unsatisfied and unverified', async () => {
            const text = `
package Test {
    requirement vehicleSpec {
        subject v : Vehicle;
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unverified = diags.filter(d => d.code === 'unverified-requirement');
            expect(unverified.length).toBeGreaterThanOrEqual(1);
            expect(unverified[0].message).toContain('vehicleSpec');
            expect(unverified[0].message).toContain('no verification case');
        });

        it('should detect verify across files in the workspace', async () => {
            const reqText = `
package Requirements {
    requirement engineSpec {
        subject e : Engine;
    }
}
`;
            const designText = `
package Design {
    part def Engine { }
    part engine_a : Engine;
    satisfy Requirements::engineSpec by engine_a;
}
`;
            const verifyText = `
package Verification {
    verification case def EngineTest { }
    verify Requirements::engineSpec by EngineTest;
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [
                    { uri: 'file:///requirements.sysml', text: reqText },
                    { uri: 'file:///design.sysml', text: designText },
                    { uri: 'file:///verification.sysml', text: verifyText },
                ],
                'file:///requirements.sysml',
            );
            const unverified = diags.filter(d => d.code === 'unverified-requirement');
            expect(unverified.length).toBe(0);
        });

        it('should detect verify across files for shorthand verify syntax', async () => {
            const reqText = `
package Requirements {
    requirement engineSpec {
        subject e : Engine;
    }
}
`;
            const designText = `
package Design {
    part def Engine { }
    satisfy Requirements::engineSpec;
}
`;
            const verifyText = `
package Verification {
    verify Requirements::engineSpec;
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [
                    { uri: 'file:///requirements.sysml', text: reqText },
                    { uri: 'file:///design.sysml', text: designText },
                    { uri: 'file:///verification.sysml', text: verifyText },
                ],
                'file:///requirements.sysml',
            );
            const unverified = diags.filter(d => d.code === 'unverified-requirement');
            expect(unverified.length).toBe(0);
        });

        it('should warn when verify is in a different file but missing', async () => {
            const reqText = `
package Requirements {
    requirement engineSpec {
        subject e : Engine;
    }
}
`;
            const designText = `
package Design {
    part def Engine { }
    part engine_a : Engine;
    satisfy Requirements::engineSpec by engine_a;
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [
                    { uri: 'file:///requirements.sysml', text: reqText },
                    { uri: 'file:///design.sysml', text: designText },
                ],
                'file:///requirements.sysml',
            );
            const unverified = diags.filter(d => d.code === 'unverified-requirement');
            expect(unverified.length).toBeGreaterThanOrEqual(1);
            expect(unverified[0].message).toContain('engineSpec');
        });

        it('should not flag nested sub-requirements for verification', async () => {
            const text = `
package Test {
    part def Vehicle { }
    requirement vehicleSpec {
        subject v : Vehicle;
        requirement massReq {
            attribute massRequired : Real;
        }
    }
    part vehicle_a : Vehicle;
    satisfy vehicleSpec by vehicle_a;
    verify vehicleSpec by VehicleTest;
    verification case def VehicleTest { }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unverified = diags.filter(d => d.code === 'unverified-requirement');
            // massReq is nested — should not be independently flagged
            expect(unverified.length).toBe(0);
        });

        it('should warn when a verify statement is commented out', async () => {
            const text = `
package Test {
    part def Vehicle { }
    requirement vehicleSpec {
        subject v : Vehicle;
    }
    part vehicle_a : Vehicle;
    satisfy vehicleSpec by vehicle_a;
    verification case def VehicleTest { }
    //verify vehicleSpec by VehicleTest;
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unverified = diags.filter(d => d.code === 'unverified-requirement');
            expect(unverified.length).toBeGreaterThanOrEqual(1);
            expect(unverified[0].message).toContain('vehicleSpec');
        });
    });

    describe('port compatibility – transitive type hierarchy', () => {
        it('should NOT flag ports whose types share a specialization chain', async () => {
            const text = `
package Test {
    port def BasePort {
        out item data;
    }
    port def DerivedPort :> BasePort { }
    part def System {
        port a : BasePort;
        port b : DerivedPort;
        connection c1 connect a to b;
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const portDiags = diags.filter(d => d.code === 'incompatible-port-types');
            expect(portDiags.length).toBe(0);
        });

        it('should NOT flag ports whose types share a common ancestor', async () => {
            const text = `
package Test {
    port def BasePort {
        out item data;
    }
    port def PortA :> BasePort { }
    port def PortB :> BasePort { }
    part def System {
        port a : PortA;
        port b : PortB;
        connection c1 connect a to b;
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const portDiags = diags.filter(d => d.code === 'incompatible-port-types');
            expect(portDiags.length).toBe(0);
        });

        it('should NOT flag ports with deep transitive hierarchy (A :> B :> C)', async () => {
            const text = `
package Test {
    port def Root {
        out item signal;
    }
    port def Middle :> Root { }
    port def Leaf :> Middle { }
    part def System {
        port r : Root;
        port l : Leaf;
        connection c1 connect r to l;
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const portDiags = diags.filter(d => d.code === 'incompatible-port-types');
            expect(portDiags.length).toBe(0);
        });

        it('should flag ports with unrelated type hierarchies', async () => {
            const text = `
package Test {
    port def SensorPort {
        out item reading;
    }
    port def ActuatorPort {
        in item command;
    }
    part def System {
        port s : SensorPort;
        port a : ActuatorPort;
        connection c1 connect s to a;
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const portDiags = diags.filter(d => d.code === 'incompatible-port-types');
            expect(portDiags.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('viewpoint satisfaction (view-no-scope)', () => {
        it('should warn when a view has no expose or filter', async () => {
            const text = `
package Test {
    part def Vehicle { }
    view emptyView { }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const viewDiags = diags.filter(d => d.code === 'view-no-scope');
            expect(viewDiags.length).toBeGreaterThanOrEqual(1);
            expect(viewDiags[0].message).toContain('emptyView');
        });

        it('should NOT warn when a view has expose targets', async () => {
            const text = `
package Test {
    part def Vehicle { }
    view scopedView {
        expose Vehicle;
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const viewDiags = diags.filter(d => d.code === 'view-no-scope');
            expect(viewDiags.length).toBe(0);
        });

        it('should NOT warn when a view has filter directives', async () => {
            const text = `
package Test {
    part def Vehicle { }
    view filteredView {
        filter @SysML::PartUsage;
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const viewDiags = diags.filter(d => d.code === 'view-no-scope');
            expect(viewDiags.length).toBe(0);
        });

        it('should NOT warn for view definitions (only view usages)', async () => {
            const text = `
package Test {
    view def MyViewDef { }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const viewDiags = diags.filter(d => d.code === 'view-no-scope');
            expect(viewDiags.length).toBe(0);
        });
    });

    describe('package/namespace visibility', () => {
        const pkgAText = `
package PkgA {
    part def Part3;
}
`;

        it('should flag a type defined only in an unrelated, unimported package', async () => {
            const pkgBText = `
package PkgB {
    part def Part1;
    part usesPart3 : Part3;
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [{ uri: 'file:///pkg-a.sysml', text: pkgAText }, { uri: 'file:///pkg-b.sysml', text: pkgBText }],
                'file:///pkg-b.sysml',
            );
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.some(d => d.message.includes("'Part3'"))).toBe(true);
        });

        it('should resolve via an exact membership import (import PkgA::Part3;)', async () => {
            const pkgBText = `
package PkgB {
    import PkgA::Part3;
    part def Part1;
    part usesPart3 : Part3;
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [{ uri: 'file:///pkg-a.sysml', text: pkgAText }, { uri: 'file:///pkg-b.sysml', text: pkgBText }],
                'file:///pkg-b.sysml',
            );
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.some(d => d.message.includes("'Part3'"))).toBe(false);
        });

        it('should resolve via a shallow namespace import (import PkgA::*;)', async () => {
            const pkgBText = `
package PkgB {
    import PkgA::*;
    part def Part1;
    part usesPart3 : Part3;
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [{ uri: 'file:///pkg-a.sysml', text: pkgAText }, { uri: 'file:///pkg-b.sysml', text: pkgBText }],
                'file:///pkg-b.sysml',
            );
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.some(d => d.message.includes("'Part3'"))).toBe(false);
        });

        it('should resolve nested members via a deep membership import (import PkgA::**;)', async () => {
            const nestedPkgAText = `
package PkgA {
    part def Housing {
        part def Part3;
    }
}
`;
            const pkgBText = `
package PkgB {
    import PkgA::**;
    part def Part1;
    part usesPart3 : Part3;
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [{ uri: 'file:///pkg-a.sysml', text: nestedPkgAText }, { uri: 'file:///pkg-b.sysml', text: pkgBText }],
                'file:///pkg-b.sysml',
            );
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.some(d => d.message.includes("'Part3'"))).toBe(false);
        });

        it('should not resolve via an import of an unrelated package', async () => {
            const pkgCText = `
package PkgC {
    part def Unrelated;
}
`;
            const pkgBText = `
package PkgB {
    import PkgC::*;
    part def Part1;
    part usesPart3 : Part3;
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [
                    { uri: 'file:///pkg-a.sysml', text: pkgAText },
                    { uri: 'file:///pkg-c.sysml', text: pkgCText },
                    { uri: 'file:///pkg-b.sysml', text: pkgBText },
                ],
                'file:///pkg-b.sysml',
            );
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.some(d => d.message.includes("'Part3'"))).toBe(true);
        });

        it('should resolve a sibling definition in the same package across files without import', async () => {
            const pkgBFile1 = `
package PkgB {
    part def Part1;
}
`;
            const pkgBFile2 = `
package PkgB {
    part usesPart1 : Part1;
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [{ uri: 'file:///pkg-b-1.sysml', text: pkgBFile1 }, { uri: 'file:///pkg-b-2.sysml', text: pkgBFile2 }],
                'file:///pkg-b-2.sysml',
            );
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.length).toBe(0);
        });

        it('should combine imports from every fragment of a package split across files', async () => {
            const pkgBFile1 = `
package PkgB {
    import PkgA::Part3;
    part def Part1;
}
`;
            const pkgBFile2 = `
package PkgB {
    part usesPart3 : Part3;
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [
                    { uri: 'file:///pkg-a.sysml', text: pkgAText },
                    { uri: 'file:///pkg-b-1.sysml', text: pkgBFile1 },
                    { uri: 'file:///pkg-b-2.sysml', text: pkgBFile2 },
                ],
                'file:///pkg-b-2.sysml',
            );
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.some(d => d.message.includes("'Part3'"))).toBe(false);
        });

        it('should still flag an unresolved reference when no fragment of the package imports it', async () => {
            const pkgBFile1 = `
package PkgB {
    part def Part1;
}
`;
            const pkgBFile2 = `
package PkgB {
    part usesPart3 : Part3;
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [
                    { uri: 'file:///pkg-a.sysml', text: pkgAText },
                    { uri: 'file:///pkg-b-1.sysml', text: pkgBFile1 },
                    { uri: 'file:///pkg-b-2.sysml', text: pkgBFile2 },
                ],
                'file:///pkg-b-2.sysml',
            );
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.some(d => d.message.includes("'Part3'"))).toBe(true);
        });

        it('should detect if a fragment\'s import is edited or removed', async () => {
            const { DocumentManager } = await import('../../server/src/documentManager.js');
            const { SemanticValidator } = await import('../../server/src/providers/semanticValidator.js');

            const uriA = 'file:///pkg-a.sysml';
            const uriB1 = 'file:///pkg-b-1.sysml';
            const uriB2 = 'file:///pkg-b-2.sysml';
            const pkgB1WithImport = `
package PkgB {
    import PkgA::Part3;
    part def Part1;
}
`;
            const pkgB2 = `
package PkgB {
    part usesPart3 : Part3;
}
`;

            const docManager = new DocumentManager();
            docManager.parse(await makeDoc(pkgAText, uriA));
            docManager.parse(await makeDoc(pkgB1WithImport, uriB1));
            docManager.parse(await makeDoc(pkgB2, uriB2));

            const validator = new SemanticValidator(docManager);
            const beforeDiags = validator.validate(uriB2).filter(d => d.code === 'unresolved-type');
            expect(beforeDiags.some(d => d.message.includes("'Part3'"))).toBe(false);

            // Incremental test: Edit existing fragment 1 (uriB1), same uri, new version, import removed
            // fragment 2 (pkgB2) is untouched, so its own symbol never held the
            // import in the first place; only the merge result should change.
            const mod = await import('../../server/node_modules/vscode-languageserver-textdocument/lib/esm/main.js');
            const pkgB1WithoutImport = `
package PkgB {
    part def Part1;
}
`;
            docManager.parse(mod.TextDocument.create(uriB1, 'sysml', 2, pkgB1WithoutImport));

            const afterDiags = validator.validate(uriB2).filter(d => d.code === 'unresolved-type');
            expect(afterDiags.some(d => d.message.includes("'Part3'"))).toBe(true);
        });

        it('should resolve for non-part definition kinds too (attribute def, port def, interface def)', async () => {
            const libText = `
package Lib {
    attribute def Mass;
    port def PowerPort;
    interface def PowerInterface;
}
`;
            const userText = `
package User {
    import Lib::*;
    attribute def Vehicle {
        attribute mass : Mass;
        port powerIn : PowerPort;
    }
    interface def VehicleInterface :> PowerInterface;
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [{ uri: 'file:///lib.sysml', text: libText }, { uri: 'file:///user.sysml', text: userText }],
                'file:///user.sysml',
            );
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.length).toBe(0);
        });

        it('should resolve an imported usage, not just definitions (§7.5.1: "part a : A;" is an ordinary public member like any definition)', async () => {
            // checkUnresolvedType only validates ':' typing positions, which expect
            // an uppercase-leading name (its own, unrelated heuristic skips lowercase
            // names as feature/subsetting references, not type references -- see the
            // 'attribute x :> distancePerVolume' case elsewhere in this file). A part
            // *usage* named uppercase is atypical style but syntactically valid, and
            // lets this test exercise resolution of a non-definition member without
            // that unrelated heuristic masking the result.
            const libText = `
package Lib {
    part def Engine;
    part SharedEngine : Engine;
}
`;
            const userText = `
package User {
    import Lib::SharedEngine;
    part def Vehicle {
        part engine : SharedEngine;
    }
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [{ uri: 'file:///lib.sysml', text: libText }, { uri: 'file:///user.sysml', text: userText }],
                'file:///user.sysml',
            );
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.some(d => d.message.includes("'SharedEngine'"))).toBe(false);
        });

        it('should re-import an already-imported name by simple name (standard §7.5.3 P2/Q example)', async () => {
            const p1Text = `
package P1 {
    part def A;
    part def C;
}
`;
            // Mirrors: package P2 { private import P1::A; private import P1::C;
            //   package Q { import C; } } -- "C" is re-imported from P2 into Q.
            const p2Text = `
package P2 {
    private import P1::A;
    private import P1::C;
    package Q {
        import C;
        part usesC : C;
    }
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [{ uri: 'file:///p1.sysml', text: p1Text }, { uri: 'file:///p2.sysml', text: p2Text }],
                'file:///p2.sysml',
            );
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.some(d => d.message.includes("'C'"))).toBe(false);
        });

        it('should let a later import in the same namespace depend on an earlier import in that same namespace', async () => {
            const libText = `
package Lib {
    part def A {
        part def B;
    }
}
`;
            const pText = `
package P {
    import Lib::A;
    import A::B;
    part usesB : B;
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [{ uri: 'file:///lib.sysml', text: libText }, { uri: 'file:///p.sysml', text: pText }],
                'file:///p.sysml',
            );
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.some(d => d.message.includes("'B'"))).toBe(false);
        });

        it('should resolve a bare re-import relative to its enclosing namespace so it can itself be re-exported further', async () => {
            const p1Text = `
package P1 {
    part def Part1;
}
`;
            const p2Text = `
package P2 {
    private import P1::Part1;
    package P2_2 {
        public import Part1;
    }
}
`;
            const p3Text = `
package P3 {
    import P2::P2_2::Part1;
    part usesPart1 : Part1;
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [
                    { uri: 'file:///p1.sysml', text: p1Text },
                    { uri: 'file:///p2.sysml', text: p2Text },
                    { uri: 'file:///p3.sysml', text: p3Text },
                ],
                'file:///p3.sysml',
            );
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.some(d => d.message.includes("'Part1'"))).toBe(false);
        });

        it('should NOT propagate a bare re-import to a further importer when declared private (default visibility)', async () => {
            const p1Text = `
package P1 {
    part def Part1;
}
`;
            const p2Text = `
package P2 {
    private import P1::Part1;
    package P2_2 {
        import Part1;
    }
}
`;
            const p3Text = `
package P3 {
    import P2::P2_2::Part1;
    part usesPart1 : Part1;
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [
                    { uri: 'file:///p1.sysml', text: p1Text },
                    { uri: 'file:///p2.sysml', text: p2Text },
                    { uri: 'file:///p3.sysml', text: p3Text },
                ],
                'file:///p3.sysml',
            );
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.some(d => d.message.includes("'Part1'"))).toBe(true);
        });

        it('should NOT propagate a bare re-import to a further importer when declared protected', async () => {
            const p1Text = `
package P1 {
    part def Part1;
}
`;
            const p2Text = `
package P2 {
    private import P1::Part1;
    package P2_2 {
        protected import Part1;
    }
}
`;
            const p3Text = `
package P3 {
    import P2::P2_2::Part1;
    part usesPart1 : Part1;
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [
                    { uri: 'file:///p1.sysml', text: p1Text },
                    { uri: 'file:///p2.sysml', text: p2Text },
                    { uri: 'file:///p3.sysml', text: p3Text },
                ],
                'file:///p3.sysml',
            );
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.some(d => d.message.includes("'Part1'"))).toBe(true);
        });

        it('should resolve a bare re-import within its own defining namespace regardless of the re-import\'s own visibility', async () => {
            // A private/protected re-import still makes the name usable *inside*
            // the package that declared it (and its own descendants) -- privacy
            // only blocks a name from being re-exported one hop further out, per
            // the propagation tests above. This isolates that from the "external
            // package" scenario: no P3 here, just a reference inside P2_2 itself.
            const p1Text = `
package P1 {
    part def Part1;
}
`;
            const p2Text = `
package P2 {
    private import P1::Part1;
    package P2_2 {
        private import Part1;
        part usesPart1 : Part1;
    }
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [{ uri: 'file:///p1.sysml', text: p1Text }, { uri: 'file:///p2.sysml', text: p2Text }],
                'file:///p2.sysml',
            );
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.some(d => d.message.includes("'Part1'"))).toBe(false);
        });

        it('should resolve an import target directly owned by the importing namespace itself, and let an external package consume its public re-export', async () => {
            const outerText = `
package Outer {
    package Inner {
        part def X;
    }
    public import Inner::X;
}
`;
            const externalText = `
package External {
    import Outer::X;
    part usesX : X;
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [
                    { uri: 'file:///outer.sysml', text: outerText },
                    { uri: 'file:///external.sysml', text: externalText },
                ],
                'file:///external.sysml',
            );
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.some(d => d.message.includes("'X'"))).toBe(false);
        });

        it('should let a local package shadow a same-named root-level package, not the reverse (§7.5.1: search innermost outward, root last)', async () => {
            const text = `
package PkgA {
    part def Part1Base;
}

package PkgB {
    package PkgA {
        part def Part1Local;
    }
    part usesLocal : PkgA::Part1Local;
    part usesBaseFromPkgB : PkgA::Part1Base;
}

package PkgC {
    part usesBaseFromPkgC : PkgA::Part1Base;
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            const elementNames = (name: string) =>
                unresolvedDiags.some(d => (d.data as { elementName?: string } | undefined)?.elementName === name);
            // The local PkgA::Part1Local reference must resolve against the nested PkgA.
            expect(elementNames('usesLocal')).toBe(false);
            // PkgA::Part1Base is shadowed from within PkgB -- the local PkgA has no such member.
            expect(elementNames('usesBaseFromPkgB')).toBe(true);
            // An unrelated package PkgC is unaffected -- root PkgA::Part1Base resolves normally there.
            expect(elementNames('usesBaseFromPkgC')).toBe(false);
        });

        it('should follow recursive membership import into nested packages (standard §7.5.3 P4/P5 example)', async () => {
            // package P4 { item A; item B; package Q { item C; } }
            // package P5 { private import P4::**; } -- equivalent to
            //   import P4; import P4::*; import P4::Q::*;
            const p4Text = `
package P4 {
    part def A;
    part def B;
    package Q {
        part def C;
    }
}
`;
            const p5Text = `
package P5 {
    private import P4::**;
    part usesA : A;
    part usesC : C;
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [{ uri: 'file:///p4.sysml', text: p4Text }, { uri: 'file:///p5.sysml', text: p5Text }],
                'file:///p5.sysml',
            );
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.some(d => d.message.includes("'A'"))).toBe(false);
            expect(unresolvedDiags.some(d => d.message.includes("'C'"))).toBe(false);
        });

        it('should follow recursive namespace import into nested packages (standard §7.5.3 P4/P6 example)', async () => {
            // package P4 { item A; item B; package Q { item C; } }
            // package P6 { private import P4::*::**; } -- equivalent to
            //   import P4::*; import P4::Q::*;
            // (Note that P4 itself is NOT imported, unlike P4::** in the P5 case above.)
            const p4Text = `
package P4 {
    part def A;
    part def B;
    package Q {
        part def C;
    }
}
`;
            const p6Text = `
package P6 {
    private import P4::*::**;
    part usesA : A;
    part usesC : C;
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [{ uri: 'file:///p4.sysml', text: p4Text }, { uri: 'file:///p6.sysml', text: p6Text }],
                'file:///p6.sysml',
            );
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.some(d => d.message.includes("'A'"))).toBe(false);
            expect(unresolvedDiags.some(d => d.message.includes("'C'"))).toBe(false);
        });

        describe('recursive/mutual import cycles should not stack overflow', () => {
            it('resolves a mutual public ::** import cycle between two packages without hanging', async () => {
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
    import A::*;
    import B::*;
    part usesA : PartA;
    part usesB : PartB;
}
`;
                const diags = await getSemanticDiagnostics(text);
                const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
                expect(unresolvedDiags.some(d => d.message.includes("'PartA'"))).toBe(false);
                expect(unresolvedDiags.some(d => d.message.includes("'PartB'"))).toBe(false);
            });

            it('resolves a package that recursively re-imports itself should not hang', async () => {
                const text = `
package Self {
    part def X;
    public import Self::**;
}
package User {
    import Self::*;
    part usesX : X;
}
`;
                const diags = await getSemanticDiagnostics(text);
                const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
                expect(unresolvedDiags.some(d => d.message.includes("'X'"))).toBe(false);
            });

            it('resolves a 3-node mutual ::** import cycle (A -> B -> C -> A) should not hang', async () => {
                const text = `
package A {
    part def PartA;
    public import B::**;
}
package B {
    part def PartB;
    public import C::**;
}
package C {
    part def PartC;
    public import A::**;
}
package User {
    import A::*;
    part usesC : PartC;
}
`;
                const diags = await getSemanticDiagnostics(text);
                const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
                expect(unresolvedDiags.some(d => d.message.includes("'PartC'"))).toBe(false);
            });
        });

        it('should propagate a publicly-imported name to a further importer (transitive re-export)', async () => {
            const pkgAText = `
package PkgA {
    part def Part3;
}
`;
            const pkgBText = `
package PkgB {
    public import PkgA::*;
}
`;
            const pkgDText = `
package PkgD {
    import PkgB::*;
    part usesPart3 : Part3;
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [
                    { uri: 'file:///pkg-a.sysml', text: pkgAText },
                    { uri: 'file:///pkg-b.sysml', text: pkgBText },
                    { uri: 'file:///pkg-d.sysml', text: pkgDText },
                ],
                'file:///pkg-d.sysml',
            );
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.some(d => d.message.includes("'Part3'"))).toBe(false);
        });

        it('should NOT propagate a privately-imported name to a further importer', async () => {
            const pkgAText = `
package PkgA {
    part def Part3;
}
`;
            const pkgBText = `
package PkgB {
    private import PkgA::*;
}
`;
            const pkgDText = `
package PkgD {
    import PkgB::*;
    part usesPart3 : Part3;
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [
                    { uri: 'file:///pkg-a.sysml', text: pkgAText },
                    { uri: 'file:///pkg-b.sysml', text: pkgBText },
                    { uri: 'file:///pkg-d.sysml', text: pkgDText },
                ],
                'file:///pkg-d.sysml',
            );
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.some(d => d.message.includes("'Part3'"))).toBe(true);
        });

        it('should NOT propagate a protected-imported name to a further importer (§7.5.3: protected == private for a package, not a definition/usage)', async () => {
            const pkgAText = `
package PkgA {
    part def Part3;
}
`;
            const pkgBText = `
package PkgB {
    protected import PkgA::*;
}
`;
            const pkgDText = `
package PkgD {
    import PkgB::*;
    part usesPart3 : Part3;
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [
                    { uri: 'file:///pkg-a.sysml', text: pkgAText },
                    { uri: 'file:///pkg-b.sysml', text: pkgBText },
                    { uri: 'file:///pkg-d.sysml', text: pkgDText },
                ],
                'file:///pkg-d.sysml',
            );
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.some(d => d.message.includes("'Part3'"))).toBe(true);
        });

        it('should let a specialization of a definition/usage see its protected-imported members (§7.5.3 exception; unrelated definitions still cannot)', async () => {
            const text = `
package Lib {
    part def Engine;
}

package User {
    part def Vehicle {
        protected import Lib::Engine;
    }
    part def SportsCar :> Vehicle {
        part engineViaSpecialization : Vehicle::Engine;
    }
    part def Unrelated {
        part engineViaUnrelated : Vehicle::Engine;
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            const elementNames = (name: string) =>
                unresolvedDiags.some(d => (d.data as { elementName?: string } | undefined)?.elementName === name);
            // SportsCar specializes Vehicle, so it inherits visibility into Vehicle's protected import.
            expect(elementNames('engineViaSpecialization')).toBe(false);
            // Unrelated is not a specialization of Vehicle -- protected behaves as private for it.
            expect(elementNames('engineViaUnrelated')).toBe(true);
        });

        it('should NOT let an unrelated same-named definition in another package falsely satisfy the specialization check (§7.6)', async () => {
            // Regression test: `isSpecializationOf` must resolve `SportsCar`'s
            // `:>` target the same namespace-aware way any other reference
            // would, not by matching *any* definition sharing the simple name
            // "Vehicle" anywhere in the workspace. PkgB::SportsCar specializes
            // PkgB::Vehicle -- an unrelated PkgA::Vehicle that merely happens
            // to share that name must not count, even though PkgA::Vehicle
            // does have a protected import of Engine.
            const text = `
package Lib {
    part def Engine;
}
package PkgA {
    part def Vehicle {
        protected import Lib::Engine;
    }
}
package PkgB {
    part def Vehicle;
    part def SportsCar :> Vehicle {
        part engine : PkgA::Vehicle::Engine;
    }
}
`;
            const diags = await getSemanticDiagnostics(text);
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.some(d => d.message.includes('PkgA::Vehicle::Engine'))).toBe(true);
        });

        it('should not let a protected member become visible through a specialization chain that never actually reaches the owning definition', async () => {
            // Test if the protected visibility remains inaccessible, which
            // requires the implementation of a re-entrancy guard, otherwise
            // causing a serious range error / stack size overflow
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
            const diags = await getSemanticDiagnostics(text);
            const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
            expect(unresolvedDiags.filter(d => d.message.includes('Vehicle::Engine')).length).toBe(2);
        });

        describe('incremental visibility changes are reassessed on re-parse', () => {
            // Resolution results must not be stale-cached across edits: an
            // import's own visibility keyword is just as much a part of a
            // document's content as anything else, so tightening or loosening
            // it (with no other change) must be picked up on the very next
            // validate() call, the same way adding/removing a symbol is.
            it('re-flags an external reference once a public import is edited down to private, and clears it again if reverted', async () => {
                const { DocumentManager } = await import('../../server/src/documentManager.js');
                const { SemanticValidator } = await import('../../server/src/providers/semanticValidator.js');

                const uriLib = 'file:///lib.sysml';
                const uriB = 'file:///b.sysml';
                const uriExternal = 'file:///external.sysml';
                const libText = `
package Lib {
    part def Part3;
}
`;
                const bTextPublic = `
package PkgB {
    public import Lib::Part3;
}
`;
                const bTextPrivate = `
package PkgB {
    private import Lib::Part3;
}
`;
                const externalText = `
package External {
    import PkgB::*;
    part usesPart3 : Part3;
}
`;

                const docManager = new DocumentManager();
                docManager.parse(await makeDoc(libText, uriLib));
                docManager.parse(await makeDoc(bTextPublic, uriB));
                docManager.parse(await makeDoc(externalText, uriExternal));
                const validator = new SemanticValidator(docManager);

                expect(validator.validate(uriExternal).filter(d => d.code === 'unresolved-type')).toHaveLength(0);

                const mod = await import('../../server/node_modules/vscode-languageserver-textdocument/lib/esm/main.js');
                docManager.parse(mod.TextDocument.create(uriB, 'sysml', 2, bTextPrivate));
                const afterDiags = validator.validate(uriExternal).filter(d => d.code === 'unresolved-type');
                expect(afterDiags.some(d => d.message.includes("'Part3'"))).toBe(true);

                docManager.parse(mod.TextDocument.create(uriB, 'sysml', 3, bTextPublic));
                expect(validator.validate(uriExternal).filter(d => d.code === 'unresolved-type')).toHaveLength(0);
            });

            it('re-flags a non-specializing reference once a public import is edited down to protected, and clears it again if reverted', async () => {
                const { DocumentManager } = await import('../../server/src/documentManager.js');
                const { SemanticValidator } = await import('../../server/src/providers/semanticValidator.js');

                const uriLib = 'file:///lib.sysml';
                const uriVehicle = 'file:///vehicle.sysml';
                const uriUser = 'file:///user.sysml';
                const libText = `
package Lib {
    part def Engine;
}
`;
                const vehicleTextPublic = `
part def Vehicle {
    public import Lib::Engine;
}
`;
                const vehicleTextProtected = `
part def Vehicle {
    protected import Lib::Engine;
}
`;
                const userText = `
package User {
    part usesEngine : Vehicle::Engine;
}
`;

                const docManager = new DocumentManager();
                docManager.parse(await makeDoc(libText, uriLib));
                docManager.parse(await makeDoc(vehicleTextPublic, uriVehicle));
                docManager.parse(await makeDoc(userText, uriUser));
                const validator = new SemanticValidator(docManager);

                expect(validator.validate(uriUser).filter(d => d.code === 'unresolved-type')).toHaveLength(0);

                const mod = await import('../../server/node_modules/vscode-languageserver-textdocument/lib/esm/main.js');
                docManager.parse(mod.TextDocument.create(uriVehicle, 'sysml', 2, vehicleTextProtected));
                const afterDiags = validator.validate(uriUser).filter(d => d.code === 'unresolved-type');
                expect(afterDiags.some(d => d.message.includes('Vehicle::Engine'))).toBe(true);

                docManager.parse(mod.TextDocument.create(uriVehicle, 'sysml', 3, vehicleTextPublic));
                expect(validator.validate(uriUser).filter(d => d.code === 'unresolved-type')).toHaveLength(0);
            });
        });

        describe('mixed-visibility duplicate imports of the same target (order-independence)', () => {
            // §7.5: "an element may have... multiple... memberships with the same
            // namespace" -- two `import` statements for the same target (here, across
            // two files of the same split package) are two distinct memberships, not
            // one that overwrites the other. The element's effective visibility must be
            // the most permissive of the two, regardless of which file/fragment happens
            // to be processed first -- a public import elsewhere in the same package
            // isn't shadowed by a redundant private one just because of file order.
            const p1Text = `
package P1 {
    part def Part1;
}
`;

            it('propagates when the public import is in the fragment registered first', async () => {
                const pkgBFile1 = `
package PkgB {
    public import P1::Part1;
}
`;
                const pkgBFile2 = `
package PkgB {
    private import P1::Part1;
}
`;
                const pkgDText = `
package PkgD {
    import PkgB::*;
    part usesPart1 : Part1;
}
`;
                const diags = await getSemanticDiagnosticsForUri(
                    [
                        { uri: 'file:///p1.sysml', text: p1Text },
                        { uri: 'file:///pkg-b-1.sysml', text: pkgBFile1 },
                        { uri: 'file:///pkg-b-2.sysml', text: pkgBFile2 },
                        { uri: 'file:///pkg-d.sysml', text: pkgDText },
                    ],
                    'file:///pkg-d.sysml',
                );
                const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
                expect(unresolvedDiags.some(d => d.message.includes("'Part1'"))).toBe(false);
            });

            it('propagates just the same when the public import is in the fragment registered second', async () => {
                const pkgBFile1 = `
package PkgB {
    private import P1::Part1;
}
`;
                const pkgBFile2 = `
package PkgB {
    public import P1::Part1;
}
`;
                const pkgDText = `
package PkgD {
    import PkgB::*;
    part usesPart1 : Part1;
}
`;
                const diags = await getSemanticDiagnosticsForUri(
                    [
                        { uri: 'file:///p1.sysml', text: p1Text },
                        { uri: 'file:///pkg-b-1.sysml', text: pkgBFile1 },
                        { uri: 'file:///pkg-b-2.sysml', text: pkgBFile2 },
                        { uri: 'file:///pkg-d.sysml', text: pkgDText },
                    ],
                    'file:///pkg-d.sysml',
                );
                const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
                expect(unresolvedDiags.some(d => d.message.includes("'Part1'"))).toBe(false);
            });
        });

        describe('qualified name resolution (§7.5.1/§7.5.5)', () => {
            const pkgAText = `
package PkgA {
    part def Part3;
}
`;

            it('should resolve a qualified reference to a real member of an unimported top-level package (§7.5.5: top-level elements are always name-resolvable)', async () => {
                const pkgBText = `
package PkgB {
    part def Part1;
    part usesPart3 : PkgA::Part3;
}
`;
                const diags = await getSemanticDiagnosticsForUri(
                    [{ uri: 'file:///pkg-a.sysml', text: pkgAText }, { uri: 'file:///pkg-b.sysml', text: pkgBText }],
                    'file:///pkg-b.sysml',
                );
                const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
                expect(unresolvedDiags.some(d => d.message.includes('PkgA::Part3'))).toBe(false);
            });

            it('should NOT resolve a qualified reference to a name that is not actually a member of the qualifying package', async () => {
                // Regression test: the qualified-name check used to fall back to "is the
                // root segment (PkgA) a known name anywhere", without ever checking that
                // the second segment is a real member of it -- so PkgA::NoSuchMember would
                // have silently resolved just because PkgA exists.
                const pkgCText = `
package PkgC {
    part def Part1;
    part usesGhost : PkgA::NoSuchMember;
}
`;
                const diags = await getSemanticDiagnosticsForUri(
                    [{ uri: 'file:///pkg-a.sysml', text: pkgAText }, { uri: 'file:///pkg-c.sysml', text: pkgCText }],
                    'file:///pkg-c.sysml',
                );
                const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
                expect(unresolvedDiags.some(d => d.message.includes('PkgA::NoSuchMember'))).toBe(true);
            });

            it('should NOT resolve a qualified reference through a privately-imported intermediate membership from outside the owning package', async () => {
                // Regression test: `PkgB::Part3` resolves the "Part3" segment
                // by indexing into PkgB's own resolved-member table, which
                // includes Part3 as a *privately* imported membership
                // (`private import PkgA::Part3;`). §7.5.2: "If [a membership]
                // is private, then it is not visible" outside the owning
                // namespace -- that must hold for a qualified-path segment
                // just as much as for a wildcard-import propagation (already
                // covered by the "should NOT propagate a privately-imported
                // name" tests above, which only exercise `import PkgB::*;`,
                // not a direct `PkgB::Part3` qualified reference).
                const pkgBText = `
package PkgB {
    private import PkgA::Part3;
}
`;
                const pkgDText = `
package PkgD {
    part usesPart3 : PkgB::Part3;
}
`;
                const diags = await getSemanticDiagnosticsForUri(
                    [
                        { uri: 'file:///pkg-a.sysml', text: pkgAText },
                        { uri: 'file:///pkg-b.sysml', text: pkgBText },
                        { uri: 'file:///pkg-d.sysml', text: pkgDText },
                    ],
                    'file:///pkg-d.sysml',
                );
                const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
                expect(unresolvedDiags.some(d => d.message.includes('PkgB::Part3'))).toBe(true);
            });

            it('should resolve a qualified reference through a privately-imported intermediate membership from inside the owning package (or a descendant of it)', async () => {
                // Privacy blocks visibility from *outside* the owning
                // namespace, not from the namespace itself or anything
                // nested inside it -- a sibling member of PkgB can still see
                // PkgB's own private membership via the same qualified path.
                const pkgBText = `
package PkgB {
    private import PkgA::Part3;
    part usesPart3 : PkgB::Part3;
}
`;
                const diags = await getSemanticDiagnosticsForUri(
                    [{ uri: 'file:///pkg-a.sysml', text: pkgAText }, { uri: 'file:///pkg-b.sysml', text: pkgBText }],
                    'file:///pkg-b.sysml',
                );
                const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
                expect(unresolvedDiags.some(d => d.message.includes('PkgB::Part3'))).toBe(false);
            });
        });

        describe('import filtering (§7.5.4)', () => {
            // Filters are evaluated against `metadataAnnotations`, which currently only
            // captures the prefix `#Name` annotation form (not the body `@Name { ... }`
            // metadata *usage* form used in the standard's own §7.5.4 examples) -- see
            // FilterExpr's doc comment. These tests use `#Name` accordingly.
            const libText = `
package Lib {
    metadata def Approval {
        attribute level : Natural;
    }
    #Approval part def Part3;
    part def Part4;
}
`;

            it('should import only metadata-matching members through a package-level filter', async () => {
                const userText = `
package User {
    import Lib::**;
    filter @Approval;
    part usesPart3 : Part3;
    part usesPart4 : Part4;
}
`;
                const diags = await getSemanticDiagnosticsForUri(
                    [{ uri: 'file:///lib.sysml', text: libText }, { uri: 'file:///user.sysml', text: userText }],
                    'file:///user.sysml',
                );
                const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
                expect(unresolvedDiags.some(d => d.message.includes("'Part3'"))).toBe(false);
                expect(unresolvedDiags.some(d => d.message.includes("'Part4'"))).toBe(true);
            });

            it('should import only metadata-matching members through an inline filtered import', async () => {
                const userText = `
package User {
    import Lib::**[@Approval];
    part usesPart3 : Part3;
    part usesPart4 : Part4;
}
`;
                const diags = await getSemanticDiagnosticsForUri(
                    [{ uri: 'file:///lib.sysml', text: libText }, { uri: 'file:///user.sysml', text: userText }],
                    'file:///user.sysml',
                );
                const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
                expect(unresolvedDiags.some(d => d.message.includes("'Part3'"))).toBe(false);
                expect(unresolvedDiags.some(d => d.message.includes("'Part4'"))).toBe(true);
            });

            it('should support "and"/"not" in filter expressions', async () => {
                const twoMetaLibText = `
package Lib {
    metadata def Approval;
    metadata def Deprecated;
    #Approval part def Part3;
    #Approval #Deprecated part def Part4;
    part def Part5;
}
`;
                const userText = `
package User {
    import Lib::**[@Approval and not @Deprecated];
    part usesPart3 : Part3;
    part usesPart4 : Part4;
    part usesPart5 : Part5;
}
`;
                const diags = await getSemanticDiagnosticsForUri(
                    [{ uri: 'file:///lib.sysml', text: twoMetaLibText }, { uri: 'file:///user.sysml', text: userText }],
                    'file:///user.sysml',
                );
                const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
                expect(unresolvedDiags.some(d => d.message.includes("'Part3'"))).toBe(false);
                expect(unresolvedDiags.some(d => d.message.includes("'Part4'"))).toBe(true);
                expect(unresolvedDiags.some(d => d.message.includes("'Part5'"))).toBe(true);
            });

            it('should support "or" in filter expressions', async () => {
                const twoMetaLibText = `
package Lib {
    metadata def Approval;
    metadata def Deprecated;
    #Approval part def Part3;
    #Deprecated part def Part4;
    part def Part5;
}
`;
                const userText = `
package User {
    import Lib::**[@Approval or @Deprecated];
    part usesPart3 : Part3;
    part usesPart4 : Part4;
    part usesPart5 : Part5;
}
`;
                const diags = await getSemanticDiagnosticsForUri(
                    [{ uri: 'file:///lib.sysml', text: twoMetaLibText }, { uri: 'file:///user.sysml', text: userText }],
                    'file:///user.sysml',
                );
                const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
                expect(unresolvedDiags.some(d => d.message.includes("'Part3'"))).toBe(false);
                expect(unresolvedDiags.some(d => d.message.includes("'Part4'"))).toBe(false);
                expect(unresolvedDiags.some(d => d.message.includes("'Part5'"))).toBe(true);
            });

            it('should treat an unsupported filter expression (e.g. attribute comparisons) as passing (fail-open)', async () => {
                const userText = `
package User {
    import Lib::**[level > 1];
    part usesPart3 : Part3;
    part usesPart4 : Part4;
}
`;
                const diags = await getSemanticDiagnosticsForUri(
                    [{ uri: 'file:///lib.sysml', text: libText }, { uri: 'file:///user.sysml', text: userText }],
                    'file:///user.sysml',
                );
                const unresolvedDiags = diags.filter(d => d.code === 'unresolved-type');
                expect(unresolvedDiags.some(d => d.message.includes("'Part3'"))).toBe(false);
                expect(unresolvedDiags.some(d => d.message.includes("'Part4'"))).toBe(false);
            });

            describe('incremental metadata changes are reassessed on re-parse', () => {
                // A filter condition's own metadata annotations are just as
                // much part of a document's content as anything else, so
                // adding/removing one must be picked up on the very next
                // validate() call, the same way an import's own visibility
                // keyword is (see the analogous describe block above).
                it('re-flags a filtered-import reference once #Approval metadata is removed from its target, and clears it again if reverted', async () => {
                    const { DocumentManager } = await import('../../server/src/documentManager.js');
                    const { SemanticValidator } = await import('../../server/src/providers/semanticValidator.js');

                    const uriLib = 'file:///lib.sysml';
                    const uriUser = 'file:///user.sysml';
                    const libTextApproved = `
package Lib {
    metadata def Approval;
    #Approval part def Part3;
}
`;
                    const libTextNotApproved = `
package Lib {
    metadata def Approval;
    part def Part3;
}
`;
                    const userText = `
package User {
    import Lib::**[@Approval];
    part usesPart3 : Part3;
}
`;

                    const docManager = new DocumentManager();
                    docManager.parse(await makeDoc(libTextApproved, uriLib));
                    docManager.parse(await makeDoc(userText, uriUser));
                    const validator = new SemanticValidator(docManager);

                    expect(validator.validate(uriUser).filter(d => d.code === 'unresolved-type')).toHaveLength(0);

                    const mod = await import('../../server/node_modules/vscode-languageserver-textdocument/lib/esm/main.js');
                    docManager.parse(mod.TextDocument.create(uriLib, 'sysml', 2, libTextNotApproved));
                    const afterDiags = validator.validate(uriUser).filter(d => d.code === 'unresolved-type');
                    expect(afterDiags.some(d => d.message.includes("'Part3'"))).toBe(true);

                    docManager.parse(mod.TextDocument.create(uriLib, 'sysml', 3, libTextApproved));
                    expect(validator.validate(uriUser).filter(d => d.code === 'unresolved-type')).toHaveLength(0);
                });

                it('re-flags an external reference once a filtered import is separately edited down to private, with the metadata unchanged', async () => {
                    // Combined case: metadata (filter match) and visibility
                    // are independent axes -- editing just one, while the
                    // other stays exactly as it was, must still be reassessed.
                    const { DocumentManager } = await import('../../server/src/documentManager.js');
                    const { SemanticValidator } = await import('../../server/src/providers/semanticValidator.js');

                    const uriLib = 'file:///lib.sysml';
                    const uriB = 'file:///b.sysml';
                    const uriExternal = 'file:///external.sysml';
                    const libTextApproved = `
package Lib {
    metadata def Approval;
    #Approval part def Part3;
}
`;
                    const bTextPublicFiltered = `
package PkgB {
    public import Lib::**[@Approval];
}
`;
                    const bTextPrivateFiltered = `
package PkgB {
    private import Lib::**[@Approval];
}
`;
                    const externalText = `
package External {
    import PkgB::*;
    part usesPart3 : Part3;
}
`;

                    const docManager = new DocumentManager();
                    docManager.parse(await makeDoc(libTextApproved, uriLib));
                    docManager.parse(await makeDoc(bTextPublicFiltered, uriB));
                    docManager.parse(await makeDoc(externalText, uriExternal));
                    const validator = new SemanticValidator(docManager);

                    expect(validator.validate(uriExternal).filter(d => d.code === 'unresolved-type')).toHaveLength(0);

                    const mod = await import('../../server/node_modules/vscode-languageserver-textdocument/lib/esm/main.js');
                    docManager.parse(mod.TextDocument.create(uriB, 'sysml', 2, bTextPrivateFiltered));
                    const afterDiags = validator.validate(uriExternal).filter(d => d.code === 'unresolved-type');
                    expect(afterDiags.some(d => d.message.includes("'Part3'"))).toBe(true);

                    docManager.parse(mod.TextDocument.create(uriB, 'sysml', 3, bTextPublicFiltered));
                    expect(validator.validate(uriExternal).filter(d => d.code === 'unresolved-type')).toHaveLength(0);
                });
            });
        });
    });

    describe('ambiguous namespace name conflicts (same-kind symbols sharing a qualifiedName)', () => {
        // Per KerML's own well-formedness rule (`Membership.isDistinguishableFrom`,
        // v1.0 §8.3.2.4.4): two memberships ARE distinguishable -- i.e. NOT a
        // conflict -- when their element kinds don't conform to each other,
        // regardless of a name collision. A `package A` and an unrelated
        // `part def A` sharing a bare name is therefore VALID SysML (see the
        // "different kinds" describe block below); a genuine conflict only
        // exists between elements of the *same* (conforming) kind, e.g. two
        // `part def A`. `buildSymbolIndexes` treats the whole qualifiedName as
        // unresolvable while such a same-kind conflict exists, and
        // `checkAmbiguousNamespaceName` flags each conflicting declaration
        // with an `ambiguous-namespace-name` diagnostic explaining why.
        it('does not silently merge two same-kind declarations sharing a name across files, and flags both', async () => {
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
    import A::B;
    import A::B2;
    part usesB : B;
    part usesB2 : B2;
}
`;
            const entries = [
                { uri: 'file:///partdef-a-1.sysml', text: partDefA1Text },
                { uri: 'file:///partdef-a-2.sysml', text: partDefA2Text },
                { uri: 'file:///external.sysml', text: externalText },
            ];

            const externalDiags = await getSemanticDiagnosticsForUri(entries, 'file:///external.sysml');
            const unresolvedInExternal = externalDiags.filter(d => d.code === 'unresolved-type');
            // Neither B (owned by the first `part def A`) nor B2 (owned by the
            // second) should resolve through the ambiguous "A" -- both must be
            // flagged, not one silently picked and the other correctly rejected.
            expect(unresolvedInExternal.some(d => d.message.includes("'B'"))).toBe(true);
            expect(unresolvedInExternal.some(d => d.message.includes("'B2'"))).toBe(true);

            const partDefA1Diags = await getSemanticDiagnosticsForUri(entries, 'file:///partdef-a-1.sysml');
            const partDefA2Diags = await getSemanticDiagnosticsForUri(entries, 'file:///partdef-a-2.sysml');
            const ambiguousInA1 = partDefA1Diags.filter(d => d.code === 'ambiguous-namespace-name');
            const ambiguousInA2 = partDefA2Diags.filter(d => d.code === 'ambiguous-namespace-name');
            // The conflict spans two different files -- each file's own
            // declaration of "A" must be flagged when that file is validated,
            // not just whichever file happens to be validated together with
            // the other (workspace-wide, unlike the per-file duplicate check).
            expect(ambiguousInA1.some(d => d.message.includes("'A'"))).toBe(true);
            expect(ambiguousInA2.some(d => d.message.includes("'A'"))).toBe(true);
        });

        it('flags the conflict when both same-kind conflicting declarations are in the same file', async () => {
            const text = `
part def A {
    part def B;
}
part def A {
    part def B2;
}
`;
            const diags = await getSemanticDiagnostics(text);
            const ambiguous = diags.filter(d => d.code === 'ambiguous-namespace-name');
            expect(ambiguous.length).toBe(2);
        });

        it('does not flag a legitimate package reopened across files as a conflict', async () => {
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
            const diags = await getSemanticDiagnosticsForUri(
                [{ uri: 'file:///shared-1.sysml', text: pkgFile1 }, { uri: 'file:///shared-2.sysml', text: pkgFile2 }],
                'file:///shared-1.sysml',
            );
            expect(diags.filter(d => d.code === 'ambiguous-namespace-name')).toHaveLength(0);
            expect(diags.filter(d => d.code === 'unresolved-type')).toHaveLength(0);
        });

        it('starts flagging the conflict only once an edit introduces a same-kind collision, and stops once the edit is undone', async () => {
            // Incremental-update test, mirroring the split-package-fragment
            // regression test above: two files that don't conflict at first
            // (part def A, package B -- different, non-conforming kinds, both
            // fine per KerML's own rule), then B is edited to redeclare itself
            // as `part def A` (now the SAME kind as the existing declaration,
            // same name) -- the conflict, and the resulting unresolved
            // reference, must appear only after that edit, and clear again
            // once the edit is reverted.
            const { DocumentManager } = await import('../../server/src/documentManager.js');
            const { SemanticValidator } = await import('../../server/src/providers/semanticValidator.js');

            const uriA = 'file:///a.sysml';
            const uriB = 'file:///b.sysml';
            const aText = `
part def A {
    part def X;
}
`;
            const bTextNoConflict = `
package B {
    part def Y;
}
`;
            const bTextConflicting = `
part def A {
    part def Y;
}
`;
            const externalUri = 'file:///external.sysml';
            const externalText = `
package External {
    import A::X;
    part usesX : X;
}
`;

            const docManager = new DocumentManager();
            docManager.parse(await makeDoc(aText, uriA));
            docManager.parse(await makeDoc(bTextNoConflict, uriB));
            docManager.parse(await makeDoc(externalText, externalUri));
            const validator = new SemanticValidator(docManager);

            const beforeDiags = validator.validate(externalUri);
            expect(beforeDiags.filter(d => d.code === 'unresolved-type')).toHaveLength(0);
            const beforeAmbiguous = validator.validate(uriA).filter(d => d.code === 'ambiguous-namespace-name');
            expect(beforeAmbiguous).toHaveLength(0);

            const mod = await import('../../server/node_modules/vscode-languageserver-textdocument/lib/esm/main.js');
            docManager.parse(mod.TextDocument.create(uriB, 'sysml', 2, bTextConflicting));

            const afterEditDiags = validator.validate(externalUri);
            expect(afterEditDiags.some(d => d.code === 'unresolved-type' && d.message.includes("'X'"))).toBe(true);
            const afterEditAmbiguous = validator.validate(uriA).filter(d => d.code === 'ambiguous-namespace-name');
            expect(afterEditAmbiguous.some(d => d.message.includes("'A'"))).toBe(true);

            docManager.parse(mod.TextDocument.create(uriB, 'sysml', 3, bTextNoConflict));

            const afterRevertDiags = validator.validate(externalUri);
            expect(afterRevertDiags.filter(d => d.code === 'unresolved-type')).toHaveLength(0);
            const afterRevertAmbiguous = validator.validate(uriA).filter(d => d.code === 'ambiguous-namespace-name');
            expect(afterRevertAmbiguous).toHaveLength(0);
        });

        it('reflects a sibling document\'s conflicting/renamed declaration on the next validate() call, in both directions', async () => {
            // The `unresolved-type` on `wheels` here isn't "Wheel doesn't
            // exist" -- it's cascading from "Wheel" being excluded from
            // resolution entirely while its qualifiedName is ambiguous
            // (buildSymbolIndexes). Checked in both directions: introducing
            // the conflict must raise both diagnostics, and removing it again
            // must clear both -- no stale state left over from the conflict
            // either way.
            const { DocumentManager } = await import('../../server/src/documentManager.js');
            const { SemanticValidator } = await import('../../server/src/providers/semanticValidator.js');

            const uriA = 'file:///vehicle.sysml';
            const uriB = 'file:///duplicate-wheel.sysml';
            const aText = `
part def Wheel {}
part def Vehicle {
    part wheels : Wheel;
}
`;
            const bTextNoConflict = `
part def Wheel2;
`;

            const bTextConflicting = `
part def Wheel;
`;

            const docManager = new DocumentManager();
            docManager.parse(await makeDoc(aText, uriA));
            docManager.parse(await makeDoc(bTextNoConflict, uriB));
            const validator = new SemanticValidator(docManager);

            const beforeDiags = validator.validate(uriA);
            expect(beforeDiags.filter(d => d.code === 'ambiguous-namespace-name')).toHaveLength(0);
            expect(beforeDiags.filter(d => d.code === 'unresolved-type')).toHaveLength(0);

            const mod = await import('../../server/node_modules/vscode-languageserver-textdocument/lib/esm/main.js');
            docManager.parse(mod.TextDocument.create(uriB, 'sysml', 2, bTextConflicting));

            const duringDiags = validator.validate(uriA);
            expect(duringDiags.some(d => d.code === 'ambiguous-namespace-name' && d.message.includes("'Wheel'"))).toBe(true);
            expect(duringDiags.some(d => d.code === 'unresolved-type' && d.message.includes("'Wheel'"))).toBe(true);

            docManager.parse(mod.TextDocument.create(uriB, 'sysml', 3, bTextNoConflict));

            const afterDiags = validator.validate(uriA);
            expect(afterDiags.filter(d => d.code === 'ambiguous-namespace-name')).toHaveLength(0);
            expect(afterDiags.filter(d => d.code === 'unresolved-type')).toHaveLength(0);
        });
    });

    describe('non-conflicting different-kind symbols sharing a qualifiedName (valid per KerML)', () => {
        // The counterpart to the describe block above: since `package A` and
        // an unrelated `part def A` don't conform to each other per KerML's
        // Membership.isDistinguishableFrom, they're valid siblings under the
        // same bare name, NOT a conflict -- both must remain independently
        // resolvable, and neither should be flagged.
        it('resolves through both declarations, and flags neither, when a package and an unrelated definition share a name', async () => {
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
    import A::B;
    import A::B2;
    part usesB : B;
    part usesB2 : B2;
}
`;
            const entries = [
                { uri: 'file:///pkg-a.sysml', text: pkgAText },
                { uri: 'file:///partdef-a.sysml', text: partDefAText },
                { uri: 'file:///external.sysml', text: externalText },
            ];

            const externalDiags = await getSemanticDiagnosticsForUri(entries, 'file:///external.sysml');
            expect(externalDiags.filter(d => d.code === 'unresolved-type')).toHaveLength(0);
            expect(externalDiags.filter(d => d.code === 'ambiguous-namespace-name')).toHaveLength(0);

            const pkgADiags = await getSemanticDiagnosticsForUri(entries, 'file:///pkg-a.sysml');
            const partDefADiags = await getSemanticDiagnosticsForUri(entries, 'file:///partdef-a.sysml');
            expect(pkgADiags.filter(d => d.code === 'ambiguous-namespace-name')).toHaveLength(0);
            expect(partDefADiags.filter(d => d.code === 'ambiguous-namespace-name')).toHaveLength(0);
        });

        it('brings in members from both declarations via a wildcard import (import A::*;)', async () => {
            // Unlike the exact-membership imports above, a wildcard import
            // doesn't name which declaration's member it wants -- it must
            // still pick up both B (owned by the package) and B2 (owned by
            // the part def), since `getResolvedMembers("A")` pools every
            // owned child under that qualifiedName regardless of which of
            // the two (valid, distinguishable) "A" declarations it came from.
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
    import A::*;
    part usesB : B;
    part usesB2 : B2;
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [
                    { uri: 'file:///pkg-a.sysml', text: pkgAText },
                    { uri: 'file:///partdef-a.sysml', text: partDefAText },
                    { uri: 'file:///external.sysml', text: externalText },
                ],
                'file:///external.sysml',
            );
            expect(diags.filter(d => d.code === 'unresolved-type')).toHaveLength(0);
        });

        it('does not flag an unresolved reference when a wildcard import pools a same-named member from both declarations', async () => {
            // Sharper edge case: package A and part def A each separately own
            // a member also named "C" (a part def and an attribute def,
            // respectively). `import A::*;` pools both under the same name --
            // which one an external reference to "C" actually ends up typed
            // as is not asserted here (that's a real, separate latent
            // ambiguity this test doesn't attempt to pin down), only that
            // resolution doesn't fail outright.
            const pkgAText = `
package A {
    part def C;
}
`;
            const partDefAText = `
part def A {
    attribute def C;
}
`;
            const externalText = `
package External {
    import A::*;
    part usesC : C;
}
`;
            const diags = await getSemanticDiagnosticsForUri(
                [
                    { uri: 'file:///pkg-a.sysml', text: pkgAText },
                    { uri: 'file:///partdef-a.sysml', text: partDefAText },
                    { uri: 'file:///external.sysml', text: externalText },
                ],
                'file:///external.sysml',
            );
            expect(diags.filter(d => d.code === 'unresolved-type')).toHaveLength(0);
        });
    });
});
