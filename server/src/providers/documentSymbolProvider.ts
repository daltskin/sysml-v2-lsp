import {
    DocumentSymbol,
    DocumentSymbolParams,
} from 'vscode-languageserver/node';
import { DocumentManager } from '../documentManager.js';
import { SysMLSymbol, displayName, toMetaclassName } from '../symbols/sysmlElements.js';
import { toSysMLSymbolKind } from './symbolKindMapping.js';

/**
 * Provides document symbols for the outline panel and breadcrumbs.
 * Walks the symbol table and builds a hierarchical DocumentSymbol tree.
 */
export class DocumentSymbolProvider {

    constructor(private documentManager: DocumentManager) { }

    provideDocumentSymbols(params: DocumentSymbolParams): DocumentSymbol[] {
        const symbolTable = this.documentManager.getSymbolTable(params.textDocument.uri);
        if (!symbolTable) {
            return [];
        }

        // Get all symbols for this document
        const symbols = symbolTable.getSymbolsForUri(params.textDocument.uri);

        // Build hierarchical structure
        return this.buildHierarchy(symbols);
    }

    private buildHierarchy(symbols: SysMLSymbol[]): DocumentSymbol[] {
        // Separate top-level symbols from children, linked by their owner's elementId
        const topLevel: SysMLSymbol[] = [];
        const elementIds = new Set(symbols.map(sym => sym.elementId));
        const childrenOf = new Map<string, SysMLSymbol[]>();

        for (const sym of symbols) {
            if (!sym.parentId || !elementIds.has(sym.parentId)) {
                topLevel.push(sym);
            } else {
                const siblings = childrenOf.get(sym.parentId) ?? [];
                siblings.push(sym);
                childrenOf.set(sym.parentId, siblings);
            }
        }

        const buildSymbol = (sym: SysMLSymbol): DocumentSymbol => {
            const children = childrenOf.get(sym.elementId) ?? [];
            return {
                name: displayName(sym),
                detail: toMetaclassName(sym.kind),
                kind: toSysMLSymbolKind(sym.kind),
                range: sym.range,
                selectionRange: sym.selectionRange,
                children: children.map(buildSymbol),
            };
        };

        return topLevel.map(buildSymbol);
    }
}
