/**
 * Namespace/import/visibility mechanics (SysML v2 §7.5): given a namespace,
 * what members does it actually have -- its own, plus whatever its `import`
 * statements bring in, plus, for a definition or usage, what it inherits
 * (KerML 7.3.2.1). Standard-library/ISQ type recognition builds on top of it
 * in `typeResolution.ts`.
 *
 * Shared between `SemanticValidator` (editor diagnostics) and
 * `SysMLModelProvider` (the `sysml/model` request's own diagnostics) so both
 * agree on what "resolved" means -- extracted here specifically so neither
 * has to import the other (they already depend on each other for unrelated
 * features, and importing a full sibling class both ways would recurse at
 * construction time).
 */

import { canonicalUri, isSameDocumentUri } from '../utils/documentUri.js';
import { splitQualifiedName } from '../utils/identUtils.js';
import { FilterExpr, ImportTarget, SysMLElementKind, SysMLSymbol, isAnonymous, isDefinition, isUsage, memberNamesOf } from './sysmlElements.js';

/**
 * A namespace's identity for name resolution: a declared one by its
 * qualifiedName (`''` for the root), an anonymous one by its own symbol, so a
 * declared name quoted like an anonymous qualifiedName never shares its members.
 */
export type NamespaceKey = string | SysMLSymbol;

export interface SymbolIndexes {
    byName: Map<string, SysMLSymbol[]>;
    /** Named members by owning namespace (`NamespaceKey`); `''` holds the root's. */
    byParent: Map<NamespaceKey, SysMLSymbol[]>;
    byQualifiedName: Map<string, SysMLSymbol>;
    /** Every symbol by `symbolId`; the only index an anonymous one (`isAnonymous`) is in. */
    byId: Map<string, SysMLSymbol>;
    definitionsByName: Map<string, SysMLSymbol[]>;
    portsByName: Map<string, SysMLSymbol[]>;
    /**
     * By name, the declarations known by that name that clash with another one
     * on it in their namespace through a short name (`findConflictingShortNames`).
     */
    clashingShortNames: Map<string, Set<SysMLSymbol>>;
}

/** One entry in a namespace's resolved member table (see `NamespaceResolver.getResolvedMembers`). */
export interface ResolvedMember {
    symbol: SysMLSymbol;
    /** Effective visibility of this membership *within its resolving namespace*. */
    visibility: 'public' | 'private' | 'protected';
}

/** A reference may be missing or ambiguous; only missing names allow library fallback. */
export interface NameResolution {
    readonly symbol?: SysMLSymbol;
    readonly ambiguous: boolean;
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
 * safety net against a malformed/cyclic `parentId` chain, since no
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
    // An element without a qualified name (an anonymous element, or a member
    // of one) can't clash by qualified name; see `findConflictingDeclarations`.
    return groupConflicts(allSymbols.filter(s => s.qualifiedName !== undefined), s => s.qualifiedName!);
}

export { memberNamesOf };

/**
 * Every declaration whose name is not distinguishable from another one's in
 * the same namespace (see `findConflictedQualifiedNames`), mapped to all the
 * declarations it clashes with, itself included. Besides clashing qualified
 * names, this covers members of an anonymous element, which have no
 * qualified name: two of them clash when they share their owner (by
 * `parentId`) and name. The two cases are grouped separately, so no
 * qualified name, however it is quoted, can be confused with an owner's symbol ID.
 *
 * A short name counts as well (KerML 7.2.5.2): two declarations in one
 * namespace clash when either one's name or short name is the other's name
 * or short name, e.g. `part def <A> Alpha;` and `part def A;`.
 */
export function findConflictingDeclarations(allSymbols: SysMLSymbol[]): Map<SysMLSymbol, SysMLSymbol[]> {
    return new Map([...findConflicts(allSymbols)].map(([symbol, { declarations }]) => [symbol, declarations]));
}

/**
 * As `findConflictingDeclarations`, with the names each declaration clashes
 * on: a name or short name it shares with another (KerML 8.3.2.4.3), which
 * need not be the one its qualified name is built from.
 */
export function findConflicts(allSymbols: SysMLSymbol[]): Map<SysMLSymbol, { declarations: SysMLSymbol[]; names: string[] }> {
    const conflicting = new Map<SysMLSymbol, { declarations: SysMLSymbol[]; names: string[] }>();
    const add = (name: string, group: SysMLSymbol[]) => {
        for (const s of group) {
            const found = conflicting.get(s);
            conflicting.set(s, {
                declarations: [...new Set([...(found?.declarations ?? []), ...group])],
                names: [...new Set([...(found?.names ?? []), name])],
            });
        }
    };
    // Declarations sharing a qualified name clash on its last segment.
    for (const [qualifiedName, group] of findConflictedQualifiedNames(allSymbols)) add(splitQualifiedName(qualifiedName).at(-1)!, group);
    const membersOfAnonymous = allSymbols.filter(s => s.qualifiedName === undefined && !isAnonymous(s) && s.parentId !== undefined);
    const byOwner = new Map<string, SysMLSymbol[]>();
    for (const s of membersOfAnonymous) {
        const list = byOwner.get(s.parentId!) ?? [];
        list.push(s);
        byOwner.set(s.parentId!, list);
    }
    for (const members of byOwner.values()) {
        // By name; clashes involving a short name are found below.
        for (const [name, group] of groupConflicts(members.filter(s => s.name), s => s.name)) add(name, group);
    }
    for (const { name, symbols } of findConflictingShortNames(allSymbols).values()) add(name, symbols);
    return conflicting;
}

/**
 * Declarations of one namespace sharing a name with a short name (or two short
 * names), grouped as `findConflictingDeclarations` groups clashing names, each
 * group with the name they clash on. The
 * namespace is the owner's qualified name, so the fragments of a package
 * declared in several documents are one namespace, else the owner's symbol ID
 * for a member of an anonymous element; the two are keyed apart.
 */
function findConflictingShortNames(allSymbols: SysMLSymbol[]): Map<string, { name: string; symbols: SysMLSymbol[] }> {
    const byId = new Map(allSymbols.map(s => [s.symbolId, s]));
    const entries: Array<{ symbol: SysMLSymbol; key: string }> = [];
    const keysWithShortName = new Set<string>();
    for (const s of allSymbols) {
        if (isAnonymous(s)) continue;
        const owner = s.parentId ? byId.get(s.parentId) : undefined;
        const namespace = owner === undefined ? 'q:'
            : owner.qualifiedName !== undefined ? `q:${owner.qualifiedName}` : `id:${owner.symbolId}`;
        for (const name of memberNamesOf(s)) {
            const key = `${namespace}\0${name}`;
            entries.push({ symbol: s, key });
            if (name === s.shortName) keysWithShortName.add(key);
        }
    }
    // Only a clash involving a short name; clashing names are found by name above.
    const groups = groupKeyedConflicts(entries.filter(e => keysWithShortName.has(e.key)));
    return new Map([...groups].map(([key, symbols]) => [key, { name: key.slice(key.indexOf('\0') + 1), symbols }]));
}

/** Group `symbols` by `keyOf`, keeping groups of two or more non-package declarations of one kind. */
function groupConflicts(symbols: SysMLSymbol[], keyOf: (s: SysMLSymbol) => string): Map<string, SysMLSymbol[]> {
    return groupKeyedConflicts(symbols.map(symbol => ({ symbol, key: keyOf(symbol) })));
}

/** As `groupConflicts`, for symbols already paired with their keys (one symbol may have several). */
function groupKeyedConflicts(entries: Array<{ symbol: SysMLSymbol; key: string }>): Map<string, SysMLSymbol[]> {
    const byKeyAndKind = new Map<string, Map<SysMLElementKind, SysMLSymbol[]>>();
    for (const { symbol: s, key } of entries) {
        let byKind = byKeyAndKind.get(key);
        if (!byKind) {
            byKind = new Map();
            byKeyAndKind.set(key, byKind);
        }
        const list = byKind.get(s.kind) ?? [];
        list.push(s);
        byKind.set(s.kind, list);
    }

    const conflicts = new Map<string, SysMLSymbol[]>();
    for (const [key, byKind] of byKeyAndKind) {
        for (const [kind, group] of byKind) {
            if (kind === SysMLElementKind.Package || group.length <= 1) continue;
            const existing = conflicts.get(key) ?? [];
            conflicts.set(key, [...existing, ...group]);
        }
    }
    return conflicts;
}

/** URI path segments joined and percent-decoded for display, or left encoded when malformed. */
function displayPath(segments: string[]): string {
    const joined = segments.join('/');
    try {
        return decodeURIComponent(joined);
    } catch {
        return joined;
    }
}

/**
 * Where a conflicting declaration lives, as seen from the document `fromUri` being diagnosed --
 * worked out from the two URIs alone (no file access): "this document" when both name the same
 * document, otherwise `uri` as a relative reference from `fromUri` (RFC 3986 §4.2, e.g. `wheel.sysml`,
 * `../lib/wheel.sysml`) when both share scheme and authority, else `uri` in full. Paths compare
 * by `canonicalUri`, as two URIs can spell the same Windows drive differently.
 */
export function describeDocumentLocation(uri: string, fromUri: string): string {
    if (isSameDocumentUri(uri, fromUri)) return 'this document';
    let target: URL;
    let from: URL;
    let targetKeys: string[];
    let fromKeys: string[];
    try {
        target = new URL(uri);
        from = new URL(fromUri);
        targetKeys = new URL(canonicalUri(uri)).pathname.split('/');
        fromKeys = new URL(canonicalUri(fromUri)).pathname.split('/');
    } catch {
        return uri;
    }
    if (target.protocol !== from.protocol || target.host !== from.host) return uri;
    const targetSegments = target.pathname.split('/');
    const fromFolder = from.pathname.split('/').slice(0, -1);
    // Count the leading folders both paths have in common, so the result only goes up (`..`) to
    // where the paths split. Folders compare canonically, so the Windows drive spellings `c%3A`,
    // `C:` and `c:` match; canonicalizing never adds or removes a `/`, so segments line up.
    let common = 0;
    while (common < fromFolder.length && common < targetSegments.length - 1
        && fromKeys[common] === targetKeys[common]) common++;
    return displayPath([...fromFolder.slice(common).map(() => '..'), ...targetSegments.slice(common)]);
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
    const byParent = new Map<NamespaceKey, SysMLSymbol[]>();
    const byQualifiedName = new Map<string, SysMLSymbol>();
    const byId = new Map<string, SysMLSymbol>();
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

    // Every element by its symbol ID, indexed first so members below can be
    // keyed by their owner. An anonymous element (`isAnonymous`) is
    // reachable only this way: its generated name is not a member name to
    // resolve, and a declared name quoted like its qualifiedName must not be
    // shadowed by it.
    for (const s of allSymbols) {
        byId.set(s.symbolId, s);
    }
    // A name two declarations of a namespace clash on through a short name is
    // left unresolved there, as a conflicted qualifiedName is (see `isAmbiguous`).
    const clashingShortNames = new Map<string, Set<SysMLSymbol>>();
    for (const { name, symbols } of findConflictingShortNames(allSymbols).values()) {
        const clashing = clashingShortNames.get(name) ?? new Set<SysMLSymbol>();
        for (const s of symbols) clashing.add(s);
        clashingShortNames.set(name, clashing);
    }
    const indexes: SymbolIndexes = { byName, byParent, byQualifiedName, byId, definitionsByName, portsByName, clashingShortNames };

    for (const s of allSymbols) {
        if (isAnonymous(s)) continue;
        // Under each name it is referenced by (KerML 8.2.3.5.3): its name and its short name.
        for (const name of memberNamesOf(s)) {
            const nameList = byName.get(name) ?? [];
            nameList.push(s);
            byName.set(name, nameList);
        }

        if (s.qualifiedName !== undefined && !conflictedQualifiedNames.has(s.qualifiedName)) {
            byQualifiedName.set(s.qualifiedName, s);
        }

        // Root-level symbols (no owner) are keyed under '', the
        // implicit root namespace -- mirrors the '' sentinel used for namespace
        // ancestor chains, so byParent.get('') gives the root's own members.
        const parentKey = ownerKeyOf(s, indexes.byId);
        if (typeof parentKey !== 'string' || !conflictedQualifiedNames.has(parentKey)) {
            const children = byParent.get(parentKey) ?? [];
            children.push(s);
            byParent.set(parentKey, children);
        }

        if (isDefinition(s.kind)) {
            for (const name of memberNamesOf(s)) {
                const defs = definitionsByName.get(name) ?? [];
                defs.push(s);
                definitionsByName.set(name, defs);
            }
        }

        if (s.kind === SysMLElementKind.PortUsage || s.kind === SysMLElementKind.PortDef) {
            for (const name of memberNamesOf(s)) {
                const ports = portsByName.get(name) ?? [];
                ports.push(s);
                portsByName.set(name, ports);
            }
        }
    }

    return indexes;
}

/** `symbol`'s owner, by its `parentId`. */
export function ownerOf(symbol: SysMLSymbol, indexes: SymbolIndexes): SysMLSymbol | undefined {
    return symbol.parentId ? indexes.byId.get(symbol.parentId) : undefined;
}

/**
 * The `NamespaceKey` of `symbol` as a namespace: its qualified name, or the
 * symbol itself when it has none (an anonymous element, or a member of one).
 */
export function namespaceKeyOf(symbol: SysMLSymbol): NamespaceKey {
    return symbol.qualifiedName ?? symbol;
}

/**
 * The `NamespaceKey` of the namespace owning `symbol`: its owner (looked up by
 * `parentId` in `byId`) as a namespace, else the root (`''`).
 */
export function ownerKeyOf(symbol: SysMLSymbol, byId: ReadonlyMap<string, SysMLSymbol>): NamespaceKey {
    const owner = symbol.parentId ? byId.get(symbol.parentId) : undefined;
    return owner ? namespaceKeyOf(owner) : '';
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
    private resolvedMembersByIndexes?: WeakMap<SymbolIndexes, Map<NamespaceKey, Map<string, ResolvedMember[]>>>;
    /** `(candidate, owner)` pairs currently mid-check in `isSpecializationOf`, guarding against re-entrant recursion (see its own doc comment). */
    private specializationChecksInProgress = new Map<SysMLSymbol, Set<SysMLSymbol>>();

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
        return this.resolveNameFrom(symbol, name, indexes) !== undefined;
    }

    /**
     * Resolve a (possibly qualified) name from the namespace containing
     * `symbol`, respecting namespace membership and visibility.
     */
    resolveNameFrom(symbol: SysMLSymbol, name: string, indexes: SymbolIndexes): SysMLSymbol | undefined {
        return this.resolveQualifiedNameFrom(ownerKeyOf(symbol, indexes.byId), name, indexes);
    }

    /** Resolve an editor reference within its enclosing namespace, including the root. */
    resolveNameIn(namespace: SysMLSymbol | undefined, name: string, indexes: SymbolIndexes): SysMLSymbol | undefined {
        return this.resolveQualifiedNameFrom(namespace ? namespaceKeyOf(namespace) : '', name, indexes);
    }

    /**
     * Resolve an editor reference without losing the reason a name is unresolved.
     * Its first segment is never resolved to `excluding`: a usage named after this
     * reference (`SysMLSymbol.namingReference`), which is a member of the namespace
     * the reference is resolved in, but never the feature it references.
     */
    resolveReferenceIn(namespace: SysMLSymbol | undefined, name: string, indexes: SymbolIndexes, excluding?: SysMLSymbol): NameResolution {
        return this.resolveQualifiedReferenceFrom(namespace ? namespaceKeyOf(namespace) : '', name, indexes, excluding);
    }

    /** Resolve a public qualified or feature-path member, without enclosing-scope fallback. */
    resolveMemberReference(owner: SysMLSymbol, name: string, indexes: SymbolIndexes): NameResolution {
        const members = this.getResolvedMembers(namespaceKeyOf(owner), indexes).get(name);
        if (members && this.isAmbiguous(name, members, indexes)) return { ambiguous: true };
        return this.referenceTo(members?.find(member => member.visibility === 'public')?.symbol, indexes);
    }

    /** Resolve a feature of `receiver` in a feature chain: its own member, else one of its types'. */
    resolveFeatureReference(receiver: SysMLSymbol, name: string, indexes: SymbolIndexes): NameResolution {
        const queue = [receiver];
        const visited = new Set<SysMLSymbol>();
        for (let index = 0; index < queue.length; index++) {
            const owner = queue[index];
            if (visited.has(owner)) continue;
            visited.add(owner);
            const member = this.resolveMemberReference(owner, name, indexes);
            if (member.symbol || member.ambiguous) return member;
            for (const typeName of owner.typeNames) {
                const type = this.resolveNameFrom(owner, typeName, indexes);
                if (type && !visited.has(type)) queue.push(type);
            }
        }
        return { ambiguous: false };
    }

    /**
     * Resolve a (possibly qualified) name to its symbol per §7.5.1, searching
     * outward from namespace `start` and its enclosing namespaces (its own resolved
     * members first, then its parent's, ...). Shared by `isLocallyVisible` (an
     * ordinary reference resolving relative to its own enclosing namespace),
     * `resolveNameFrom`, and import-target resolution (an `import` declaration's target is itself a
     * qualifiedName, resolved the same relative way -- not as an absolute/global
     * name -- so a bare `import C;` inside a nested package can pick up a `C`
     * its own enclosing package already imported, per §7.5.1/§7.5.3).
     */
    private resolveQualifiedNameFrom(start: NamespaceKey, name: string, indexes: SymbolIndexes): SysMLSymbol | undefined {
        return this.resolveQualifiedReferenceFrom(start, name, indexes).symbol;
    }

    private resolveQualifiedReferenceFrom(start: NamespaceKey, name: string, indexes: SymbolIndexes, excluding?: SysMLSymbol): NameResolution {
        const [first, ...rest] = splitQualifiedName(name);

        let resolved: SysMLSymbol | undefined;
        for (const ancestor of this.namespaceAncestorsOf(start, indexes)) {
            const members = this.getResolvedMembers(ancestor, indexes).get(first);
            const candidates = excluding ? members?.filter(member => member.symbol !== excluding) : members;
            if (candidates && candidates.length > 0) {
                if (this.isAmbiguous(first, candidates, indexes)) return { ambiguous: true };
                resolved = candidates[0].symbol;
                break;
            }
        }
        if (resolved === undefined) return { ambiguous: false };

        // A segment beyond the first isn't reached through the resolving
        // context's own ancestor chain (unlike the first segment, found above
        // by construction only in scopes enclosing `start`), so
        // its membership visibility must actually be checked here: "private"
        // means not visible outside the owning namespace (§7.5.2), and the
        // owning namespace here is whatever the previous segment resolved to,
        // not necessarily anything enclosing `start`. A private
        // segment is still resolvable when `start` is itself
        // that owning namespace or nested within it (querying your own, or an
        // ancestor's, private members from inside is not "outside").
        const isWithinStart = (namespace: NamespaceKey): boolean =>
            this.namespaceAncestorsOf(start, indexes).has(namespace);
        for (const segment of rest) {
            const owner: SysMLSymbol = resolved;
            const ownerKey = namespaceKeyOf(owner);
            const members: ResolvedMember[] | undefined = this.getResolvedMembers(ownerKey, indexes).get(segment);
            if (members && this.isAmbiguous(segment, members, indexes)) return { ambiguous: true };
            const visibleMember: ResolvedMember | undefined = members?.find(
                (m: ResolvedMember) => m.visibility === 'public'
                    || isWithinStart(ownerKey)
                    || (m.visibility === 'protected' && this.isProtectedVisibleFrom(start, owner, indexes)),
            );
            if (!visibleMember) return { ambiguous: false };
            resolved = visibleMember.symbol;
        }
        // A qualified name clashing with another declaration's is left unresolved (`byQualifiedName`).
        return this.referenceTo(resolved, indexes);
    }

    private referenceTo(resolved: SysMLSymbol | undefined, indexes: SymbolIndexes): NameResolution {
        if (!resolved) return { ambiguous: false };
        const symbol = resolved.qualifiedName !== undefined ? indexes.byQualifiedName.get(resolved.qualifiedName) : resolved;
        return { symbol, ambiguous: symbol === undefined };
    }

    /**
     * Whether `name` names more than one of `candidates` that clash on it
     * through a short name (`SymbolIndexes.clashingShortNames`), so it can't
     * be resolved to either (KerML 7.2.5.2). Like a conflicted qualifiedName,
     * it doesn't fall through to an enclosing namespace's member of that name.
     */
    private isAmbiguous(name: string, candidates: ResolvedMember[], indexes: SymbolIndexes): boolean {
        const clashing = indexes.clashingShortNames.get(name);
        return clashing !== undefined && candidates.filter(c => clashing.has(c.symbol)).length > 1;
    }

    /**
     * §7.5.3's protected-import exception: "A visibility of protected is the
     * same as private, unless the importing namespace is a definition or
     * usage, in which case the imported memberships are also visible in all
     * specializations of the definition or usage (see also 7.6 on
     * inheritance)." `owner` is the namespace that owns the
     * protected membership (where the `protected import` was declared);
     * this is true when `owner` is itself a definition or
     * usage, and namespace `start` (or one of its own enclosing
     * namespaces) is a specialization of it.
     *
     * Only covers a *qualified* reference reaching into a specialization's
     * own protected members this way (`resolveQualifiedNameFrom`'s
     * multi-segment loop); an *unqualified* reference to a member a
     * specialization inherits resolves through its inherited memberships
     * (`addInheritedMembers`).
     */
    private isProtectedVisibleFrom(start: NamespaceKey, owner: SysMLSymbol, indexes: SymbolIndexes): boolean {
        if (!(isDefinition(owner.kind) || isUsage(owner.kind))) return false;

        for (const ancestor of this.namespaceAncestorsOf(start, indexes)) {
            const candidate = typeof ancestor === 'string' ? indexes.byQualifiedName.get(ancestor) : ancestor;
            if (candidate && this.isSpecializationOf(candidate, owner, indexes)) return true;
        }
        return false;
    }

    /**
     * Whether `candidate`'s own definition/usage transitively
     * specializes `owner` (`:>`/`specializes`/`subsets` for a
     * definition, or the typing relationship for a usage) per §7.6. Used
     * only by `isProtectedVisibleFrom`. Walks `typeNames`, resolving each
     * name via `resolveQualifiedNameFrom` relative to the candidate's own
     * enclosing scope -- the same namespace-aware resolution an ordinary
     * `:>` reference itself goes through -- rather than a bare simple-name
     * lookup across the whole workspace (`indexes.definitionsByName.get`):
     * that would match *any* same-named definition anywhere, not just the
     * one `candidate`'s own `:>` clause actually refers to, so
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
    private isSpecializationOf(candidate: SysMLSymbol, owner: SysMLSymbol, indexes: SymbolIndexes): boolean {
        const ownersInProgress = this.specializationChecksInProgress.get(candidate) ?? new Set<SysMLSymbol>();
        if (ownersInProgress.has(owner)) return false;
        ownersInProgress.add(owner);
        this.specializationChecksInProgress.set(candidate, ownersInProgress);
        try {
            const visited = new Set<SysMLSymbol>([candidate]);
            let frontier = [candidate];
            let guard = 0;
            while (frontier.length > 0 && guard++ < MAX_SPECIALIZATION_CHAIN_DEPTH) {
                const next: SysMLSymbol[] = [];
                for (const symbol of frontier) {
                    for (const typeName of symbol.typeNames) {
                        const supertype = this.resolveQualifiedNameFrom(ownerKeyOf(symbol, indexes.byId), typeName, indexes);
                        if (!supertype) continue;
                        // Resolved through its name, a supertype is found as `byQualifiedName`'s
                        // entry, which for a package declared in several documents is its merged view.
                        if (supertype === owner || (owner.qualifiedName !== undefined && supertype.qualifiedName === owner.qualifiedName)) return true;
                        if (!visited.has(supertype)) {
                            visited.add(supertype);
                            next.push(supertype);
                        }
                    }
                }
                frontier = next;
            }
            return false;
        } finally {
            ownersInProgress.delete(owner);
            if (ownersInProgress.size === 0) this.specializationChecksInProgress.delete(candidate);
        }
    }

    /**
     * `symbol`'s enclosing namespaces (its parent, its parent's parent, ...),
     * as `NamespaceKey`s, plus the implicit root namespace (`''`).
     * Members of any of these are visible from `symbol` without an import.
     */
    namespaceAncestors(symbol: SysMLSymbol, indexes: SymbolIndexes): Set<NamespaceKey> {
        return this.namespaceAncestorsOf(ownerKeyOf(symbol, indexes.byId), indexes);
    }

    /**
     * As `namespaceAncestors`, but starting from a namespace directly rather
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
    private namespaceAncestorsOf(start: NamespaceKey, indexes: SymbolIndexes): Set<NamespaceKey> {
        const ancestors = new Set<NamespaceKey>();
        let current: NamespaceKey | undefined = start;
        let guard = 0;
        while (current !== undefined && current !== '' && guard++ < MAX_NAMESPACE_NESTING_DEPTH) {
            ancestors.add(current);
            const namespaceSymbol: SysMLSymbol | undefined = typeof current === 'string' ? indexes.byQualifiedName.get(current) : current;
            current = namespaceSymbol ? ownerKeyOf(namespaceSymbol, indexes.byId) : undefined;
        }
        ancestors.add('');
        return ancestors;
    }

    /**
     * The resolved member table of `namespace` (a `NamespaceKey`,
     * `''` for the implicit root): its own owned members, plus everything brought in by
     * its `import` statements — including, transitively, a further namespace's
     * own already-imported (and non-privately-imported) members, matching
     * §7.5.3's "imported memberships become members of the importing
     * namespace" and its P2/Q re-import example. A definition or usage also has
     * the members it inherits (`addInheritedMembers`), after its owned members and
     * before its imported ones (KerML 8.2.3.5.3). Cached per `indexes`.
     */
    getResolvedMembers(namespace: NamespaceKey, indexes: SymbolIndexes): Map<string, ResolvedMember[]> {
        if (!this.resolvedMembersByIndexes) this.resolvedMembersByIndexes = new WeakMap();
        let perIndexesCache = this.resolvedMembersByIndexes.get(indexes);
        if (!perIndexesCache) {
            perIndexesCache = new Map();
            this.resolvedMembersByIndexes.set(indexes, perIndexesCache);
        }
        const cached = perIndexesCache.get(namespace);
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

        for (const owned of indexes.byParent.get(namespace) ?? []) {
            addMember(owned.name, { symbol: owned, visibility: owned.visibility ?? 'public' });
            if (owned.shortName) {
                addMember(owned.shortName, { symbol: owned, visibility: owned.visibility ?? 'public' });
            }
        }

        // Cycle guard: seed the cache with `members` itself -- the *same live
        // object*, not a snapshot copy -- before processing imports, rather
        // than an empty table. An import target is itself resolved relative
        // to *this* namespace (see `applyImport`'s `importingNamespace`),
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
        perIndexesCache.set(namespace, members);

        const owner = typeof namespace === 'string' ? indexes.byQualifiedName.get(namespace) : namespace;
        // Inherited before imported: an inherited membership hides an imported one of the same name (KerML 7.3.2.1).
        if (owner && (isDefinition(owner.kind) || isUsage(owner.kind))) this.addInheritedMembers(owner, indexes, addMember);
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
            this.applyImport(imp, namespace, indexes, filteredAddMember);
        }

        return members;
    }

    /**
     * Fold the memberships `type` inherits into `addMember` (KerML 7.3.2.1,
     * 7.3.2.2, 8.3.3.1.10 `Type::inheritedMemberships`): the public and
     * protected memberships of the types it specializes (`generalsOf`), their
     * own inherited ones included, without the features redefined there
     * (`removeRedefinedFeatures`): one another inherited membership's feature
     * redefines, or one a feature `type` owns redefines, directly or indirectly.
     */
    private addInheritedMembers(type: SysMLSymbol, indexes: SymbolIndexes, addMember: (name: string, entry: ResolvedMember) => void): void {
        const inheritable: [string, ResolvedMember][] = [];
        for (const general of this.generalsOf(type, indexes)) {
            for (const [name, entries] of this.getResolvedMembers(namespaceKeyOf(general), indexes)) {
                for (const entry of entries) {
                    if (entry.visibility !== 'private' && entry.symbol !== type) inheritable.push([name, entry]);
                }
            }
        }
        const redefinedByOwned = new Set((indexes.byParent.get(namespaceKeyOf(type)) ?? [])
            .flatMap(owned => (owned.redefinedFeatureTargets ?? []).map(target => this.resolveRedefinedFeature(type, target, indexes).symbol))
            .filter((feature): feature is SysMLSymbol => feature !== undefined));
        const inheritedFeatures = new Set(inheritable.map(([, entry]) => entry.symbol));
        const redefinedByInherited = new Set([...inheritedFeatures]
            .flatMap(feature => [...this.allRedefinedFeaturesOf(feature, indexes)].filter(redefined => redefined !== feature)));
        for (const [name, entry] of inheritable) {
            if (redefinedByInherited.has(entry.symbol)) continue;
            if ([...this.allRedefinedFeaturesOf(entry.symbol, indexes)].some(feature => redefinedByOwned.has(feature))) continue;
            addMember(name, entry);
        }
    }

    /**
     * The types `type` specializes, each once: those it is typed by,
     * subclassifies or subsets, resolved from the namespace owning it (KerML
     * 8.2.3.5.2), and the features it redefines (`resolveRedefinedFeature`).
     * Never `type` itself.
     */
    private generalsOf(type: SysMLSymbol, indexes: SymbolIndexes): SysMLSymbol[] {
        const redefinedNames = type.redefinedFeatureTargets ?? [];
        const owner = ownerOf(type, indexes);
        const generals = [
            ...[...new Set([...type.typeNames, ...type.specializationNames])]
                .filter(name => !redefinedNames.includes(name))
                .map(name => this.resolveQualifiedNameFrom(ownerKeyOf(type, indexes.byId), name, indexes)),
            ...redefinedNames.map(name => owner ? this.resolveRedefinedFeature(owner, name, indexes).symbol : undefined),
        ];
        return [...new Set(generals.filter((general): general is SysMLSymbol => general !== undefined && general !== type))];
    }

    /**
     * Resolve the feature named `name` that a feature of `owningType`
     * redefines (KerML 8.2.3.5.1): the basic resolution of `name` with each
     * type `owningType` specializes in turn as the local namespace, until one
     * resolves -- not `owningType` itself, whose inherited members leave out
     * the features its own features redefine.
     */
    resolveRedefinedFeature(owningType: SysMLSymbol, name: string, indexes: SymbolIndexes): NameResolution {
        for (const general of this.generalsOf(owningType, indexes)) {
            const resolution = this.resolveQualifiedReferenceFrom(namespaceKeyOf(general), name, indexes);
            if (resolution.symbol || resolution.ambiguous) return resolution;
        }
        return { ambiguous: false };
    }

    /** `feature` and every feature it redefines, directly or indirectly (KerML 8.3.3.1.10 `allRedefinedFeaturesOf`). */
    private allRedefinedFeaturesOf(feature: SysMLSymbol, indexes: SymbolIndexes): Set<SysMLSymbol> {
        const all = new Set<SysMLSymbol>([feature]);
        for (const current of all) {
            const owner = ownerOf(current, indexes);
            if (!owner) continue;
            for (const target of current.redefinedFeatureTargets ?? []) {
                const redefined = this.resolveRedefinedFeature(owner, target, indexes).symbol;
                if (redefined) all.add(redefined);
            }
        }
        return all;
    }

    /**
     * Fold one `import` statement's contribution into `addMember`, per the
     * membership vs. namespace / shallow vs. `::**` deep distinctions in
     * ImportTarget (§7.5.3, including the P4/P5/P6 recursive-import example).
     *
     * `imp.target` is resolved relative to `importingNamespace` (the importing
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
        importingNamespace: NamespaceKey,
        indexes: SymbolIndexes,
        addMember: (name: string, entry: ResolvedMember) => void,
    ): void {
        switch (imp.kind) {
            case 'membership': {
                const target = this.resolveQualifiedNameFrom(importingNamespace, imp.target, indexes);
                if (target) {
                    addMember(target.name, { symbol: target, visibility: imp.visibility });
                    if (target.shortName) addMember(target.shortName, { symbol: target, visibility: imp.visibility });
                }
                break;
            }
            case 'membership-deep': {
                const target = this.resolveQualifiedNameFrom(importingNamespace, imp.target, indexes);
                if (target) {
                    addMember(target.name, { symbol: target, visibility: imp.visibility });
                    if (target.shortName) addMember(target.shortName, { symbol: target, visibility: imp.visibility });
                    this.importVisibleMembers(namespaceKeyOf(target), imp.visibility, indexes, addMember, true);
                }
                break;
            }
            case 'namespace-shallow': {
                const owner = this.resolveQualifiedNameFrom(importingNamespace, imp.target, indexes);
                if (owner) this.importVisibleMembers(namespaceKeyOf(owner), imp.visibility, indexes, addMember, false);
                break;
            }
            case 'namespace-deep': {
                const owner = this.resolveQualifiedNameFrom(importingNamespace, imp.target, indexes);
                if (owner) this.importVisibleMembers(namespaceKeyOf(owner), imp.visibility, indexes, addMember, true);
                break;
            }
        }
    }

    /**
     * Import the non-private/protected resolved members of namespace `owner`
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
        owner: NamespaceKey,
        importVisibility: 'public' | 'private' | 'protected',
        indexes: SymbolIndexes,
        addMember: (name: string, entry: ResolvedMember) => void,
        recursive: boolean,
        visited: Set<NamespaceKey> = new Set(),
    ): void {
        if (visited.has(owner)) return;
        visited.add(owner);
        for (const [name, entries] of this.getResolvedMembers(owner, indexes)) {
            for (const entry of entries) {
                if (entry.visibility === 'private' || entry.visibility === 'protected') continue;
                addMember(name, { symbol: entry.symbol, visibility: importVisibility });
                if (recursive) {
                    this.importVisibleMembers(namespaceKeyOf(entry.symbol), importVisibility, indexes, addMember, true, visited);
                }
            }
        }
    }
}
