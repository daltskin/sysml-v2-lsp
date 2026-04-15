/**
 * Symbol table benchmark suite — measures symbol table construction and lookup.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from '../../../server/src/documentManager.js';
import { benchmarkFn, type BenchmarkResult, type BenchmarkOptions } from '../utils/harness.js';
import type { SuiteReport } from '../reporters/jsonReporter.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');

interface TestFile {
    label: string;
    uri: string;
    text: string;
}

function loadTestFiles(): TestFile[] {
    const files: TestFile[] = [];
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
            const p = path.join(fixturesDir, name);
            files.push({ label: `fixture/${name}`, uri: `file:///fixture/${name}`, text: fs.readFileSync(p, 'utf-8') });
        }
    }

    return files;
}

export function runSymbolTableSuite(opts: BenchmarkOptions = {}): SuiteReport {
    const files = loadTestFiles();
    const results: BenchmarkResult[] = [];

    // Single-file symbol table construction
    for (const file of files) {
        const result = benchmarkFn(`build/${file.label}`, () => {
            const dm = new DocumentManager();
            const doc = TextDocument.create(file.uri, 'sysml', 1, file.text);
            dm.parse(doc);
            const st = dm.getSymbolTable(file.uri);
            const symbolCount = st?.getAllSymbols().length ?? 0;
            return { symbolCount };
        }, opts);
        results.push(result);
    }

    // Multi-file workspace symbol table (incremental build)
    if (files.length > 1) {
        const result = benchmarkFn('build/workspace-all', () => {
            const dm = new DocumentManager();
            for (const file of files) {
                const doc = TextDocument.create(file.uri, 'sysml', 1, file.text);
                dm.parse(doc);
            }
            const wst = dm.getWorkspaceSymbolTable();
            const symbolCount = wst.getAllSymbols().length;
            return { symbolCount, fileCount: files.length };
        }, opts);
        results.push(result);
    }

    // Symbol lookup performance (use bike.sysml as reference — it's the most complex example)
    const bikeFile = files.find(f => f.label === 'bike.sysml');
    if (bikeFile) {
        const dm = new DocumentManager();
        const doc = TextDocument.create(bikeFile.uri, 'sysml', 1, bikeFile.text);
        dm.parse(doc);
        const st = dm.getSymbolTable(bikeFile.uri);

        if (st) {
            const allSymbols = st.getAllSymbols();
            const sampleNames = allSymbols.slice(0, Math.min(10, allSymbols.length)).map(s => s.name);

            // Lookup by name
            const lookupResult = benchmarkFn('lookup/by-name', () => {
                let found = 0;
                for (const name of sampleNames) {
                    const matches = st.findByName(name);
                    found += matches.length;
                }
                return { lookups: sampleNames.length, found };
            }, { ...opts, warmup: (opts.warmup ?? 2) * 2, runs: (opts.runs ?? 5) * 2 });
            results.push(lookupResult);

            // Lookup by URI
            const uriResult = benchmarkFn('lookup/by-uri', () => {
                const symbols = st.getSymbolsForUri(bikeFile.uri);
                return { found: symbols.length };
            }, { ...opts, warmup: (opts.warmup ?? 2) * 2, runs: (opts.runs ?? 5) * 2 });
            results.push(uriResult);
        }
    }

    return { name: 'symbolTable', results };
}
