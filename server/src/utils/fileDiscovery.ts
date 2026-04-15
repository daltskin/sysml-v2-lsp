/**
 * Shared file-discovery utilities for scanning workspace folders.
 *
 * Used by server.ts (startup scan) and the folderLoad benchmark.
 * Having a single source of truth avoids skip-list divergence.
 */

import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';

/** Default directories to skip during workspace scanning. */
export const DEFAULT_SKIP_DIRS: readonly string[] = [
    'node_modules', '.git', '.settings',
    'temp', 'test', 'tests',
    'out', 'dist', 'build', 'coverage',
    '.venv', '__pycache__',
];

/** File extensions treated as SysML source files. */
const SYSML_EXTENSIONS = ['.sysml', '.kerml'];

function isSysMLFile(name: string): boolean {
    return SYSML_EXTENSIONS.some(ext => name.endsWith(ext));
}

/**
 * Recursively find all .sysml / .kerml files under a directory (sync).
 *
 * @param dir       Root directory to scan
 * @param skipDirs  Set of directory names to skip (defaults to DEFAULT_SKIP_DIRS)
 */
export function findSysMLFiles(dir: string, skipDirs?: ReadonlySet<string>): string[] {
    const skip = skipDirs ?? new Set(DEFAULT_SKIP_DIRS);
    const results: string[] = [];
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return results;
    }
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (skip.has(entry.name)) continue;
            // Skip nested repositories — independent projects
            try {
                fs.statSync(path.join(fullPath, '.git'));
                continue;
            } catch { /* no .git → recurse */ }
            results.push(...findSysMLFiles(fullPath, skip));
        } else if (entry.isFile() && isSysMLFile(entry.name)) {
            results.push(fullPath);
        }
    }
    return results;
}

/**
 * Recursively find all .sysml / .kerml files under a directory (async).
 * Recurses into sub-directories concurrently.
 *
 * @param dir       Root directory to scan
 * @param skipDirs  Set of directory names to skip (defaults to DEFAULT_SKIP_DIRS)
 */
export async function findSysMLFilesAsync(dir: string, skipDirs?: ReadonlySet<string>): Promise<string[]> {
    const skip = skipDirs ?? new Set(DEFAULT_SKIP_DIRS);
    const results: string[] = [];
    let entries: fs.Dirent[];
    try {
        entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
        return results;
    }
    const childDirPromises: Promise<string[]>[] = [];
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (skip.has(entry.name)) continue;
            childDirPromises.push(findSysMLFilesAsync(fullPath, skip));
        } else if (entry.isFile() && isSysMLFile(entry.name)) {
            results.push(fullPath);
        }
    }
    if (childDirPromises.length > 0) {
        const childResults = await Promise.all(childDirPromises);
        for (const arr of childResults) results.push(...arr);
    }
    return results;
}

/**
 * Read a batch of files concurrently (bounded to avoid FD exhaustion).
 */
export async function readFilesBatch(
    filePaths: string[],
    batchSize: number = 32,
): Promise<Map<string, string>> {
    const contents = new Map<string, string>();
    for (let i = 0; i < filePaths.length; i += batchSize) {
        const batch = filePaths.slice(i, i + batchSize);
        const settled = await Promise.allSettled(
            batch.map(async (fp) => {
                const text = await fsp.readFile(fp, 'utf-8');
                return { fp, text };
            }),
        );
        for (const result of settled) {
            if (result.status === 'fulfilled') {
                contents.set(result.value.fp, result.value.text);
            }
        }
    }
    return contents;
}
