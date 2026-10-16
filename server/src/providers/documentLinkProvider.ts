import { TextDocument } from 'vscode-languageserver-textdocument';
import {
    DocumentLink,
    DocumentLinkParams,
    Range,
    TextDocuments,
} from 'vscode-languageserver/node';
import { DocumentManager } from '../documentManager.js';
import { resolveLibraryPackage } from '../library/libraryIndex.js';
import { readQualifiedNameAt, scanQualifiedNames, splitQualifiedName } from '../utils/identUtils.js';

/**
 * Find all SysML `import` statements in `text` without regex.
 *
 * Returns an array of { pathStart, pathEnd, importPath } objects
 * for each `import <path>;` found.
 */
function findImportStatements(text: string): Array<{ pathStart: number; pathEnd: number; importPath: string }> {
    const results: Array<{ pathStart: number; pathEnd: number; importPath: string }> = [];
    for (const keyword of scanQualifiedNames(text)) {
        if (text.slice(keyword.start, keyword.end) !== 'import') continue;
        let start = keyword.end;
        while (start < text.length && /\s/.test(text[start])) start++;
        const path = readQualifiedNameAt(text, start);
        if (!path) continue;
        const suffix = text.slice(path.end).match(/^\s*(::\*\*(?=;|\s)|::\*(?=;|\s))?\s*;/);
        if (!suffix) continue;
        const wildcard = suffix[1] ?? '';
        results.push({
            pathStart: path.start,
            pathEnd: path.end + (wildcard ? suffix[0].indexOf(wildcard) + wildcard.length : 0),
            importPath: path.name,
        });
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
        const firstSegment = splitQualifiedName(qualifiedName)[0];
        const matches = symbolTable.findByName(firstSegment);
        if (matches.length > 0) return { uri: matches[0].uri };

        // Fall back to the standard library index
        const libUri = resolveLibraryPackage(qualifiedName);
        if (libUri) return { uri: libUri };

        return undefined;
    }
}
