/**
 * Identity of document URIs independent of how they are spelled.
 *
 * The same document can reach the server under different spellings: on
 * Windows, a client may send `file:///c%3A/dir/a.sysml` for an open document,
 * while `pathToFileURL` on a scanned path yields `file:///C:/dir/a.sysml`.
 */

/**
 * Canonical key of a URI, so that the spellings of one Windows file compare
 * equal: a `file://` URI's drive letter is lowercased and its percent-encoded
 * colon (`%3A`) decoded. The rest of the URI, including its path case, is kept
 * as is, as distinct documents may differ only in case.
 */
export function canonicalUri(uri: string): string {
    return uri.replace(/^file:\/\/\/([A-Za-z])(?::|%3[Aa])(?=\/|$)/, (_m, drive: string) => `file:///${drive.toLowerCase()}:`);
}

/** Whether two URIs name the same document (see `canonicalUri`). */
export function isSameDocumentUri(a: string, b: string): boolean {
    return a === b || canonicalUri(a) === canonicalUri(b);
}
