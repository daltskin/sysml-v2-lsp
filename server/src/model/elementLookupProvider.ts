/**
 * Provider for the `sysml/elementLookup` custom LSP request — see
 * `elementLookupTypes.ts` for the protocol shapes and rationale.
 */

import { DocumentManager } from '../documentManager.js';
import { SysMLSymbol } from '../symbols/sysmlElements.js';
import type {
    ElementLookupQueryKind,
    ElementMatch,
    SysMLElementLookupParams,
    SysMLElementLookupResult,
} from './elementLookupTypes.js';

export class ElementLookupProvider {

    constructor(private readonly documentManager: DocumentManager) { }

    /**
     * Resolves each query to every element whose name exactly matches,
     * keyed by the query's own `name`. `kind` says which of `name`/
     * `shortName`/`qualifiedName` to match against (inferred from `name`'s
     * shape when omitted); `scope` narrows a `'name'`/`'shortName'` match to
     * a namespace, or completes a `'qualifiedName'` one relative to it. See
     * `ElementLookupQuery`'s doc comment in `elementLookupTypes.ts` for the
     * exact matching rules.
     */
    elementLookup(params: SysMLElementLookupParams): SysMLElementLookupResult {
        const allSymbols = this.documentManager.getWorkspaceSymbolTable().getAllSymbolsIncludingDuplicates();
        const results: Record<string, ElementMatch[]> = {};
        for (const query of params?.queries ?? []) {
            const kind = query.kind ?? (query.name.includes('::') ? 'qualifiedName' : 'name');
            const matches = this.resolveMatches(allSymbols, query.name, kind, query.scope);
            results[query.name] = matches.map(sym => this.toElementMatch(sym));
        }
        return { results, indexingComplete: this.documentManager.isWorkspaceScanComplete() };
    }

    private resolveMatches(
        allSymbols: SysMLSymbol[],
        name: string,
        kind: ElementLookupQueryKind,
        scope: string | undefined,
    ): SysMLSymbol[] {
        if (kind === 'qualifiedName') {
            // A scope that's already the leading segment of `name` (e.g. name
            // "A::Wheel", scope "A") is redundant, not a further restriction --
            // prepending it would build a nonsensical "A::A::Wheel" target, so
            // treat this the same as no scope at all.
            const isScopeRedundant = scope !== undefined && name.startsWith(`${scope}::`);
            if (scope && !isScopeRedundant) {
                const target = `${scope}::${name}`;
                return allSymbols.filter(sym => sym.qualifiedName === target);
            }
            const suffix = `::${name}`;
            return allSymbols.filter(sym => sym.qualifiedName === name || sym.qualifiedName.endsWith(suffix));
        }
        if (kind === 'shortName') {
            return this.withinScope(allSymbols, scope).filter(sym => sym.shortName === name);
        }
        return this.withinScope(allSymbols, scope).filter(sym => sym.name === name);
    }

    /**
     * Narrows candidates to a namespace's subtree -- anything nested under
     * `scope`, at any depth -- when `scope` is given; an empty/absent
     * `scope` means "search the whole workspace" (returns `symbols` as-is).
     */
    private withinScope(symbols: SysMLSymbol[], scope: string | undefined): SysMLSymbol[] {
        if (!scope) return symbols;
        const prefix = `${scope}::`;
        return symbols.filter(sym => sym.qualifiedName.startsWith(prefix));
    }

    private toElementMatch(sym: SysMLSymbol): ElementMatch {
        return {
            name: sym.name,
            shortName: sym.shortName,
            qualifiedName: sym.qualifiedName,
            type: sym.kind,
            uri: sym.uri,
            range: sym.range,
        };
    }
}
