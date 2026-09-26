/**
 * Namespace/import/visibility mechanics (SysML v2 §7.5): given a namespace,
 * what members does it actually have -- its own, plus whatever its `import`
 * statements bring in. This is the pure §7.5 model; standard-library/ISQ
 * type recognition builds on top of it in `typeResolution.ts`.
 *
 * Shared between `SemanticValidator` (editor diagnostics) and
 * `SysMLModelProvider` (the `sysml/model` request's own diagnostics) so both
 * agree on what "resolved" means -- extracted here specifically so neither
 * has to import the other (they already depend on each other for unrelated
 * features, and importing a full sibling class both ways would recurse at
 * construction time).
 */

import { FilterExpr, ImportTarget, SysMLElementKind, SysMLSymbol, isDefinition, isUsage } from './sysmlElements.js';

export interface SymbolIndexes {
    byName: Map<string, SysMLSymbol[]>;
    byParent: Map<string, SysMLSymbol[]>;
    byQualifiedName: Map<string, SysMLSymbol>;
    definitionsByName: Map<string, SysMLSymbol[]>;
    portsByName: Map<string, SysMLSymbol[]>;
}

/** One entry in a namespace's resolved member table (see `NamespaceResolver.getResolvedMembers`). */
export interface ResolvedMember {
    symbol: SysMLSymbol;
    /** Effective visibility of this membership *within its resolving namespace*. */
    visibility: 'public' | 'private' | 'protected';
}

/** Permissiveness order for picking the effective visibility when the same
 *  element has more than one membership of a namespace 
 * (see `getResolvedMembers`'s `addMember`).
 */
const VISIBILITY_RANK: Record<ResolvedMember['visibility'], number> = { public: 2, protected: 1, private: 0 };

/**
 * Depth cap for the specialization-chain walk in `isSpecializationOf`. Not the
 * actual cycle guard (that's its `visited` set) -- a generous safety net in
 * case that guard ever has a gap, since no real model specializes this deep.
 */
const MAX_SPECIALIZATION_CHAIN_DEPTH = 64;

/**
 * Depth cap for the enclosing-namespace climb in `namespaceAncestorsOf`. A
 * safety net against a malformed/cyclic `parentQualifiedName` chain, since no
 * real model nests namespaces anywhere near this deep.
 */
const MAX_NAMESPACE_NESTING_DEPTH = 64;

/**
 * QualifiedNames claimed by more than one symbol *of the same kind* --
 * excluding Package, since a package may legitimately be "reopened" under
 * the same qualifiedName (across files, or at multiple positions in one
 * file; merged by `SymbolTable.mergePackageFragments`), which is a
 * different thing from a naming conflict.
 *
 * This mirrors KerML's own well-formedness rule rather than an assumption:
 * `Membership.isDistinguishableFrom` (KerML v1.0 §8.3.2.4.4) states two
 * memberships ARE distinguishable -- i.e. NOT a conflict -- "if... neither
 * of the metaclasses of the memberElement of this Membership and the
 * memberElement of the other Membership conform to the other", regardless
 * of whether their names collide. So a `package A` and an unrelated
 * `part def A` sharing a bare name is valid SysML (their metaclasses don't
 * conform to each other) -- only two elements of the *same* (or a
 * conforming) kind sharing a name are genuinely not distinguishable, per
 * `Namespace.validateNamespaceDistinguishibility`'s "all memberships of a
 * Namespace must be distinguishable from each other."
 *
 * This codebase has no full SysML/KerML metaclass hierarchy to test general
 * conformance against, so "conforms" is approximated conservatively as
 * "identical `SysMLElementKind`" -- the one case where conformance is
 * unambiguous (a kind trivially conforms to itself) without guessing at
 * relationships (e.g. PartUsage vs. PartDefinition) this codebase doesn't
 * model. This may under-flag some real conflicts between genuinely related
 * but differently-named kinds, but never over-flags a legitimately
 * different-kind collision like the package/definition case above.
 *
 * Exported so `SemanticValidator` can flag each conflicting declaration
 * with its own diagnostic, using the same conflict definition
 * `buildSymbolIndexes` uses to keep such symbols' children from being
 * silently pooled together.
 */
export function findConflictedQualifiedNames(allSymbols: SysMLSymbol[]): Map<string, SysMLSymbol[]> {
    const byQualifiedNameAndKind = new Map<string, Map<SysMLElementKind, SysMLSymbol[]>>();
    for (const s of allSymbols) {
        let byKind = byQualifiedNameAndKind.get(s.qualifiedName);
        if (!byKind) {
            byKind = new Map();
            byQualifiedNameAndKind.set(s.qualifiedName, byKind);
        }
        const list = byKind.get(s.kind) ?? [];
        list.push(s);
        byKind.set(s.kind, list);
    }

    const conflicts = new Map<string, SysMLSymbol[]>();
    for (const [qualifiedName, byKind] of byQualifiedNameAndKind) {
        for (const [kind, symbols] of byKind) {
            if (kind === SysMLElementKind.Package || symbols.length <= 1) continue;
            const existing = conflicts.get(qualifiedName) ?? [];
            conflicts.set(qualifiedName, [...existing, ...symbols]);
        }
    }
    return conflicts;
}

/**
 * Where a conflicting declaration lives, as seen from the document `fromUri` being diagnosed --
 * worked out from the two URIs alone (no file access): "this document" when they are the same,
 * otherwise `uri` as a relative reference from `fromUri` (RFC 3986 §4.2, e.g. `wheel.sysml`,
 * `../lib/wheel.sysml`) when both share scheme and authority, else `uri` in full.
 */
export function describeDocumentLocation(uri: string, fromUri: string): string {
    if (uri === fromUri) return 'this document';
    let target: URL;
    let from: URL;
    try {
        target = new URL(uri);
        from = new URL(fromUri);
    } catch {
        return uri;
    }
    if (target.protocol !== from.protocol || target.host !== from.host) return uri;
    const targetSegments = target.pathname.split('/');
    const fromFolder = from.pathname.split('/').slice(0, -1);
    let common = 0;
    while (common < fromFolder.length && common < targetSegments.length - 1 && fromFolder[common] === targetSegments[common]) common++;
    const relative = [...fromFolder.slice(common).map(() => '..'), ...targetSegments.slice(common)].join('/');
    return decodeURIComponent(relative);
}

/**
 * The declarations in `conflicting` other than `symbol` itself, in a stable order (by document URI,
 * then position) -- compared by document and position, not object identity, since `symbol` may come
 * from a different symbol table (e.g. one document's own) than the workspace-wide `conflicting` list.
 */
export function otherDeclarations(conflicting: SysMLSymbol[], symbol: SysMLSymbol): SysMLSymbol[] {
    const start = (s: SysMLSymbol) => s.selectionRange.start;
    return conflicting
        .filter(s => !(s.uri === symbol.uri && start(s).line === start(symbol).line && start(s).character === start(symbol).character))
        .sort((a, b) => (a.uri < b.uri ? -1 : a.uri > b.uri ? 1 : start(a).line - start(b).line || start(a).character - start(b).character));
}

/**
 * The other declarations sharing a conflicted name, for a diagnostic on one of them: the first
 * one's kind and location (`describeDocumentLocation`, 1-based line), plus a count of any further
 * ones, e.g. "part def in document wheel.sysml (line 3) and 2 other occurrences".
 */
export function describeConflictingDeclarations(others: SysMLSymbol[], fromUri: string): string {
    if (others.length === 0) return '';
    const [first, ...rest] = others;
    const location = describeDocumentLocation(first.uri, fromUri);
    const described = `${first.kind} in ${location === 'this document' ? location : `document ${location}`} (line ${first.selectionRange.start.line + 1})`;
    if (rest.length === 0) return described;
    return `${described} and ${rest.length} other ${rest.length === 1 ? 'occurrence' : 'occurrences'}`;
}

/** Build the byName/byParent/byQualifiedName/etc. indexes a `NamespaceResolver` (and other checks) need from a flat symbol array. */
export function buildSymbolIndexes(allSymbols: SysMLSymbol[]): SymbolIndexes {
    const byName = new Map<string, SysMLSymbol[]>();
    const byParent = new Map<string, SysMLSymbol[]>();
    const byQualifiedName = new Map<string, SysMLSymbol>();
    const definitionsByName = new Map<string, SysMLSymbol[]>();
    const portsByName = new Map<string, SysMLSymbol[]>();

    // A conflicted qualifiedName (see `findConflictedQualifiedNames` -- two
    // same-kind symbols sharing a name, not e.g. a package and an unrelated
    // definition, which is valid) is excluded from `byQualifiedName` and
    // from ever owning pooled children in `byParent`: resolving straight
    // through a genuinely ambiguous name, or treating two indistinguishable
    // declarations' children as siblings in one namespace, would silently
    // paper over a real modeling error instead of surfacing it. This
    // intentionally also makes a reference *from inside* one of the
    // conflicting declarations to its own child unresolved, not just
    // external references through the ambiguous name -- the whole name is
    // invalid while the conflict exists, and `checkAmbiguousNamespaceName`
    // (semanticValidator.ts) flags the root cause on each conflicting
    // declaration.
    const conflictedQualifiedNames = new Set(findConflictedQualifiedNames(allSymbols).keys());

    for (const s of allSymbols) {
        const nameList = byName.get(s.name) ?? [];
        nameList.push(s);
        byName.set(s.name, nameList);

        if (!conflictedQualifiedNames.has(s.qualifiedName)) {
            byQualifiedName.set(s.qualifiedName, s);
        }

        // Root-level symbols (no parentQualifiedName) are keyed under '', the
        // implicit root namespace -- mirrors the '' sentinel used for namespace
        // ancestor chains, so byParent.get('') gives the root's own members.
        const parentKey = s.parentQualifiedName ?? '';
        if (!conflictedQualifiedNames.has(parentKey)) {
            const children = byParent.get(parentKey) ?? [];
            children.push(s);
            byParent.set(parentKey, children);
        }

        if (isDefinition(s.kind)) {
            const defs = definitionsByName.get(s.name) ?? [];
            defs.push(s);
            definitionsByName.set(s.name, defs);
        }

        if (s.kind === SysMLElementKind.PortUsage || s.kind === SysMLElementKind.PortDef) {
            const ports = portsByName.get(s.name) ?? [];
            ports.push(s);
            portsByName.set(s.name, ports);
        }
    }

    return { byName, byParent, byQualifiedName, definitionsByName, portsByName };
}

/** AND together zero or more (possibly undefined) filter expressions; `undefined` means "no filter". */
function combineFilters(exprs: Array<FilterExpr | undefined> | undefined): FilterExpr | undefined {
    const defined = (exprs ?? []).filter((e): e is FilterExpr => e !== undefined);
    if (defined.length === 0) return undefined;
    return defined.reduce((left, right) => ({ kind: 'and', left, right }));
}

/**
 * Evaluate a §7.5.4 filter condition against a candidate member. Only the
 * metadata classification-test subset is modeled (see FilterExpr's doc
 * comment); 'unsupported' evaluates to true (fail-open), so a filter
 * expression this doesn't understand never silently blocks an otherwise
 * valid import.
 */
export function evaluateFilter(expr: FilterExpr, symbol: SysMLSymbol): boolean {
    switch (expr.kind) {
        case 'metadata':
            return (symbol.metadataAnnotations ?? []).some(name => {
                const simpleName = name.includes('::') ? name.split('::').pop()! : name;
                return name === expr.name || simpleName === expr.name;
            });
        case 'and':
            return evaluateFilter(expr.left, symbol) && evaluateFilter(expr.right, symbol);
        case 'or':
            return evaluateFilter(expr.left, symbol) || evaluateFilter(expr.right, symbol);
        case 'not':
            return !evaluateFilter(expr.expr, symbol);
        case 'unsupported':
            return true;
    }
}

/**
 * Resolves whether a name is visible from a given reference site, per
 * SysML v2 §7.5's namespace/import/visibility model. Owns a cache of each
 * namespace's resolved member table, keyed by `SymbolIndexes` identity, so
 * multiple resolutions against the same workspace snapshot are cheap.
 */
export class NamespaceResolver {
    private resolvedMembersByIndexes?: WeakMap<SymbolIndexes, Map<string, Map<string, ResolvedMember[]>>>;
    /** `(candidateQualifiedName, ownerQualifiedName)` pairs currently mid-check in `isSpecializationOf`, guarding against re-entrant recursion (see its own doc comment). */
    private specializationChecksInProgress = new Set<string>();

    /**
     * Whether `name` (simple or qualified, e.g. `"Owner::Nested::Target"`) is
     * resolvable from `symbol`'s reference site, per §7.5.1: "A qualified name
     * with more than one segment is resolved by recursively resolving the
     * name of the qualifying namespace and then resolving the element name in
     * that context." A qualified name is *not* just "is the first segment
     * visible" (a package name being resolvable doesn't mean every name after
     * `::` is one of its actual members) -- each segment after the first must
     * be a genuine member (owned or imported) of the previously-resolved
     * namespace.
     */
    isLocallyVisible(symbol: SysMLSymbol, name: string, indexes: SymbolIndexes): boolean {
        return this.resolveQualifiedNameFrom(symbol.parentQualifiedName, name, indexes) !== undefined;
    }

    /**
     * Resolve a (possibly qualified) name to its symbol per §7.5.1, searching
     * outward from `startQualifiedName`'s enclosing namespaces (its own resolved
     * members first, then its parent's, ...). Shared by `isLocallyVisible` (an
     * ordinary reference resolving relative to its own enclosing namespace) and
     * import-target resolution (an `import` declaration's target is itself a
     * qualifiedName, resolved the same relative way -- not as an absolute/global
     * name -- so a bare `import C;` inside a nested package can pick up a `C`
     * its own enclosing package already imported, per §7.5.1/§7.5.3).
     */
    private resolveQualifiedNameFrom(startQualifiedName: string | undefined, name: string, indexes: SymbolIndexes): SysMLSymbol | undefined {
        const [first, ...rest] = name.split('::');

        let resolvedQualifiedName: string | undefined;
        for (const ancestorQualifiedName of this.namespaceAncestorsOf(startQualifiedName, indexes)) {
            const candidates = this.getResolvedMembers(ancestorQualifiedName, indexes).get(first);
            if (candidates && candidates.length > 0) {
                resolvedQualifiedName = candidates[0].symbol.qualifiedName;
                break;
            }
        }
        if (resolvedQualifiedName === undefined) return undefined;

        // A segment beyond the first isn't reached through the resolving
        // context's own ancestor chain (unlike the first segment, found above
        // by construction only in scopes enclosing `startQualifiedName`), so
        // its membership visibility must actually be checked here: "private"
        // means not visible outside the owning namespace (§7.5.2), and the
        // owning namespace here is whatever the previous segment resolved to,
        // not necessarily anything enclosing `startQualifiedName`. A private
        // segment is still resolvable when `startQualifiedName` is itself
        // that owning namespace or nested within it (querying your own, or an
        // ancestor's, private members from inside is not "outside").
        const isWithinStart = (namespaceQualifiedName: string): boolean =>
            this.namespaceAncestorsOf(startQualifiedName, indexes).has(namespaceQualifiedName);
        for (const segment of rest) {
            const ownerQualifiedName: string = resolvedQualifiedName;
            const members: ResolvedMember[] | undefined = this.getResolvedMembers(ownerQualifiedName, indexes).get(segment);
            const visibleMember: ResolvedMember | undefined = members?.find(
                (m: ResolvedMember) => m.visibility === 'public'
                    || isWithinStart(ownerQualifiedName)
                    || (m.visibility === 'protected' && this.isProtectedVisibleFrom(startQualifiedName, ownerQualifiedName, indexes)),
            );
            if (!visibleMember) return undefined;
            resolvedQualifiedName = visibleMember.symbol.qualifiedName;
        }
        const finalQualifiedName: string = resolvedQualifiedName;
        return indexes.byQualifiedName.get(finalQualifiedName);
    }

    /**
     * §7.5.3's protected-import exception: "A visibility of protected is the
     * same as private, unless the importing namespace is a definition or
     * usage, in which case the imported memberships are also visible in all
     * specializations of the definition or usage (see also 7.6 on
     * inheritance)." `ownerQualifiedName` is the namespace that owns the
     * protected membership (where the `protected import` was declared);
     * this is true when `ownerQualifiedName` is itself a definition or
     * usage, and `startQualifiedName` (or one of its own enclosing
     * namespaces) is a specialization of it.
     *
     * Only covers a *qualified* reference reaching into a specialization's
     * own protected members this way (`resolveQualifiedNameFrom`'s
     * multi-segment loop) -- an *unqualified* reference to a member a
     * specialization inherits without qualifying it by the supertype's name
     * is a broader §7.6 feature-inheritance question this resolver doesn't
     * otherwise model (it deliberately covers only §7.5's own namespace/
     * import mechanics), so that case isn't covered here.
     */
    private isProtectedVisibleFrom(startQualifiedName: string | undefined, ownerQualifiedName: string, indexes: SymbolIndexes): boolean {
        const owner = indexes.byQualifiedName.get(ownerQualifiedName);
        if (!owner || !(isDefinition(owner.kind) || isUsage(owner.kind))) return false;

        for (const ancestorQualifiedName of this.namespaceAncestorsOf(startQualifiedName, indexes)) {
            if (ancestorQualifiedName && this.isSpecializationOf(ancestorQualifiedName, ownerQualifiedName, indexes)) return true;
        }
        return false;
    }

    /**
     * Whether `candidateQualifiedName`'s own definition/usage transitively
     * specializes `ownerQualifiedName` (`:>`/`specializes`/`subsets` for a
     * definition, or the typing relationship for a usage) per §7.6. Used
     * only by `isProtectedVisibleFrom`. Walks `typeNames`, resolving each
     * name via `resolveQualifiedNameFrom` relative to the candidate's own
     * enclosing scope -- the same namespace-aware resolution an ordinary
     * `:>` reference itself goes through -- rather than a bare simple-name
     * lookup across the whole workspace (`indexes.definitionsByName.get`):
     * that would match *any* same-named definition anywhere, not just the
     * one `candidateQualifiedName`'s own `:>` clause actually refers to, so
     * an unrelated definition in a different package sharing a supertype's
     * simple name could falsely satisfy this check.
     *
     * Guarded against re-entrancy: resolving a candidate's own `:>` target
     * can recurse back into `isProtectedVisibleFrom` -> `isSpecializationOf`
     * for the very same (candidate, owner) pair before this call has
     * returned. Each such call gets a *fresh* `visited` set (it's local, not
     * shared across calls), so the in-BFS cycle guard below doesn't catch
     * this -- only a check that survives across separate top-level calls
     * does. Fails closed (not proven a specialization) rather than
     * recursing forever; the guard key is scoped to `indexes` implicitly by
     * being cleared once the outermost call for it returns, so it can't
     * leak a stale answer across different `SymbolIndexes` snapshots.
     */
    private isSpecializationOf(candidateQualifiedName: string, ownerQualifiedName: string, indexes: SymbolIndexes): boolean {
        const reentrancyKey = `${candidateQualifiedName}\0${ownerQualifiedName}`;
        if (this.specializationChecksInProgress.has(reentrancyKey)) return false;
        this.specializationChecksInProgress.add(reentrancyKey);
        try {
            const visited = new Set<string>([candidateQualifiedName]);
            let frontier = [candidateQualifiedName];
            let guard = 0;
            while (frontier.length > 0 && guard++ < MAX_SPECIALIZATION_CHAIN_DEPTH) {
                const next: string[] = [];
                for (const qualifiedName of frontier) {
                    const symbol = indexes.byQualifiedName.get(qualifiedName);
                    for (const typeName of symbol?.typeNames ?? []) {
                        const supertype = this.resolveQualifiedNameFrom(symbol?.parentQualifiedName, typeName, indexes);
                        if (!supertype) continue;
                        if (supertype.qualifiedName === ownerQualifiedName) return true;
                        if (!visited.has(supertype.qualifiedName)) {
                            visited.add(supertype.qualifiedName);
                            next.push(supertype.qualifiedName);
                        }
                    }
                }
                frontier = next;
            }
            return false;
        } finally {
            this.specializationChecksInProgress.delete(reentrancyKey);
        }
    }

    /**
     * Qualified names of `symbol`'s enclosing namespaces (its parent, its
     * parent's parent, ...), plus the implicit root namespace (`''`).
     * Members of any of these are visible from `symbol` without an import.
     */
    namespaceAncestors(symbol: SysMLSymbol, indexes: SymbolIndexes): Set<string> {
        return this.namespaceAncestorsOf(symbol.parentQualifiedName, indexes);
    }

    /**
     * As `namespaceAncestors`, but starting from a qualifiedName directly rather
     * than a symbol's own parent. Iteration order matters here, not just
     * membership: `resolveQualifiedNameFrom`'s first-segment lookup walks this
     * set in order and stops at the first namespace that has a matching member,
     * so a `Set`'s insertion order *is* the search order. Per §7.5.1, name
     * resolution searches the innermost enclosing namespace outward, with the
     * implicit root namespace as the last (least specific) fallback -- a local
     * name must shadow a same-named root-level one, not the reverse. `''` (the
     * root) is therefore added last, after the full innermost-to-outermost
     * climb, not seeded first.
     */
    private namespaceAncestorsOf(startQualifiedName: string | undefined, indexes: SymbolIndexes): Set<string> {
        const ancestors = new Set<string>();
        let current = startQualifiedName;
        let guard = 0;
        while (current && guard++ < MAX_NAMESPACE_NESTING_DEPTH) {
            ancestors.add(current);
            current = indexes.byQualifiedName.get(current)?.parentQualifiedName;
        }
        ancestors.add('');
        return ancestors;
    }

    /**
     * The resolved member table of namespace `qualifiedName` (`''` for the
     * implicit root): its own owned members, plus everything brought in by
     * its `import` statements — including, transitively, a further namespace's
     * own already-imported (and non-privately-imported) members, matching
     * §7.5.3's "imported memberships become members of the importing
     * namespace" and its P2/Q re-import example. Cached per `indexes`.
     */
    getResolvedMembers(qualifiedName: string, indexes: SymbolIndexes): Map<string, ResolvedMember[]> {
        if (!this.resolvedMembersByIndexes) this.resolvedMembersByIndexes = new WeakMap();
        let perIndexesCache = this.resolvedMembersByIndexes.get(indexes);
        if (!perIndexesCache) {
            perIndexesCache = new Map();
            this.resolvedMembersByIndexes.set(indexes, perIndexesCache);
        }
        const cached = perIndexesCache.get(qualifiedName);
        if (cached) return cached;

        const members = new Map<string, ResolvedMember[]>();
        // If the same element reaches this namespace through more than one membership
        // (e.g. two `import` statements for the same target -- across package fragments
        // in different files, or just two imports in one file), each is a distinct
        // membership (§7.5: "an element may have... multiple... memberships with the same
        // namespace"); nothing merges them into one, so the element's effective visibility
        // is the most permissive of them -- a public membership makes it visible outside
        // regardless of a redundant private/protected one also existing. Keeping only the
        // *first*-seen membership (as opposed to the most permissive) would make the result
        // depend on import-processing order, which isn't a real distinction the model makes.
        const addMember = (name: string, entry: ResolvedMember) => {
            const list = members.get(name) ?? [];
            const existingIndex = list.findIndex(e => e.symbol === entry.symbol);
            if (existingIndex === -1) {
                list.push(entry);
            } else if (VISIBILITY_RANK[entry.visibility] > VISIBILITY_RANK[list[existingIndex].visibility]) {
                list[existingIndex] = entry;
            }
            members.set(name, list);
        };

        for (const owned of indexes.byParent.get(qualifiedName) ?? []) {
            addMember(owned.name, { symbol: owned, visibility: owned.visibility ?? 'public' });
        }

        // Cycle guard: seed the cache with `members` itself -- the *same live
        // object*, not a snapshot copy -- before processing imports, rather
        // than an empty table. An import target is itself resolved relative
        // to *this* namespace (see `applyImport`'s `fromQualifiedName`),
        // which means resolving it can recurse back into this same
        // `getResolvedMembers` call: for a directly-owned sibling (e.g.
        // `public import Inner::X;` where `Inner` is a package declared
        // directly in this same namespace), that recursive call must see the
        // already-known owned members, not nothing, or a same-namespace
        // relative import would never resolve. Caching the live object
        // (rather than a frozen `new Map(members)` copy) additionally covers
        // one import depending on another *earlier* import already
        // processed in this same namespace (e.g. `import Lib::A; import
        // A::B;` -- resolving the second import's "A" must see what the
        // first one already added to `members`, not a pre-import-loop
        // snapshot) -- a reentrant call only ever happens synchronously,
        // nested within this same call stack (an unrelated, non-cyclic
        // caller elsewhere always runs after this call has already returned
        // its complete result, single-threaded JS having no interleaving),
        // so there's no risk of an unrelated caller observing a partial
        // table. An empty seed was only ever needed to stop a genuine import
        // *cycle* (this namespace transitively importing itself) from
        // recursing forever; owned members are computed with no recursion at
        // all, so exposing them (and each import's incremental contribution)
        // here doesn't reopen that.
        perIndexesCache.set(qualifiedName, members);

        const owner = indexes.byQualifiedName.get(qualifiedName);
        const importTargets = owner?.importTargets ?? [];
        // §7.5.4: a package-level `filter` applies to every import of that package,
        // combined (AND) with any filter on the specific import itself.
        const packageFilter = combineFilters(owner?.filterConditions);
        for (const imp of importTargets) {
            const effectiveFilter = combineFilters([packageFilter, imp.filter].filter((f): f is FilterExpr => f !== undefined));
            const filteredAddMember = effectiveFilter
                ? (name: string, entry: ResolvedMember) => {
                    if (evaluateFilter(effectiveFilter, entry.symbol)) addMember(name, entry);
                }
                : addMember;
            this.applyImport(imp, qualifiedName, indexes, filteredAddMember);
        }

        return members;
    }

    /**
     * Fold one `import` statement's contribution into `addMember`, per the
     * membership vs. namespace / shallow vs. `::**` deep distinctions in
     * ImportTarget (§7.5.3, including the P4/P5/P6 recursive-import example).
     *
     * `imp.target` is resolved relative to `fromQualifiedName` (the importing
     * namespace itself, per §7.5.1's generic name-resolution rule: begin in the
     * namespace containing the reference, then walk outward through its
     * enclosing namespaces), not as an absolute/global name. This covers both:
     * a target directly owned by the importing namespace itself (e.g. `public
     * import Inner::X;` where `Inner` is a package declared directly in this
     * same namespace), and a bare `import C;` inside a nested package that
     * picks up a `C` only visible via an enclosing package's own import
     * (§7.5.3's P2/Q example) -- the latter falls through to an outer ancestor
     * once this namespace's own (owned-only, see the cycle-guard note in
     * `getResolvedMembers`) members come up empty for that name.
     */
    private applyImport(
        imp: ImportTarget,
        fromQualifiedName: string,
        indexes: SymbolIndexes,
        addMember: (name: string, entry: ResolvedMember) => void,
    ): void {
        switch (imp.kind) {
            case 'membership': {
                const target = this.resolveQualifiedNameFrom(fromQualifiedName, imp.target, indexes);
                if (target) addMember(target.name, { symbol: target, visibility: imp.visibility });
                break;
            }
            case 'membership-deep': {
                const target = this.resolveQualifiedNameFrom(fromQualifiedName, imp.target, indexes);
                if (target) {
                    addMember(target.name, { symbol: target, visibility: imp.visibility });
                    this.importVisibleMembers(target.qualifiedName, imp.visibility, indexes, addMember, true);
                }
                break;
            }
            case 'namespace-shallow': {
                const owner = this.resolveQualifiedNameFrom(fromQualifiedName, imp.target, indexes);
                if (owner) this.importVisibleMembers(owner.qualifiedName, imp.visibility, indexes, addMember, false);
                break;
            }
            case 'namespace-deep': {
                const owner = this.resolveQualifiedNameFrom(fromQualifiedName, imp.target, indexes);
                if (owner) this.importVisibleMembers(owner.qualifiedName, imp.visibility, indexes, addMember, true);
                break;
            }
        }
    }

    /**
     * Import the non-private/protected resolved members of `ownerQualifiedName`
     * (its own members plus, transitively, its own public imports), tagging
     * each with `importVisibility` (this import statement's own keyword, which
     * governs re-export — not the source member's original visibility). When
     * `recursive`, also recurse into any imported member that is itself a
     * namespace (owns members), per the `::**` "continues into namespaces
     * that are owned members of an imported namespace" rule.
     *
     * `visited` guards against a namespace reachable more than once within
     * one top-level `::**` propagation chain, e.g. a namespace that ends up
     * a member of itself (`membership-deep`'s `import Self::**;` adds
     * `Self` as its own member before recursing into it) or a mutual cycle
     * (`A` deep-imports `B`, `B` deep-imports `A`) -- without it, the *same*
     * qualifiedName's propagation would restart from scratch every time it's
     * reached again, recursing forever. This is a different concern from
     * `getResolvedMembers`'s own cache-based cycle guard (which stops a
     * given namespace's *table* from being recomputed while already in
     * progress, letting one import see an earlier import's contribution in
     * the same namespace) -- that cache is now the same live object across
     * calls, so a self-referential membership it returns is genuinely
     * visible here and must be tracked, not relied on to look "not yet
     * there" the way a frozen snapshot used to accidentally mask it.
     */
    private importVisibleMembers(
        ownerQualifiedName: string,
        importVisibility: 'public' | 'private' | 'protected',
        indexes: SymbolIndexes,
        addMember: (name: string, entry: ResolvedMember) => void,
        recursive: boolean,
        visited: Set<string> = new Set(),
    ): void {
        if (visited.has(ownerQualifiedName)) return;
        visited.add(ownerQualifiedName);
        for (const [name, entries] of this.getResolvedMembers(ownerQualifiedName, indexes)) {
            for (const entry of entries) {
                if (entry.visibility === 'private' || entry.visibility === 'protected') continue;
                addMember(name, { symbol: entry.symbol, visibility: importVisibility });
                if (recursive) {
                    this.importVisibleMembers(entry.symbol.qualifiedName, importVisibility, indexes, addMember, true, visited);
                }
            }
        }
    }
}
