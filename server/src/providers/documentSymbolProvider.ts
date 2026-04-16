import {
    DocumentSymbol,
    DocumentSymbolParams,
} from 'vscode-languageserver/node.js';
import { DocumentManager } from '../documentManager.js';
import { SysMLSymbol, toMetaclassName } from '../symbols/sysmlElements.js';
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
        // Separate top-level symbols from children
        const topLevel: SysMLSymbol[] = [];
        const byQualifiedName = new Map<string, SysMLSymbol>();
        const childrenOf = new Map<string, SysMLSymbol[]>();

        for (const sym of symbols) {
            byQualifiedName.set(sym.qualifiedName, sym);
            if (!sym.parentQualifiedName) {
                topLevel.push(sym);
            } else {
                const siblings = childrenOf.get(sym.parentQualifiedName) ?? [];
                siblings.push(sym);
                childrenOf.set(sym.parentQualifiedName, siblings);
            }
        }

        const buildSymbol = (sym: SysMLSymbol): DocumentSymbol => {
            const children = childrenOf.get(sym.qualifiedName) ?? [];
            return {
                name: sym.name,
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
