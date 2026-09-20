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
     * Resolves each query to every element whose name exactly matches,
     * keyed by the query's own `name` (brackets and all, for a short-name
     * query). A query containing `::` matches by `qualifiedName` --
     * against `` `${scope}::${name}` `` when a *usable* `scope` is given
     * (`name` is then a path *relative to* `scope`, e.g.
     * `name: "A::Wheel", scope: "X"` matches only `X::A::Wheel`), or,
     * when `scope` is omitted -- or `name` already starts with
     * `` `${scope}::` `` (`scope` is already part of `name`, so it would
     * only double up; treated the same as omitted) -- against `name` as an
     * exact match *or* as a trailing path segment of a longer
     * `qualifiedName` (so `"A::Wheel"` matches both a top-level `A::Wheel`
     * and a nested `X::A::Wheel`) -- `scope` is what pins a partial path to
     * one exact location instead of matching it wherever it occurs.
     * A query wrapped in `<...>` (e.g. `<whl>`, mirroring the grammar's own
     * `<shortName>` delimiter syntax) matches only a declared short-name
     * alias -- never the long name. Any other query matches only the
     * declared simple `name` -- never a short name -- so a plain-name query
     * can't accidentally hit an unrelated element's alias. The bracketed and
     * plain forms search at any nesting depth, within `scope`'s subtree if
     * given, else anywhere in the workspace. Exact, case-sensitive equality
     * only -- no substring or fuzzy matching, unlike `workspace/symbol`.
     * Standard-library elements aren't reachable yet -- see `scope`'s doc
     * comment on `ElementLookupQuery`.
     */
    elementLookup(params: SysMLElementLookupParams): SysMLElementLookupResult {
        const allSymbols = this.documentManager.getWorkspaceSymbolTable().getAllSymbolsIncludingDuplicates();
        const results: Record<string, ElementMatch[]> = {};
        for (const query of params?.queries ?? []) {
            const matches = this.resolveMatches(allSymbols, query.name, query.scope);
            results[query.name] = matches.map(sym => this.toElementMatch(sym));
        }
        return { results, indexingComplete: this.documentManager.isWorkspaceScanComplete() };
    }

    private resolveMatches(allSymbols: SysMLSymbol[], name: string, scope: string | undefined): SysMLSymbol[] {
        if (name.includes('::')) {
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
        const shortName = this.asShortNameQuery(name);
        if (shortName !== undefined) {
            return this.withinScope(allSymbols, scope).filter(sym => sym.shortName === shortName);
        }
        return this.withinScope(allSymbols, scope).filter(sym => sym.name === name);
    }

    /** Strips a query's `<shortName>` delimiters, or returns undefined if it isn't that form. */
    private asShortNameQuery(name: string): string | undefined {
        return name.length > 2 && name.startsWith('<') && name.endsWith('>')
            ? name.slice(1, -1)
            : undefined;
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
            qualifiedName: sym.qualifiedName,
            type: sym.kind,
            uri: sym.uri,
            range: sym.range,
        };
    }
}
