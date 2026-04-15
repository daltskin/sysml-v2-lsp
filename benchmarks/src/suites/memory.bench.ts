/**
 * Memory benchmark suite — measures heap usage across parsing scenarios.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from '../../../server/src/documentManager.js';
import { benchmarkFn, type BenchmarkResult, type BenchmarkOptions } from '../utils/harness.js';
import { forceGC, takeMemorySnapshot, formatBytes } from '../utils/memory.js';
import type { SuiteReport } from '../reporters/jsonReporter.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');

function loadAllFiles(): { label: string; uri: string; text: string }[] {
    const files: { label: string; uri: string; text: string }[] = [];
    const examplesDir = path.join(ROOT, 'examples');
    const fixturesDir = path.join(ROOT, 'benchmarks/fixtures');

    for (const name of ['camera.sysml', 'vehicle-model.sysml', 'toaster-system.sysml', 'bike.sysml']) {
        const p = path.join(examplesDir, name);
        if (fs.existsSync(p)) {
            files.push({ label: name, uri: `file:///${name}`, text: fs.readFileSync(p, 'utf-8') });
        }
    }

    if (fs.existsSync(fixturesDir)) {
        for (const name of fs.readdirSync(fixturesDir).filter(f => f.endsWith('.sysml')).sort()) {
            files.push({
                label: `fixture/${name}`,
                uri: `file:///fixture/${name}`,
                text: fs.readFileSync(path.join(fixturesDir, name), 'utf-8'),
            });
        }
    }

    return files;
}

export function runMemorySuite(opts: BenchmarkOptions = {}): SuiteReport {
    const files = loadAllFiles();
    const results: BenchmarkResult[] = [];
    const memOpts: BenchmarkOptions = { ...opts, trackMemory: true, warmup: 1, runs: 3 };

    // Parse-only memory: parse all files and measure heap delta
    results.push(benchmarkFn('parse/all-files', () => {
        forceGC();
        const before = takeMemorySnapshot();
        const dm = new DocumentManager();
        for (const file of files) {
            dm.parse(TextDocument.create(file.uri, 'sysml', 1, file.text));
        }
        forceGC();
        const after = takeMemorySnapshot();
        return {
            heapDelta: after.heapUsed - before.heapUsed,
            heapDeltaFormatted: formatBytes(after.heapUsed - before.heapUsed),
            fileCount: files.length,
        };
    }, memOpts));

    // Parse + symbol table memory
    results.push(benchmarkFn('parse+symbols/all-files', () => {
        forceGC();
        const before = takeMemorySnapshot();
        const dm = new DocumentManager();
        for (const file of files) {
            dm.parse(TextDocument.create(file.uri, 'sysml', 1, file.text));
        }
        for (const file of files) {
            dm.getSymbolTable(file.uri);
        }
        dm.getWorkspaceSymbolTable();
        forceGC();
        const after = takeMemorySnapshot();
        return {
            heapDelta: after.heapUsed - before.heapUsed,
            heapDeltaFormatted: formatBytes(after.heapUsed - before.heapUsed),
            fileCount: files.length,
        };
    }, memOpts));

    // Scaling test: parse incrementally (1 file, 2 files, ... N files)
    for (let n = 1; n <= files.length; n++) {
        const subset = files.slice(0, n);
        results.push(benchmarkFn(`scaling/${n}-files`, () => {
            forceGC();
            const before = takeMemorySnapshot();
            const dm = new DocumentManager();
            for (const file of subset) {
                dm.parse(TextDocument.create(file.uri, 'sysml', 1, file.text));
                dm.getSymbolTable(file.uri);
            }
            forceGC();
            const after = takeMemorySnapshot();
            return {
                heapDelta: after.heapUsed - before.heapUsed,
                heapDeltaFormatted: formatBytes(after.heapUsed - before.heapUsed),
                fileCount: n,
            };
        }, memOpts));
    }

    return { name: 'memory', results };
}
