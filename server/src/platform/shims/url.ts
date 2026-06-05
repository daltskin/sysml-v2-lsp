/**
 * Browser shim for `node:url` (the subset the server uses).
 *
 * Converts between filesystem-style paths and `file://` URIs.  The
 * browser build mostly deals with already-URI strings, so these only
 * need to be round-trip-correct for the simple cases the server hits.
 */

export function fileURLToPath(url: string | URL): string {
    const href = typeof url === 'string' ? url : url.href;
    if (href.startsWith('file://')) {
        const withoutScheme = href.slice('file://'.length);
        // Drop a leading host (usually empty) up to the first slash.
        const path = withoutScheme.startsWith('/') ? withoutScheme : `/${withoutScheme}`;
        return decodeURIComponent(path);
    }
    return decodeURIComponent(href);
}

export function pathToFileURL(path: string): URL {
    const normalized = path.replace(/\\/g, '/');
    const withSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
    const encoded = withSlash.split('/').map(encodeURIComponent).join('/');
    return new URL(`file://${encoded}`);
}

export default { fileURLToPath, pathToFileURL };
