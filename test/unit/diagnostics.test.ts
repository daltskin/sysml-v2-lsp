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
    port def FuelPort;
    port def ElectricalPort;

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
    });
});
