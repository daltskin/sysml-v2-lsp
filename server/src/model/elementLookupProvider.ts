/**
 * Provider for the `sysml/elementLookup` custom LSP request — see
 * `elementLookupTypes.ts` for the protocol shapes and rationale.
 */

import { DocumentManager } from '../documentManager.js';
import { SysMLSymbol } from '../symbols/sysmlElements.js';
import type { ElementMatch, SysMLElementLookupParams, SysMLElementLookupResult } from './elementLookupTypes.js';

export class ElementLookupProvider {

    constructor(private readonly documentManager: DocumentManager) { }

    /**
     * Resolves each query to every element whose name exactly matches, in
     * request order. A query containing `::` matches by full `qualifiedName`;
     * a bare query matches by simple `name`, at any nesting depth. Exact,
     * case-sensitive equality only -- no substring or fuzzy matching, unlike
     * `workspace/symbol`.
     */
    elementLookup(params: SysMLElementLookupParams): SysMLElementLookupResult {
        const allSymbols = this.documentManager.getWorkspaceSymbolTable().getAllSymbolsIncludingDuplicates();
        const results = (params?.queries ?? []).map(query => {
            const matches = query.name.includes('::')
                ? allSymbols.filter(sym => sym.qualifiedName === query.name)
                : allSymbols.filter(sym => sym.name === query.name);
            return matches.map(sym => this.toElementMatch(sym));
        });
        return { results };
    }

    private toElementMatch(sym: SysMLSymbol): ElementMatch {
        return {
            qualifiedName: sym.qualifiedName,
            type: sym.kind,
            uri: sym.uri,
            range: sym.range,
        };
    }
}
