/**
 * Identity of `file://` URIs independent of how they are spelled.
 *
 * The same file can reach the server under different spellings: a client
 * may send `file:///c%3A/dir/a.sysml` for an open document, while
 * `pathToFileURL` on a scanned path yields `file:///C:/dir/a.sysml`.
 */

/**
 * Canonical key of a URI: `file://` URIs are percent-decoded and their drive
 * letter lowercased, so two spellings of one file compare equal. Other URIs
 * (and malformed ones) are returned unchanged.
 */
export function canonicalFileUri(uri: string): string {
    if (!uri.startsWith('file://')) return uri;
    let rest: string;
    try {
        rest = decodeURIComponent(uri.slice('file://'.length));
    } catch {
        return uri;
    }
    return `file://${rest.replace(/^\/([A-Za-z]):/, (_m, drive: string) => `/${drive.toLowerCase()}:`)}`;
}

/** Whether two URIs name the same file (see `canonicalFileUri`). */
export function isSameFileUri(a: string, b: string): boolean {
    return a === b || canonicalFileUri(a) === canonicalFileUri(b);
}
