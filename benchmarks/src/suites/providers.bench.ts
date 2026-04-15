/**
 * Provider benchmark suite — measures LSP provider response latency.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from '../../../server/src/documentManager.js';
import { DiagnosticsProvider } from '../../../server/src/providers/diagnosticsProvider.js';
import { HoverProvider } from '../../../server/src/providers/hoverProvider.js';
import { CompletionProvider } from '../../../server/src/providers/completionProvider.js';
import { DefinitionProvider } from '../../../server/src/providers/definitionProvider.js';
import { ReferencesProvider } from '../../../server/src/providers/referencesProvider.js';
import { DocumentSymbolProvider } from '../../../server/src/providers/documentSymbolProvider.js';
import { SemanticTokensProvider } from '../../../server/src/providers/semanticTokensProvider.js';
import { RenameProvider } from '../../../server/src/providers/renameProvider.js';
import { CodeActionProvider } from '../../../server/src/providers/codeActionProvider.js';
import { benchmarkFn, type BenchmarkResult, type BenchmarkOptions } from '../utils/harness.js';
import type { SuiteReport } from '../reporters/jsonReporter.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');

function loadBikeFile(): { uri: string; text: string; lines: string[] } {
    const p = path.join(ROOT, 'examples/bike.sysml');
    const text = fs.readFileSync(p, 'utf-8');
    return { uri: 'file:///bike.sysml', text, lines: text.split('\n') };
}

/** Find a line index containing a given substring. */
function findLine(lines: string[], substring: string): number {
    const idx = lines.findIndex(l => l.includes(substring));
    return idx >= 0 ? idx : 0;
}

/** Find the column of a substring within a line. */
function findCol(line: string, substring: string): number {
    const idx = line.indexOf(substring);
    return idx >= 0 ? idx : 0;
}

export function runProviderSuite(opts: BenchmarkOptions = {}): SuiteReport {
    const { uri, text, lines } = loadBikeFile();
    const results: BenchmarkResult[] = [];

    // Pre-parse once — providers operate on cached data
    const dm = new DocumentManager();
    const doc = TextDocument.create(uri, 'sysml', 1, text);
    dm.parse(doc);
    // Pre-build symbol table so we measure provider logic, not first-build cost
    dm.getSymbolTable(uri);

    // Find representative positions in bike.sysml
    const partDefLine = findLine(lines, 'part def');
    const partDefCol = findCol(lines[partDefLine] ?? '', 'part def') + 9;
    const attributeLine = findLine(lines, 'attribute');
    const midLine = Math.floor(lines.length / 2);
    const endLine = lines.length - 2;

    const positions = [
        { label: 'top', line: partDefLine, character: partDefCol },
        { label: 'mid', line: midLine, character: 4 },
        { label: 'end', line: endLine, character: 4 },
    ];

    // ── Diagnostics ──
    const diagProvider = new DiagnosticsProvider(dm);
    results.push(benchmarkFn('diagnostics', () => {
        const diags = diagProvider.getDiagnostics(uri);
        return { count: diags.length };
    }, opts));

    // ── Document Symbols ──
    const symbolProvider = new DocumentSymbolProvider(dm);
    results.push(benchmarkFn('documentSymbols', () => {
        const syms = symbolProvider.provideDocumentSymbols({ textDocument: { uri } });
        return { count: syms.length };
    }, opts));

    // ── Semantic Tokens ──
    const tokenProvider = new SemanticTokensProvider(dm);
    results.push(benchmarkFn('semanticTokens', () => {
        const tokens = tokenProvider.provideSemanticTokens({ textDocument: { uri } });
        return { dataLength: tokens.data.length };
    }, opts));

    // ── Hover (at multiple positions) ──
    const hoverProvider = new HoverProvider(dm);
    for (const pos of positions) {
        results.push(benchmarkFn(`hover/${pos.label}`, () => {
            const hover = hoverProvider.provideHover({
                textDocument: { uri },
                position: { line: pos.line, character: pos.character },
            });
            return { hasResult: hover !== null };
        }, opts));
    }

    // ── Completions (at multiple positions) ──
    const completionProvider = new CompletionProvider(dm);
    for (const pos of positions) {
        results.push(benchmarkFn(`completion/${pos.label}`, () => {
            const items = completionProvider.provideCompletions({
                textDocument: { uri },
                position: { line: pos.line, character: pos.character },
            });
            return { count: items.length };
        }, opts));
    }

    // ── Go to Definition ──
    const defProvider = new DefinitionProvider(dm);
    results.push(benchmarkFn('definition', () => {
        const loc = defProvider.provideDefinition({
            textDocument: { uri },
            position: { line: attributeLine, character: findCol(lines[attributeLine] ?? '', 'attribute') + 5 },
        });
        return { hasResult: loc !== null };
    }, opts));

    // ── References ──
    const refProvider = new ReferencesProvider(dm);
    results.push(benchmarkFn('references', () => {
        const locs = refProvider.provideReferences({
            textDocument: { uri },
            position: { line: partDefLine, character: partDefCol },
            context: { includeDeclaration: true },
        });
        return { count: locs.length };
    }, opts));

    // ── Rename (prepare) ──
    const renameProvider = new RenameProvider(dm);
    results.push(benchmarkFn('rename/prepare', () => {
        const range = renameProvider.prepareRename({
            textDocument: { uri },
            position: { line: partDefLine, character: partDefCol },
        });
        return { hasResult: range !== null };
    }, opts));

    // ── Code Actions ──
    const codeActionProvider = new CodeActionProvider(dm);
    const diagsForActions = diagProvider.getDiagnostics(uri);
    if (diagsForActions.length > 0) {
        results.push(benchmarkFn('codeActions', () => {
            const actions = codeActionProvider.provideCodeActions({
                textDocument: { uri },
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 10 },
                },
                context: { diagnostics: diagsForActions },
            });
            return { count: actions.length };
        }, opts));
    } else {
        // No diagnostics to trigger code actions — benchmark with empty context
        results.push(benchmarkFn('codeActions', () => {
            const actions = codeActionProvider.provideCodeActions({
                textDocument: { uri },
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 10 },
                },
                context: { diagnostics: [] },
            });
            return { count: actions.length };
        }, opts));
    }

    return { name: 'providers', results };
}
