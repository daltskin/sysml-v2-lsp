import { Location, ReferenceParams } from 'vscode-languageserver/node';
import { DocumentManager } from '../documentManager.js';
import { NameReferences } from '../symbols/nameReferences.js';

/** Find complete source references across the workspace, with exact name ranges. */
export class ReferencesProvider {
    constructor(private readonly documentManager: DocumentManager) { }

    provideReferences(params: ReferenceParams): Location[] {
        const references = new NameReferences(this.documentManager);
        const ref = references.at(params.textDocument.uri, params.position);
        return ref?.symbol
            ? references.to(ref.symbol, params.context.includeDeclaration)
                .map(({ uri, range }) => ({ uri, range }))
            : [];
    }
}
