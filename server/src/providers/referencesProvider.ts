import {
    ReferenceParams,
    Location,
} from 'vscode-languageserver/node.js';
import { DocumentManager } from '../documentManager.js';

/**
 * Provides find-all-references for SysML elements.
 */
export class ReferencesProvider {

    constructor(private documentManager: DocumentManager) { }

    provideReferences(params: ReferenceParams): Location[] {
        const result = this.documentManager.get(params.textDocument.uri);
        if (!result) {
            return [];
        }

        // Use shared workspace symbol table (includes all documents)
        const symbolTable = this.documentManager.getWorkspaceSymbolTable();

        // Find symbol at position
        const symbol = symbolTable.findSymbolAtPosition(
            params.textDocument.uri,
            params.position.line,
            params.position.character,
        );

        if (!symbol) {
            return [];
        }

        // Find all references across all files
        const references = symbolTable.findReferences(symbol.name);
        const locations: Location[] = [];

        for (const ref of references) {
            locations.push({
                uri: ref.uri,
                range: ref.selectionRange,
            });
        }

        // Include the definition itself if requested
        if (params.context.includeDeclaration) {
            // Already included through findReferences
        }

        return locations;
    }
}
