/**
 * Shared character-classification and identifier-scanning utilities.
 *
 * Consolidates functions that were previously duplicated across
 * definitionProvider, hoverProvider, signatureHelpProvider,
 * renameProvider, sysmlModelProvider, and libraryIndex.
 */

/** Whether `c` can start an identifier (A-Z, a-z, _). */
export function isIdentStart(c: number): boolean {
    return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95;
}

/**
 * Whether `c` can appear inside an identifier (A-Z, a-z, 0-9, _).
 *
 * This is the single canonical implementation — replaces the former
 * `isWordChar` helpers that had the same logic.
 */
export function isIdentPart(c: number): boolean {
    return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 95;
}

/**
 * Find the qualified name at `character` in `lineText` without regex.
 * Scans for contiguous identifier segments separated by '::'.
 *
 * Example: for `ISQ::mass` with `character` anywhere inside the span,
 * returns `"ISQ::mass"`.
 */
export function extractQualifiedNameAt(lineText: string, character: number): string | undefined {
    const len = lineText.length;
    let i = 0;

    while (i < len) {
        if (!isIdentStart(lineText.charCodeAt(i))) { i++; continue; }

        const wordStart = i;
        while (i < len) {
            while (i < len && isIdentPart(lineText.charCodeAt(i))) i++;
            if (i + 2 <= len && lineText[i] === ':' && lineText[i + 1] === ':' &&
                i + 2 < len && isIdentStart(lineText.charCodeAt(i + 2))) {
                i += 2;
            } else {
                break;
            }
        }
        const wordEnd = i;

        if (character >= wordStart && character <= wordEnd) {
            return lineText.substring(wordStart, wordEnd);
        }
    }

    return undefined;
}

/**
 * Replace line and block comments with spaces while preserving line/offset
 * positions so index-based scans remain valid.
 */
export function stripComments(text: string): string {
    return text
        .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
        .replace(/\/\/[^\n]*/g, m => ' '.repeat(m.length));
}
