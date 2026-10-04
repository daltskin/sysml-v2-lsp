/**
 * Parse benchmark suite — measures lexer + parser performance with cold/warm DFA.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
    clearAllDFAStates,
    isDfaPreSeeded,
    loadDFASnapshot,
    markDfaNotPreSeeded,
} from '../../../server/src/parser/dfaLoader.js';
import { benchmarkFn, type BenchmarkResult, type BenchmarkOptions } from '../utils/harness.js';
import { parseRaw, resetDFA } from '../utils/rawParser.js';
import type { SuiteReport } from '../reporters/jsonReporter.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');

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
            const t = parseRaw(text);
            if (t.errors > 0) throw new Error(`Cold parse failed for ${file.label}: ${t.errors} syntax errors`);
            return { lines: t.lines, tokens: t.tokens, mode: t.mode, errors: t.errors };
        }, opts);
        results.push(coldResult);

        // Warm parse (pre-seeded DFA each iteration)
        const warmResult = benchmarkFn(`warm/${file.label}`, () => {
            resetDFA();
            loadDFASnapshot();
            const first = parseRaw(text);
            let result = first;
            let retries = 0;

            if (first.errors > 0) {
                clearAllDFAStates();
                result = parseRaw(text);
                retries = 1;
            }
            if (isDfaPreSeeded()) markDfaNotPreSeeded();
            if (result.errors > 0) throw new Error(`Warm parse failed for ${file.label}: ${result.errors} syntax errors`);

            return {
                lines: result.lines,
                tokens: result.tokens,
                mode: retries > 0 ? `${first.mode}+retry` : result.mode,
                errors: result.errors,
                initialErrors: first.errors,
                retries,
            };
        }, opts);
        results.push(warmResult);
    }

    // Snapshot reloads leave stale states that later suites' production retry cannot detect.
    resetDFA();
    return { name: 'parse', results };
}
