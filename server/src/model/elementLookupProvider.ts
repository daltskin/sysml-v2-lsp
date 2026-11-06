/**
 * Provider for the `sysml/elementLookup` custom LSP request — see
 * `elementLookupTypes.ts` for the protocol shapes and rationale.
 */

import { DocumentManager } from '../documentManager.js';
import { SysMLElementKind, SysMLSymbol } from '../symbols/sysmlElements.js';
import { ParsedQualifiedName, escapedQualifiedName, joinQualifiedName, parseQualifiedName } from '../utils/identUtils.js';
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
     * `shortName`/`qualifiedName` to match against (inferred from `name`
     * read in the textual notation when omitted, `inferredKind`); `scope`
     * narrows a `'name'`/`'shortName'` match to a namespace, or completes
     * a `'qualifiedName'` one relative to it. See `ElementLookupQuery`'s doc
     * comment in `elementLookupTypes.ts` for the exact matching rules.
     * Object.create(null) avoids Object.prototype special-casing keys like
     * __proto__ (a valid SysML element name), which would otherwise be
     * silently dropped when set on a plain {} literal.
     */
    elementLookup(params: SysMLElementLookupParams): SysMLElementLookupResult {
        const allSymbols = this.documentManager.getWorkspaceSymbolTable().getAllSymbolsIncludingDuplicates();
        const results: Record<string, ElementMatch[]> = Object.create(null);
        for (const query of params?.queries ?? []) {
            // A query without a string `name` can't be keyed and is left out; one whose `scope`
            // is neither a string nor absent matches nothing.
            if (typeof query?.name !== 'string') continue;
            if (query.scope != null && typeof query.scope !== 'string') {
                results[query.name] = [];
                continue;
            }
            // `name` is read once, both to infer the kind and to match it as a qualified name.
            const parsed = query.kind === undefined || query.kind === 'qualifiedName' ? parseQualifiedName(query.name) : undefined;
            const kind = query.kind ?? inferredKind(query.name, parsed);
            const matches = this.resolveMatches(allSymbols, query.name, parsed, kind, query.scope);
            // A package declared in several documents is one element, reported once.
            const matchedPackages = new Set<string>();
            results[query.name] = matches.filter(sym => {
                if (sym.kind !== SysMLElementKind.Package) return true;
                if (matchedPackages.has(sym.symbolId)) return false;
                matchedPackages.add(sym.symbolId);
                return true;
            }).map(sym => this.toElementMatch(sym));
        }
        return { results, indexingComplete: this.documentManager.isWorkspaceScanComplete() };
    }

    private resolveMatches(
        allSymbols: SysMLSymbol[],
        name: string,
        parsed: ParsedQualifiedName | undefined,
        kind: ElementLookupQueryKind,
        scope: string | undefined,
    ): SysMLSymbol[] {
        if (kind === 'qualifiedName') {
            // `name` (read as `parsed`) and `scope` are qualified names in the textual notation, matched by their names.
            const parsedScope = scope ? parseQualifiedName(scope) : { global: false, names: [] };
            if (!parsed || !parsedScope) return [];
            const names = parsed.names;
            const scopeNames = parsedScope.names;
            // A global name (`$::`) is resolved from the root namespace (KerML 7.2.5.1): matched
            // exactly, never as a suffix, and not relative to `scope`.
            if (parsed.global) {
                const key = joinQualifiedName(names);
                return allSymbols.filter(sym => sym.qualifiedName === key);
            }
            // A scope that's already the leading segment of `name` (e.g. name
            // "A::Wheel", scope "A") is redundant, not a further restriction --
            // prepending it would build a nonsensical "A::A::Wheel" target, so
            // treat this the same as no scope at all.
            const isScopeRedundant = scopeNames.length < names.length
                && scopeNames.every((scopeName, i) => names[i] === scopeName);
            if (scopeNames.length > 0 && !isScopeRedundant) {
                const target = joinQualifiedName([...scopeNames, ...names]);
                return allSymbols.filter(sym => sym.qualifiedName === target);
            }
            const key = joinQualifiedName(names);
            const suffix = `::${key}`;
            return allSymbols.filter(sym => sym.qualifiedName !== undefined
                && (sym.qualifiedName === key || sym.qualifiedName.endsWith(suffix)));
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
        // `scope` is a qualified name in the textual notation, matched by its names; it is
        // always a path from the root, so a global `$::` changes nothing.
        const parsedScope = parseQualifiedName(scope);
        if (!parsedScope) return [];
        const prefix = `${joinQualifiedName(parsedScope.names)}::`;
        const byId = new Map(symbols.map(sym => [sym.symbolId, sym]));
        return symbols.filter(sym => {
            if (sym.qualifiedName !== undefined) return sym.qualifiedName.startsWith(prefix);
            // Without a qualified name (inside an anonymous element): placed by its nearest owner that has one.
            let owner = sym.parentId ? byId.get(sym.parentId) : undefined;
            while (owner && owner.qualifiedName === undefined) {
                owner = owner.parentId ? byId.get(owner.parentId) : undefined;
            }
            return owner?.qualifiedName !== undefined && `${owner.qualifiedName}::`.startsWith(prefix);
        });
    }

    private toElementMatch(sym: SysMLSymbol): ElementMatch {
        return {
            name: sym.name,
            shortName: sym.shortName,
            qualifiedName: sym.qualifiedName === undefined ? null : escapedQualifiedName(sym.qualifiedName),
            symbolId: sym.symbolId,
            type: sym.kind,
            uri: sym.uri,
            range: sym.range,
        };
    }
}

/**
 * What a query's `name` denotes when its `kind` is omitted: a qualified name if, as `parsed` reads
 * it in the textual notation (KerML 8.2.3.5.1), it is global, has several names, or is written
 * other than as its one name, such as quoted; otherwise a name, matched as declared.
 */
function inferredKind(name: string, parsed: ParsedQualifiedName | undefined): ElementLookupQueryKind {
    return parsed && (parsed.global || parsed.names.length > 1 || parsed.names[0] !== name) ? 'qualifiedName' : 'name';
}
