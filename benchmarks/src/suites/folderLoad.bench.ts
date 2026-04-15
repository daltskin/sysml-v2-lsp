/**
 * Folder-loading benchmark suite — measures end-to-end folder scanning:
 * discover files → read from disk → parse → build workspace symbol table.
 *
 * This mirrors the real startup path in server.ts (scanWorkspaceFoldersAsync).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DocumentManager } from '../../../server/src/documentManager.js';
import { findSysMLFilesAsync, readFilesBatch } from '../../../server/src/utils/fileDiscovery.js';
import { benchmarkFnAsync, type BenchmarkResult, type BenchmarkOptions } from '../utils/harness.js';
import type { SuiteReport } from '../reporters/jsonReporter.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');

/**
 * Async end-to-end folder load: discover → concurrent read → batch parse → symbol table.
 * Mirrors the real scanWorkspaceFoldersAsync() path in server.ts.
 */
async function loadFoldersAsync(dirs: string[]): Promise<{ fileCount: number; symbolCount: number }> {
    const dm = new DocumentManager();

    // Phase 1: Discover files concurrently
    const fileArrays = await Promise.all(dirs.map(d => findSysMLFilesAsync(d)));
    const allFiles: string[] = [];
    for (const arr of fileArrays) allFiles.push(...arr);

    // Phase 2: Read all files concurrently (batches of 32)
    const fileContents = await readFilesBatch(allFiles, 32);

    // Phase 3: Parse sequentially using batch-optimised parser
    let fileCount = 0;
    for (const filePath of allFiles) {
        const content = fileContents.get(filePath);
        if (content === undefined) continue;
        const uri = pathToFileURL(filePath).toString();
        dm.parseBatch(uri, 0, content);
        fileCount++;
    }

    const wst = dm.getWorkspaceSymbolTable();
    const symbolCount = wst.getAllSymbols().length;
    return { fileCount, symbolCount };
}

export async function runFolderLoadSuite(opts: BenchmarkOptions = {}): Promise<SuiteReport> {
    const results: BenchmarkResult[] = [];

    const examplesDir = path.join(ROOT, 'examples');
    const libraryDir = path.join(ROOT, 'sysml.library');
    const systemsDir = path.join(libraryDir, 'Systems Library');
    const domainDir = path.join(libraryDir, 'Domain Libraries');
    const fixturesDir = path.join(ROOT, 'benchmarks/fixtures');
    const validDir = path.join(ROOT, 'test/fixtures/valid');

    // Small folder — 4 example files
    if (fs.existsSync(examplesDir)) {
        results.push(await benchmarkFnAsync('folder/examples', () => {
            return loadFoldersAsync([examplesDir]);
        }, opts));
    }

    // Standard library subfolders
    if (fs.existsSync(systemsDir)) {
        results.push(await benchmarkFnAsync('folder/sysml-library/systems', () => {
            return loadFoldersAsync([systemsDir]);
        }, opts));
    }

    if (fs.existsSync(domainDir)) {
        results.push(await benchmarkFnAsync('folder/sysml-library/domain', () => {
            return loadFoldersAsync([domainDir]);
        }, opts));
    }

    // Full standard library — 94 files
    if (fs.existsSync(libraryDir)) {
        results.push(await benchmarkFnAsync('folder/sysml-library', () => {
            return loadFoldersAsync([libraryDir]);
        }, opts));
    }

    // Full workspace — all folders combined
    const allDirs = [examplesDir, libraryDir, fixturesDir, validDir].filter(d => fs.existsSync(d));
    if (allDirs.length > 0) {
        results.push(await benchmarkFnAsync('folder/all', () => {
            return loadFoldersAsync(allDirs);
        }, opts));
    }

    // External folder — apollo-11 (338 .sysml files)
    const apolloDir = '/workspaces/apollo-11';
    if (fs.existsSync(apolloDir)) {
        results.push(await benchmarkFnAsync('folder/apollo-11', () => {
            return loadFoldersAsync([apolloDir]);
        }, opts));

        // apollo-11 + standard library combined
        const apolloPlusDirs = [apolloDir, libraryDir].filter(d => fs.existsSync(d));
        results.push(await benchmarkFnAsync('folder/apollo-11+library', () => {
            return loadFoldersAsync(apolloPlusDirs);
        }, opts));
    }

    return { name: 'folderLoad', results };
}
