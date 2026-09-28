/**
 * Identity of document URIs independent of how they are spelled.
 *
 * The same document can reach the server under different spellings: a client
 * may send `file:///c%3A/dir/A.sysml` for an open document, while
 * `pathToFileURL` on a scanned path yields `file:///C:/dir/a.sysml`.
 */

/**
 * Canonical key of a URI, so that different spellings of one document compare
 * equal: case-insensitive for every scheme (`file://`, `https://`, ...), and
 * `file://` URIs are also percent-decoded. A malformed `file://` URI is only
 * lowercased.
 */
export function canonicalUri(uri: string): string {
    if (uri.startsWith('file://')) {
        try {
            return decodeURIComponent(uri).toLowerCase();
        } catch { /* malformed percent-encoding: compare without decoding */ }
    }
    return uri.toLowerCase();
}

/** Whether two URIs name the same document (see `canonicalUri`). */
export function isSameDocumentUri(a: string, b: string): boolean {
    return a === b || canonicalUri(a) === canonicalUri(b);
}
