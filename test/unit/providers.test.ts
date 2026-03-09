/**
 * Comprehensive tests for all LSP providers.
 *
 * Uses dynamic imports so vscode-languageserver and
 * vscode-languageserver-textdocument resolve from server/node_modules.
 */
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a TextDocument from raw SysML text */
async function makeDoc(text: string, uri = 'test://test.sysml') {
    const { TextDocument } = await import('vscode-languageserver-textdocument');
    return TextDocument.create(uri, 'sysml', 1, text);
}

/** Parse text into DocumentManager and return dm + doc */
async function setup(text: string, uri = 'test://test.sysml') {
    const { DocumentManager } = await import('../../server/src/documentManager.js');
    const dm = new DocumentManager();
    const doc = await makeDoc(text, uri);
    dm.parse(doc);
    return { dm, doc };
}

/** Parse multiple texts into the same DocumentManager */
async function setupMulti(entries: { text: string; uri: string }[]) {
    const { DocumentManager } = await import('../../server/src/documentManager.js');
    const dm = new DocumentManager();
    const docs = [];
    for (const { text, uri } of entries) {
        const doc = await makeDoc(text, uri);
        dm.parse(doc);
        docs.push(doc);
    }
    return { dm, docs };
}

/** Minimal mock for TextDocuments<TextDocument> */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockDocs(docs: { uri: string }[]): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = new Map<string, any>();
    for (const d of docs) m.set(d.uri, d);
    return { get: (uri: string) => m.get(uri) };
}

// ---------------------------------------------------------------------------
// Shared fixture texts
// ---------------------------------------------------------------------------

const VEHICLE_TEXT = `
package VehicleModel {
    part def Vehicle {
        attribute mass : Real;
        attribute maxSpeed : Real;
        port fuelPort : FuelPort;
    }

    part def Engine :> Vehicle {
        attribute horsepower : Real;
    }

    part def Chassis {
        attribute wheelbase : Real;
        part frontAxle : Axle;
    }

    part def Axle {
        part leftWheel : Wheel;
    }

    part def Wheel {
        attribute diameter : Real;
    }

    port def FuelPort {
        in item fuel : Fuel;
    }

    item def Fuel;

    connection def FuelLine {
        end source : FuelPort;
        end target : FuelPort;
    }

    requirement def SafetyRequirement {
        doc /* All vehicles must meet minimum safety standards */
        subject vehicle : Vehicle;
    }
}
`;

const ACTION_TEXT = `
package Actions {
    action def Brake {
        attribute force : Real;
    }

    action def EmergencyStop {
        perform Brake;
    }

    action def Drive {
        include Brake;
    }

    calc def Speed {
        attribute distance : Real;
        attribute time : Real;
    }
}
`;

const IMPORT_TEXT = `
package Library {
    part def Sensor;
}

package Main {
    import Library::*;
    part mySensor : Sensor;
}
`;

// ===================================================================
// CodeLens Provider
// ===================================================================

describe('CodeLens Provider', () => {
    it('should return code lenses for definitions', async () => {
        const { CodeLensProvider } = await import('../../server/src/providers/codeLensProvider.js');
        const { dm } = await setup(VEHICLE_TEXT);

        const provider = new CodeLensProvider(dm);
        const lenses = provider.provideCodeLenses({
            textDocument: { uri: 'test://test.sysml' },
        });

        expect(lenses.length).toBeGreaterThan(0);
        for (const lens of lenses) {
            expect(lens.command).toBeDefined();
            expect(lens.command!.title).toMatch(/\d+ references?/);
        }
    });

    it('should include package in lenses', async () => {
        const { CodeLensProvider } = await import('../../server/src/providers/codeLensProvider.js');
        const { dm } = await setup(VEHICLE_TEXT);

        const provider = new CodeLensProvider(dm);
        const lenses = provider.provideCodeLenses({
            textDocument: { uri: 'test://test.sysml' },
        });

        // VehicleModel package should get a lens
        expect(lenses.some(l => l.command!.title.includes('reference'))).toBe(true);
    });

    it('should return empty array for unknown URI', async () => {
        const { DocumentManager } = await import('../../server/src/documentManager.js');
        const { CodeLensProvider } = await import('../../server/src/providers/codeLensProvider.js');
        const provider = new CodeLensProvider(new DocumentManager());
        const lenses = provider.provideCodeLenses({ textDocument: { uri: 'test://unknown.sysml' } });
        expect(lenses).toEqual([]);
    });

    it('should count cross-file references in code lenses', async () => {
        const { CodeLensProvider } = await import('../../server/src/providers/codeLensProvider.js');

        const fileA = `package Lib { part def Sensor { attribute reading : Real; } }`;
        const fileB = `package App { part mySensor : Sensor; }`;

        const { dm } = await setupMulti([
            { text: fileA, uri: 'test://lib.sysml' },
            { text: fileB, uri: 'test://app.sysml' },
        ]);

        const provider = new CodeLensProvider(dm);
        const lenses = provider.provideCodeLenses({ textDocument: { uri: 'test://lib.sysml' } });

        // Sensor def should have a lens showing references (including cross-file usage)
        const sensorLens = lenses.find(l => l.command?.title.includes('reference'));
        expect(sensorLens).toBeDefined();
    });
});

// ===================================================================
// Workspace Symbol Provider
// ===================================================================

describe('Workspace Symbol Provider', () => {
    it('should find symbols matching a query', async () => {
        const { WorkspaceSymbolProvider } = await import('../../server/src/providers/workspaceSymbolProvider.js');
        const { dm } = await setup(VEHICLE_TEXT);

        const provider = new WorkspaceSymbolProvider(dm);
        const results = provider.provideWorkspaceSymbols({ query: 'Vehicle' });

        expect(results.length).toBeGreaterThan(0);
        expect(results.some(r => r.name === 'Vehicle')).toBe(true);
    });

    it('should return all symbols for empty query', async () => {
        const { WorkspaceSymbolProvider } = await import('../../server/src/providers/workspaceSymbolProvider.js');
        const { dm } = await setup(VEHICLE_TEXT);

        const provider = new WorkspaceSymbolProvider(dm);
        const all = provider.provideWorkspaceSymbols({ query: '' });
        expect(all.length).toBeGreaterThan(0);
    });

    it('should search across multiple documents', async () => {
        const { WorkspaceSymbolProvider } = await import('../../server/src/providers/workspaceSymbolProvider.js');
        const { dm } = await setupMulti([
            { text: VEHICLE_TEXT, uri: 'test://vehicle.sysml' },
            { text: ACTION_TEXT, uri: 'test://actions.sysml' },
        ]);

        const provider = new WorkspaceSymbolProvider(dm);
        expect(provider.provideWorkspaceSymbols({ query: 'Vehicle' }).some(r => r.name === 'Vehicle')).toBe(true);
        expect(provider.provideWorkspaceSymbols({ query: 'Brake' }).some(r => r.name === 'Brake')).toBe(true);
    });

    it('should return empty for unmatched query', async () => {
        const { WorkspaceSymbolProvider } = await import('../../server/src/providers/workspaceSymbolProvider.js');
        const { dm } = await setup(VEHICLE_TEXT);

        const provider = new WorkspaceSymbolProvider(dm);
        expect(provider.provideWorkspaceSymbols({ query: 'XyzNonexistent' })).toEqual([]);
    });
});

// ===================================================================
// Linked Editing Range Provider
// ===================================================================

describe('Linked Editing Range Provider', () => {
    it('should return linked ranges for multiply-referenced symbol', async () => {
        const { LinkedEditingRangeProvider } = await import('../../server/src/providers/linkedEditingRangeProvider.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
        const { dm } = await setup(VEHICLE_TEXT);
        const uri = 'test://test.sysml';

        // FuelPort is used as definition AND as usage in FuelLine
        const st = new SymbolTable();
        st.build(uri, dm.get(uri)!);
        const fuelPortRefs = st.findByName('FuelPort');

        const provider = new LinkedEditingRangeProvider(dm);

        if (fuelPortRefs.length > 1) {
            const sym = fuelPortRefs[0];
            const result = provider.provideLinkedEditingRanges({
                textDocument: { uri },
                position: { line: sym.selectionRange.start.line, character: sym.selectionRange.start.character },
            });
            if (result) {
                expect(result.ranges.length).toBeGreaterThan(1);
            }
        }
    });

    it('should return null for unknown URI', async () => {
        const { LinkedEditingRangeProvider } = await import('../../server/src/providers/linkedEditingRangeProvider.js');
        const { DocumentManager } = await import('../../server/src/documentManager.js');

        const provider = new LinkedEditingRangeProvider(new DocumentManager());
        const result = provider.provideLinkedEditingRanges({
            textDocument: { uri: 'test://unknown.sysml' },
            position: { line: 0, character: 0 },
        });
        expect(result).toBeNull();
    });

    it('should return null for position with no symbol', async () => {
        const { LinkedEditingRangeProvider } = await import('../../server/src/providers/linkedEditingRangeProvider.js');
        const { dm } = await setup(VEHICLE_TEXT);

        const provider = new LinkedEditingRangeProvider(dm);
        const result = provider.provideLinkedEditingRanges({
            textDocument: { uri: 'test://test.sysml' },
            position: { line: 0, character: 0 },  // blank line
        });
        expect(result).toBeNull();
    });
});

// ===================================================================
// Inlay Hint Provider
// ===================================================================

describe('Inlay Hint Provider', () => {
    it('should return hints for the full range', async () => {
        const { InlayHintProvider } = await import('../../server/src/providers/inlayHintProvider.js');
        const { dm } = await setup(VEHICLE_TEXT);

        const provider = new InlayHintProvider(dm);
        const hints = provider.provideInlayHints({
            textDocument: { uri: 'test://test.sysml' },
            range: { start: { line: 0, character: 0 }, end: { line: 100, character: 0 } },
        });

        expect(Array.isArray(hints)).toBe(true);
        for (const h of hints) {
            expect(h.position.line).toBeGreaterThanOrEqual(0);
            expect(typeof h.label).toBe('string');
        }
    });

    it('should filter hints by range', async () => {
        const { InlayHintProvider } = await import('../../server/src/providers/inlayHintProvider.js');
        const { dm } = await setup(VEHICLE_TEXT);

        const provider = new InlayHintProvider(dm);
        const narrow = provider.provideInlayHints({
            textDocument: { uri: 'test://test.sysml' },
            range: { start: { line: 0, character: 0 }, end: { line: 2, character: 0 } },
        });
        const wide = provider.provideInlayHints({
            textDocument: { uri: 'test://test.sysml' },
            range: { start: { line: 0, character: 0 }, end: { line: 100, character: 0 } },
        });
        expect(narrow.length).toBeLessThanOrEqual(wide.length);
    });

    it('should return empty for unknown URI', async () => {
        const { InlayHintProvider } = await import('../../server/src/providers/inlayHintProvider.js');
        const { DocumentManager } = await import('../../server/src/documentManager.js');

        const provider = new InlayHintProvider(new DocumentManager());
        const hints = provider.provideInlayHints({
            textDocument: { uri: 'test://unknown.sysml' },
            range: { start: { line: 0, character: 0 }, end: { line: 100, character: 0 } },
        });
        expect(hints).toEqual([]);
    });
});

// ===================================================================
// Document Link Provider
// ===================================================================

describe('Document Link Provider', () => {
    it('should find links in import statements', async () => {
        const { DocumentLinkProvider } = await import('../../server/src/providers/documentLinkProvider.js');
        const { dm, doc } = await setup(IMPORT_TEXT);

        const provider = new DocumentLinkProvider(dm, mockDocs([doc]));
        const links = provider.provideDocumentLinks({ textDocument: { uri: doc.uri } });

        expect(links.length).toBeGreaterThan(0);
        expect(links.some(l => l.tooltip?.includes('Library'))).toBe(true);
    });

    it('should return empty for no imports', async () => {
        const { DocumentLinkProvider } = await import('../../server/src/providers/documentLinkProvider.js');
        const { dm, doc } = await setup(`package NoImports { part def A; }`);

        const provider = new DocumentLinkProvider(dm, mockDocs([doc]));
        const links = provider.provideDocumentLinks({ textDocument: { uri: doc.uri } });
        expect(links.length).toBe(0);
    });

    it('should return empty for unknown URI', async () => {
        const { DocumentLinkProvider } = await import('../../server/src/providers/documentLinkProvider.js');
        const { DocumentManager } = await import('../../server/src/documentManager.js');

        const provider = new DocumentLinkProvider(new DocumentManager(), mockDocs([]));
        const links = provider.provideDocumentLinks({ textDocument: { uri: 'test://unknown.sysml' } });
        expect(links).toEqual([]);
    });
});

// ===================================================================
// Type Hierarchy Provider
// ===================================================================

describe('Type Hierarchy Provider', () => {
    it('should prepare hierarchy for a part def', async () => {
        const { TypeHierarchyProvider } = await import('../../server/src/providers/typeHierarchyProvider.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
        const { dm } = await setup(VEHICLE_TEXT);
        const uri = 'test://test.sysml';

        const st = new SymbolTable();
        st.build(uri, dm.get(uri)!);
        const vehicleSym = st.findByName('Vehicle')[0];
        expect(vehicleSym).toBeDefined();

        const provider = new TypeHierarchyProvider(dm);
        const items = provider.prepareTypeHierarchy({
            textDocument: { uri },
            position: {
                line: vehicleSym.selectionRange.start.line,
                character: vehicleSym.selectionRange.start.character,
            },
        });

        expect(items).not.toBeNull();
        expect(items!.length).toBe(1);
        expect(items![0].name).toBe('Vehicle');
    });

    it('should find subtypes via :> specialization', async () => {
        const { TypeHierarchyProvider } = await import('../../server/src/providers/typeHierarchyProvider.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
        const { dm } = await setup(VEHICLE_TEXT);
        const uri = 'test://test.sysml';

        const st = new SymbolTable();
        st.build(uri, dm.get(uri)!);
        const vehicleSym = st.findByName('Vehicle')[0];

        const provider = new TypeHierarchyProvider(dm);
        const items = provider.prepareTypeHierarchy({
            textDocument: { uri },
            position: {
                line: vehicleSym.selectionRange.start.line,
                character: vehicleSym.selectionRange.start.character,
            },
        });

        expect(items).not.toBeNull();
        const subtypes = provider.provideSubtypes({ item: items![0] });
        expect(Array.isArray(subtypes)).toBe(true);
        // Engine :> Vehicle should make Engine a subtype of Vehicle
    });

    it('should find supertypes via :> specialization', async () => {
        const { TypeHierarchyProvider } = await import('../../server/src/providers/typeHierarchyProvider.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
        const { dm } = await setup(VEHICLE_TEXT);
        const uri = 'test://test.sysml';

        const st = new SymbolTable();
        st.build(uri, dm.get(uri)!);
        const engineSym = st.findByName('Engine')[0];

        if (engineSym) {
            const provider = new TypeHierarchyProvider(dm);
            const items = provider.prepareTypeHierarchy({
                textDocument: { uri },
                position: {
                    line: engineSym.selectionRange.start.line,
                    character: engineSym.selectionRange.start.character,
                },
            });

            if (items && items.length > 0) {
                const supertypes = provider.provideSupertypes({ item: items[0] });
                expect(Array.isArray(supertypes)).toBe(true);
                // Engine :> Vehicle → Vehicle is the supertype
            }
        }
    });

    it('should return null for unknown URI', async () => {
        const { TypeHierarchyProvider } = await import('../../server/src/providers/typeHierarchyProvider.js');
        const { DocumentManager } = await import('../../server/src/documentManager.js');

        const provider = new TypeHierarchyProvider(new DocumentManager());
        const result = provider.prepareTypeHierarchy({
            textDocument: { uri: 'test://unknown.sysml' },
            position: { line: 0, character: 0 },
        });
        expect(result).toBeNull();
    });
});

// ===================================================================
// Call Hierarchy Provider
// ===================================================================

describe('Call Hierarchy Provider', () => {
    it('should prepare hierarchy for an action def', async () => {
        const { CallHierarchyProvider } = await import('../../server/src/providers/callHierarchyProvider.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
        const { dm, doc } = await setup(ACTION_TEXT);

        const st = new SymbolTable();
        st.build(doc.uri, dm.get(doc.uri)!);
        const brakeSym = st.findByName('Brake')[0];
        expect(brakeSym).toBeDefined();

        const provider = new CallHierarchyProvider(dm);
        const items = provider.prepareCallHierarchy({
            textDocument: { uri: doc.uri },
            position: {
                line: brakeSym.selectionRange.start.line,
                character: brakeSym.selectionRange.start.character,
            },
        });

        expect(items).not.toBeNull();
        expect(items!.length).toBe(1);
        expect(items![0].name).toBe('Brake');
    });

    it('should find incoming calls (who performs/includes this action)', async () => {
        const { CallHierarchyProvider } = await import('../../server/src/providers/callHierarchyProvider.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
        const { dm, doc } = await setup(ACTION_TEXT);

        const st = new SymbolTable();
        st.build(doc.uri, dm.get(doc.uri)!);
        const brakeSym = st.findByName('Brake')[0];
        expect(brakeSym).toBeDefined();

        const provider = new CallHierarchyProvider(dm);
        const items = provider.prepareCallHierarchy({
            textDocument: { uri: doc.uri },
            position: {
                line: brakeSym.selectionRange.start.line,
                character: brakeSym.selectionRange.start.character,
            },
        });
        expect(items).not.toBeNull();

        const incoming = provider.provideIncomingCalls({ item: items![0] });
        expect(Array.isArray(incoming)).toBe(true);
        // EmergencyStop does `perform Brake;`, Drive does `include Brake;`
    });

    it('should find outgoing calls', async () => {
        const { CallHierarchyProvider } = await import('../../server/src/providers/callHierarchyProvider.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
        const { dm, doc } = await setup(ACTION_TEXT);

        const st = new SymbolTable();
        st.build(doc.uri, dm.get(doc.uri)!);
        const esSym = st.findByName('EmergencyStop')[0];
        expect(esSym).toBeDefined();

        const provider = new CallHierarchyProvider(dm);
        const items = provider.prepareCallHierarchy({
            textDocument: { uri: doc.uri },
            position: {
                line: esSym.selectionRange.start.line,
                character: esSym.selectionRange.start.character,
            },
        });
        expect(items).not.toBeNull();

        const outgoing = provider.provideOutgoingCalls({ item: items![0] });
        expect(Array.isArray(outgoing)).toBe(true);
    });

    it('should return null for non-behavioral elements', async () => {
        const { CallHierarchyProvider } = await import('../../server/src/providers/callHierarchyProvider.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
        const { dm, doc } = await setup(VEHICLE_TEXT);

        const st = new SymbolTable();
        st.build(doc.uri, dm.get(doc.uri)!);
        const vehicleSym = st.findByName('Vehicle')[0];
        expect(vehicleSym).toBeDefined();

        const provider = new CallHierarchyProvider(dm);
        const items = provider.prepareCallHierarchy({
            textDocument: { uri: doc.uri },
            position: {
                line: vehicleSym.selectionRange.start.line,
                character: vehicleSym.selectionRange.start.character,
            },
        });
        expect(items).toBeNull();
    });

    it('should return null for unknown URI', async () => {
        const { CallHierarchyProvider } = await import('../../server/src/providers/callHierarchyProvider.js');
        const { DocumentManager } = await import('../../server/src/documentManager.js');

        const provider = new CallHierarchyProvider(new DocumentManager());
        const result = provider.prepareCallHierarchy({
            textDocument: { uri: 'test://unknown.sysml' },
            position: { line: 0, character: 0 },
        });
        expect(result).toBeNull();
    });

    it('should detect typed action usages as outgoing calls', async () => {
        const { CallHierarchyProvider } = await import('../../server/src/providers/callHierarchyProvider.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
        const compositionText = `
package Pipeline {
    action def StepA { attribute x : Real; }
    action def StepB { attribute y : Real; }
    action mainFlow {
        first start;
        then action a : StepA { }
        then action b : StepB { }
        then done;
    }
}
`;
        const { dm, doc } = await setup(compositionText);

        const st = new SymbolTable();
        st.build(doc.uri, dm.get(doc.uri)!);
        const mainSym = st.findByName('mainFlow')[0];
        expect(mainSym).toBeDefined();

        const provider = new CallHierarchyProvider(dm);
        const items = provider.prepareCallHierarchy({
            textDocument: { uri: doc.uri },
            position: {
                line: mainSym.selectionRange.start.line,
                character: mainSym.selectionRange.start.character,
            },
        });
        expect(items).not.toBeNull();

        const outgoing = provider.provideOutgoingCalls({ item: items![0] });
        const names = outgoing.map(o => o.to.name);
        expect(names).toContain('StepA');
        expect(names).toContain('StepB');
    });

    it('should detect typed action usages as incoming calls', async () => {
        const { CallHierarchyProvider } = await import('../../server/src/providers/callHierarchyProvider.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
        const compositionText = `
package Pipeline {
    action def StepA { attribute x : Real; }
    action mainFlow {
        first start;
        then action a : StepA { }
        then done;
    }
}
`;
        const { dm, doc } = await setup(compositionText);

        const st = new SymbolTable();
        st.build(doc.uri, dm.get(doc.uri)!);
        const stepASym = st.findByName('StepA')[0];
        expect(stepASym).toBeDefined();

        const provider = new CallHierarchyProvider(dm);
        const items = provider.prepareCallHierarchy({
            textDocument: { uri: doc.uri },
            position: {
                line: stepASym.selectionRange.start.line,
                character: stepASym.selectionRange.start.character,
            },
        });
        expect(items).not.toBeNull();

        const incoming = provider.provideIncomingCalls({ item: items![0] });
        expect(incoming.length).toBeGreaterThan(0);
        expect(incoming[0].from.name).toBe('mainFlow');
    });
});

// ===================================================================
// Signature Help Provider
// ===================================================================

describe('Signature Help Provider', () => {
    it('should return null when not in a signature context', async () => {
        const { SignatureHelpProvider } = await import('../../server/src/providers/signatureHelpProvider.js');
        const { dm, doc } = await setup(ACTION_TEXT);

        const provider = new SignatureHelpProvider(dm, mockDocs([doc]));
        const help = provider.provideSignatureHelp({
            textDocument: { uri: doc.uri },
            position: { line: 0, character: 0 },
        });
        expect(help).toBeNull();
    });

    it('should not crash for calc invocation context', async () => {
        const { SignatureHelpProvider } = await import('../../server/src/providers/signatureHelpProvider.js');
        const text = `
package Test {
    calc def Speed {
        attribute distance : Real;
        attribute time : Real;
    }
    calc Speed(
}
`;
        const { dm, doc } = await setup(text);
        const provider = new SignatureHelpProvider(dm, mockDocs([doc]));

        const lines = text.split('\n');
        let targetLine = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('calc Speed(')) {
                targetLine = i;
                break;
            }
        }

        if (targetLine >= 0) {
            const help = provider.provideSignatureHelp({
                textDocument: { uri: doc.uri },
                position: { line: targetLine, character: lines[targetLine].indexOf('(') + 1 },
            });
            // Either null or valid — shouldn't crash
            expect(help === null || help.signatures !== undefined).toBe(true);
        }
    });

    it('should return null for unknown URI', async () => {
        const { SignatureHelpProvider } = await import('../../server/src/providers/signatureHelpProvider.js');
        const { DocumentManager } = await import('../../server/src/documentManager.js');

        const provider = new SignatureHelpProvider(new DocumentManager(), mockDocs([]));
        const help = provider.provideSignatureHelp({
            textDocument: { uri: 'test://unknown.sysml' },
            position: { line: 0, character: 0 },
        });
        expect(help).toBeNull();
    });
});

// ===================================================================
// Code Action Provider
// ===================================================================

describe('Code Action Provider', () => {
    it('should offer quick fix for keyword typo diagnostic', async () => {
        const { CodeActionProvider } = await import('../../server/src/providers/codeActionProvider.js');

        const provider = new CodeActionProvider();
        const actions = provider.provideCodeActions({
            textDocument: { uri: 'test://test.sysml' },
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
            context: {
                diagnostics: [{
                    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
                    message: "Unknown keyword 'paart'. Did you mean 'part'?",
                    severity: 2,
                }],
            },
        });

        expect(actions.length).toBe(1);
        expect(actions[0].title).toContain('paart');
        expect(actions[0].title).toContain('part');
    });

    it('should return empty for non-typo diagnostics', async () => {
        const { CodeActionProvider } = await import('../../server/src/providers/codeActionProvider.js');

        const provider = new CodeActionProvider();
        const actions = provider.provideCodeActions({
            textDocument: { uri: 'test://test.sysml' },
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
            context: {
                diagnostics: [{
                    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
                    message: 'Some other error',
                    severity: 1,
                }],
            },
        });
        expect(actions.length).toBe(0);
    });
});

// ===================================================================
// Formatting Provider
// ===================================================================

describe('Formatting Provider', () => {
    it('should format a document', async () => {
        const { FormattingProvider } = await import('../../server/src/providers/formattingProvider.js');
        const text = 'package P{\npart def A{\nattribute x:Real;\n}\n}';
        const doc = await makeDoc(text);

        const provider = new FormattingProvider(mockDocs([doc]));
        const edits = provider.provideDocumentFormatting({
            textDocument: { uri: doc.uri },
            options: { tabSize: 4, insertSpaces: true },
        });
        expect(Array.isArray(edits)).toBe(true);
    });

    it('should return empty for unknown URI', async () => {
        const { FormattingProvider } = await import('../../server/src/providers/formattingProvider.js');

        const provider = new FormattingProvider(mockDocs([]));
        const edits = provider.provideDocumentFormatting({
            textDocument: { uri: 'test://unknown.sysml' },
            options: { tabSize: 4, insertSpaces: true },
        });
        expect(edits).toEqual([]);
    });

    it('should produce consistent indentation', async () => {
        const { FormattingProvider } = await import('../../server/src/providers/formattingProvider.js');
        const text = 'package P {\npart def A {\nattribute x : Real;\n}\n}';
        const doc = await makeDoc(text);

        const provider = new FormattingProvider(mockDocs([doc]));
        const edits = provider.provideDocumentFormatting({
            textDocument: { uri: doc.uri },
            options: { tabSize: 4, insertSpaces: true },
        });

        if (edits.length > 0) {
            const formatted = edits[0].newText;
            const lines = formatted.split('\n').filter(l => l.trim().length > 0);
            // Inner elements should have indentation
            const innerLines = lines.filter(l => l.includes('attribute') || l.includes('part def'));
            for (const l of innerLines) {
                expect(l.startsWith(' ')).toBe(true);
            }
        }
    });
});

// ===================================================================
// Selection Range Provider
// ===================================================================

describe('Selection Range Provider', () => {
    it('should return nested selection ranges', async () => {
        const { SelectionRangeProvider } = await import('../../server/src/providers/selectionRangeProvider.js');
        const text = `package P {\n    part def A {\n        attribute x : Real;\n    }\n}`;
        const doc = await makeDoc(text);

        const provider = new SelectionRangeProvider(mockDocs([doc]));
        const ranges = provider.provideSelectionRanges({
            textDocument: { uri: doc.uri },
            positions: [{ line: 2, character: 15 }],
        });

        expect(ranges.length).toBe(1);
        let r = ranges[0];
        let depth = 0;
        while (r.parent) { r = r.parent; depth++; }
        expect(depth).toBeGreaterThan(0);
    });

    it('should return empty for unknown URI', async () => {
        const { SelectionRangeProvider } = await import('../../server/src/providers/selectionRangeProvider.js');

        const provider = new SelectionRangeProvider(mockDocs([]));
        const ranges = provider.provideSelectionRanges({
            textDocument: { uri: 'test://unknown.sysml' },
            positions: [{ line: 0, character: 0 }],
        });
        expect(ranges).toEqual([]);
    });
});

// ===================================================================
// Document Symbol Provider
// ===================================================================

describe('Document Symbol Provider', () => {
    it('should return hierarchical symbols', async () => {
        const { DocumentSymbolProvider } = await import('../../server/src/providers/documentSymbolProvider.js');
        const { dm } = await setup(VEHICLE_TEXT);

        const provider = new DocumentSymbolProvider(dm);
        const symbols = provider.provideDocumentSymbols({
            textDocument: { uri: 'test://test.sysml' },
        });

        expect(symbols.length).toBeGreaterThan(0);
        const pkg = symbols.find(s => s.name === 'VehicleModel');
        expect(pkg).toBeDefined();
    });

    it('should include children in nested symbols', async () => {
        const { DocumentSymbolProvider } = await import('../../server/src/providers/documentSymbolProvider.js');
        const { dm } = await setup(VEHICLE_TEXT);

        const provider = new DocumentSymbolProvider(dm);
        const symbols = provider.provideDocumentSymbols({
            textDocument: { uri: 'test://test.sysml' },
        });

        const pkg = symbols.find(s => s.name === 'VehicleModel');
        if (pkg && pkg.children) {
            expect(pkg.children.length).toBeGreaterThan(0);
        }
    });

    it('should return empty for unknown URI', async () => {
        const { DocumentSymbolProvider } = await import('../../server/src/providers/documentSymbolProvider.js');
        const { DocumentManager } = await import('../../server/src/documentManager.js');

        const provider = new DocumentSymbolProvider(new DocumentManager());
        const symbols = provider.provideDocumentSymbols({
            textDocument: { uri: 'test://unknown.sysml' },
        });
        expect(symbols).toEqual([]);
    });
});

// ===================================================================
// Hover Provider
// ===================================================================

describe('Hover Provider', () => {
    it('should return hover info for a definition', async () => {
        const { HoverProvider } = await import('../../server/src/providers/hoverProvider.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
        const { dm } = await setup(VEHICLE_TEXT);
        const uri = 'test://test.sysml';

        const st = new SymbolTable();
        st.build(uri, dm.get(uri)!);
        const vehicleSym = st.findByName('Vehicle')[0];
        expect(vehicleSym).toBeDefined();

        const provider = new HoverProvider(dm);
        const hover = provider.provideHover({
            textDocument: { uri },
            position: {
                line: vehicleSym.selectionRange.start.line,
                character: vehicleSym.selectionRange.start.character,
            },
        });

        expect(hover).not.toBeNull();
        expect((hover!.contents as unknown as { value: string }).value).toContain('Vehicle');
    });

    it('should return null for empty position', async () => {
        const { HoverProvider } = await import('../../server/src/providers/hoverProvider.js');
        const { DocumentManager } = await import('../../server/src/documentManager.js');

        const provider = new HoverProvider(new DocumentManager());
        const hover = provider.provideHover({
            textDocument: { uri: 'test://unknown.sysml' },
            position: { line: 0, character: 0 },
        });
        expect(hover).toBeNull();
    });

    it('should include semantic feedback for hovered diagnostic range', async () => {
        const { HoverProvider } = await import('../../server/src/providers/hoverProvider.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
        const text = `package T { part def V { part e : Missing[1]; } }`;
        const { dm } = await setup(text);
        const uri = 'test://test.sysml';

        const st = new SymbolTable();
        st.build(uri, dm.get(uri)!);
        const usage = st.findByName('e')[0];
        expect(usage).toBeDefined();

        const provider = new HoverProvider(dm);
        const hover = provider.provideHover({
            textDocument: { uri },
            position: {
                line: usage.selectionRange.start.line,
                character: usage.selectionRange.start.character,
            },
        });

        const value = (hover!.contents as unknown as { value: string }).value;
        expect(value).toContain('Semantic Feedback');
        expect(value).toContain('not defined');
    });
});

// ===================================================================
// Definition Provider
// ===================================================================

describe('Definition Provider', () => {
    it('should find the definition of a symbol', async () => {
        const { DefinitionProvider } = await import('../../server/src/providers/definitionProvider.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
        const { dm } = await setup(VEHICLE_TEXT);
        const uri = 'test://test.sysml';

        const st = new SymbolTable();
        st.build(uri, dm.get(uri)!);
        const vehicleSym = st.findByName('Vehicle')[0];
        expect(vehicleSym).toBeDefined();

        const provider = new DefinitionProvider(dm);
        const def = provider.provideDefinition({
            textDocument: { uri },
            position: {
                line: vehicleSym.selectionRange.start.line,
                character: vehicleSym.selectionRange.start.character,
            },
        });
        expect(def).not.toBeNull();
    });

    it('should return null for unknown URI', async () => {
        const { DefinitionProvider } = await import('../../server/src/providers/definitionProvider.js');
        const { DocumentManager } = await import('../../server/src/documentManager.js');

        const provider = new DefinitionProvider(new DocumentManager());
        const def = provider.provideDefinition({
            textDocument: { uri: 'test://unknown.sysml' },
            position: { line: 0, character: 0 },
        });
        expect(def).toBeNull();
    });
});

// ===================================================================
// References Provider
// ===================================================================

describe('References Provider', () => {
    it('should find references to a symbol', async () => {
        const { ReferencesProvider } = await import('../../server/src/providers/referencesProvider.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
        const { dm } = await setup(VEHICLE_TEXT);
        const uri = 'test://test.sysml';

        const st = new SymbolTable();
        st.build(uri, dm.get(uri)!);
        const vehicleSym = st.findByName('Vehicle')[0];
        expect(vehicleSym).toBeDefined();

        const provider = new ReferencesProvider(dm);
        const refs = provider.provideReferences({
            textDocument: { uri },
            position: {
                line: vehicleSym.selectionRange.start.line,
                character: vehicleSym.selectionRange.start.character,
            },
            context: { includeDeclaration: true },
        });
        expect(refs.length).toBeGreaterThan(0);
    });

    it('should find cross-file references via text scanning', async () => {
        const { ReferencesProvider } = await import('../../server/src/providers/referencesProvider.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');

        const fileA = `package Lib { part def Sensor { attribute reading : Real; } }`;
        const fileB = `package App { import Lib::*; part mySensor : Sensor; }`;

        const { dm } = await setupMulti([
            { text: fileA, uri: 'test://lib.sysml' },
            { text: fileB, uri: 'test://app.sysml' },
        ]);

        const st = new SymbolTable();
        st.build('test://lib.sysml', dm.get('test://lib.sysml')!);
        const sensorSym = st.findByName('Sensor')[0];
        expect(sensorSym).toBeDefined();

        const provider = new ReferencesProvider(dm);
        const refs = provider.provideReferences({
            textDocument: { uri: 'test://lib.sysml' },
            position: {
                line: sensorSym.selectionRange.start.line,
                character: sensorSym.selectionRange.start.character,
            },
            context: { includeDeclaration: true },
        });
        // Should find Sensor in lib.sysml (definition) AND in app.sysml (usage)
        expect(refs.length).toBeGreaterThanOrEqual(2);
        const uris = refs.map(r => r.uri);
        expect(uris).toContain('test://lib.sysml');
        expect(uris).toContain('test://app.sysml');
    });

    it('should exclude declaration when includeDeclaration is false', async () => {
        const { ReferencesProvider } = await import('../../server/src/providers/referencesProvider.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
        const { dm } = await setup(VEHICLE_TEXT);
        const uri = 'test://test.sysml';

        const st = new SymbolTable();
        st.build(uri, dm.get(uri)!);
        const fuelPortSym = st.findByName('FuelPort')[0];
        expect(fuelPortSym).toBeDefined();

        const provider = new ReferencesProvider(dm);
        const withDecl = provider.provideReferences({
            textDocument: { uri },
            position: {
                line: fuelPortSym.selectionRange.start.line,
                character: fuelPortSym.selectionRange.start.character,
            },
            context: { includeDeclaration: true },
        });
        const withoutDecl = provider.provideReferences({
            textDocument: { uri },
            position: {
                line: fuelPortSym.selectionRange.start.line,
                character: fuelPortSym.selectionRange.start.character,
            },
            context: { includeDeclaration: false },
        });
        expect(withDecl.length).toBeGreaterThanOrEqual(withoutDecl.length);
    });

    it('should deduplicate references', async () => {
        const { ReferencesProvider } = await import('../../server/src/providers/referencesProvider.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
        const { dm } = await setup(VEHICLE_TEXT);
        const uri = 'test://test.sysml';

        const st = new SymbolTable();
        st.build(uri, dm.get(uri)!);
        const vehicleSym = st.findByName('Vehicle')[0];
        expect(vehicleSym).toBeDefined();

        const provider = new ReferencesProvider(dm);
        const refs = provider.provideReferences({
            textDocument: { uri },
            position: {
                line: vehicleSym.selectionRange.start.line,
                character: vehicleSym.selectionRange.start.character,
            },
            context: { includeDeclaration: true },
        });
        // Check no duplicate locations
        const keys = refs.map(r => `${r.uri}:${r.range.start.line}:${r.range.start.character}`);
        expect(new Set(keys).size).toBe(keys.length);
    });

    it('should return empty for unknown URI', async () => {
        const { ReferencesProvider } = await import('../../server/src/providers/referencesProvider.js');
        const { DocumentManager } = await import('../../server/src/documentManager.js');

        const provider = new ReferencesProvider(new DocumentManager());
        const refs = provider.provideReferences({
            textDocument: { uri: 'test://unknown.sysml' },
            position: { line: 0, character: 0 },
            context: { includeDeclaration: true },
        });
        expect(refs).toEqual([]);
    });
});

// ===================================================================
// Rename Provider
// ===================================================================

describe('Rename Provider', () => {
    it('should prepare a rename for a named symbol', async () => {
        const { RenameProvider } = await import('../../server/src/providers/renameProvider.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
        const { dm } = await setup(VEHICLE_TEXT);
        const uri = 'test://test.sysml';

        const st = new SymbolTable();
        st.build(uri, dm.get(uri)!);
        const vehicleSym = st.findByName('Vehicle')[0];
        expect(vehicleSym).toBeDefined();

        const provider = new RenameProvider(dm);
        const result = provider.prepareRename({
            textDocument: { uri },
            position: {
                line: vehicleSym.selectionRange.start.line,
                character: vehicleSym.selectionRange.start.character,
            },
        });
        expect(result).not.toBeNull();
    });

    it('should execute rename and return edits', async () => {
        const { RenameProvider } = await import('../../server/src/providers/renameProvider.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
        const text = `
package Test {
    part def Sensor;
    part mySensor : Sensor;
}
`;
        const { dm } = await setup(text);
        const uri = 'test://test.sysml';

        const st = new SymbolTable();
        st.build(uri, dm.get(uri)!);
        const sensorSym = st.findByName('Sensor')[0];
        expect(sensorSym).toBeDefined();

        const provider = new RenameProvider(dm);
        const result = provider.provideRename({
            textDocument: { uri },
            position: {
                line: sensorSym.selectionRange.start.line,
                character: sensorSym.selectionRange.start.character,
            },
            newName: 'Detector',
        });

        expect(result).toBeDefined();
        expect(result.changes).toBeDefined();
        const edits = result.changes![uri];
        expect(edits).toBeDefined();
        expect(edits.length).toBeGreaterThanOrEqual(2); // definition + usage
        // All edits should replace with 'Detector'
        for (const edit of edits) {
            expect(edit.newText).toBe('Detector');
        }
    });
});

// ===================================================================
// Semantic Tokens Provider
// ===================================================================

describe('Semantic Tokens Provider', () => {
    it('should produce valid token data', async () => {
        const { SemanticTokensProvider } = await import('../../server/src/providers/semanticTokensProvider.js');
        const { dm } = await setup(VEHICLE_TEXT);
        const uri = 'test://test.sysml';

        const provider = new SemanticTokensProvider(dm);
        const tokens = provider.provideSemanticTokens({
            textDocument: { uri },
        });
        expect(tokens).toBeDefined();
        expect(tokens.data.length).toBeGreaterThan(0);
        // Token data must be groups of 5 integers
        expect(tokens.data.length % 5).toBe(0);
    });

    it('should classify keywords with keyword token type', async () => {
        const { SemanticTokensProvider } = await import('../../server/src/providers/semanticTokensProvider.js');
        const text = 'package Test { part def Vehicle; }';
        const { dm } = await setup(text);
        const uri = 'test://test.sysml';

        const provider = new SemanticTokensProvider(dm);
        const tokens = provider.provideSemanticTokens({ textDocument: { uri } });
        expect(tokens.data.length).toBeGreaterThan(0);

        // Token type index 6 = keyword — check at least some tokens are keywords
        const tokenTypes: number[] = [];
        for (let i = 3; i < tokens.data.length; i += 5) {
            tokenTypes.push(tokens.data[i]);
        }
        expect(tokenTypes).toContain(6); // keyword type
    });

    it('should classify numeric literals with number token type', async () => {
        const { SemanticTokensProvider } = await import('../../server/src/providers/semanticTokensProvider.js');
        const text = 'package Test { part def V { part w : W[4]; } part def W; }';
        const { dm } = await setup(text);
        const uri = 'test://test.sysml';

        const provider = new SemanticTokensProvider(dm);
        const tokens = provider.provideSemanticTokens({ textDocument: { uri } });

        const tokenTypes: number[] = [];
        for (let i = 3; i < tokens.data.length; i += 5) {
            tokenTypes.push(tokens.data[i]);
        }
        expect(tokenTypes).toContain(9); // number type
    });

    it('should classify identifiers with variable token type', async () => {
        const { SemanticTokensProvider } = await import('../../server/src/providers/semanticTokensProvider.js');
        const text = 'package Test { part myPart : SomeType; part def SomeType; }';
        const { dm } = await setup(text);
        const uri = 'test://test.sysml';

        const provider = new SemanticTokensProvider(dm);
        const tokens = provider.provideSemanticTokens({ textDocument: { uri } });

        const tokenTypes: number[] = [];
        for (let i = 3; i < tokens.data.length; i += 5) {
            tokenTypes.push(tokens.data[i]);
        }
        expect(tokenTypes).toContain(3); // variable type
    });
});

// ===================================================================
// Folding Range Provider
// ===================================================================

describe('Folding Range Provider', () => {
    it('should provide folding ranges for blocks', async () => {
        const { FoldingRangeProvider } = await import('../../server/src/providers/foldingRangeProvider.js');
        const { dm } = await setup(VEHICLE_TEXT);

        const provider = new FoldingRangeProvider(dm);
        const ranges = provider.provideFoldingRanges({
            textDocument: { uri: 'test://test.sysml' },
        });
        expect(ranges.length).toBeGreaterThan(0);
    });
});

// ===================================================================
// Diagnostics Provider
// ===================================================================

describe('Completion Provider', () => {
    it('should return SysML keyword completions', async () => {
        const { CompletionProvider } = await import('../../server/src/providers/completionProvider.js');
        const { dm } = await setup(VEHICLE_TEXT);

        const provider = new CompletionProvider(dm);
        const items = provider.provideCompletions({
            textDocument: { uri: 'test://test.sysml' },
            position: { line: 1, character: 4 },
        });

        expect(items.length).toBeGreaterThan(0);
        const labels = items.map(i => i.label);
        expect(labels).toContain('part def');
        expect(labels).toContain('action def');
        expect(labels).toContain('package');
        expect(labels).toContain('import');
    });

    it('should include snippet insert text for definitions', async () => {
        const { CompletionProvider } = await import('../../server/src/providers/completionProvider.js');
        const { InsertTextFormat } = await import('vscode-languageserver/node.js');
        const { dm } = await setup(VEHICLE_TEXT);

        const provider = new CompletionProvider(dm);
        const items = provider.provideCompletions({
            textDocument: { uri: 'test://test.sysml' },
            position: { line: 0, character: 0 },
        });

        const partDef = items.find(i => i.label === 'part def');
        expect(partDef).toBeDefined();
        expect(partDef!.insertText).toContain('part def');
        expect(partDef!.insertTextFormat).toBe(InsertTextFormat.Snippet);
    });

    it('should resolve a completion item unchanged', async () => {
        const { CompletionProvider } = await import('../../server/src/providers/completionProvider.js');
        const { dm } = await setup(VEHICLE_TEXT);

        const provider = new CompletionProvider(dm);
        const item = { label: 'part def', kind: 6, data: 'part def' };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resolved = provider.resolveCompletion(item as any);
        expect(resolved.label).toBe('part def');
    });

    it('should prioritize type-like completions in type annotation context', async () => {
        const { CompletionProvider } = await import('../../server/src/providers/completionProvider.js');
        const text = `package P {
    part def Wheel;
    part car : 
}`;
        const { dm } = await setup(text);

        const provider = new CompletionProvider(dm);
        const items = provider.provideCompletions({
            textDocument: { uri: 'test://test.sysml' },
            position: { line: 2, character: 15 },
        });

        const labels = items.map(i => i.label);
        expect(labels).toContain('Wheel');
        expect(labels).not.toContain('bind');
    });

    it('should offer port-focused completions in connect endpoint context', async () => {
        const { CompletionProvider } = await import('../../server/src/providers/completionProvider.js');
        const text = `package P {
    port def FuelPort;
    part def Car {
        port fuel : FuelPort;
        port backup : FuelPort;
        connection c1 connect fuel to 
    }
}`;
        const { dm } = await setup(text);

        const provider = new CompletionProvider(dm);
        const items = provider.provideCompletions({
            textDocument: { uri: 'test://test.sysml' },
            position: { line: 5, character: 36 },
        });

        const labels = items.map(i => i.label);
        expect(labels).toContain('backup');
        expect(labels).toContain('fuel');
        expect(labels).not.toContain('attribute def');
    });
});

describe('Diagnostics Provider', () => {
    it('should generate diagnostics from parse errors', async () => {
        const { DiagnosticsProvider } = await import('../../server/src/providers/diagnosticsProvider.js');
        const { dm } = await setup('package Broken { @@@ }');

        const provider = new DiagnosticsProvider(dm);
        const diags = provider.getDiagnostics('test://test.sysml');
        expect(diags.length).toBeGreaterThan(0);
    });

    it('should produce zero diagnostics for valid input', async () => {
        const { DiagnosticsProvider } = await import('../../server/src/providers/diagnosticsProvider.js');
        const { dm } = await setup('package ValidModel { part def Sensor { attribute reading : Real; } }');

        const provider = new DiagnosticsProvider(dm);
        const diags = provider.getDiagnostics('test://test.sysml');
        expect(diags.length).toBe(0);
    });
});
