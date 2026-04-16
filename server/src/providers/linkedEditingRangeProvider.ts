import {
    LinkedEditingRangeParams,
    LinkedEditingRanges,
} from 'vscode-languageserver/node.js';
import { DocumentManager } from '../documentManager.js';

/**
 * Provides linked editing ranges — when you edit a symbol name,
 * all other occurrences of that name in the same document update
 * simultaneously (mirror editing).
 */
export class LinkedEditingRangeProvider {

    constructor(private documentManager: DocumentManager) { }

    provideLinkedEditingRanges(params: LinkedEditingRangeParams): LinkedEditingRanges | null {
        const uri = params.textDocument.uri;
        const symbolTable = this.documentManager.getSymbolTable(uri);
        if (!symbolTable) return null;

        const text = this.documentManager.getText(uri);
        if (!text) return null;

        // Find symbol at cursor (declaration or reference)
        const symbol = symbolTable.findSymbolAtPosition(
            uri,
            params.position.line,
            params.position.character,
        );
        if (!symbol) return null;

        // Find all references with the same name in this document
        const allRefs = symbolTable.findReferences(symbol.name);
        const sameDocRefs = allRefs.filter(ref => ref.uri === uri);

        if (sameDocRefs.length <= 1) return null;

        return {
            ranges: sameDocRefs.map(ref => ref.selectionRange),
        };
    }
}
