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
import { joinQualifiedName, scanFeaturePaths, splitQualifiedName } from '../utils/identUtils.js';
import { ElementRegistry, RegistryElement, RegistryRelationship } from './elementRegistry.js';
import { FilterExpr, ImportTarget, ReferenceChain, SysMLElementKind, SysMLSymbol, isAnonymous, isDefinition, isUsage, memberNamesOf } from './sysmlElements.js';

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
    /** The registry name resolution works on (`NamespaceResolver`). */
    registry: ElementRegistry;
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

/** A declaration's clash: the declarations it clashes with, itself included, and the names it clashes on. */
export interface Conflict {
    declarations: SysMLSymbol[];
    names: string[];
}

/** The conflicts of each `SymbolIndexes`, found once (`findConflicts`). */
const conflictsByIndexes = new WeakMap<SymbolIndexes, Map<SysMLSymbol, Conflict>>();

/**
 * Every declaration whose name is not distinguishable from another one's in
 * the same namespace (see `findConflicts`), mapped to all the declarations it
 * clashes with, itself included.
 */
export function findConflictingDeclarations(indexes: SymbolIndexes): Map<SysMLSymbol, SysMLSymbol[]> {
    return new Map([...findConflicts(indexes)].map(([symbol, { declarations }]) => [symbol, declarations]));
}

/**
 * The declarations of the registry's elements that clash with another element
 * of the same namespace (KerML 8.3.2.4.3 `validateNamespaceDistinguishibility`),
 * with the names they clash on: two elements of one kind (kinds conforming
 * only to themselves here) sharing a name or short name (SysML 7.2.2), among
 * the members of one element, or the top-level elements of every document,
 * the root namespace of the workspace (SysML 7.5.5). A package is never in
 * conflict, since the same-named packages of a namespace are one element.
 */
export function findConflicts(indexes: SymbolIndexes): Map<SysMLSymbol, Conflict> {
    const cached = conflictsByIndexes.get(indexes);
    if (cached) return cached;
    const { registry } = indexes;
    const conflicting = new Map<SysMLSymbol, Conflict>();
    const add = (name: string, group: readonly RegistryElement[]) => {
        const declarations = group.flatMap(element => [...registry.symbolsOf(element)]);
        for (const s of declarations) {
            const found = conflicting.get(s);
            conflicting.set(s, {
                declarations: [...new Set([...(found?.declarations ?? []), ...declarations])],
                names: [...new Set([...(found?.names ?? []), name])],
            });
        }
    };
    const inspect = (members: readonly RegistryElement[]) => {
        const byNameAndKind = new Map<string, Map<SysMLElementKind, Set<RegistryElement>>>();
        for (const member of members) {
            if (member.kind === SysMLElementKind.Package) continue;
            for (const name of new Set([member.name, member.shortName])) {
                if (name === undefined) continue;
                let byKind = byNameAndKind.get(name);
                if (!byKind) byNameAndKind.set(name, byKind = new Map());
                let group = byKind.get(member.kind);
                if (!group) byKind.set(member.kind, group = new Set());
                group.add(member);
            }
        }
        for (const [name, byKind] of byNameAndKind) {
            for (const group of byKind.values()) if (group.size > 1) add(name, [...group]);
        }
    };
    inspect(registry.getRootIds().map(id => registry.getElement(id)!));
    for (const element of registry.getElements()) {
        inspect(element.ownedElementIds.map(id => registry.getElement(id)!));
    }
    conflictsByIndexes.set(indexes, conflicting);
    return conflicting;
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
/**
 * The indexes of `allSymbols`, with `registry` for name resolution: the symbol
 * table's when given, else one built from `allSymbols` alone.
 */
export function buildSymbolIndexes(allSymbols: SysMLSymbol[], registry?: ElementRegistry): SymbolIndexes {
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
    const indexes: SymbolIndexes = {
        byName, byParent, byQualifiedName, byId, definitionsByName, portsByName,
        registry: registry ?? ElementRegistry.fromSymbols(allSymbols),
    };

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
 * The root namespace of the workspace (SysML 7.5.5): every document's
 * top-level elements and top-level imports, one namespace for all documents,
 * as the textual notation leaves the extent of a root namespace to the tool.
 * It is the global namespace too (SysML 7.5.1, 7.5.5), the standard library's
 * top-level elements among its members.
 */
export const GLOBAL_NAMESPACE = { kind: 'global' } as const;

/** A namespace names are resolved in: an element of the registry, or the root namespace of the workspace. */
export type NamespaceScope = RegistryElement | typeof GLOBAL_NAMESPACE;

/** A namespace's resolved members by name, as `getResolvedMembers` gives them. */
type MemberTable = Map<string, ResolvedMember[]>;

/** What a relationship's target resolves to: the element's ID, none when unresolved or ambiguous. */
export interface TargetResolution {
    readonly targetId?: string;
    readonly ambiguous: boolean;
}

/** What the resolver caches for one `SymbolIndexes`. */
interface ResolverCache {
    tables: Map<NamespaceScope, MemberTable>;
    targets: Map<string, TargetResolution>;
}

/**
 * Resolves names from a reference site (SysML 7.5.1), over the element
 * registry: a namespace is an element, its members are the elements it owns,
 * and outward from it come its owners, the root namespace of the document the
 * reference is written in, and the global namespace. Each namespace's member
 * table is cached per `SymbolIndexes`.
 */
export class NamespaceResolver {
    private cacheByIndexes = new WeakMap<SymbolIndexes, ResolverCache>();
    /** `(candidate, owner)` pairs currently mid-check in `isSpecializationOf`, guarding against re-entrant recursion. */
    private specializationChecksInProgress = new Map<SysMLSymbol, Set<SysMLSymbol>>();

    /**
     * Whether `name` (simple or qualified) resolves from `symbol`'s reference
     * site: each segment after the first a member of the namespace the one
     * before it resolves to (KerML 8.2.3.5.1).
     */
    isLocallyVisible(symbol: SysMLSymbol, name: string, indexes: SymbolIndexes): boolean {
        return this.resolveNameFrom(symbol, name, indexes) !== undefined;
    }

    /** Resolve a (possibly qualified) name from the namespace owning `symbol`. */
    resolveNameFrom(symbol: SysMLSymbol, name: string, indexes: SymbolIndexes): SysMLSymbol | undefined {
        return this.resolveFrom(this.owningScope(symbol, indexes), name, indexes).symbol;
    }

    /** Resolve a reference in `namespace`, or, without one, at the top level of a document. */
    resolveNameIn(namespace: SysMLSymbol | undefined, name: string, indexes: SymbolIndexes): SysMLSymbol | undefined {
        return this.resolveReferenceIn(namespace, name, indexes).symbol;
    }

    /**
     * Resolve a reference in `namespace`, or, without one, at the top level of
     * document `uri`, without losing the reason a name is unresolved. Its first
     * segment is never resolved to `excluding`: a usage named after this
     * reference (`SysMLSymbol.namingReference`), which is a member of the
     * namespace the reference is resolved in, but never the feature it references.
     */
    resolveReferenceIn(namespace: SysMLSymbol | undefined, name: string, indexes: SymbolIndexes, excluding?: SysMLSymbol): NameResolution {
        const scope = namespace ? this.scopeOf(namespace, indexes) : undefined;
        return this.resolveFrom(scope, name, indexes, excluding);
    }

    /** Resolve a public qualified or feature-path member, without enclosing-scope fallback. */
    resolveMemberReference(owner: SysMLSymbol, name: string, indexes: SymbolIndexes): NameResolution {
        const scope = this.scopeOf(owner, indexes);
        const members = scope && this.tableOf(scope, indexes).get(name);
        if (members && this.isAmbiguous(members, indexes)) return { ambiguous: true };
        return { symbol: members?.find(member => member.visibility === 'public')?.symbol, ambiguous: false };
    }

    /** Resolve a feature of `receiver` in a feature chain: its own member, else one of its generals' (SysML 7.6.1). */
    resolveFeatureReference(receiver: SysMLSymbol, name: string, indexes: SymbolIndexes): NameResolution {
        const queue = [receiver];
        const visited = new Set<SysMLSymbol>();
        for (let index = 0; index < queue.length; index++) {
            const owner = queue[index];
            if (visited.has(owner)) continue;
            visited.add(owner);
            const member = this.resolveMemberReference(owner, name, indexes);
            if (member.symbol || member.ambiguous) return member;
            for (const general of this.generalsOf(owner, indexes)) {
                if (!visited.has(general)) queue.push(general);
            }
        }
        return { ambiguous: false };
    }

    /**
     * The element a relationship of the registry targets (SysML 7.2.3
     * `target`), cached per `indexes`; none when its target is unresolved or
     * ambiguous, or a conjugated port typing (`~P`), whose conjugated port
     * definition the server records no element for.
     */
    resolveTarget(relationship: RegistryRelationship, indexes: SymbolIndexes): TargetResolution {
        const { targets } = this.cacheOf(indexes);
        let resolution = targets.get(relationship.symbolId);
        if (!resolution) {
            // KerML 8.2.3.5.1: a name pending resolution is not resolved again, so a target whose
            // resolution comes back to itself (`part a :>> a.x;`) is unresolved there.
            targets.set(relationship.symbolId, { ambiguous: false });
            const owner = indexes.registry.getElement(relationship.ownerId);
            const declaring = owner && indexes.registry.symbolsOf(owner)
                .find(s => relationship.declarations.some(d => isSameDocumentUri(d.uri, s.uri)));
            const target = declaring && owner ? this.targetOf(relationship, owner, declaring, indexes) : { ambiguous: false };
            resolution = { targetId: target.symbol && this.scopeOf(target.symbol, indexes)?.symbolId, ambiguous: target.ambiguous };
            targets.set(relationship.symbolId, resolution);
        }
        return resolution;
    }

    /** The target of `relationship`, which `owner` declares in `declaring`, by the rule of its kind. */
    private targetOf(relationship: RegistryRelationship, owner: RegistryElement, declaring: SysMLSymbol, indexes: SymbolIndexes): NameResolution {
        if (relationship.kind === 'import') {
            // An import's target is resolved from the importing namespace outward (SysML 7.5.3).
            const { symbols, ambiguous } = this.resolveAll(owner, relationship.target, indexes, undefined, true);
            return ambiguous || symbols.length > 1 ? { ambiguous: true } : { symbol: symbols[0], ambiguous: false };
        }
        const chain = relationship.chain;
        if (!chain || chain.length === 0 || relationship.conjugated) return { ambiguous: false };
        const [first] = chain;
        const single = chain.length === 1;
        if ((relationship.kind === 'typing' || relationship.kind === 'specializes') && single) {
            // A general is a type, never a package (KerML 8.3.3.1.8 `general : Type`).
            const start = first.global ? GLOBAL_NAMESPACE : this.owningScope(declaring, indexes);
            const { symbols, ambiguous } = this.resolveAll(start, joinQualifiedName(first.names), indexes, declaring, true);
            if (ambiguous) return { ambiguous: true };
            return { symbol: symbols.find(s => s.kind !== SysMLElementKind.Package), ambiguous: false };
        }
        if (relationship.kind === 'redefinition' && single && !first.global) {
            // KerML 8.2.3.5.1: a feature of a definition or usage redefines one of its owner's generals' features.
            const owningType = owner.ownerId === undefined ? undefined : indexes.registry.getElement(owner.ownerId);
            const owningSymbol = owningType && this.symbolOf(owningType, indexes);
            if (owningSymbol && (isDefinition(owningSymbol.kind) || isUsage(owningSymbol.kind))) {
                return this.resolveRedefinedFeature(owningSymbol, joinQualifiedName(first.names), indexes);
            }
        }
        return this.resolveChain(declaring, chain, indexes);
    }

    /**
     * Resolve a feature chain written in `from`'s declaration (SysML 7.6.6,
     * 8.2.3.5.2): its first qualified name from the namespace owning `from`
     * (or, global, from the global namespace), never to `from` itself, each
     * later one's first name among the previous feature's features, the rest
     * among that one's members.
     */
    private resolveChain(from: SysMLSymbol, chain: ReferenceChain, indexes: SymbolIndexes): NameResolution {
        const [first, ...rest] = chain;
        const name = joinQualifiedName(first.names);
        let result = first.global
            ? this.resolveFrom(GLOBAL_NAMESPACE, name, indexes, from)
            : this.resolveFrom(this.owningScope(from, indexes), name, indexes, from);
        for (const link of rest) {
            const [feature, ...members] = link.names;
            if (!result.symbol || feature === undefined) return result.symbol ? { ambiguous: false } : result;
            result = this.resolveFeatureReference(result.symbol, feature, indexes);
            for (const member of members) {
                if (!result.symbol) return result;
                result = this.resolveMemberReference(result.symbol, member, indexes);
            }
        }
        return result;
    }

    /**
     * The namespaces a name is resolved in from `symbol`, innermost first
     * (SysML 7.5.1, 7.5.5): its owner and the owner's owners, the root namespace
     * of its document, and the global namespace.
     */
    namespaceAncestors(symbol: SysMLSymbol, indexes: SymbolIndexes): NamespaceScope[] {
        return this.ancestorsOf(this.owningScope(symbol, indexes), indexes);
    }

    /**
     * The resolved member table of a namespace: its owned members, for a
     * definition or usage the members it inherits (SysML 7.5.1), then its
     * imported members, transitively (SysML 7.5.3). A namespace given by
     * its qualified name (`''` for the global namespace) or by its symbol.
     */
    getResolvedMembers(namespace: NamespaceKey | NamespaceScope, indexes: SymbolIndexes): MemberTable {
        let scope: NamespaceScope | undefined;
        if (namespace === '') scope = GLOBAL_NAMESPACE;
        else if (typeof namespace === 'string') {
            const symbol = indexes.byQualifiedName.get(namespace);
            scope = symbol && this.scopeOf(symbol, indexes);
        } else if ('symbolId' in namespace && 'ownedElementIds' in namespace) scope = namespace as RegistryElement;
        else if (namespace === GLOBAL_NAMESPACE) scope = GLOBAL_NAMESPACE;
        else scope = this.scopeOf(namespace as SysMLSymbol, indexes);
        return scope ? this.tableOf(scope, indexes) : new Map();
    }

    /**
     * The named elements `namespace` owns (SysML 7.5.2), each once, whichever
     * declaration of it declares them; not those it inherits or imports.
     */
    ownedMembersOf(namespace: SysMLSymbol, indexes: SymbolIndexes): SysMLSymbol[] {
        const scope = this.scopeOf(namespace, indexes);
        return (scope?.ownedElementIds ?? [])
            .map(id => this.symbolOf(indexes.registry.getElement(id)!, indexes))
            .filter((member): member is SysMLSymbol => member !== undefined && !isAnonymous(member));
    }

    /** The ID of the element owning `symbol` in the registry; `''` for a top-level element, owned by the root namespace. */
    ownerIdOf(symbol: SysMLSymbol, indexes: SymbolIndexes): string {
        return this.scopeOf(symbol, indexes)?.ownerId ?? '';
    }

    /** The registry element a symbol is a declaration of; a package's merged view by its ID. */
    private scopeOf(symbol: SysMLSymbol, indexes: SymbolIndexes): RegistryElement | undefined {
        return indexes.registry.elementOf(symbol) ?? indexes.registry.getElement(symbol.symbolId);
    }

    /** The registry element owning `symbol`; none for a top-level element. */
    private owningScope(symbol: SysMLSymbol, indexes: SymbolIndexes): RegistryElement | undefined {
        const ownerId = this.scopeOf(symbol, indexes)?.ownerId;
        if (ownerId !== undefined) return indexes.registry.getElement(ownerId);
        const owner = ownerOf(symbol, indexes);
        return owner && this.scopeOf(owner, indexes);
    }

    /**
     * The symbol standing for `element` in results: for a package, the symbol
     * table's view of all its declarations (by its ID), else its declaration.
     */
    private symbolOf(element: RegistryElement, indexes: SymbolIndexes): SysMLSymbol | undefined {
        const declarations = indexes.registry.symbolsOf(element);
        if (element.kind === SysMLElementKind.Package) {
            const merged = indexes.byId.get(element.symbolId);
            if (merged) return merged;
        }
        return declarations[0];
    }

    /** The cache of `indexes`, created on first use. */
    private cacheOf(indexes: SymbolIndexes): ResolverCache {
        let cache = this.cacheByIndexes.get(indexes);
        if (!cache) {
            cache = { tables: new Map(), targets: new Map() };
            this.cacheByIndexes.set(indexes, cache);
        }
        return cache;
    }

    /**
     * The namespaces a name is resolved in, from `start` outward (KerML
     * 8.2.3.5.4): `start` and its owners, then the root namespace of the
     * workspace, the global namespace, last.
     */
    private ancestorsOf(start: NamespaceScope | undefined, indexes: SymbolIndexes): NamespaceScope[] {
        const ancestors: NamespaceScope[] = [];
        let current: NamespaceScope | undefined = start;
        let guard = 0;
        while (current && isElementScope(current) && guard++ < MAX_NAMESPACE_NESTING_DEPTH && !ancestors.includes(current)) {
            ancestors.push(current);
            current = current.ownerId === undefined ? undefined : indexes.registry.getElement(current.ownerId);
        }
        ancestors.push(GLOBAL_NAMESPACE);
        return ancestors;
    }

    /**
     * Resolve a (possibly qualified) name from namespace `start` (none: the root
     * namespace of `uri`) to one element (`resolveAll`): a name found for more
     * than one, through distinguishable qualifiers, is ambiguous.
     */
    private resolveFrom(start: NamespaceScope | undefined, name: string, indexes: SymbolIndexes, excluding?: SysMLSymbol): NameResolution {
        const { symbols, ambiguous } = this.resolveAll(start, name, indexes, excluding, false);
        if (ambiguous || symbols.length > 1) return { ambiguous: true };
        return { symbol: symbols[0], ambiguous: false };
    }

    /**
     * Resolve a (possibly qualified) name from namespace `start` (none: the root
     * namespace of `uri`): its first segment in the innermost namespace having a
     * member of that name (SysML 7.5.1, 7.5.5), each later one among the visible
     * members of what the one before it resolves to. A qualifying segment naming
     * several distinguishable members (a package and a definition, KerML
     * 8.3.2.4.3) qualifies through each of them; the last segment gives each
     * qualifier's first member of its name, or with `all` every one of them.
     */
    private resolveAll(
        start: NamespaceScope | undefined, name: string, indexes: SymbolIndexes,
        excluding: SysMLSymbol | undefined, all: boolean,
    ): { symbols: SysMLSymbol[]; ambiguous: boolean } {
        const [first, ...rest] = splitQualifiedName(name);
        const ancestors = this.ancestorsOf(start, indexes);
        const unresolved = { symbols: [], ambiguous: false };

        let current: SysMLSymbol[] = [];
        for (const ancestor of ancestors) {
            const members = this.tableOf(ancestor, indexes).get(first);
            const candidates = excluding ? members?.filter(member => member.symbol !== excluding) : members;
            if (candidates && candidates.length > 0) {
                // Ambiguous among all the namespace's members of that name, the excluded one
                // included: two indistinguishable members leave the name unresolved there.
                if (this.isAmbiguous(members!, indexes)) return { symbols: [], ambiguous: true };
                current = rest.length > 0 || all ? candidates.map(c => c.symbol) : [candidates[0].symbol];
                break;
            }
        }
        if (current.length === 0) return unresolved;

        // A later segment is a member of the namespace the one before it resolved to, visible
        // from `start`: public, or private or protected to a reference from within that
        // namespace, protected also from a specialization of it (SysML 7.5.3).
        for (const [index, segment] of rest.entries()) {
            const last = index === rest.length - 1;
            const next: SysMLSymbol[] = [];
            for (const owner of current) {
                const ownerScope = this.scopeOf(owner, indexes);
                const members = ownerScope && this.tableOf(ownerScope, indexes).get(segment);
                if (!members) continue;
                if (this.isAmbiguous(members, indexes)) return { symbols: [], ambiguous: true };
                const visible = members.filter(m => m.visibility === 'public'
                    || ancestors.includes(ownerScope!)
                    || (m.visibility === 'protected' && this.isProtectedVisibleFrom(ancestors, owner, indexes)));
                if (visible.length === 0) continue;
                next.push(...(last && !all ? [visible[0]] : visible).map(m => m.symbol));
            }
            current = [...new Set(next)];
            if (current.length === 0) return unresolved;
        }
        return { symbols: current, ambiguous: false };
    }

    /**
     * Whether a name can't be resolved to one of `candidates`, the members of
     * one namespace by that name: two of them are of the same kind and owned
     * by the same element, so indistinguishable there (KerML 8.3.2.4.3, kinds
     * conforming only to themselves here), whether the name is either one's
     * name or short name (SysML 7.2.2), and whether this namespace owns them
     * or inherits or imports them from that one.
     */
    private isAmbiguous(candidates: ResolvedMember[], indexes: SymbolIndexes): boolean {
        const seen = new Map<string, SysMLSymbol>();
        for (const { symbol } of candidates) {
            const element = this.scopeOf(symbol, indexes);
            if (!element || element.kind === SysMLElementKind.Package) continue;
            // Top-level elements, of every document, are owned by the one root namespace.
            const key = `${element.ownerId ?? ''}\0${element.kind}`;
            const other = seen.get(key);
            if (other && other !== symbol) return true;
            seen.set(key, symbol);
        }
        return false;
    }

    /**
     * SysML 7.5.3's protected visibility: a protected member of a definition or
     * usage `owner` is visible from a namespace among `ancestors` that
     * specializes it.
     */
    private isProtectedVisibleFrom(ancestors: readonly NamespaceScope[], owner: SysMLSymbol, indexes: SymbolIndexes): boolean {
        if (!(isDefinition(owner.kind) || isUsage(owner.kind))) return false;
        for (const ancestor of ancestors) {
            const candidate = isElementScope(ancestor) ? this.symbolOf(ancestor, indexes) : undefined;
            if (candidate && this.isSpecializationOf(candidate, owner, indexes)) return true;
        }
        return false;
    }

    /**
     * Whether `candidate` transitively specializes `owner`, through its
     * generals (SysML 7.6, `generalsOf`). Fails closed on a re-entrant check
     * of the same pair.
     */
    private isSpecializationOf(candidate: SysMLSymbol, owner: SysMLSymbol, indexes: SymbolIndexes): boolean {
        const ownersInProgress = this.specializationChecksInProgress.get(candidate) ?? new Set<SysMLSymbol>();
        if (ownersInProgress.has(owner)) return false;
        ownersInProgress.add(owner);
        this.specializationChecksInProgress.set(candidate, ownersInProgress);
        const ownerScope = this.scopeOf(owner, indexes);
        try {
            const visited = new Set<SysMLSymbol>([candidate]);
            let frontier = [candidate];
            let guard = 0;
            while (frontier.length > 0 && guard++ < MAX_SPECIALIZATION_CHAIN_DEPTH) {
                const next: SysMLSymbol[] = [];
                for (const symbol of frontier) {
                    for (const supertype of this.generalsOf(symbol, indexes)) {
                        if (supertype === owner || (ownerScope !== undefined && this.scopeOf(supertype, indexes) === ownerScope)) return true;
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
     * The member table of `scope`, computed once per `indexes`: owned members,
     * then for a definition or usage its inherited ones, then imported ones; a
     * root namespace has its document's top-level elements, the global
     * namespace every document's.
     */
    private tableOf(scope: NamespaceScope, indexes: SymbolIndexes): MemberTable {
        const { tables } = this.cacheOf(indexes);
        const cached = tables.get(scope);
        if (cached) return cached;

        const members: MemberTable = new Map();
        // The same element reaching this namespace through more than one membership has
        // the most permissive visibility of them, whatever order they're found in.
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
        const addOwned = (element: RegistryElement) => {
            const owned = this.symbolOf(element, indexes);
            if (!owned || isAnonymous(owned)) return;
            for (const name of memberNamesOf(owned)) addMember(name, { symbol: owned, visibility: owned.visibility ?? 'public' });
        };

        if (!isElementScope(scope)) {
            for (const id of indexes.registry.getRootIds()) addOwned(indexes.registry.getElement(id)!);
            tables.set(scope, members);
            // Every document's top-level imports are memberships of the one root namespace,
            // visible within all its top-level elements (SysML 7.5.5).
            for (const imp of indexes.registry.getAllRootImports()) this.applyImport(imp, scope, indexes, addMember);
            return members;
        }

        for (const id of scope.ownedElementIds) addOwned(indexes.registry.getElement(id)!);
        // Seeded with the live table before imports, so an import resolved relative to this
        // namespace sees its owned members and the earlier imports, and an import cycle ends.
        tables.set(scope, members);

        const owner = this.symbolOf(scope, indexes);
        // Inherited before imported: an inherited membership hides an imported one of the same name (KerML 7.3.2.1).
        if (owner && (isDefinition(owner.kind) || isUsage(owner.kind))) this.addInheritedMembers(owner, scope, indexes, addMember);
        // Imports of every declaration, each resolved from the document declaring it; SysML
        // 7.5.4: a package's `filter` applies to every import of that package.
        const declarations = indexes.registry.symbolsOf(scope);
        const packageFilter = combineFilters(declarations.flatMap(d => d.filterConditions ?? []));
        for (const declaration of declarations) {
            for (const imp of declaration.importTargets ?? []) {
                const effectiveFilter = combineFilters([packageFilter, imp.filter].filter((f): f is FilterExpr => f !== undefined));
                const filteredAddMember = effectiveFilter
                    ? (name: string, entry: ResolvedMember) => {
                        if (evaluateFilter(effectiveFilter, entry.symbol)) addMember(name, entry);
                    }
                    : addMember;
                this.applyImport(imp, scope, indexes, filteredAddMember);
            }
        }
        return members;
    }

    /**
     * Fold the memberships `type` inherits into `addMember` (KerML 7.3.2.1,
     * 8.3.3.1.10 `Type::inheritedMemberships`): the public and protected
     * memberships of the types it specializes, without the features redefined
     * there, by another inherited feature or by a feature `type` owns.
     */
    private addInheritedMembers(type: SysMLSymbol, scope: RegistryElement, indexes: SymbolIndexes, addMember: (name: string, entry: ResolvedMember) => void): void {
        const inheritable: [string, ResolvedMember][] = [];
        for (const general of this.generalsOf(type, indexes)) {
            const generalScope = this.scopeOf(general, indexes);
            if (!generalScope) continue;
            for (const [name, entries] of this.tableOf(generalScope, indexes)) {
                for (const entry of entries) {
                    if (entry.visibility !== 'private' && entry.symbol !== type) inheritable.push([name, { symbol: entry.symbol, visibility: entry.visibility }]);
                }
            }
        }
        const ownedSymbols = scope.ownedElementIds
            .map(id => this.symbolOf(indexes.registry.getElement(id)!, indexes))
            .filter((owned): owned is SysMLSymbol => owned !== undefined);
        const redefinedByOwned = new Set(ownedSymbols
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
     * The types `type` specializes, each once (SysML 7.6.1): the targets
     * of the specializations its own declarations parse to (typing,
     * subclassification, subsetting, redefinition, `resolveTarget`), and the
     * feature a shorthand's reference subsetting (`perform a`) refers to
     * (SysML 7.17.6, 7.9.5). Never `type` itself.
     */
    private generalsOf(type: SysMLSymbol, indexes: SymbolIndexes): SysMLSymbol[] {
        const element = this.scopeOf(type, indexes);
        const generals: (SysMLSymbol | undefined)[] = [];
        for (const id of element?.ownedRelationshipIds ?? []) {
            const relationship = indexes.registry.getRelationship(id);
            if (!relationship || relationship.kind === 'import') continue;
            const { targetId } = this.resolveTarget(relationship, indexes);
            const target = targetId === undefined ? undefined : indexes.registry.getElement(targetId);
            generals.push(target && this.symbolOf(target, indexes));
        }
        if (type.namingReference !== undefined && !type.namedByRedefinition) generals.push(this.resolveNamingFeature(type, indexes));
        return [...new Set(generals.filter((general): general is SysMLSymbol => general !== undefined && general !== type))];
    }

    /**
     * The feature `symbol`'s `namingReference` refers to: resolved from the
     * namespace owning `symbol` (KerML 8.2.3.5.2), never to `symbol` itself, or
     * for a redefinition from the types its owner specializes (8.2.3.5.1);
     * through a feature chain, each feature after the first is one of the one
     * before it.
     */
    resolveNamingFeature(symbol: SysMLSymbol, indexes: SymbolIndexes): SysMLSymbol | undefined {
        const owner = ownerOf(symbol, indexes);
        const [path] = scanFeaturePaths(symbol.namingReference ?? '');
        if (!path) return undefined;
        const [first, ...chain] = path.qualifiedNames;
        // The features of a redefined chain (`:>> x2.p`) are resolved as any reference, from the owner.
        let feature = symbol.namedByRedefinition && chain.length === 0
            ? owner && this.resolveRedefinedFeature(owner, first.name, indexes).symbol
            : this.resolveReferenceIn(owner, first.name, indexes, symbol).symbol;
        for (const qualified of chain) {
            const [member, ...rest] = qualified.segments;
            feature = feature && this.resolveFeatureReference(feature, member.name, indexes).symbol;
            for (const segment of rest) feature = feature && this.resolveMemberReference(feature, segment.name, indexes).symbol;
        }
        return feature;
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
            const resolution = this.resolveFrom(this.scopeOf(general, indexes), name, indexes);
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
     * Fold one `import`'s memberships into `addMember` (SysML 7.5.3, KerML
     * 8.3.2.4.5): its target resolved from the importing namespace outward,
     * then the target itself (a membership import), its visible members (a
     * namespace import), and with `::**` theirs recursively.
     */
    private applyImport(
        imp: ImportTarget,
        importing: NamespaceScope,
        indexes: SymbolIndexes,
        addMember: (name: string, entry: ResolvedMember) => void,
    ): void {
        // A target naming distinguishable members (a package and a definition) imports through each.
        const { symbols: targets, ambiguous } = this.resolveAll(importing, imp.target, indexes, undefined, true);
        if (ambiguous) return;
        for (const target of targets) {
            const targetScope = this.scopeOf(target, indexes);
            switch (imp.kind) {
                case 'membership':
                case 'membership-deep':
                    for (const name of memberNamesOf(target)) addMember(name, { symbol: target, visibility: imp.visibility });
                    if (imp.kind === 'membership-deep' && targetScope) this.importVisibleMembers(targetScope, imp.visibility, indexes, addMember, true);
                    break;
                case 'namespace-shallow':
                case 'namespace-deep':
                    if (targetScope) this.importVisibleMembers(targetScope, imp.visibility, indexes, addMember, imp.kind === 'namespace-deep');
                    break;
            }
        }
    }

    /**
     * Import the public members of namespace `owner` (its own and those it
     * imports publicly), each with this import's visibility; when `recursive`,
     * also those of each imported member that is a namespace (`::**`). Each
     * namespace once, so a namespace importing itself or a cycle of imports ends.
     */
    private importVisibleMembers(
        owner: RegistryElement,
        importVisibility: 'public' | 'private' | 'protected',
        indexes: SymbolIndexes,
        addMember: (name: string, entry: ResolvedMember) => void,
        recursive: boolean,
        visited: Set<RegistryElement> = new Set(),
    ): void {
        if (visited.has(owner)) return;
        visited.add(owner);
        for (const [name, entries] of this.tableOf(owner, indexes)) {
            for (const entry of entries) {
                if (entry.visibility === 'private' || entry.visibility === 'protected') continue;
                addMember(name, { symbol: entry.symbol, visibility: importVisibility });
                const memberScope = recursive ? this.scopeOf(entry.symbol, indexes) : undefined;
                if (memberScope) this.importVisibleMembers(memberScope, importVisibility, indexes, addMember, true, visited);
            }
        }
    }
}

/** Whether `scope` is an element of the registry, not a root or the global namespace. */
function isElementScope(scope: NamespaceScope): scope is RegistryElement {
    return 'symbolId' in scope;
}
