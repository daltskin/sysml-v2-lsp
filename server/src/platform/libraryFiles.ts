/**
 * Platform library loader — Node.js variant.
 *
 * Discovers the SysML v2 standard library on disk (either the bundled
 * `sysml.library/` directory shipped with the package, or a user-set
 * `sysml.library.path`) and returns every `.sysml` / `.kerml` file as
 * an in-memory `{ uri, content }` entry.
 *
 * The browser build swaps this module for `libraryFiles.browser.ts`
 * via the esbuild resolver plugin (see esbuild.mjs), which serves the
 * same shape from a bundled snapshot instead of the filesystem.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** A standard-library source file: its URI and full text content. */
export interface LibraryFile {
    /** Absolute `file://` (Node) or `sysml-stdlib:` (browser) URI. */
    uri: string;
    /** Full file content. */
    content: string;
}

/**
 * Load every standard-library file as an in-memory entry.
 *
 * @param serverDir  `__dirname` of the running server module
 *                   (typically `dist/server/`).
 * @param customPath Optional user-configured library path override
 *                   (`sysml.library.path`).
 */
export function loadLibraryFiles(serverDir: string, customPath?: string): LibraryFile[] {
    let libRoot: string | undefined;

    if (customPath && customPath.trim()) {
        const abs = resolve(customPath);
        if (existsSync(abs)) {
            libRoot = abs;
        }
    }

    if (!libRoot) {
        // Bundled library lives at <pkg>/sysml.library relative to
        // the server module at <pkg>/dist/server/server.js.
        const bundled = resolve(serverDir, '..', '..', 'sysml.library');
        if (existsSync(bundled)) {
            libRoot = bundled;
        }
    }

    if (!libRoot) {
        return [];
    }

    const files: LibraryFile[] = [];

    const walk = (dir: string): void => {
        let entries: string[];
        try {
            entries = readdirSync(dir);
        } catch {
            return;
        }
        for (const name of entries) {
            const full = join(dir, name);
            try {
                const stat = statSync(full);
                if (stat.isDirectory()) {
                    walk(full);
                } else if (name.endsWith('.sysml') || name.endsWith('.kerml')) {
                    files.push({
                        uri: pathToFileURL(full).href,
                        content: readFileSync(full, 'utf8'),
                    });
                }
            } catch {
                /* skip unreadable entries */
            }
        }
    };

    walk(libRoot);
    return files;
}
