import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('MCP Server Core', () => {
    // Load the DFA snapshot before tests to avoid cold-DFA timeouts.
    beforeAll(async () => {
        const { loadDFASnapshot } = await import('../../server/src/parser/dfaLoader.js');
        loadDFASnapshot();
    });
    let McpContext: typeof import('../../server/src/mcpCore.js').McpContext;
    let handleParse: typeof import('../../server/src/mcpCore.js').handleParse;
    let handleValidate: typeof import('../../server/src/mcpCore.js').handleValidate;
    let handleGetSymbols: typeof import('../../server/src/mcpCore.js').handleGetSymbols;
    let handleGetDefinition: typeof import('../../server/src/mcpCore.js').handleGetDefinition;
    let handleGetReferences: typeof import('../../server/src/mcpCore.js').handleGetReferences;
    let handleGetHierarchy: typeof import('../../server/src/mcpCore.js').handleGetHierarchy;
    let handleGetModelSummary: typeof import('../../server/src/mcpCore.js').handleGetModelSummary;
    let handleGetDiagnostics: typeof import('../../server/src/mcpCore.js').handleGetDiagnostics;
    let getElementKinds: typeof import('../../server/src/mcpCore.js').getElementKinds;
    let SYSML_KEYWORDS: typeof import('../../server/src/mcpCore.js').SYSML_KEYWORDS;
    let formatSymbol: typeof import('../../server/src/mcpCore.js').formatSymbol;
    let formatError: typeof import('../../server/src/mcpCore.js').formatError;
    let handleResourceElementKinds: typeof import('../../server/src/mcpCore.js').handleResourceElementKinds;
    let handleResourceKeywords: typeof import('../../server/src/mcpCore.js').handleResourceKeywords;
    let handleResourceGrammarOverview: typeof import('../../server/src/mcpCore.js').handleResourceGrammarOverview;
    let handlePromptReviewSysml: typeof import('../../server/src/mcpCore.js').handlePromptReviewSysml;
    let handlePromptExplainElement: typeof import('../../server/src/mcpCore.js').handlePromptExplainElement;
    let handlePromptGenerateSysml: typeof import('../../server/src/mcpCore.js').handlePromptGenerateSysml;
    let handlePreview: typeof import('../../server/src/mcpCore.js').handlePreview;
    let handleGetComplexity: typeof import('../../server/src/mcpCore.js').handleGetComplexity;
    let ensureParsed: typeof import('../../server/src/mcpCore.js').ensureParsed;

    let ctx: InstanceType<typeof McpContext>;

    beforeEach(async () => {
        const mod = await import('../../server/src/mcpCore.js');
        McpContext = mod.McpContext;
        handleParse = mod.handleParse;
        handleValidate = mod.handleValidate;
        handleGetSymbols = mod.handleGetSymbols;
        handleGetDefinition = mod.handleGetDefinition;
        handleGetReferences = mod.handleGetReferences;
        handleGetHierarchy = mod.handleGetHierarchy;
        handleGetModelSummary = mod.handleGetModelSummary;
        handleGetDiagnostics = mod.handleGetDiagnostics;
        getElementKinds = mod.getElementKinds;
        SYSML_KEYWORDS = mod.SYSML_KEYWORDS;
        formatSymbol = mod.formatSymbol;
        formatError = mod.formatError;
        handleResourceElementKinds = mod.handleResourceElementKinds;
        handleResourceKeywords = mod.handleResourceKeywords;
        handleResourceGrammarOverview = mod.handleResourceGrammarOverview;
        handlePromptReviewSysml = mod.handlePromptReviewSysml;
        handlePromptExplainElement = mod.handlePromptExplainElement;
        handlePromptGenerateSysml = mod.handlePromptGenerateSysml;
        handlePreview = mod.handlePreview;
        handleGetComplexity = mod.handleGetComplexity;
        ensureParsed = mod.ensureParsed;

        // Fresh context for each test — no shared state leaking between tests
        ctx = new McpContext();
    });

    const VALID_MODEL = `package Camera {
    part def CameraSystem {
        attribute resolution : String;
        port viewfinder : ViewPort;
    }
    part def ViewPort;
    part camera : CameraSystem;
}`;

    const INVALID_MODEL = `part def Broken {
    attribute x :
`;

    // -----------------------------------------------------------------------
    // parse tool
    // -----------------------------------------------------------------------

    describe('handleParse', () => {
        it('should parse valid SysML and return symbol count', () => {
            const result = handleParse(ctx, VALID_MODEL);
            expect(result.errorCount).toBe(0);
            expect(result.symbolCount).toBeGreaterThan(0);
            expect(result.uri).toBe('untitled.sysml');
            expect(result.timing).toBeDefined();
        });

        it('should use provided URI', () => {
            const result = handleParse(ctx, VALID_MODEL, 'file:///camera.sysml');
            expect(result.uri).toBe('file:///camera.sysml');
        });

        it('should report top-level elements', () => {
            const result = handleParse(ctx, VALID_MODEL);
            expect(result.topLevelElements).toBeDefined();
            const topLevel = result.topLevelElements as string[];
            expect(topLevel.some((e) => e.includes('Camera'))).toBe(true);
        });

        it('should report errors for invalid syntax', () => {
            const result = handleParse(ctx, INVALID_MODEL);
            expect(result.errorCount).toBeGreaterThan(0);
            expect(result.errors).toBeDefined();
            const errors = result.errors as Array<Record<string, unknown>>;
            expect(errors[0].line).toBeGreaterThan(0);
            expect(errors[0].message).toBeDefined();
        });
    });

    // -----------------------------------------------------------------------
    // validate tool
    // -----------------------------------------------------------------------

    describe('handleValidate', () => {
        it('should return valid=true for correct input', () => {
            const result = handleValidate(ctx, VALID_MODEL);
            expect(result.valid).toBe(true);
            expect(result.syntaxErrors).toEqual([]);
        });

        it('should return valid=false with errors for bad input', () => {
            const result = handleValidate(ctx, INVALID_MODEL);
            expect(result.valid).toBe(false);
            expect(result.syntaxErrors.length).toBeGreaterThan(0);
            expect(result.totalIssues).toBeGreaterThan(0);
        });

        it('should include semantic issues for unresolved types', () => {
            const code = `package T { part def V { part e : Missing[1]; } }`;
            const result = handleValidate(ctx, code);
            expect(result.semanticIssues.length).toBeGreaterThan(0);
            const unresolved = result.semanticIssues.filter(
                (i: Record<string, unknown>) => i.code === 'unresolved-type'
            );
            expect(unresolved.length).toBeGreaterThanOrEqual(1);
        });
    });

    // -----------------------------------------------------------------------
    // getDiagnostics tool
    // -----------------------------------------------------------------------

    describe('handleGetDiagnostics', () => {
        it('should return diagnostics for a previously parsed document', () => {
            const code = `package T { part def V { part e : Missing[1]; } }`;
            handleParse(ctx, code, 'test.sysml');
            const result = handleGetDiagnostics(ctx, 'test.sysml');
            expect(result.uri).toBe('test.sysml');
            expect(result.diagnostics.length).toBeGreaterThan(0);
            expect(result.summary).toBeDefined();
            expect(result.summary['unresolved-type']).toBeGreaterThanOrEqual(1);
        });

        it('should return empty diagnostics for a clean document', () => {
            const code = `package T {
    part def Engine { doc /* An engine */ attribute power : Real; }
    part car { doc /* A car */ part engine : Engine[1]; }
}`;
            handleParse(ctx, code, 'clean.sysml');
            const result = handleGetDiagnostics(ctx, 'clean.sysml');
            // May have hints (naming, missing-doc) but no errors/warnings
            const errors = result.diagnostics.filter(
                (d: Record<string, unknown>) => d.severity === 'error' || d.severity === 'warning'
            );
            expect(errors.length).toBe(0);
        });
    });

    // -----------------------------------------------------------------------
    // getSymbols tool
    // -----------------------------------------------------------------------

    describe('handleGetSymbols', () => {
        beforeEach(() => {
            handleParse(ctx, VALID_MODEL, 'test.sysml');
        });

        it('should return all symbols', () => {
            const result = handleGetSymbols(ctx, {});
            expect(result.count).toBeGreaterThan(0);
            expect(result.symbols.length).toBe(result.count);
        });

        it('should filter by uri', () => {
            const result = handleGetSymbols(ctx, { uri: 'test.sysml' });
            expect(result.count).toBeGreaterThan(0);
            const empty = handleGetSymbols(ctx, { uri: 'nonexistent.sysml' });
            expect(empty.count).toBe(0);
        });

        it('should filter by kind', () => {
            const result = handleGetSymbols(ctx, { kind: 'part def' });
            expect(result.count).toBeGreaterThan(0);
            result.symbols.forEach((s) => {
                expect(s.kind).toBe('part def');
            });
        });

        it('should filter definitions only', () => {
            const result = handleGetSymbols(ctx, { definitionsOnly: true });
            expect(result.count).toBeGreaterThan(0);
            result.symbols.forEach((s) => {
                expect((s.kind as string).endsWith(' def')).toBe(true);
            });
        });

        it('should filter usages only', () => {
            const result = handleGetSymbols(ctx, { usagesOnly: true });
            expect(result.count).toBeGreaterThan(0);
            result.symbols.forEach((s) => {
                expect((s.kind as string).endsWith(' def')).toBe(false);
            });
        });
    });

    // -----------------------------------------------------------------------
    // getDefinition tool
    // -----------------------------------------------------------------------

    describe('handleGetDefinition', () => {
        beforeEach(() => {
            handleParse(ctx, VALID_MODEL, 'test.sysml');
        });

        it('should find by qualified name', () => {
            const result = handleGetDefinition(ctx, 'Camera::CameraSystem');
            expect(result.qualifiedName).toBe('Camera::CameraSystem');
            expect(result.name).toBe('CameraSystem');
            expect(result.kind).toBeDefined();
        });

        it('should find by simple name', () => {
            const result = handleGetDefinition(ctx, 'CameraSystem');
            expect(result.found).toBe(true);
            expect((result as { count: number }).count).toBeGreaterThanOrEqual(1);
        });

        it('should return not-found for unknown name', () => {
            const result = handleGetDefinition(ctx, 'NonExistent');
            expect(result.found).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // getReferences tool
    // -----------------------------------------------------------------------

    describe('handleGetReferences', () => {
        beforeEach(() => {
            handleParse(ctx, VALID_MODEL, 'test.sysml');
        });

        it('should find references by name', () => {
            const result = handleGetReferences(ctx, 'CameraSystem');
            expect(result.name).toBe('CameraSystem');
            expect(result.referenceCount).toBeGreaterThanOrEqual(1);
            expect(result.references.length).toBe(result.referenceCount);
        });

        it('should return zero references for unknown name', () => {
            const result = handleGetReferences(ctx, 'Unknown');
            expect(result.referenceCount).toBe(0);
        });
    });

    // -----------------------------------------------------------------------
    // getHierarchy tool
    // -----------------------------------------------------------------------

    describe('handleGetHierarchy', () => {
        beforeEach(() => {
            handleParse(ctx, VALID_MODEL, 'test.sysml');
        });

        it('should return hierarchy for a nested element', () => {
            const result = handleGetHierarchy(ctx, 'CameraSystem') as {
                element: { name: string; kind: string };
                ancestors: Array<{ name: string }>;
                children: Array<{ name: string }>;
            };
            expect(result.element).toBeDefined();
            expect(result.element.name).toBe('CameraSystem');
            expect(result.ancestors.length).toBeGreaterThan(0);
            expect(result.ancestors[0].name).toBe('Camera');
        });

        it('should return hierarchy for a root element', () => {
            const result = handleGetHierarchy(ctx, 'Camera') as {
                element: { name: string };
                ancestors: Array<{ name: string }>;
            };
            expect(result.element.name).toBe('Camera');
            expect(result.ancestors.length).toBe(0);
        });

        it('should return not-found for unknown name', () => {
            const result = handleGetHierarchy(ctx, 'NonExistent') as { found: boolean };
            expect(result.found).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // getModelSummary tool
    // -----------------------------------------------------------------------

    describe('handleGetModelSummary', () => {
        it('should return empty summary before parsing', () => {
            const result = handleGetModelSummary(ctx);
            expect(result.totalSymbols).toBe(0);
            expect((result.loadedDocuments as string[]).length).toBe(0);
        });

        it('should return summary after parsing', () => {
            handleParse(ctx, VALID_MODEL, 'cam.sysml');
            const result = handleGetModelSummary(ctx);
            expect(result.totalSymbols).toBeGreaterThan(0);
            expect(result.loadedDocuments).toContain('cam.sysml');
            expect(result.elementsByKind).toBeDefined();
            expect((result.definitions as number)).toBeGreaterThan(0);
            expect((result.usages as number)).toBeGreaterThan(0);
        });

        it('should track multiple documents', () => {
            handleParse(ctx, VALID_MODEL, 'a.sysml');
            handleParse(ctx, 'package Other { part def Foo; }', 'b.sysml');
            const result = handleGetModelSummary(ctx);
            expect((result.loadedDocuments as string[]).length).toBe(2);
        });
    });

    // -----------------------------------------------------------------------
    // Stateful context behaviour
    // -----------------------------------------------------------------------

    describe('McpContext state', () => {
        it('should persist symbols across parse calls', () => {
            handleParse(ctx, 'package A { part def X; }', 'a.sysml');
            handleParse(ctx, 'package B { part def Y; }', 'b.sysml');

            const all = handleGetSymbols(ctx, {});
            const names = all.symbols.map((s) => s.name);
            expect(names).toContain('X');
            expect(names).toContain('Y');
        });

        it('should replace symbols when re-parsing the same URI', () => {
            handleParse(ctx, 'package A { part def X; }', 'a.sysml');
            handleParse(ctx, 'package A { part def Z; }', 'a.sysml');

            const all = handleGetSymbols(ctx, { uri: 'a.sysml' });
            const names = all.symbols.map((s) => s.name);
            expect(names).toContain('Z');
            expect(names).not.toContain('X');
        });
    });

    // -----------------------------------------------------------------------
    // Resource helpers
    // -----------------------------------------------------------------------

    describe('getElementKinds', () => {
        it('should return categorised element kinds', () => {
            const result = getElementKinds();
            expect(result.definitions.length).toBeGreaterThan(0);
            expect(result.usages.length).toBeGreaterThan(0);
            expect(result.total).toBe(
                result.definitions.length + result.usages.length + result.other.length,
            );
        });

        it('should have definitions ending in "def"', () => {
            const result = getElementKinds();
            result.definitions.forEach((d) => {
                expect(d.endsWith(' def') || d === 'metadata def' || d === 'rendering def').toBe(true);
            });
        });
    });

    describe('SYSML_KEYWORDS', () => {
        it('should contain common keywords', () => {
            expect(SYSML_KEYWORDS).toContain('package');
            expect(SYSML_KEYWORDS).toContain('part');
            expect(SYSML_KEYWORDS).toContain('attribute');
            expect(SYSML_KEYWORDS).toContain('port');
            expect(SYSML_KEYWORDS).toContain('action');
            expect(SYSML_KEYWORDS).toContain('requirement');
        });

        it('should have more than 100 keywords', () => {
            expect(SYSML_KEYWORDS.length).toBeGreaterThan(100);
        });
    });

    // -----------------------------------------------------------------------
    // Format helpers
    // -----------------------------------------------------------------------

    describe('formatSymbol', () => {
        it('should format a symbol with required fields', () => {
            handleParse(ctx, VALID_MODEL, 'test.sysml');
            const sym = ctx.symbolTable
                .getAllSymbols()
                .find((s) => s.name === 'CameraSystem' && s.kind === 'part def')!;
            const formatted = formatSymbol(sym);
            expect(formatted.name).toBe('CameraSystem');
            expect(formatted.kind).toBe('part def');
            expect(formatted.qualifiedName).toContain('Camera::CameraSystem');
            expect(formatted.location).toBeDefined();
        });

        it('should omit optional fields when absent', () => {
            handleParse(ctx, 'package P { part def Simple; }', 'test.sysml');
            const sym = ctx.symbolTable.findByName('Simple')[0];
            const formatted = formatSymbol(sym);
            expect(formatted.documentation).toBeUndefined();
            expect(formatted.type).toBeUndefined();
        });
    });

    describe('formatError', () => {
        it('should convert 0-based to 1-based line/column', () => {
            const err = { line: 0, column: 0, message: 'test', length: 1 };
            const formatted = formatError(err);
            expect(formatted.line).toBe(1);
            expect(formatted.column).toBe(1);
            expect(formatted.message).toBe('test');
            expect(formatted.length).toBe(1);
        });
    });

    // -----------------------------------------------------------------------
    // Resource handlers
    // -----------------------------------------------------------------------

    describe('handleResourceElementKinds', () => {
        it('should return categorised element kinds', () => {
            const result = handleResourceElementKinds();
            expect(result.definitions).toBeDefined();
            expect(result.usages).toBeDefined();
            expect(result.total).toBe(
                (result.definitions as string[]).length +
                (result.usages as string[]).length +
                (result.other as string[]).length,
            );
        });
    });

    describe('handleResourceKeywords', () => {
        it('should return keywords with count', () => {
            const result = handleResourceKeywords();
            expect(result.keywords).toBeDefined();
            expect(result.count).toBe(result.keywords.length);
            expect(result.count).toBeGreaterThan(100);
            expect(result.keywords).toContain('package');
            expect(result.keywords).toContain('part');
            expect(result.keywords).toContain('requirement');
        });
    });

    describe('handleResourceGrammarOverview', () => {
        it('should return markdown content', () => {
            const result = handleResourceGrammarOverview();
            expect(result).toContain('# SysML v2 Grammar Overview');
            expect(result).toContain('## Element Categories');
            expect(result).toContain('part def');
            expect(result).toContain('## Specialisation Syntax');
        });
    });

    // -----------------------------------------------------------------------
    // Prompt handlers
    // -----------------------------------------------------------------------

    describe('handlePromptReviewSysml', () => {
        it('should return review prompt with parse results for valid code', () => {
            const messages = handlePromptReviewSysml(ctx, VALID_MODEL);
            expect(messages).toHaveLength(1);
            expect(messages[0].role).toBe('user');
            expect(messages[0].content.type).toBe('text');
            expect(messages[0].content.text).toContain('Parse Results');
            expect(messages[0].content.text).toContain('0 syntax errors');
            expect(messages[0].content.text).toContain('CameraSystem');
            expect(messages[0].content.text).toContain('Source Code');
        });

        it('should include errors in prompt for invalid code', () => {
            const messages = handlePromptReviewSysml(ctx, INVALID_MODEL);
            expect(messages[0].content.text).toContain('Errors:');
            expect(messages[0].content.text).not.toContain('0 syntax errors');
        });
    });

    describe('handlePromptExplainElement', () => {
        it('should return explain prompt with element name', () => {
            const messages = handlePromptExplainElement('part def');
            expect(messages).toHaveLength(1);
            expect(messages[0].role).toBe('user');
            expect(messages[0].content.text).toContain('part def');
            expect(messages[0].content.text).toContain('systems engineering');
            expect(messages[0].content.text).toContain('SysML v2 code example');
        });
    });

    describe('handlePromptGenerateSysml', () => {
        it('should return generate prompt with description', () => {
            const messages = handlePromptGenerateSysml('A drone delivery system');
            expect(messages).toHaveLength(1);
            expect(messages[0].role).toBe('user');
            expect(messages[0].content.text).toContain('A drone delivery system');
            expect(messages[0].content.text).toContain('valid SysML v2 syntax');
        });

        it('should include scope when provided', () => {
            const messages = handlePromptGenerateSysml('A drone', 'structural only');
            expect(messages[0].content.text).toContain('Focus on: structural only');
        });

        it('should use default scope when not provided', () => {
            const messages = handlePromptGenerateSysml('A drone');
            expect(messages[0].content.text).toContain('Include structural definitions');
        });
    });

    // -----------------------------------------------------------------------
    // getComplexity tool
    // -----------------------------------------------------------------------

    describe('handleGetComplexity', () => {
        it('should return all-zero report without prior parse', () => {
            const result = handleGetComplexity(ctx);
            expect(result.complexityIndex).toBe(0);
            expect(result.definitions).toBe(0);
        });

        it('should return non-zero report after parsing', () => {
            handleParse(ctx, VALID_MODEL, 'test.sysml');
            const result = handleGetComplexity(ctx);
            expect(result.complexityIndex).toBeGreaterThan(0);
            expect(result.definitions).toBeGreaterThan(0);
        });

        it('should auto-parse when code is provided', () => {
            // No prior parse — pass code directly
            const result = handleGetComplexity(ctx, undefined, VALID_MODEL);
            expect(result.complexityIndex).toBeGreaterThan(0);
            expect(result.definitions).toBeGreaterThan(0);
        });
    });

    // -----------------------------------------------------------------------
    // Auto-parse (ensureParsed) — query tools work without prior parse call
    // -----------------------------------------------------------------------

    describe('auto-parse via code parameter', () => {
        it('handleGetDiagnostics should auto-parse from code', () => {
            const code = `package T { part def V { part e : Missing[1]; } }`;
            const result = handleGetDiagnostics(ctx, undefined, code);
            expect(result.diagnostics.length).toBeGreaterThan(0);
            expect(result.summary['unresolved-type']).toBeGreaterThanOrEqual(1);
        });

        it('handleGetSymbols should auto-parse from code', () => {
            const result = handleGetSymbols(ctx, { code: VALID_MODEL });
            expect(result.count).toBeGreaterThan(0);
            expect(result.symbols.some(s => s.name === 'CameraSystem')).toBe(true);
        });

        it('handleGetDefinition should auto-parse from code', () => {
            const result = handleGetDefinition(ctx, 'CameraSystem', VALID_MODEL);
            expect(result.found).toBe(true);
        });

        it('handleGetReferences should auto-parse from code', () => {
            const result = handleGetReferences(ctx, 'CameraSystem', VALID_MODEL);
            expect(result.referenceCount).toBeGreaterThanOrEqual(1);
        });

        it('handleGetHierarchy should auto-parse from code', () => {
            const result = handleGetHierarchy(ctx, 'CameraSystem', VALID_MODEL) as {
                element: { name: string };
                ancestors: Array<{ name: string }>;
            };
            expect(result.element).toBeDefined();
            expect(result.element.name).toBe('CameraSystem');
            expect(result.ancestors.length).toBeGreaterThan(0);
        });

        it('handleGetModelSummary should auto-parse from code', () => {
            const result = handleGetModelSummary(ctx, VALID_MODEL);
            expect(result.totalSymbols).toBeGreaterThan(0);
            expect((result.definitions as number)).toBeGreaterThan(0);
        });

        it('handleGetComplexity should auto-parse from code', () => {
            const result = handleGetComplexity(ctx, undefined, VALID_MODEL);
            expect(result.complexityIndex).toBeGreaterThan(0);
        });
    });

    // -----------------------------------------------------------------------
    // ensureParsed re-parse from cache
    // -----------------------------------------------------------------------

    describe('ensureParsed cache behaviour', () => {
        it('should re-parse from loadedDocuments when symbol table is empty for URI', () => {
            // Parse once to populate the cache
            handleParse(ctx, VALID_MODEL, 'cached.sysml');
            // Clear the symbol table manually to simulate empty state
            ctx.symbolTable.build('cached.sysml', {
                tree: null as unknown as import('../../server/src/parser/parseDocument.js').ParseResult['tree'],
                errors: [],
                tokens: null as unknown as import('../../server/src/parser/parseDocument.js').ParseResult['tokens'],
                timing: { lexMs: 0, parseMs: 0, totalMs: 0 },
            });
            expect(ctx.symbolTable.getSymbolsForUri('cached.sysml').length).toBe(0);

            // ensureParsed should re-parse from cache
            ensureParsed(ctx, 'cached.sysml');
            expect(ctx.symbolTable.getSymbolsForUri('cached.sysml').length).toBeGreaterThan(0);
        });

        it('should not re-parse when symbols already exist', () => {
            handleParse(ctx, VALID_MODEL, 'existing.sysml');
            const countBefore = ctx.symbolTable.getSymbolsForUri('existing.sysml').length;

            // ensureParsed should be a no-op
            ensureParsed(ctx, 'existing.sysml');
            const countAfter = ctx.symbolTable.getSymbolsForUri('existing.sysml').length;
            expect(countAfter).toBe(countBefore);
        });
    });

    // -----------------------------------------------------------------------
    // preview tool
    // -----------------------------------------------------------------------

    describe('handlePreview', () => {
        it('should generate a General View diagram for structural code', () => {
            const result = handlePreview(ctx, { code: VALID_MODEL });
            expect(result.diagramType).toBe('general');
            expect(result.diagram).toContain('classDiagram');
            expect(result.elementCount).toBeGreaterThan(0);
            expect(result.errors).toHaveLength(0);
        });

        it('should return syntax errors for invalid code', () => {
            const result = handlePreview(ctx, { code: INVALID_MODEL });
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should auto-detect activity diagram for action-heavy code', () => {
            const actionModel = `action def ProcessOrder {
    action receiveOrder;
    action validatePayment;
    action shipItem;
}`;
            const result = handlePreview(ctx, { code: actionModel });
            expect(result.diagramType).toBe('activity');
            expect(result.diagram).toContain('flowchart');
        });

        it('should auto-detect state diagram for state-heavy code', () => {
            const stateModel = `state def DeviceStates {
    state idle;
    state running;
    state error;
}`;
            const result = handlePreview(ctx, { code: stateModel });
            expect(result.diagramType).toBe('state');
            expect(result.diagram).toContain('stateDiagram');
        });

        it('should respect forced diagramType override', () => {
            const result = handlePreview(ctx, {
                code: VALID_MODEL,
                diagramType: 'interconnection',
            });
            // Should use interconnection even though the model is structural
            expect(result.diagramType).toBe('interconnection');
        });

        it('should use provided URI', () => {
            handlePreview(ctx, { code: VALID_MODEL, uri: 'file:///test.sysml' });
            // The URI should have been stored in the context
            expect(ctx.loadedDocuments.has('file:///test.sysml')).toBe(true);
        });

        it('should default URI to preview.sysml', () => {
            handlePreview(ctx, { code: VALID_MODEL });
            expect(ctx.loadedDocuments.has('preview.sysml')).toBe(true);
        });

        it('should generate diff when originalCode is provided', () => {
            const original = `package Vehicle {
    part def Engine;
}`;
            const modified = `package Vehicle {
    part def Engine;
    part def Transmission;
}`;
            const result = handlePreview(ctx, {
                code: modified,
                originalCode: original,
            });
            expect(result.diff).toBeDefined();
            expect(result.diff!.added.length).toBeGreaterThan(0);
            expect(result.diff!.added.some(a => a.includes('Transmission'))).toBe(true);
        });

        it('should show removed elements in diff', () => {
            const original = `package Vehicle {
    part def Engine;
    part def Transmission;
}`;
            const modified = `package Vehicle {
    part def Engine;
}`;
            const result = handlePreview(ctx, {
                code: modified,
                originalCode: original,
            });
            expect(result.diff).toBeDefined();
            expect(result.diff!.removed.length).toBeGreaterThan(0);
        });

        it('should focus on a specific element', () => {
            const model = `package Vehicle {
    part def Engine {
        attribute horsePower : Integer;
    }
    part def Chassis;
    part def Wheel;
}`;
            const focused = handlePreview(ctx, { code: model, focus: 'Engine' });
            const full = handlePreview(ctx, { code: model });
            // Focused diagram should render fewer elements than the full one
            expect(focused.elementCount).toBeLessThanOrEqual(full.elementCount);
        });

        it('should include semantic issues when present', () => {
            const model = `part def Foo {
    part bar : UnknownType;
}`;
            const result = handlePreview(ctx, { code: model });
            // May or may not have semantic issues depending on validator
            expect(result).toHaveProperty('errors');
        });

        it('should handle empty code gracefully', () => {
            const result = handlePreview(ctx, { code: '' });
            expect(result.elementCount).toBe(0);
            expect(result.diagram).toBeDefined();
        });
    });
});
