/**
 * Parse benchmark suite — measures lexer + parser performance with cold/warm DFA.
 */

import { BailErrorStrategy, CharStream, CommonTokenStream, DefaultErrorStrategy, PredictionMode } from 'antlr4ng';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SysMLv2Lexer } from '../../../server/src/generated/SysMLv2Lexer.js';
import { SysMLv2Parser } from '../../../server/src/generated/SysMLv2Parser.js';
import { isDfaPreSeeded, loadDFASnapshot, markDfaNotPreSeeded } from '../../../server/src/parser/dfaLoader.js';
import { benchmarkFn, type BenchmarkResult, type BenchmarkOptions } from '../utils/harness.js';
import type { SuiteReport } from '../reporters/jsonReporter.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');

interface ParseTiming {
    lexMs: number;
    parseMs: number;
    totalMs: number;
    tokens: number;
    lines: number;
    mode: 'SLL' | 'SLL+LL';
    errors: number;
}

function resetDFA(): void {
    const dfas = (SysMLv2Parser as unknown as Record<string, unknown[]>).decisionsToDFA as Array<{s0?: undefined; states?: {clear?: () => void}}>;
    for (const dfa of dfas) {
        if (!dfa) continue;
        dfa.s0 = undefined;
        if (dfa.states && typeof dfa.states.clear === 'function') {
            dfa.states.clear();
        }
    }
}

function parseOnce(text: string): ParseTiming {
    const totalStart = performance.now();

    const input = CharStream.fromString(text);
    const lexer = new SysMLv2Lexer(input);
    const tokenStream = new CommonTokenStream(lexer);

    const lexStart = performance.now();
    tokenStream.fill();
    const lexMs = performance.now() - lexStart;
    const tokenCount = tokenStream.getTokens().length;

    const parser = new SysMLv2Parser(tokenStream);
    parser.removeErrorListeners();

    let mode: 'SLL' | 'SLL+LL' = 'SLL';
    let errors = 0;

    parser.interpreter.predictionMode = PredictionMode.SLL;
    parser.errorHandler = new BailErrorStrategy();

    const parseStart = performance.now();
    try {
        parser.rootNamespace();
    } catch {
        mode = 'SLL+LL';
        tokenStream.seek(0);
        parser.reset();
        parser.interpreter.predictionMode = PredictionMode.LL;
        parser.errorHandler = new DefaultErrorStrategy();
        parser.removeErrorListeners();
        parser.addErrorListener({
            syntaxError: () => { errors++; },
            reportAmbiguity: () => { },
            reportAttemptingFullContext: () => { },
            reportContextSensitivity: () => { },
        });
        parser.rootNamespace();
    }
    const parseMs = performance.now() - parseStart;
    const totalMs = performance.now() - totalStart;

    return { lexMs, parseMs, totalMs, tokens: tokenCount, lines: text.split('\n').length, mode, errors };
}

interface BenchFile {
    label: string;
    path: string;
}

function discoverFiles(): BenchFile[] {
    const examplesDir = path.join(ROOT, 'examples');
    const fixturesDir = path.join(ROOT, 'benchmarks/fixtures');
    const files: BenchFile[] = [];

    // Example files
    for (const name of ['camera.sysml', 'vehicle-model.sysml', 'toaster-system.sysml', 'bike.sysml']) {
        const p = path.join(examplesDir, name);
        if (fs.existsSync(p)) files.push({ label: name, path: p });
    }

    // Synthetic fixtures
    if (fs.existsSync(fixturesDir)) {
        for (const name of fs.readdirSync(fixturesDir).filter(f => f.endsWith('.sysml')).sort()) {
            files.push({ label: `fixture/${name}`, path: path.join(fixturesDir, name) });
        }
    }

    return files;
}

export function runParseSuite(opts: BenchmarkOptions = {}): SuiteReport {
    const files = discoverFiles();
    const results: BenchmarkResult[] = [];

    for (const file of files) {
        if (!fs.existsSync(file.path)) continue;
        const text = fs.readFileSync(file.path, 'utf-8');

        // Cold parse (reset DFA each iteration)
        const coldResult = benchmarkFn(`cold/${file.label}`, () => {
            resetDFA();
            const t = parseOnce(text);
            return { lines: t.lines, tokens: t.tokens, mode: t.mode, errors: t.errors };
        }, opts);
        results.push(coldResult);

        // Warm parse (pre-seeded DFA each iteration)
        const warmResult = benchmarkFn(`warm/${file.label}`, () => {
            resetDFA();
            loadDFASnapshot();
            if (isDfaPreSeeded()) markDfaNotPreSeeded();
            const t = parseOnce(text);
            return { lines: t.lines, tokens: t.tokens, mode: t.mode, errors: t.errors };
        }, opts);
        results.push(warmResult);
    }

    return { name: 'parse', results };
}
