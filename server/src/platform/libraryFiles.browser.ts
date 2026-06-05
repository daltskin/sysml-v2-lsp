/**
 * Platform library loader — browser (Web Worker) variant.
 *
 * There is no filesystem inside a browser worker, so the standard
 * library is bundled at build time into `bundledLibrary.generated.ts`
 * (produced by `scripts/bundle-library.mjs`).  This module serves the
 * same `{ uri, content }` shape as the Node loader so the rest of the
 * library index code is platform-agnostic.
 *
 * Substituted for `libraryFiles.ts` in the browser bundle by the
 * esbuild resolver plugin (see esbuild.mjs).
 */

// eslint-disable-next-line import/no-unresolved -- generated at build time
import { BUNDLED_LIBRARY } from '../library/bundledLibrary.generated.js';

/** A standard-library source file: its URI and full text content. */
export interface LibraryFile {
    /** `sysml-stdlib:` URI uniquely identifying the bundled file. */
    uri: string;
    /** Full file content. */
    content: string;
}

/** Build the `sysml-stdlib:` URI for a bundled relative path. */
export function libraryUriForPath(relPath: string): string {
    const encoded = relPath.split('/').map(encodeURIComponent).join('/');
    return `sysml-stdlib:///${encoded}`;
}

/**
 * Load every standard-library file from the bundled snapshot.
 * `serverDir` / `customPath` are ignored in the browser (no filesystem).
 */
export function loadLibraryFiles(_serverDir: string, _customPath?: string): LibraryFile[] {
    return Object.entries(BUNDLED_LIBRARY).map(([relPath, content]) => ({
        uri: libraryUriForPath(relPath),
        content: content as string,
    }));
}
