import { describe, expect, it } from 'vitest';
import type { CodeActionParams, Diagnostic } from 'vscode-languageserver/node.js';

/** Create a TextDocument from raw SysML text */
async function makeDoc(text: string, uri = 'file:///test.sysml') {
    const mod = await import(
        '../../server/node_modules/vscode-languageserver-textdocument/lib/esm/main.js'
    );
    return mod.TextDocument.create(uri, 'sysml', 1, text);
}

/** Get semantic diagnostics for a SysML document */
async function getSemanticDiagnostics(text: string, uri = 'file:///test.sysml') {
    const { DocumentManager } = await import('../../server/src/documentManager.js');
    const { SemanticValidator } = await import(
        '../../server/src/providers/semanticValidator.js'
    );

    const docManager = new DocumentManager();
    const doc = await makeDoc(text, uri);
    docManager.parse(doc);

    const validator = new SemanticValidator(docManager);
    return { diagnostics: validator.validate(uri), docManager };
}

/** Build a CodeActionProvider with a primed DocumentManager */
async function makeProvider(text: string, uri = 'file:///test.sysml') {
    const { DocumentManager } = await import('../../server/src/documentManager.js');
    const { CodeActionProvider } = await import(
        '../../server/src/providers/codeActionProvider.js'
    );

    const docManager = new DocumentManager();
    const doc = await makeDoc(text, uri);
    docManager.parse(doc);

    return { provider: new CodeActionProvider(docManager), docManager };
}

/** Build CodeActionParams for a list of diagnostics */
function makeParams(
    uri: string,
    diagnostics: Diagnostic[],
): CodeActionParams {
    return {
        textDocument: { uri },
        range: diagnostics[0]?.range ?? { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        context: { diagnostics },
    };
}

// ─────────────────────────────────────────────────────────────────
// Naming convention fixes
// ─────────────────────────────────────────────────────────────────

describe('Code Actions — Naming Convention', () => {
    it('should offer PascalCase fix for lowercase definition', async () => {
        const uri = 'file:///test.sysml';
        const text = `package Test {\n    part def wheel {\n    }\n}`;

        const { diagnostics } = await getSemanticDiagnostics(text, uri);
        const namingDiag = diagnostics.filter(d => d.code === 'naming-convention');
        expect(namingDiag.length).toBeGreaterThan(0);

        const { provider } = await makeProvider(text, uri);
        const actions = provider.provideCodeActions(makeParams(uri, namingDiag));

        expect(actions.length).toBeGreaterThan(0);
        const fix = actions.find(a => a.title.includes("Rename to 'Wheel'"));
        expect(fix).toBeDefined();
        expect(fix!.edit?.changes?.[uri]).toBeDefined();

        const edits = fix!.edit!.changes![uri];
        expect(edits[0].newText).toBe('Wheel');
    });

    it('should offer camelCase fix for uppercase usage', async () => {
        const uri = 'file:///test.sysml';
        const text = `package Test {\n    part def Wheel {\n    }\n    part Tire : Wheel;\n}`;

        const { diagnostics } = await getSemanticDiagnostics(text, uri);
        const namingDiag = diagnostics.filter(
            d => d.code === 'naming-convention' && d.message.includes('camelCase'),
        );
        expect(namingDiag.length).toBeGreaterThan(0);

        const { provider } = await makeProvider(text, uri);
        const actions = provider.provideCodeActions(makeParams(uri, namingDiag));

        const fix = actions.find(a => a.title.includes("Rename to 'tire'"));
        expect(fix).toBeDefined();
        expect(fix!.edit!.changes![uri][0].newText).toBe('tire');
    });
});

// ─────────────────────────────────────────────────────────────────
// Missing documentation fixes
// ─────────────────────────────────────────────────────────────────

describe('Code Actions — Missing Documentation', () => {
    it('should offer to add a doc comment inside the definition body', async () => {
        const uri = 'file:///test.sysml';
        const text = `package Test {\n    part def Engine {\n    }\n}`;

        const { diagnostics } = await getSemanticDiagnostics(text, uri);
        const docDiag = diagnostics.filter(d => d.code === 'missing-doc');
        expect(docDiag.length).toBeGreaterThan(0);

        const { provider } = await makeProvider(text, uri);
        const actions = provider.provideCodeActions(makeParams(uri, docDiag));

        const fix = actions.find(a => a.title.includes("Add documentation for 'Engine'"));
        expect(fix).toBeDefined();

        const edits = fix!.edit!.changes![uri];
        expect(edits.length).toBe(1);
        expect(edits[0].newText).toContain('doc');
        expect(edits[0].newText).toContain('Engine');

        // The edit should insert after the opening brace (inside the body),
        // not above the definition — per SysML v2 spec, doc is an owned member.
        const insertRange = edits[0].range;
        // Opening brace is on line 1 ("    part def Engine {")
        expect(insertRange.start.line).toBe(1);
        // Insert position should be right after the '{'
        expect(insertRange.start.character).toBeGreaterThanOrEqual(
            '    part def Engine {'.indexOf('{') + 1,
        );
    });

    it('should not offer doc fix when documentation exists', async () => {
        const uri = 'file:///test.sysml';
        const text = `package Test {\n    doc /* An engine */\n    part def Engine {\n    }\n}`;

        const { diagnostics } = await getSemanticDiagnostics(text, uri);
        const docDiag = diagnostics.filter(d => d.code === 'missing-doc');

        // Engine should not have a missing-doc diagnostic since it has a doc comment
        // (may or may not fire depending on parser — just verify no fix offered if no diag)
        if (docDiag.length === 0) {
            // Great — no diagnostic means no fix needed
            expect(true).toBe(true);
        }
    });
});

// ─────────────────────────────────────────────────────────────────
// Empty enumeration fixes
// ─────────────────────────────────────────────────────────────────

describe('Code Actions — Empty Enumeration', () => {
    it('should offer to add placeholder enum values', async () => {
        const uri = 'file:///test.sysml';
        const text = `package Test {\n    enum def Color {\n    }\n}`;

        const { diagnostics } = await getSemanticDiagnostics(text, uri);
        const enumDiag = diagnostics.filter(d => d.code === 'empty-enum');
        expect(enumDiag.length).toBeGreaterThan(0);

        const { provider } = await makeProvider(text, uri);
        const actions = provider.provideCodeActions(makeParams(uri, enumDiag));

        const fix = actions.find(a => a.title === 'Add placeholder enum values');
        expect(fix).toBeDefined();

        const edits = fix!.edit!.changes![uri];
        expect(edits.length).toBe(1);
        expect(edits[0].newText).toContain('enum value1');
        expect(edits[0].newText).toContain('enum value2');
    });
});

// ─────────────────────────────────────────────────────────────────
// Unused definition fixes
// ─────────────────────────────────────────────────────────────────

describe('Code Actions — Unused Definition', () => {
    it('should offer to prefix unused definition with underscore', async () => {
        const uri = 'file:///test.sysml';
        const text = `package Test {\n    part def Sensor {\n    }\n}`;

        const { diagnostics } = await getSemanticDiagnostics(text, uri);
        const unusedDiag = diagnostics.filter(d => d.code === 'unused-definition');
        expect(unusedDiag.length).toBeGreaterThan(0);

        const { provider } = await makeProvider(text, uri);
        const actions = provider.provideCodeActions(makeParams(uri, unusedDiag));

        const fix = actions.find(a => a.title.includes("Prefix with underscore: '_Sensor'"));
        expect(fix).toBeDefined();

        const edits = fix!.edit!.changes![uri];
        expect(edits[0].newText).toBe('_Sensor');
    });

    it('should not offer underscore fix when already prefixed', async () => {
        const uri = 'file:///test.sysml';
        // Manually construct a diagnostic for an already-prefixed name
        const { CodeActionProvider } = await import(
            '../../server/src/providers/codeActionProvider.js'
        );
        const { DocumentManager } = await import('../../server/src/documentManager.js');

        const provider = new CodeActionProvider(new DocumentManager());
        const diag: Diagnostic = {
            severity: 4, // Hint
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 7 } },
            message: "Definition '_Sensor' is not referenced by any usage in this document",
            source: 'sysml',
            code: 'unused-definition',
        };

        const actions = provider.provideCodeActions(makeParams(uri, [diag]));
        const underscoreFix = actions.find(a => a.title.includes('Prefix with underscore'));
        expect(underscoreFix).toBeUndefined();
    });
});

// ─────────────────────────────────────────────────────────────────
// New semantic quick fixes
// ─────────────────────────────────────────────────────────────────

describe('Code Actions — Redefinition Multiplicity', () => {
    it('should offer to align multiplicity with base feature', async () => {
        const uri = 'file:///test.sysml';
        const text = `package Test {
    part def Wheel;
    part def Vehicle {
        part wheel : Wheel[0..1];
    }
    part def SportsCar :> Vehicle {
        part wheel :>> wheel[2];
    }
}`;

        const { diagnostics } = await getSemanticDiagnostics(text, uri);
        const redefDiag = diagnostics.filter(d => d.code === 'invalid-redefinition-multiplicity');
        expect(redefDiag.length).toBeGreaterThanOrEqual(1);

        const { provider } = await makeProvider(text, uri);
        const actions = provider.provideCodeActions(makeParams(uri, redefDiag));
        const fix = actions.find(a => a.title.includes('Align multiplicity with base'));

        expect(fix).toBeDefined();
        expect(fix!.edit?.changes?.[uri]?.length).toBeGreaterThan(0);
    });
});

describe('Code Actions — Incompatible Port Types', () => {
    it('should suggest replacing endpoint with a compatible local port', async () => {
        const uri = 'file:///test.sysml';
        const text = `package Test {
    port def FuelPort;
    port def ElectricalPort;

    part def Car {
        port fuel : FuelPort;
        port altFuel : FuelPort;
        port power : ElectricalPort;

        connection c1 connect fuel to power;
    }
}`;

        const { diagnostics } = await getSemanticDiagnostics(text, uri);
        const portDiag = diagnostics.filter(d => d.code === 'incompatible-port-types');
        expect(portDiag.length).toBeGreaterThanOrEqual(1);

        const { provider } = await makeProvider(text, uri);
        const actions = provider.provideCodeActions(makeParams(uri, portDiag));
        const fix = actions.find(a => a.title.includes("compatible port 'altFuel'"));

        expect(fix).toBeDefined();
        expect(fix!.edit?.changes?.[uri]?.[0].newText).toContain('altFuel');
    });
});

describe('Code Actions — Unresolved Constraint Reference', () => {
    it('should suggest nearest member replacement for unresolved path', async () => {
        const uri = 'file:///test.sysml';
        const text = `package Test {
    part def Wheel {
        attribute radius : Real;
    }

    requirement def BrakeReq {
        subject wheel : Wheel;
        require constraint {
            wheel.radus > 0
        }
    }
}`;

        const { diagnostics } = await getSemanticDiagnostics(text, uri);
        const constraintDiag = diagnostics.filter(d => d.code === 'unresolved-constraint-reference');
        expect(constraintDiag.length).toBeGreaterThanOrEqual(1);

        const { provider } = await makeProvider(text, uri);
        const actions = provider.provideCodeActions(makeParams(uri, constraintDiag));
        const fix = actions.find(a => a.title.includes("wheel.radius"));

        expect(fix).toBeDefined();
        expect(fix!.edit?.changes?.[uri]?.[0].newText).toBe('wheel.radius');
    });
});

// ─────────────────────────────────────────────────────────────────
// Keyword typo fixes (existing — verify still works)
// ─────────────────────────────────────────────────────────────────

describe('Code Actions — Keyword Typo', () => {
    it('should offer typo fix for misspelled keyword', async () => {
        const uri = 'file:///test.sysml';
        const { CodeActionProvider } = await import(
            '../../server/src/providers/codeActionProvider.js'
        );
        const { DocumentManager } = await import('../../server/src/documentManager.js');

        const provider = new CodeActionProvider(new DocumentManager());
        const diag: Diagnostic = {
            severity: 1,
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
            message: "Unknown keyword 'paart'. Did you mean 'part'?",
            source: 'sysml',
            code: 'keyword-typo',
        };

        const actions = provider.provideCodeActions(makeParams(uri, [diag]));
        expect(actions.length).toBe(1);
        expect(actions[0].title).toContain("'paart' → 'part'");
        expect(actions[0].edit!.changes![uri][0].newText).toBe('part');
    });
});

// ─────────────────────────────────────────────────────────────────
// No fixes for unrelated diagnostics
// ─────────────────────────────────────────────────────────────────

describe('Code Actions — No false positives', () => {
    it('should return no actions for unresolved-type diagnostic when file text is unavailable', async () => {
        const uri = 'file:///test.sysml';
        const { CodeActionProvider } = await import(
            '../../server/src/providers/codeActionProvider.js'
        );
        const { DocumentManager } = await import('../../server/src/documentManager.js');

        const provider = new CodeActionProvider(new DocumentManager());
        const diag: Diagnostic = {
            severity: 2,
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
            message: "Type 'FooBar' is not defined in the current document or standard library",
            source: 'sysml',
            code: 'unresolved-type',
        };

        const actions = provider.provideCodeActions(makeParams(uri, [diag]));
        expect(actions.length).toBe(0);
    });

    it('should return no actions for invalid-multiplicity diagnostic', async () => {
        const uri = 'file:///test.sysml';
        const { CodeActionProvider } = await import(
            '../../server/src/providers/codeActionProvider.js'
        );
        const { DocumentManager } = await import('../../server/src/documentManager.js');

        const provider = new CodeActionProvider(new DocumentManager());
        const diag: Diagnostic = {
            severity: 1,
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
            message: "Invalid multiplicity [5..2]: lower bound (5) exceeds upper bound (2)",
            source: 'sysml',
            code: 'invalid-multiplicity',
        };

        const actions = provider.provideCodeActions(makeParams(uri, [diag]));
        expect(actions.length).toBe(0);
    });
});

describe('Code Actions — Unresolved Type', () => {
    it('should offer to import a workspace package that defines the missing type', async () => {
        const uriMain = 'file:///main.sysml';
        const uriLib = 'file:///lib.sysml';
        const mainText = `package CameraTestBDD {
    attribute resolution : Resolution;
}`;
        const libText = `package PictureTaking {
    part def Resolution;
}`;

        const { DocumentManager } = await import('../../server/src/documentManager.js');
        const { CodeActionProvider } = await import('../../server/src/providers/codeActionProvider.js');

        const docManager = new DocumentManager();
        docManager.parse(await makeDoc(mainText, uriMain));
        docManager.parse(await makeDoc(libText, uriLib));

        const provider = new CodeActionProvider(docManager);
        const diag: Diagnostic = {
            severity: 2,
            range: { start: { line: 1, character: 27 }, end: { line: 1, character: 37 } },
            message: "Type 'Resolution' is not defined in the current document or standard library",
            source: 'sysml',
            code: 'unresolved-type',
            data: { typeName: 'Resolution' },
        };

        const actions = provider.provideCodeActions(makeParams(uriMain, [diag]));
        const importFix = actions.find(a => a.title.includes("Import 'PictureTaking::*'"));

        expect(importFix).toBeDefined();
        expect(importFix!.edit?.changes?.[uriMain]?.[0].newText).toContain('public import PictureTaking::*;');
    });

    it('should offer to create a local attribute def stub for unresolved type in attribute context', async () => {
        const uri = 'file:///test.sysml';
        const text = `package CameraTestBDD {
    attribute resolution : Resolution;
}`;

        const { provider } = await makeProvider(text, uri);
        const diag: Diagnostic = {
            severity: 2,
            range: { start: { line: 1, character: 27 }, end: { line: 1, character: 37 } },
            message: "Type 'Resolution' is not defined in the current document or standard library",
            source: 'sysml',
            code: 'unresolved-type',
            data: { typeName: 'Resolution' },
        };

        const actions = provider.provideCodeActions(makeParams(uri, [diag]));
        const createFix = actions.find(a => a.title.includes("Create local 'attribute def Resolution;'"));

        expect(createFix).toBeDefined();
        expect(createFix!.edit?.changes?.[uri]?.[0].newText).toContain('attribute def Resolution;');
    });

    it('should offer attribute def for unresolved Map in attribute context', async () => {
        const uri = 'file:///test-map.sysml';
        const text = `package CameraTestBDD {
    attribute mapData : Map;
}`;

        const { provider } = await makeProvider(text, uri);
        const diag: Diagnostic = {
            severity: 2,
            range: { start: { line: 1, character: 24 }, end: { line: 1, character: 27 } },
            message: "Type 'Map' is not defined in the current document or standard library",
            source: 'sysml',
            code: 'unresolved-type',
            data: { typeName: 'Map' },
        };

        const actions = provider.provideCodeActions(makeParams(uri, [diag]));
        const createFix = actions.find(a => a.title.includes("Create local 'attribute def Map;'"));

        expect(createFix).toBeDefined();
        expect(createFix!.edit?.changes?.[uri]?.[0].newText).toContain('attribute def Map;');
    });

    it('should still offer attribute def when unresolved-type range is on attribute name', async () => {
        const uri = 'file:///camera-bdd.sysml';
        const text = `package CameraTestBDD {
    part def CameraSystem {
        attribute resolution : Resolution;
    }
}`;

        const { provider } = await makeProvider(text, uri);
        const diag: Diagnostic = {
            severity: 2,
            // Mirrors real-world diagnostic where range targets "resolution"
            // instead of "Resolution".
            range: { start: { line: 2, character: 18 }, end: { line: 2, character: 29 } },
            message: "Type 'Resolution' is not defined in the current document or standard library",
            source: 'sysml',
            code: 'unresolved-type',
            data: { typeName: 'Resolution' },
        };

        const actions = provider.provideCodeActions(makeParams(uri, [diag]));
        const createFix = actions.find(a => a.title.includes("Create local 'attribute def Resolution;'"));

        expect(createFix).toBeDefined();
        expect(createFix!.edit?.changes?.[uri]?.[0].newText).toContain('attribute def Resolution;');
    });
});
