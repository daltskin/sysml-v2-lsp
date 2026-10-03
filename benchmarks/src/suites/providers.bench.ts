/**
 * Provider benchmark suite — measures LSP provider response latency.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Position } from 'vscode-languageserver/node';
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

function loadBikeFile(): { uri: string; text: string } {
    const p = path.join(ROOT, 'examples/bike.sysml');
    const text = fs.readFileSync(p, 'utf-8');
    return { uri: 'file:///bike.sysml', text };
}

function requireResult(condition: unknown, operation: string): asserts condition {
    if (!condition) throw new Error(`Provider benchmark preflight failed: ${operation}`);
}

export function runProviderSuite(opts: BenchmarkOptions = {}): SuiteReport {
    const { uri, text } = loadBikeFile();
    const results: BenchmarkResult[] = [];
    const microOpts = { ...opts, operationsPerRun: opts.operationsPerRun ?? 100 };

    // Pre-parse once — providers operate on cached data
    const dm = new DocumentManager();
    const doc = TextDocument.create(uri, 'sysml', 1, text);
    dm.parse(doc);
    // Pre-build symbol table so we measure provider logic, not first-build cost
    const symbolTable = dm.getSymbolTable(uri);
    requireResult(symbolTable, 'symbol table');

    const symbols = symbolTable.getAllSymbols();
    requireResult(symbols.length >= 3, 'representative symbols');
    const at = (index: number): Position => symbols[index].selectionRange.start;
    const positions = [
        { label: 'top', position: at(0) },
        { label: 'mid', position: at(Math.floor(symbols.length / 2)) },
        { label: 'end', position: at(symbols.length - 1) },
    ];
    const targetPosition = positions[0].position;

    // A typed usage whose type is defined locally exercises real reference resolution.
    const lines = text.split('\n');
    const typedUsage = symbols.find(s => s.typeNames.length > 0
        && symbols.some(d => d !== s && d.name === s.typeNames[0])
        && lines[s.selectionRange.start.line].includes(s.typeNames[0], s.selectionRange.end.character));
    requireResult(typedUsage, 'typed usage with local definition');
    const typeName = typedUsage.typeNames[0];
    const typeDefinition = symbols.find(d => d !== typedUsage && d.name === typeName)!;
    const referenceLine = typedUsage.selectionRange.start.line;
    const referencePosition: Position = {
        line: referenceLine,
        character: lines[referenceLine].indexOf(typeName, typedUsage.selectionRange.end.character),
    };
    const definitionPosition = typeDefinition.selectionRange.start;

    const invalidUri = 'file:///benchmark-invalid.sysml';
    dm.parse(TextDocument.create(invalidUri, 'sysml', 1, `${text}\npackage BenchmarkBroken { @@@ }\n`));

    // ── Diagnostics ──
    const diagProvider = new DiagnosticsProvider(dm);
    requireResult(diagProvider.getDiagnostics(invalidUri).length > 0, 'diagnostics');
    results.push(benchmarkFn('diagnostics', () => {
        const diags = diagProvider.getDiagnostics(invalidUri);
        return { count: diags.length };
    }, microOpts));

    // ── Document Symbols ──
    const symbolProvider = new DocumentSymbolProvider(dm);
    results.push(benchmarkFn('documentSymbols', () => {
        const syms = symbolProvider.provideDocumentSymbols({ textDocument: { uri } });
        return { count: syms.length };
    }, microOpts));

    // ── Semantic Tokens ──
    const tokenProvider = new SemanticTokensProvider(dm);
    results.push(benchmarkFn('semanticTokens', () => {
        const tokens = tokenProvider.provideSemanticTokens({ textDocument: { uri } });
        return { dataLength: tokens.data.length };
    }, microOpts));

    // ── Hover (at multiple positions) ──
    const hoverProvider = new HoverProvider(dm);
    for (const pos of positions) {
        requireResult(hoverProvider.provideHover({ textDocument: { uri }, position: pos.position }), `hover/${pos.label}`);
        results.push(benchmarkFn(`hover/${pos.label}`, () => {
            const hover = hoverProvider.provideHover({
                textDocument: { uri },
                position: pos.position,
            });
            return { hasResult: hover !== null };
        }, microOpts));
    }

    // ── Completions (at multiple positions) ──
    const completionProvider = new CompletionProvider(dm);
    for (const pos of positions) {
        requireResult(completionProvider.provideCompletions({ textDocument: { uri }, position: pos.position }).length > 0, `completion/${pos.label}`);
        results.push(benchmarkFn(`completion/${pos.label}`, () => {
            const items = completionProvider.provideCompletions({
                textDocument: { uri },
                position: pos.position,
            });
            return { count: items.length };
        }, microOpts));
    }

    // ── Go to Definition ──
    const defProvider = new DefinitionProvider(dm);
    const definition = defProvider.provideDefinition({ textDocument: { uri }, position: referencePosition });
    requireResult(definition && definition.range.start.line === definitionPosition.line, 'definition');
    results.push(benchmarkFn('definition', () => {
        const loc = defProvider.provideDefinition({
            textDocument: { uri },
            position: referencePosition,
        });
        return { hasResult: loc !== null };
    }, microOpts));

    // ── References ──
    const refProvider = new ReferencesProvider(dm);
    requireResult(refProvider.provideReferences({
        textDocument: { uri },
        position: definitionPosition,
        context: { includeDeclaration: true },
    }).length > 1, 'references');
    results.push(benchmarkFn('references', () => {
        const locs = refProvider.provideReferences({
            textDocument: { uri },
            position: definitionPosition,
            context: { includeDeclaration: true },
        });
        return { count: locs.length };
    }, microOpts));

    // ── Rename (prepare) ──
    const renameProvider = new RenameProvider(dm);
    requireResult(renameProvider.prepareRename({ textDocument: { uri }, position: definitionPosition }), 'rename/prepare');
    results.push(benchmarkFn('rename/prepare', () => {
        const range = renameProvider.prepareRename({
            textDocument: { uri },
            position: definitionPosition,
        });
        return { hasResult: range !== null };
    }, microOpts));

    // ── Code Actions ──
    const codeActionProvider = new CodeActionProvider(dm);
    type CodeActionParams = Parameters<CodeActionProvider['provideCodeActions']>[0];
    const actionRange = { start: targetPosition, end: targetPosition };
    const actionDiagnostic: CodeActionParams['context']['diagnostics'][number] = {
        range: actionRange,
        message: "Unknown keyword 'prt'. Did you mean 'part'?",
        data: { typo: 'prt', suggestion: 'part' },
    };
    const actionParams: CodeActionParams = {
        textDocument: { uri },
        range: actionRange,
        context: { diagnostics: [actionDiagnostic] },
    };
    requireResult(codeActionProvider.provideCodeActions(actionParams).length > 0, 'codeActions');
    results.push(benchmarkFn('codeActions', () => {
        const actions = codeActionProvider.provideCodeActions(actionParams);
        return { count: actions.length };
    }, microOpts));

    return { name: 'providers', results };
}
