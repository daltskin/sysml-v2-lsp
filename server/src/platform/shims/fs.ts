/**
 * Browser shim for `node:fs`.
 *
 * The language server bundles its own copy of the standard library
 * (see platform/libraryFiles.browser.ts) and relies on LSP document
 * sync for workspace files, so no real filesystem is needed in the
 * browser.  These stubs let the shared Node code paths bundle and
 * degrade gracefully (workspace disk scanning simply finds nothing).
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

export class Dirent {
    name = '';
    isDirectory(): boolean { return false; }
    isFile(): boolean { return false; }
}

export function existsSync(_path: string): boolean {
    return false;
}

export function readFileSync(_path: string, _enc?: unknown): string {
    throw new Error('fs.readFileSync is not available in the browser');
}

export function readdirSync(_path: string, _opts?: unknown): string[] {
    return [];
}

export function statSync(_path: string): { isDirectory(): boolean; isFile(): boolean } {
    throw new Error('fs.statSync is not available in the browser');
}

export default { Dirent, existsSync, readFileSync, readdirSync, statSync };
