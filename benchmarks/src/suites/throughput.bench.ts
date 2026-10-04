/**
 * Throughput benchmark suite — measures lines/second and tokens/second.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { clearAllDFAStates, loadDFASnapshot, isDfaPreSeeded, markDfaNotPreSeeded } from '../../../server/src/parser/dfaLoader.js';
import { benchmarkFn, type BenchmarkResult, type BenchmarkOptions } from '../utils/harness.js';
import { parseRaw, resetDFA } from '../utils/rawParser.js';
import type { SuiteReport } from '../reporters/jsonReporter.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');

interface FileData {
    label: string;
    text: string;
    lines: number;
    tokens: number;
}

function loadAndTokenize(): FileData[] {
    // Earlier suites can leave stale snapshot DFA states; validate fixtures against a clean ATN.
    resetDFA();
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
            const parsed = parseRaw(text);
            if (parsed.errors > 0) throw new Error(`Fixture parse failed for ${name}: ${parsed.errors} syntax errors`);
            files.push({
                label: name,
                text,
                lines: text.split('\n').length,
                tokens: parsed.tokens,
            });
        }
    }

    return files;
}

interface BatchParseResult {
    errors: number;
    initialErrors: number;
    retries: number;
}

function parseAllFiles(files: FileData[], recoverStaleDfa = false): BatchParseResult {
    let errors = 0;
    let initialErrors = 0;
    let retries = 0;
    for (const file of files) {
        const first = parseRaw(file.text);
        initialErrors += first.errors;
        if (recoverStaleDfa && first.errors > 0) {
            clearAllDFAStates();
            errors += parseRaw(file.text).errors;
            retries++;
        } else {
            errors += first.errors;
        }
    }
    return { errors, initialErrors, retries };
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
        const start = performance.now();
        const parsed = parseAllFiles(files, true);
        if (isDfaPreSeeded()) markDfaNotPreSeeded();
        const elapsed = performance.now() - start;
        if (parsed.errors > 0) throw new Error(`Warm throughput parse failed: ${parsed.errors} syntax errors`);
        return {
            totalLines,
            totalTokens,
            fileCount: files.length,
            elapsedMs: elapsed,
            linesPerSec: Math.round(totalLines / (elapsed / 1000)),
            tokensPerSec: Math.round(totalTokens / (elapsed / 1000)),
            errors: parsed.errors,
            initialErrors: parsed.initialErrors,
            retries: parsed.retries,
        };
    }, opts));

    // Cold DFA throughput
    results.push(benchmarkFn('throughput/cold', () => {
        resetDFA();
        const start = performance.now();
        const parsed = parseAllFiles(files);
        const elapsed = performance.now() - start;
        if (parsed.errors > 0) throw new Error(`Cold throughput parse failed: ${parsed.errors} syntax errors`);
        return {
            totalLines,
            totalTokens,
            fileCount: files.length,
            elapsedMs: elapsed,
            linesPerSec: Math.round(totalLines / (elapsed / 1000)),
            tokensPerSec: Math.round(totalTokens / (elapsed / 1000)),
            errors: parsed.errors,
        };
    }, opts));

    // Snapshot reloads leave stale states that later suites' production retry cannot detect.
    resetDFA();
    return { name: 'throughput', results };
}
