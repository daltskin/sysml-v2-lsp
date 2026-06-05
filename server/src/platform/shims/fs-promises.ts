/**
 * Browser shim for `node:fs/promises`.
 *
 * Used only by the workspace disk-scan path, which never runs in the
 * browser (the client streams document content over LSP instead).
 * The stubs return empty results so the scan no-ops cleanly.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

export async function readFile(_path: string, _enc?: unknown): Promise<string> {
    throw new Error('fs/promises.readFile is not available in the browser');
}

export async function readdir(_path: string, _opts?: unknown): Promise<never[]> {
    return [];
}

export async function stat(_path: string): Promise<{ isDirectory(): boolean; isFile(): boolean }> {
    throw new Error('fs/promises.stat is not available in the browser');
}

export default { readFile, readdir, stat };
