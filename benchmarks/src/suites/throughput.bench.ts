/**
 * Throughput benchmark suite — measures lines/second and tokens/second.
 */

import { CharStream, CommonTokenStream } from 'antlr4ng';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SysMLv2Lexer } from '../../../server/src/generated/SysMLv2Lexer.js';
import { SysMLv2Parser } from '../../../server/src/generated/SysMLv2Parser.js';
import { loadDFASnapshot, isDfaPreSeeded, markDfaNotPreSeeded } from '../../../server/src/parser/dfaLoader.js';
import { benchmarkFn, type BenchmarkResult, type BenchmarkOptions } from '../utils/harness.js';
import type { SuiteReport } from '../reporters/jsonReporter.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');

function resetDFA(): void {
    const dfas = (SysMLv2Parser as any).decisionsToDFA as any[];
    for (const dfa of dfas) {
        if (!dfa) continue;
        dfa.s0 = undefined;
        if (dfa.states && typeof dfa.states.clear === 'function') {
            dfa.states.clear();
        }
    }
}

interface FileData {
    label: string;
    text: string;
    lines: number;
    tokens: number;
}

function loadAndTokenize(): FileData[] {
    const files: FileData[] = [];
    const examplesDir = path.join(ROOT, 'examples');
    const fixturesDir = path.join(ROOT, 'benchmarks/fixtures');

    const candidates = [
        { dir: examplesDir, names: ['camera.sysml', 'vehicle-model.sysml', 'toaster-system.sysml', 'bike.sysml'] },
    ];

    if (fs.existsSync(fixturesDir)) {
        candidates.push({
            dir: fixturesDir,
            names: fs.readdirSync(fixturesDir).filter(f => f.endsWith('.sysml')).sort(),
        });
    }

    for (const { dir, names } of candidates) {
        for (const name of names) {
            const p = path.join(dir, name);
            if (!fs.existsSync(p)) continue;
            const text = fs.readFileSync(p, 'utf-8');
            const input = CharStream.fromString(text);
            const lexer = new SysMLv2Lexer(input);
            const stream = new CommonTokenStream(lexer);
            stream.fill();
            files.push({
                label: name,
                text,
                lines: text.split('\n').length,
                tokens: stream.getTokens().length,
            });
        }
    }

    return files;
}

function parseAllFiles(files: FileData[]): void {
    for (const file of files) {
        const input = CharStream.fromString(file.text);
        const lexer = new SysMLv2Lexer(input);
        const stream = new CommonTokenStream(lexer);
        stream.fill();
        const parser = new SysMLv2Parser(stream);
        parser.removeErrorListeners();
        parser.rootNamespace();
    }
}

export function runThroughputSuite(opts: BenchmarkOptions = {}): SuiteReport {
    const files = loadAndTokenize();
    const results: BenchmarkResult[] = [];

    const totalLines = files.reduce((s, f) => s + f.lines, 0);
    const totalTokens = files.reduce((s, f) => s + f.tokens, 0);

    // Warm DFA throughput (steady-state)
    results.push(benchmarkFn('throughput/warm', () => {
        resetDFA();
        loadDFASnapshot();
        if (isDfaPreSeeded()) markDfaNotPreSeeded();
        const start = performance.now();
        parseAllFiles(files);
        const elapsed = performance.now() - start;
        return {
            totalLines,
            totalTokens,
            fileCount: files.length,
            elapsedMs: elapsed,
            linesPerSec: Math.round(totalLines / (elapsed / 1000)),
            tokensPerSec: Math.round(totalTokens / (elapsed / 1000)),
        };
    }, opts));

    // Cold DFA throughput
    results.push(benchmarkFn('throughput/cold', () => {
        resetDFA();
        const start = performance.now();
        parseAllFiles(files);
        const elapsed = performance.now() - start;
        return {
            totalLines,
            totalTokens,
            fileCount: files.length,
            elapsedMs: elapsed,
            linesPerSec: Math.round(totalLines / (elapsed / 1000)),
            tokensPerSec: Math.round(totalTokens / (elapsed / 1000)),
        };
    }, opts));

    return { name: 'throughput', results };
}
