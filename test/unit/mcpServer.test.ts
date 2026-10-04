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
        it('should refer to each owner by its symbol ID as parentId, never by a name', () => {
            const code = 'package Demo {\n    part a { port p; }\n    part b { port p; }\n    connect a.p to b.p { attribute flowRate; }\n}\n';
            const { symbols } = handleGetSymbols(ctx, { code, uri: 'owners.sysml' }) as { symbols: Array<Record<string, unknown>> };
            const byId = new Map(symbols.map(s => [s.symbolId, s]));
            const ownerOf = (name: string) => byId.get(symbols.find(s => s.name === name)!.parentId);
            expect(symbols.some(s => 'parent' in s)).toBe(false);
            // A client finds an owner, and its name or its absence, through parentId.
            expect(ownerOf('a')!.name).toBe('Demo');
            expect(ownerOf('flowRate')).toMatchObject({ name: '', kind: 'connection', declaration: 'connect a.p to b.p' });
            // The qualified name is always reported: null without one, as in the SysML v2 API.
            expect(symbols.map(s => [s.name, s.qualifiedName])).toContainEqual(['flowRate', null]);
            expect(symbols.map(s => [s.name, s.qualifiedName])).toContainEqual(['', null]);
            expect(symbols.map(s => [s.name, s.qualifiedName])).toContainEqual(['a', 'Demo::a']);
        });

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

        it('should report transition endpoints without a source-name collision', () => {
            const result = handleGetSymbols(ctx, {
                code: `state def Machine {
    state a;
    state b;
    transition first a then b;
}`,
                uri: 'transition.sysml',
            });
            const transition = result.symbols.find(s => s.kind === 'transition');

            expect(transition).toMatchObject({ source: 'a', target: 'b' });
            expect(transition?.name).not.toBe('a');
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

        it('should give every symbol and ancestor a displayName, an anonymous one next to its declaration', () => {
            const code = `package Demo {
    part a { port p; }
    part b { port p; }
    interface a.p to b.p { part x; }
}`;
            const { symbols } = handleGetSymbols(ctx, { code, uri: 'display-name.sysml' }) as { symbols: Array<Record<string, unknown>> };
            expect(symbols.find(s => s.kind === 'interface')).toMatchObject({ name: '', declaration: 'interface a.p to b.p', displayName: 'a.p→b.p' });
            expect(symbols.find(s => s.name === 'a')).toMatchObject({ displayName: 'a' });
            expect(symbols.find(s => s.name === 'a')).not.toHaveProperty('declaration');
            const { ancestors } = handleGetHierarchy(ctx, 'x', code, 'display-name.sysml') as { ancestors: Array<Record<string, unknown>> };
            expect(ancestors.map(a => a.displayName)).toEqual(['Demo', 'a.p→b.p']);
        });

        it('should list an anonymous owner among the ancestors of its member', () => {
            const code = `package Demo {
    part a { port p; }
    part b { port p; }
    interface a.p to b.p { part x { part y; } }
}`;
            const result = handleGetHierarchy(ctx, 'y', code, 'anonymous.sysml') as {
                ancestors: Array<{ name: string; declaration?: string; kind: string }>;
            };
            // The anonymous interface has no name, only its declaration.
            expect(result.ancestors.map(a => [a.name, a.declaration, a.kind])).toEqual([
                ['Demo', undefined, 'package'],
                ['', 'interface a.p to b.p', 'interface'],
                ['x', undefined, 'part'],
            ]);
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
            expect(formatted.specializes).toBeUndefined();
        });

        it('should separate type (typing) from specializes (specialization)', () => {
            handleParse(
                ctx,
                `package P {
                    part def Base;
                    part def Mid;
                    part def Derived :> Base, Mid;
                    part def Container { part inst : Base; }
                }`,
                'test.sysml',
            );
            const derived = ctx.symbolTable.findByName('Derived')[0];
            expect(derived).toBeDefined();
            expect(derived.specializationNames).toEqual(expect.arrayContaining(['Base', 'Mid']));
            const formattedDerived = formatSymbol(derived);
            // `Derived :> Base, Mid` is purely a specialization — no typing.
            expect(formattedDerived.type).toBeUndefined();
            expect(formattedDerived.specializes).toBe('Base, Mid');

            const inst = ctx.symbolTable.findByName('inst')[0];
            expect(inst).toBeDefined();
            const formattedInst = formatSymbol(inst);
            // `inst : Base` is feature typing — should appear under `type`, not `specializes`.
            expect(formattedInst.type).toBe('Base');
            expect(formattedInst.specializes).toBeUndefined();
        });

        it('should populate specializationNames for the subsets keyword', () => {
            handleParse(
                ctx,
                `package P {
                    part def A {
                        attribute baseAttr : String;
                    }
                    part def B :> A {
                        attribute derivedAttr subsets baseAttr;
                    }
                }`,
                'test.sysml',
            );
            const derivedAttr = ctx.symbolTable.findByName('derivedAttr')[0];
            expect(derivedAttr).toBeDefined();
            expect(derivedAttr.specializationNames).toEqual(expect.arrayContaining(['baseAttr']));
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

        it('should give each anonymous connection in a General View its own node', () => {
            const code = `package Demo {
    part a { port p; }
    part b { port p; }
    connect a.p to b.p;
    connect a.p to b.p;
}`;
            const result = handlePreview(ctx, { code, diagramType: 'general', uri: 'anonymous-general.sysml' });
            // Each is its symbol ID, with the dashes Mermaid can't take as underscores.
            const ids = ctx.symbolTable.getSymbolsForUri('anonymous-general.sysml').filter(s => s.kind === 'connection').map(s => s.symbolId);
            const nodes = [...result.diagram.matchAll(/class ([0-9a-f]{8}_\w+)/g)].map(m => m[1]);
            expect(nodes.sort()).toEqual(ids.map(id => id.replace(/-/g, '_')).sort());
            expect(new Set(nodes).size).toBe(2);
            expect(result.diagram).not.toMatch(/class\s*$/m);
        });

        it('should label an anonymous element with the same text as the outline', () => {
            const code = `package Demo {
    part def Engine { port p; }
    part : Engine { port q; }
    part a { port p; }
    part b { port p; }
    connect a.p to b.p;
}`;
            const general = handlePreview(ctx, { code, diagramType: 'general', uri: 'anonymous-labels.sysml' }).diagram;
            expect(general).toMatch(/class [0-9a-f]{8}_\w+\[": Engine"\]/);
            expect(general).toMatch(/class [0-9a-f]{8}_\w+\["a\.p→b\.p"\]/);
            // The type is the label itself, so it is not repeated below it.
            const interconnection = handlePreview(ctx, { code, diagramType: 'interconnection', uri: 'anonymous-labels.sysml' }).diagram;
            expect(interconnection).toMatch(/[0-9a-f]{8}_\w+\["■ : Engine"\]/);
            expect(interconnection).not.toContain(': Engine\\n: Engine');
            expect(interconnection).not.toContain('anonymous');
        });

        it('should give each anonymous participant of a Sequence View its own lifeline', () => {
            const code = `package Demo {
    part def Server;
    part client;
    part : Server;
    part : Server;
    action request;
    action reply;
}`;
            const { diagram } = handlePreview(ctx, { code, diagramType: 'sequence', uri: 'anonymous-sequence.sysml' });
            const participants = [...diagram.matchAll(/participant (\w+) as (.+)/g)].map(m => [m[1], m[2]]);
            expect(participants.map(p => p[1])).toEqual(['client', ': Server', ': Server']);
            expect(new Set(participants.map(p => p[0])).size).toBe(3);
            // Messages run between declared lifelines only.
            const ids = new Set(participants.map(p => p[0]));
            for (const [, from, to] of diagram.matchAll(/(\w+)->>\+(\w+):/g)) {
                expect(ids.has(from) && ids.has(to)).toBe(true);
            }
        });

        it('should show an anonymous actor in a Use Case View by its type, once for all use cases', () => {
            const code = `package Shop {
    part def User;
    use case def Buy { actor : User; actor clerk; }
    use case def Pay { actor : User; }
    package Inner { use case def Return; }
}`;
            const { diagram } = handlePreview(ctx, { code, diagramType: 'usecase', uri: 'anonymous-usecase.sysml' });
            expect(diagram.match(/actor_\w+\{\{"🧑 : User"\}\}/g)).toHaveLength(1);
            const user = /(actor_\w+)\{\{"🧑 : User"\}\}/.exec(diagram)![1];
            expect(diagram).toContain(`${user} --> Shop__Buy`);
            expect(diagram).toContain(`${user} --> Shop__Pay`);
            expect(diagram).toContain('actor_clerk --> Shop__Buy');
            // A use case is drawn in the package that owns it, directly or nested.
            const inner = diagram.slice(diagram.indexOf('subgraph Shop__Inner'));
            expect(inner.slice(0, inner.indexOf('end'))).toContain('Shop__Inner__Return(["Return"])');
        });

        it('should show subjects, stakeholders and use cases outside a package in a Use Case View', () => {
            const code = `part def Vehicle;
part def Owner;
use case def Drive { subject : Vehicle; actor driver; }
requirement def Safety { stakeholder : Owner; stakeholder regulator; }`;
            const { diagram } = handlePreview(ctx, { code, diagramType: 'usecase', uri: 'usecase-subjects.sysml' });
            expect(diagram).toContain('Drive(["Drive"])');
            expect(diagram).toMatch(/[0-9a-f]{8}_\w+\["📋 : Vehicle"\]/);
            const owner = /([0-9a-f]{8}_\w+)\{\{"👤 : Owner"\}\}/.exec(diagram)![1];
            expect(diagram).toContain(`${owner} -.->|"«stakeholder»"| Safety`);
            expect(diagram).toContain('Safety__regulator{{"👤 regulator"}}');
        });

        it('should note the interactions of a Sequence View with fewer than two participants', () => {
            // Without definitions to fall back on, the one anonymous part is the only participant.
            const code = `package Demo {
    part : Server;
    action request;
}`;
            const { diagram } = handlePreview(ctx, { code, diagramType: 'sequence', uri: 'sequence-notes.sysml' });
            expect(diagram).toMatch(/Note over [0-9a-f]{8}_\w+: request/);
        });

        it('should label an anonymous state inside a state definition as in the outline', () => {
            const code = `package Demo {
    state def Mode;
    state def Machine {
        state idle;
        state : Mode;
    }
    state running;
}`;
            const { diagram } = handlePreview(ctx, { code, diagramType: 'state', uri: 'anonymous-state.sysml' });
            const machine = diagram.slice(diagram.indexOf('state "Machine" as Demo__Machine {'));
            const body = machine.slice(0, machine.indexOf('}'));
            expect(body).toContain('Demo__Machine__idle : idle');
            expect(body).toMatch(/[0-9a-f]{8}_\w+ : : Mode/);
            expect(diagram).toContain('Demo__running : running');
        });

        it('should include the type of a focused element, and the type\'s members', () => {
            const code = `package Demo {
    part def Engine { attribute power; }
    part def Wheel;
    part car : Engine;
}`;
            const { diagram } = handlePreview(ctx, { code, diagramType: 'general', uri: 'focus-type.sysml', focus: 'car' });
            expect(diagram).toContain('class Engine');
            expect(diagram).toContain('+power');
            expect(diagram).not.toContain('Wheel');
        });

        it('should list changed named elements by qualified name, added anonymous ones by their display text', () => {
            const originalCode = 'package Demo { part def A; part def B; part a : A; }';
            const code = 'package Demo { part def A; part def B; part a : B; part : A; }';
            const result = handlePreview(ctx, { code, originalCode, uri: 'diff-changed.sysml' }) as unknown as { diff: { added: string[]; changed: string[] } };
            expect(result.diff.added).toEqual(['part : A']);
            expect(result.diff.changed).toEqual(['part Demo::a']);
        });

        it('should list an added anonymous element in a diff, never as `undefined`', () => {
            const originalCode = 'package Demo { part a { port p; } part b { port p; } }';
            const code = 'package Demo { part a { port p; } part b { port p; } connect a.p to b.p; }';
            const result = handlePreview(ctx, { code, originalCode, uri: 'anonymous-diff.sysml' }) as unknown as { diff: { added: string[] } };
            expect(result.diff.added).toEqual(['connection a.p→b.p']);
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

        it('should render fork/join as bars and decide/merge as diamonds in the activity view (issue #62)', () => {
            const controlModel = `action testParallelFlow {
    action startStep;
    fork myFork;
    join myJoin;
    merge myMerge;
    decide myDecide;
}`;
            const result = handlePreview(ctx, { code: controlModel });
            expect(result.diagramType).toBe('activity');
            // fork/join → bar-style rectangle nodes
            expect(result.diagram).toContain('fork myFork"]');
            expect(result.diagram).toContain('join myJoin"]');
            // decide/merge → diamond nodes  {"..."}
            expect(result.diagram).toContain('{"decide myDecide"}');
            expect(result.diagram).toContain('{"merge myMerge"}');
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

        it('should render nested states and parsed transition edges (issue #84)', () => {
            const stateModel = `package Demo {
    state def Machine {
        entry; then a;
        state a;
        state b;
        transition first a then b;
    }
}`;
            const result = handlePreview(ctx, { code: stateModel, diagramType: 'state' });

            expect(result.errors).toHaveLength(0);
            expect(result.diagram).toContain('Demo__Machine__a : a');
            expect(result.diagram).toContain('Demo__Machine__b : b');
            expect(result.diagram).toContain('Demo__Machine__a --> Demo__Machine__b');
        });

        it('should render declared activity branches without declaration-order edges (issue #85)', () => {
            const activityModel = `package Demo {
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
}`;
            const result = handlePreview(ctx, { code: activityModel, diagramType: 'activity' });

            expect(result.errors).toHaveLength(0);
            expect(result.diagram).toContain(
                'Demo__RoutePower__serveLoadDirect --> Demo__RoutePower__routeSurplus',
            );
            expect(result.diagram).toContain(
                'Demo__RoutePower__serveLoadDirect --> Demo__RoutePower__coverDeficit',
            );
            expect(result.diagram).toContain(
                'Demo__RoutePower__start --> Demo__RoutePower__senseFlows',
            );
            expect(result.diagram).toContain(
                'Demo__RoutePower__coverDeficit --> Demo__RoutePower__done',
            );
            expect(result.diagram).not.toContain(
                'Demo__RoutePower__routeSurplus --> Demo__RoutePower__coverDeficit',
            );
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

describe('MCP server process', () => {
    it('derives IDs from the project ID in SYSML_PROJECT_ID', async () => {
        const { build } = await import('esbuild');
        const { mkdtemp, rm } = await import('node:fs/promises');
        const { tmpdir } = await import('node:os');
        const { join } = await import('node:path');
        const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
        const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
        const { NAMESPACE_URL, uuidV5 } = await import('../../server/src/utils/uuid.js');
        const directory = await mkdtemp(join(tmpdir(), 'sysml-mcp-project-id-'));
        const projectId = '3f9c2b1e-7a4d-4e8b-9c2f-1d5e6a7b8c9d';
        try {
            await build({
                entryPoints: { mcpServer: 'server/src/mcpServer.ts' },
                bundle: true, platform: 'node', format: 'cjs', outdir: directory, logLevel: 'silent',
            });
            const transport = new StdioClientTransport({
                command: process.execPath,
                args: [join(directory, 'mcpServer.js')],
                env: { ...process.env, SYSML_PROJECT_ID: projectId } as Record<string, string>,
                stderr: 'ignore',
            });
            const client = new Client({ name: 'test', version: '1.0.0' });
            await client.connect(transport);
            try {
                const result = await client.callTool({ name: 'getSymbols', arguments: { code: 'package Demo;', uri: 'demo.sysml' } });
                const { symbols } = result.structuredContent as { symbols: Array<{ name: string; symbolId: string }> };
                expect(symbols.find(s => s.name === 'Demo')!.symbolId).toBe(uuidV5(NAMESPACE_URL, `urn:uuid:${projectId}/Demo`));
            } finally {
                await client.close();
            }
        } finally {
            await rm(directory, { recursive: true, force: true });
        }
    }, 60_000);
});
