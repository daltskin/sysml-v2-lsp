import {
    LinkedEditingRangeParams,
    LinkedEditingRanges,
} from 'vscode-languageserver/node';
import { DocumentManager } from '../documentManager.js';
import { NameReferences } from '../symbols/nameReferences.js';

/**
 * Provides linked editing ranges — when you edit a symbol name,
 * all other occurrences of that name in the same document update
 * simultaneously (mirror editing).
 */
export class LinkedEditingRangeProvider {

    constructor(private documentManager: DocumentManager) { }

    provideLinkedEditingRanges(params: LinkedEditingRangeParams): LinkedEditingRanges | null {
        const uri = params.textDocument.uri;
        const references = new NameReferences(this.documentManager);
        const ref = references.at(uri, params.position);
        if (!ref?.symbol) return null;
        const sameDocRefs = references.to(ref.symbol)
            .filter(occurrence => occurrence.uri === uri && occurrence.name === ref.name);

        if (sameDocRefs.length <= 1) return null;

        return {
            ranges: sameDocRefs.map(ref => ref.range),
        };
    }
}
