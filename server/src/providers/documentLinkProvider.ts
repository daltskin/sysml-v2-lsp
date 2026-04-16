import { TextDocument } from 'vscode-languageserver-textdocument';
import {
    DocumentLink,
    DocumentLinkParams,
    Range,
    TextDocuments,
} from 'vscode-languageserver/node.js';
import { DocumentManager } from '../documentManager.js';
import { resolveLibraryPackage } from '../library/libraryIndex.js';
import { isIdentPart as isIdentChar } from '../utils/identUtils.js';

/**
 * Find all SysML `import` statements in `text` without regex.
 *
 * Returns an array of { pathStart, pathEnd, importPath } objects
 * for each `import <path>;` found.
 */
function findImportStatements(text: string): Array<{ pathStart: number; pathEnd: number; importPath: string }> {
    const results: Array<{ pathStart: number; pathEnd: number; importPath: string }> = [];
    const len = text.length;
    let i = 0;

    while (i < len) {
        const idx = text.indexOf('import', i);
        if (idx === -1) break;

        // Ensure word boundary before 'import'
        if (idx > 0 && isIdentChar(text.charCodeAt(idx - 1))) {
            i = idx + 6;
            continue;
        }
        const afterImport = idx + 6;
        if (afterImport >= len) break;

        // Must be followed by whitespace
        const ch = text.charCodeAt(afterImport);
        if (ch !== 32 && ch !== 9 && ch !== 10 && ch !== 13) { // space, tab, LF, CR
            i = afterImport;
            continue;
        }

        // Skip whitespace after 'import'
        let j = afterImport;
        while (j < len) {
            const wc = text.charCodeAt(j);
            if (wc !== 32 && wc !== 9 && wc !== 10 && wc !== 13) break;
            j++;
        }
        if (j >= len) break;

        // Read the qualified path: identifier segments separated by '::',
        // optionally ending with '*'
        const pathStart = j;
        while (j < len) {
            if (text.charCodeAt(j) === 42) { // '*'
                j++;
                break;
            }
            if (!isIdentChar(text.charCodeAt(j))) break;
            while (j < len && isIdentChar(text.charCodeAt(j))) j++;
            // Check for '::' separator
            if (j + 1 < len && text[j] === ':' && text[j + 1] === ':') {
                j += 2;
            } else {
                break;
            }
        }
        const pathEnd = j;
        if (pathEnd <= pathStart) { i = j; continue; }

        // Skip whitespace, then expect ';'
        while (j < len && (text.charCodeAt(j) === 32 || text.charCodeAt(j) === 9)) j++;
        if (j >= len || text[j] !== ';') { i = j; continue; }

        results.push({ pathStart, pathEnd, importPath: text.substring(pathStart, pathEnd) });
        i = j + 1;
    }

    return results;
}

/**
 * Strip trailing `::*` or `:*` from an import path for lookup.
 */
function stripTrailingWildcard(path: string): string {
    if (path.endsWith('::*')) return path.slice(0, -3);
    if (path.endsWith(':*')) return path.slice(0, -2);
    return path;
}

/**
 * Provides clickable document links for `import` statements.
 *
 * Turns `import Camera::Optics;` into a clickable link that
 * jumps to the definition of `Camera` or `Camera::Optics`.
 */
export class DocumentLinkProvider {

    constructor(
        private documentManager: DocumentManager,
        private documents: TextDocuments<TextDocument>,
    ) { }

    provideDocumentLinks(params: DocumentLinkParams): DocumentLink[] {
        const uri = params.textDocument.uri;
        const doc = this.documents.get(uri);
        if (!doc) return [];

        const text = doc.getText();
        const links: DocumentLink[] = [];

        // Use shared workspace symbol table for cross-file resolution
        const symbolTable = this.documentManager.getWorkspaceSymbolTable();

        // Find all import statements in the text (no regex)
        const imports = findImportStatements(text);

        for (const imp of imports) {
            const startPos = doc.positionAt(imp.pathStart);
            const endPos = doc.positionAt(imp.pathEnd);

            // Strip trailing ::* for lookup
            const lookupName = stripTrailingWildcard(imp.importPath);
            const target = this.resolveImportTarget(lookupName, symbolTable);

            if (target) {
                links.push({
                    range: Range.create(startPos, endPos),
                    target: target.uri,
                    tooltip: `Go to ${lookupName}`,
                });
            } else {
                // Still create a link even if unresolved — shows it's meant to be navigable
                links.push({
                    range: Range.create(startPos, endPos),
                    tooltip: `${lookupName} (unresolved)`,
                });
            }
        }

        return links;
    }

    private resolveImportTarget(qualifiedName: string, symbolTable: ReturnType<DocumentManager['getWorkspaceSymbolTable']>): { uri: string } | undefined {
        // Try exact qualified name first
        const exact = symbolTable.getSymbol(qualifiedName);
        if (exact) return { uri: exact.uri };

        // Try the first segment as a simple name
        const firstSegment = qualifiedName.split('::')[0];
        const matches = symbolTable.findByName(firstSegment);
        if (matches.length > 0) return { uri: matches[0].uri };

        // Fall back to the standard library index
        const libUri = resolveLibraryPackage(qualifiedName);
        if (libUri) return { uri: libUri };

        return undefined;
    }
}
