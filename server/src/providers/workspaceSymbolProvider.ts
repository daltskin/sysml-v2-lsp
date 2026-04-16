import {
    SymbolInformation,
    WorkspaceSymbolParams,
} from 'vscode-languageserver/node.js';
import { DocumentManager } from '../documentManager.js';
import { toSysMLSymbolKind } from './symbolKindMapping.js';

/**
 * Provides workspace-wide symbol search (Ctrl+T / # search).
 *
 * Aggregates symbols from all open/parsed documents, supporting
 * fuzzy filtering by name.
 */
export class WorkspaceSymbolProvider {

    constructor(private documentManager: DocumentManager) { }

    provideWorkspaceSymbols(params: WorkspaceSymbolParams): SymbolInformation[] {
        const query = params.query.toLowerCase();

        const symbolTable = this.documentManager.getWorkspaceSymbolTable();
        const allSymbols = symbolTable.getAllSymbols();
        const results: SymbolInformation[] = [];

        for (const sym of allSymbols) {
            // Filter by query (empty query returns all)
            if (query && !sym.name.toLowerCase().includes(query) &&
                !sym.qualifiedName.toLowerCase().includes(query)) {
                continue;
            }

            results.push({
                name: sym.name,
                kind: toSysMLSymbolKind(sym.kind),
                location: {
                    uri: sym.uri,
                    range: sym.selectionRange,
                },
                containerName: sym.parentQualifiedName,
            });

            // Limit results to avoid overwhelming the UI
            if (results.length >= 200) break;
        }

        return results;
    }
}
