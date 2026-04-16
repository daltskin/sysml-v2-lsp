import {
    DefinitionParams,
    Location,
} from 'vscode-languageserver/node.js';
import { DocumentManager } from '../documentManager.js';
import { resolveLibraryPackage, resolveLibraryType } from '../library/libraryIndex.js';
import { extractQualifiedNameAt } from '../utils/identUtils.js';

/**
 * Provides go-to-definition for SysML elements.
 * Resolves symbol at cursor → jumps to its declaration.
 * Falls back to standard library type definitions when no
 * local definition is found.
 */
export class DefinitionProvider {

    constructor(private documentManager: DocumentManager) { }

    provideDefinition(params: DefinitionParams): Location | null {
        const symbolTable = this.documentManager.getSymbolTable(params.textDocument.uri);
        if (!symbolTable) {
            return null;
        }

        // Workspace-wide symbol table for cross-file lookups (imports etc.)
        const wsSymbolTable = this.documentManager.getWorkspaceSymbolTable();

        // Find what's at the cursor
        const symbol = symbolTable.findSymbolAtPosition(
            params.textDocument.uri,
            params.position.line,
            params.position.character,
        );

        if (!symbol) {
            // Try looking up by word at position
            const text = this.documentManager.getText(params.textDocument.uri);
            if (!text) return null;

            const word = this.getWordAtPosition(text, params.position.line, params.position.character);
            if (!word) return null;

            // For qualified names (e.g. ISQ::mass), prefer the
            // standard library — the qualifier is a strong signal
            // that the user means a library package, not a local symbol.
            if (word.includes('::')) {
                const libLoc = this.resolveFromLibrary(word);
                if (libLoc) return libLoc;

                // Fall back to local then workspace-wide member lookup
                const member = word.split('::').pop()!;
                const memberMatches = symbolTable.findByName(member);
                if (memberMatches.length > 0) {
                    return {
                        uri: memberMatches[0].uri,
                        range: memberMatches[0].selectionRange,
                    };
                }
                const wsMemberMatches = wsSymbolTable.findByName(member);
                if (wsMemberMatches.length > 0) {
                    return {
                        uri: wsMemberMatches[0].uri,
                        range: wsMemberMatches[0].selectionRange,
                    };
                }
                return null;
            }

            // Unqualified name — search local symbols first, then workspace
            const matches = symbolTable.findByName(word);
            if (matches.length > 0) {
                return {
                    uri: matches[0].uri,
                    range: matches[0].selectionRange,
                };
            }
            const wsMatches = wsSymbolTable.findByName(word);
            if (wsMatches.length > 0) {
                return {
                    uri: wsMatches[0].uri,
                    range: wsMatches[0].selectionRange,
                };
            }

            // Fall back to the standard library
            return this.resolveFromLibrary(word);
        }

        // If the symbol has a type, try to navigate to the type definition
        if (symbol.typeName) {
            const typeMatches = symbolTable.findByName(symbol.typeName);
            if (typeMatches.length > 0) {
                return {
                    uri: typeMatches[0].uri,
                    range: typeMatches[0].selectionRange,
                };
            }
            const wsTypeMatches = wsSymbolTable.findByName(symbol.typeName);
            if (wsTypeMatches.length > 0) {
                return {
                    uri: wsTypeMatches[0].uri,
                    range: wsTypeMatches[0].selectionRange,
                };
            }

            // Fall back to the standard library for the type
            const libLoc = this.resolveFromLibrary(symbol.typeName);
            if (libLoc) return libLoc;
        }

        return {
            uri: symbol.uri,
            range: symbol.selectionRange,
        };
    }

    /**
     * Resolve a name against the bundled SysML standard library.
     * Returns a Location pointing to the `.kerml` / `.sysml` file
     * and line where the type is declared, or `null`.
     */
    private resolveFromLibrary(name: string): Location | null {
        const loc = resolveLibraryType(name);
        if (loc) {
            return {
                uri: loc.uri,
                range: {
                    start: { line: loc.line, character: 0 },
                    end: { line: loc.line, character: 0 },
                },
            };
        }

        // Fall back to library package resolution (e.g. USCustomaryUnits, SI)
        const pkgUri = resolveLibraryPackage(name);
        if (pkgUri) {
            return {
                uri: pkgUri,
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 0 },
                },
            };
        }

        return null;
    }

    private getWordAtPosition(text: string, line: number, character: number): string | undefined {
        const lines = text.split('\n');
        if (line >= lines.length) return undefined;

        const lineText = lines[line];
        if (character >= lineText.length) return undefined;

        // Scan for qualified names (e.g. ISQ::mass, Pkg::Type) without regex
        return extractQualifiedNameAt(lineText, character);
    }
}


