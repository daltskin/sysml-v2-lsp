/**
 * SysML v2 MCP Server — Core Logic
 *
 * Pure functions and stateful helpers used by the MCP tool/resource/prompt
 * handlers.  Extracted from mcpServer.ts so they can be unit-tested without
 * spinning up a transport.
 */

import type { Diagnostic } from 'vscode-languageserver/node.js';
import type { ComplexityReport } from './analysis/complexityAnalyzer.js';
import { analyseComplexity } from './analysis/complexityAnalyzer.js';
import type { DiagramType } from './mcp/mermaidGenerator.js';
import { diffSymbols, generateMermaidDiagram } from './mcp/mermaidGenerator.js';
import type { SyntaxError } from './parser/errorListener.js';
import { parseDocument } from './parser/parseDocument.js';
import { SemanticValidator } from './providers/semanticValidator.js';
import { SymbolTable } from './symbols/symbolTable.js';
import type { SysMLSymbol } from './symbols/sysmlElements.js';
import { SysMLElementKind, isDefinition, isUsage } from './symbols/sysmlElements.js';
import { SYSML_KEYWORDS_ARRAY as SYSML_KEYWORDS } from './utils/sysmlKeywords.js';
export { SYSML_KEYWORDS_ARRAY as SYSML_KEYWORDS } from './utils/sysmlKeywords.js';

// ---------------------------------------------------------------------------
// State container — one per MCP session
// ---------------------------------------------------------------------------

export class McpContext {
    readonly symbolTable = new SymbolTable();
    readonly loadedDocuments = new Map<string, string>();
    readonly loadedDocumentHashes = new Map<string, number>();
    readonly lastParseErrors = new Map<string, SyntaxError[]>();
    readonly lastParseTiming = new Map<string, { lex: number; parse: number }>();
}

function hashTextFNV1a(text: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

/**
 * Ensure a document is parsed and its symbols are available.
 *
 * If `code` is provided, parse it immediately (storing the result in ctx).
 * If `code` is omitted, check whether the symbol table already has symbols
 * for the given URI.  If not — but the source was previously loaded —
 * re-parse from the cached source.
 *
 * This makes every query tool self-contained: callers can pass `code`
 * directly instead of having to call `parse` first.
 */
export function ensureParsed(ctx: McpContext, uri: string, code?: string): void {
    if (code !== undefined) {
        parseAndBuild(ctx, code, uri);
        return;
    }
    // No code supplied — re-parse from cache if the symbol table is empty for this URI
    const symbols = ctx.symbolTable.getSymbolsForUri(uri);
    if (symbols.length === 0) {
        const cached = ctx.loadedDocuments.get(uri);
        if (cached) {
            parseAndBuild(ctx, cached, uri);
        }
    }
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatSymbol(sym: SysMLSymbol): Record<string, unknown> {
    return {
        name: sym.name,
        kind: sym.kind,
        qualifiedName: sym.qualifiedName,
        ...(sym.typeNames.length > 0 ? { type: sym.typeNames.join(', ') } : {}),
        ...(sym.documentation ? { documentation: sym.documentation } : {}),
        ...(sym.parentQualifiedName ? { parent: sym.parentQualifiedName } : {}),
        ...(sym.children.length > 0 ? { children: sym.children } : {}),
        location: {
            uri: sym.uri,
            range: sym.range,
        },
    };
}

export function formatError(err: SyntaxError): Record<string, unknown> {
    return {
        line: err.line + 1,
        column: err.column + 1,
        message: err.message,
        length: err.length,
    };
}

// ---------------------------------------------------------------------------
// Core operations — each returns the JSON-serialisable result object
// ---------------------------------------------------------------------------

export function parseAndBuild(
    ctx: McpContext,
    text: string,
    uri: string,
): { errors: SyntaxError[]; symbolCount: number; timingMs: { lex: number; parse: number } } {
    const hash = hashTextFNV1a(text);
    const prevHash = ctx.loadedDocumentHashes.get(uri);
    const currentSymbolCount = ctx.symbolTable.getSymbolsForUri(uri).length;
    const cachedErrors = ctx.lastParseErrors.get(uri) ?? [];
    const canReuseCachedParse = currentSymbolCount > 0 || cachedErrors.length > 0;
    if (prevHash === hash && ctx.lastParseTiming.has(uri) && canReuseCachedParse) {
        return {
            errors: cachedErrors,
            symbolCount: currentSymbolCount,
            timingMs: ctx.lastParseTiming.get(uri) ?? { lex: 0, parse: 0 },
        };
    }

    const result = parseDocument(text);
    ctx.symbolTable.build(uri, result);
    ctx.loadedDocuments.set(uri, text);
    ctx.loadedDocumentHashes.set(uri, hash);
    ctx.lastParseErrors.set(uri, result.errors);
    const timing = { lex: result.timing.lexMs, parse: result.timing.parseMs };
    ctx.lastParseTiming.set(uri, timing);

    return {
        errors: result.errors,
        symbolCount: ctx.symbolTable.getSymbolsForUri(uri).length,
        timingMs: timing,
    };
}

export function handleParse(
    ctx: McpContext,
    code: string,
    uri?: string,
): Record<string, unknown> {
    const docUri = uri ?? 'untitled.sysml';
    const { errors, symbolCount, timingMs } = parseAndBuild(ctx, code, docUri);

    const summary: Record<string, unknown> = {
        uri: docUri,
        symbolCount,
        errorCount: errors.length,
        timing: timingMs,
    };

    if (errors.length > 0) {
        summary.errors = errors.map(formatError);
    }

    const allSymbols = ctx.symbolTable.getSymbolsForUri(docUri);
    const topLevel = allSymbols
        .filter((s) => !s.parentQualifiedName)
        .map((s) => `${s.kind} ${s.qualifiedName}`);
    if (topLevel.length > 0) {
        summary.topLevelElements = topLevel;
    }

    return summary;
}

// ---------------------------------------------------------------------------
// Preview — parse SysML code and generate a Mermaid diagram
// ---------------------------------------------------------------------------

export interface PreviewOptions {
    /** SysML source code to preview */
    code: string;
    /** Optional original code for diff highlighting */
    originalCode?: string;
    /** Force a specific diagram type (auto-detected if omitted) */
    diagramType?: DiagramType;
    /** Focus on a specific element by name (renders only its neighbourhood) */
    focus?: string;
    /** Document URI (defaults to 'preview.sysml') */
    uri?: string;
}

export interface PreviewResult {
    /** The Mermaid diagram markup */
    diagram: string;
    /** The diagram type used */
    diagramType: DiagramType;
    /** Human-readable description */
    description: string;
    /** Number of elements rendered */
    elementCount: number;
    /** Syntax errors in the code */
    errors: ReturnType<typeof formatError>[];
    /** Diff summary (only when originalCode is provided) */
    diff?: {
        added: string[];
        changed: string[];
        removed: string[];
        unchangedCount: number;
    };
    /** Semantic issues (warnings/errors) */
    semanticIssues?: Record<string, unknown>[];
}

export function handlePreview(
    ctx: McpContext,
    opts: PreviewOptions,
): PreviewResult {
    const docUri = opts.uri ?? 'preview.sysml';
    const { errors } = parseAndBuild(ctx, opts.code, docUri);

    const allSymbols = ctx.symbolTable.getSymbolsForUri(docUri);

    // Optional semantic validation
    const allNames = new Set(ctx.symbolTable.getAllSymbols().map(s => s.name));
    const semanticDiags = SemanticValidator.validateSymbols(allSymbols, allNames, {
        allSymbols: ctx.symbolTable.getAllSymbols(),
        text: opts.code,
        uri: docUri,
    });

    // Determine which symbols to render
    let renderSymbols = allSymbols;

    // Focus mode: filter to the targeted element and its children/related types
    if (opts.focus) {
        const focusName = opts.focus;
        const focusSet = new Set<string>();

        // Build parent→children index (sym.children is not populated by parser)
        const childrenOf = new Map<string, SysMLSymbol[]>();
        for (const s of allSymbols) {
            if (s.parentQualifiedName) {
                const list = childrenOf.get(s.parentQualifiedName) ?? [];
                list.push(s);
                childrenOf.set(s.parentQualifiedName, list);
            }
        }

        // Find the focused element(s) by name or qualified name
        const focused = allSymbols.filter(s =>
            s.name === focusName
            || s.qualifiedName === focusName
            || s.qualifiedName.endsWith(`::${focusName}`)
        );

        for (const f of focused) {
            focusSet.add(f.qualifiedName);
            // Include children via parentQualifiedName index
            const children = childrenOf.get(f.qualifiedName) ?? [];
            for (const child of children) {
                focusSet.add(child.qualifiedName);
            }
            // Include parent
            if (f.parentQualifiedName) {
                focusSet.add(f.parentQualifiedName);
            }
            // Include typed elements referenced by the focused element or its children
            const typeSource = [...f.typeNames];
            for (const child of children) {
                typeSource.push(...child.typeNames);
            }
            for (const tn of typeSource) {
                const typed = allSymbols.find(s => s.name === tn || s.qualifiedName === tn);
                if (typed) {
                    focusSet.add(typed.qualifiedName);
                    // Include children of the type definition too
                    for (const child of (childrenOf.get(typed.qualifiedName) ?? [])) {
                        focusSet.add(child.qualifiedName);
                    }
                }
            }
        }

        if (focusSet.size > 0) {
            renderSymbols = allSymbols.filter(s => focusSet.has(s.qualifiedName));
        }
    }

    // Generate the Mermaid diagram
    const mermaid = generateMermaidDiagram(renderSymbols, allSymbols, opts.diagramType);

    const result: PreviewResult = {
        diagram: mermaid.diagram,
        diagramType: mermaid.diagramType,
        description: mermaid.description,
        elementCount: mermaid.elementCount,
        errors: errors.map(formatError),
    };

    // Diff mode: compare original and modified
    if (opts.originalCode) {
        const origUri = 'preview-original.sysml';
        const origResult = parseDocument(opts.originalCode);
        const origTable = new SymbolTable();
        origTable.build(origUri, origResult);
        const origSymbols = origTable.getSymbolsForUri(origUri);

        const diff = diffSymbols(origSymbols, allSymbols);
        result.diff = {
            added: diff.added.map(s => `${s.kind} ${s.qualifiedName}`),
            changed: diff.changed.map(s => `${s.kind} ${s.qualifiedName}`),
            removed: diff.removed,
            unchangedCount: diff.unchanged.length,
        };
    }

    // Include semantic issues if any are non-trivial
    if (semanticDiags.length > 0) {
        result.semanticIssues = semanticDiags.map((d: Diagnostic) => ({
            line: d.range.start.line + 1,
            column: d.range.start.character + 1,
            message: d.message,
            severity: d.severity === 1 ? 'error' : d.severity === 2 ? 'warning' : 'info',
        }));
    }

    return result;
}

export function handleValidate(
    ctx: McpContext,
    code: string,
    uri?: string,
): { valid: boolean; syntaxErrors: Record<string, unknown>[]; semanticIssues: Record<string, unknown>[]; totalIssues: number } {
    const docUri = uri ?? 'untitled.sysml';
    const { errors } = parseAndBuild(ctx, code, docUri);

    // Run semantic validation on the built symbol table
    const symbols = ctx.symbolTable.getSymbolsForUri(docUri);
    const allNames = new Set(ctx.symbolTable.getAllSymbols().map(s => s.name));
    const semanticDiags = SemanticValidator.validateSymbols(symbols, allNames, {
        allSymbols: ctx.symbolTable.getAllSymbols(),
        text: code,
        uri: docUri,
    });

    const semanticIssues = semanticDiags.map((d: Diagnostic) => ({
        line: d.range.start.line + 1,
        column: d.range.start.character + 1,
        message: d.message,
        severity: d.severity === 1 ? 'error' : d.severity === 2 ? 'warning' : d.severity === 3 ? 'info' : 'hint',
        code: d.code,
    }));

    return {
        valid: errors.length === 0 && semanticDiags.filter((d: Diagnostic) => d.severity === 1).length === 0,
        syntaxErrors: errors.map(formatError),
        semanticIssues,
        totalIssues: errors.length + semanticDiags.length,
    };
}

export function handleGetDiagnostics(
    ctx: McpContext,
    uri?: string,
    code?: string,
): { uri: string; diagnostics: Record<string, unknown>[]; summary: Record<string, number> } {
    const docUri = uri ?? 'untitled.sysml';
    ensureParsed(ctx, docUri, code);
    const symbols = ctx.symbolTable.getSymbolsForUri(docUri);
    const allNames = new Set(ctx.symbolTable.getAllSymbols().map(s => s.name));
    const diags = SemanticValidator.validateSymbols(symbols, allNames, {
        allSymbols: ctx.symbolTable.getAllSymbols(),
        text: code ?? ctx.loadedDocuments.get(docUri),
        uri: docUri,
    });

    const summary: Record<string, number> = {};
    for (const d of diags) {
        const code = String(d.code ?? 'unknown');
        summary[code] = (summary[code] ?? 0) + 1;
    }

    return {
        uri: docUri,
        diagnostics: diags.map((d: Diagnostic) => ({
            line: d.range.start.line + 1,
            column: d.range.start.character + 1,
            message: d.message,
            severity: d.severity === 1 ? 'error' : d.severity === 2 ? 'warning' : d.severity === 3 ? 'info' : 'hint',
            code: d.code,
        })),
        summary,
    };
}

export function handleGetSymbols(
    ctx: McpContext,
    opts: { kind?: string; uri?: string; definitionsOnly?: boolean; usagesOnly?: boolean; code?: string },
): { count: number; symbols: Record<string, unknown>[] } {
    if (opts.code) {
        const docUri = opts.uri ?? 'untitled.sysml';
        ensureParsed(ctx, docUri, opts.code);
    }
    let symbols = opts.uri
        ? ctx.symbolTable.getSymbolsForUri(opts.uri)
        : ctx.symbolTable.getAllSymbols();

    if (opts.kind) {
        symbols = symbols.filter((s) => s.kind.toLowerCase() === opts.kind!.toLowerCase());
    }
    if (opts.definitionsOnly) {
        symbols = symbols.filter((s) => isDefinition(s.kind));
    }
    if (opts.usagesOnly) {
        symbols = symbols.filter((s) => isUsage(s.kind));
    }

    return { count: symbols.length, symbols: symbols.map(formatSymbol) };
}

export function handleGetDefinition(
    ctx: McpContext,
    name: string,
    code?: string,
    uri?: string,
): Record<string, unknown> {
    if (code) {
        ensureParsed(ctx, uri ?? 'untitled.sysml', code);
    }
    const exact = ctx.symbolTable.getSymbol(name);
    if (exact) {
        return formatSymbol(exact);
    }

    const matches = ctx.symbolTable.findByName(name);
    if (matches.length === 0) {
        return { found: false, message: `No symbol found with name "${name}"` };
    }
    return { found: true, count: matches.length, symbols: matches.map(formatSymbol) };
}

export function handleGetReferences(
    ctx: McpContext,
    name: string,
    code?: string,
    uri?: string,
): { name: string; referenceCount: number; references: Record<string, unknown>[] } {
    if (code) {
        ensureParsed(ctx, uri ?? 'untitled.sysml', code);
    }
    const refs = ctx.symbolTable.findReferences(name);
    return { name, referenceCount: refs.length, references: refs.map(formatSymbol) };
}

export function handleGetHierarchy(
    ctx: McpContext,
    name: string,
    code?: string,
    uri?: string,
): Record<string, unknown> {
    if (code) {
        ensureParsed(ctx, uri ?? 'untitled.sysml', code);
    }
    const exact = ctx.symbolTable.getSymbol(name);
    const target = exact ?? ctx.symbolTable.findByName(name)[0];

    if (!target) {
        return { found: false, message: `No symbol "${name}" found` };
    }

    const ancestors: Array<{ name: string; kind: string; qualifiedName: string }> = [];
    let current = target.parentQualifiedName;
    while (current) {
        const parent = ctx.symbolTable.getSymbol(current);
        if (!parent) break;
        ancestors.unshift({ name: parent.name, kind: parent.kind, qualifiedName: parent.qualifiedName });
        current = parent.parentQualifiedName;
    }

    const children = target.children
        .map((qn) => ctx.symbolTable.getSymbol(qn))
        .filter((s): s is SysMLSymbol => s !== undefined)
        .map((s) => ({
            name: s.name,
            kind: s.kind,
            qualifiedName: s.qualifiedName,
            ...(s.typeNames.length > 0 ? { type: s.typeNames.join(', ') } : {}),
        }));

    return {
        element: {
            name: target.name,
            kind: target.kind,
            qualifiedName: target.qualifiedName,
            ...(target.typeNames.length > 0 ? { type: target.typeNames.join(', ') } : {}),
        },
        ancestors,
        children,
    };
}

export function handleGetModelSummary(
    ctx: McpContext,
    code?: string,
    uri?: string,
): Record<string, unknown> {
    if (code) {
        ensureParsed(ctx, uri ?? 'untitled.sysml', code);
    }
    const allSymbols = ctx.symbolTable.getAllSymbols();
    const kindCounts: Record<string, number> = {};
    for (const sym of allSymbols) {
        kindCounts[sym.kind] = (kindCounts[sym.kind] ?? 0) + 1;
    }
    const sorted = Object.entries(kindCounts).sort(([, a], [, b]) => b - a);
    return {
        totalSymbols: allSymbols.length,
        loadedDocuments: Array.from(ctx.loadedDocuments.keys()),
        elementsByKind: Object.fromEntries(sorted),
        definitions: allSymbols.filter((s) => isDefinition(s.kind)).length,
        usages: allSymbols.filter((s) => isUsage(s.kind)).length,
    };
}

// ---------------------------------------------------------------------------
// Complexity analysis handler
// ---------------------------------------------------------------------------

export function handleGetComplexity(
    ctx: McpContext,
    uri?: string,
    code?: string,
): ComplexityReport {
    if (code) {
        ensureParsed(ctx, uri ?? 'untitled.sysml', code);
    }
    const symbols = uri
        ? ctx.symbolTable.getSymbolsForUri(uri)
        : ctx.symbolTable.getAllSymbols();
    return analyseComplexity(symbols);
}

// ---------------------------------------------------------------------------
// Resource data helpers
// ---------------------------------------------------------------------------

export function getElementKinds(): { definitions: string[]; usages: string[]; other: string[]; total: number } {
    const kinds = Object.values(SysMLElementKind);
    return {
        definitions: kinds.filter((k) => isDefinition(k)),
        usages: kinds.filter((k) => isUsage(k)),
        other: kinds.filter((k) => !isDefinition(k) && !isUsage(k)),
        total: kinds.length,
    };
}

export function handleResourceElementKinds(): Record<string, unknown> {
    return getElementKinds();
}

export function handleResourceKeywords(): { keywords: readonly string[]; count: number } {
    return { keywords: SYSML_KEYWORDS, count: SYSML_KEYWORDS.length };
}

export function handleResourceGrammarOverview(): string {
    return `# SysML v2 Grammar Overview

## Element Categories

### Definitions (Types)
Definitions declare reusable types:
- \`part def\` — structural element type
- \`attribute def\` — value type
- \`port def\` — interface point type
- \`connection def\` — connection type
- \`interface def\` — interface type
- \`action def\` — behavior type
- \`state def\` — state machine type
- \`requirement def\` — requirement type
- \`constraint def\` — constraint type
- \`item def\` — general item type
- \`enum def\` — enumeration type
- \`calc def\` — calculation type
- \`use case def\` — use case type
- \`allocation def\` — allocation type
- \`view def\` / \`viewpoint def\` — viewpoint types

### Usages (Instances)
Usages create instances of definitions:
- \`part\` — structural instance
- \`attribute\` — value instance
- \`port\` — port instance
- \`action\` — action step
- \`state\` — state instance
- \`requirement\` — requirement instance
- \`item\` — item instance

## Specialisation Syntax
- \`part car : Vehicle\` — \`car\` specialises \`Vehicle\`
- \`part car :> baseVehicle\` — \`car\` subsets \`baseVehicle\`
- \`part car :>> specificVehicle\` — \`car\` redefines \`specificVehicle\`

## Packages & Namespaces
\`\`\`sysml
package VehicleModel {
    part def Vehicle { ... }
    part car : Vehicle;
}
\`\`\`

## Documentation
\`\`\`sysml
part def Vehicle {
    doc /* A general vehicle definition */
    attribute mass : Real;
}
\`\`\`

## Unrestricted Names
Names with spaces use single quotes: \`part 'Main Assembly' : Assembly;\`
`;
}

// ---------------------------------------------------------------------------
// Prompt handlers
// ---------------------------------------------------------------------------

export function handlePromptReviewSysml(
    ctx: McpContext,
    code: string,
): { role: 'user'; content: { type: 'text'; text: string } }[] {
    const { errors, symbolCount } = parseAndBuild(ctx, code, 'review.sysml');
    const allSymbols = ctx.symbolTable.getSymbolsForUri('review.sysml');
    const defs = allSymbols.filter((s) => isDefinition(s.kind));
    const usages = allSymbols.filter((s) => isUsage(s.kind));

    const context = [
        `Parsed: ${symbolCount} symbols, ${errors.length} syntax errors`,
        `Definitions: ${defs.map((d) => `${d.kind} ${d.name}`).join(', ') || 'none'}`,
        `Usages: ${usages.map((u) => `${u.kind} ${u.name}`).join(', ') || 'none'}`,
    ];
    if (errors.length > 0) {
        context.push(`Errors: ${errors.map((e) => `line ${e.line + 1}: ${e.message}`).join('; ')}`);
    }

    return [{
        role: 'user' as const,
        content: {
            type: 'text' as const,
            text: `Please review the following SysML v2 model for correctness, completeness, and best practices.

## Parse Results
${context.join('\n')}

## Source Code
\`\`\`sysml
${code}
\`\`\`

Please check for:
1. Syntax errors and how to fix them
2. Missing type specialisations
3. Naming conventions (PascalCase for definitions, camelCase for usages)
4. Missing documentation (doc comments)
5. Structural completeness (are there orphaned usages without definitions?)
6. Suggestions for additional ports, attributes, or constraints`,
        },
    }];
}

export function handlePromptExplainElement(
    element: string,
): { role: 'user'; content: { type: 'text'; text: string } }[] {
    return [{
        role: 'user' as const,
        content: {
            type: 'text' as const,
            text: `Explain the SysML v2 element kind "${element}" in detail. Include:

1. What it represents in systems engineering
2. The difference between its definition form and usage form (if applicable)
3. Common attributes and relationships
4. A simple SysML v2 code example
5. When to use it vs similar elements

Use the SysML v2 syntax (not SysML v1 block diagrams).`,
        },
    }];
}

export function handlePromptGenerateSysml(
    description: string,
    scope?: string,
): { role: 'user'; content: { type: 'text'; text: string } }[] {
    const scopeHint = scope
        ? `Focus on: ${scope}`
        : 'Include structural definitions, key attributes, ports, and connections.';

    return [{
        role: 'user' as const,
        content: {
            type: 'text' as const,
            text: `Generate a SysML v2 model for the following system description.

## System Description
${description}

## Scope
${scopeHint}

## Requirements
- Use valid SysML v2 syntax
- Organise elements in packages
- Use PascalCase for definitions, camelCase for usages
- Add doc comments for key elements
- Include type specialisations where appropriate
- Use ports and connections for interfaces between parts

Return the complete SysML v2 source code in a single code block.`,
        },
    }];
}
