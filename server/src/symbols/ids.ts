import { canonicalUri } from '../utils/documentUri.js';
import { escapeName } from '../utils/names.js';
import { NAMESPACE_URL, getUrlPrefix, uuidV5 } from '../utils/uuid.js';
import { SysMLElementKind, SysMLSymbol, isAnonymous } from './sysmlElements.js';

/**
 * Gives each declaration its `symbolId` and `parentId`, and finds it by
 * them. A symbolId is a version 5 UUID derived from the text of the
 * workspace following KerML 9.1, so it survives reloads and edits
 * elsewhere. It is not the KerML `elementId`, which must not change while the
 * element exists: a rename or move gives a new symbolId.
 *
 * It is derived from:
 *
 * - a top-level element: its URL (the project's URL prefix and its name) in
 *   the URL namespace;
 * - any other element: its path in the namespace of its top-level element's
 *   UUID. The path is its qualified name as written in the notation; without
 *   one, its owner's path, `/` and its declaration as written (KerML uses a
 *   position in the abstract syntax here, which this server doesn't build).
 *
 * Declarations with the same path form a group, identified by the UUID of
 * that key. A package, one element however many documents declare it, takes
 * the group's UUID; the other declarations are numbered by document and
 * position (`path`, `path#2`, ...), so the result never depends on the order
 * documents are indexed in. A document is added or removed on its own: only
 * groups it shares with other documents, and the members of a declaration
 * whose symbol ID changes as a result, are revisited.
 *
 * So a symbol ID is stable across reloads only while the set of declarations
 * is unchanged: when another document adds or removes a declaration with the
 * same path, the declarations are renumbered, and one sorted after it gets a
 * new symbol ID, as do its members (a package keeps its own).
 */
export class IdRegistry {
    /** Declarations by symbol ID */
    private readonly byId = new Map<string, SysMLSymbol>();
    /** Declarations sharing a key, by the UUID of that key */
    private readonly groups = new Map<string, SysMLSymbol[]>();
    /** The namespace, key and path each group's UUID was derived from */
    private readonly groupKeys = new Map<string, { namespace: string; key: string; path: string }>();
    /** The group each declaration is in */
    private readonly groupOf = new WeakMap<SysMLSymbol, string>();
    /** For debugging only: the unique key each symbol ID was derived from */
    private readonly keys = new WeakMap<SysMLSymbol, string>();
    /** Each declaration's unique path, which its members' paths start with */
    private readonly paths = new WeakMap<SysMLSymbol, string>();
    /** The UUID of each namespace and key seen (namespace first), so an unchanged element is not hashed again */
    private uuidsByKey = new Map<string, string>();

    /**
     * @param owners each declaration's owner, as declared in the parse tree
     * @param members each declaration's own members, the reverse of `owners`
     */
    constructor(
        private readonly owners: WeakMap<SysMLSymbol, SysMLSymbol>,
        private readonly members: WeakMap<SysMLSymbol, SysMLSymbol[]>,
    ) {}

    /** The declaration with `symbolId`, if any. */
    get(id: string): SysMLSymbol | undefined {
        return this.byId.get(id);
    }

    /** Give a document's declarations their symbol IDs; `declarations` lists every owner before its members. */
    add(declarations: readonly SysMLSymbol[]): void {
        for (const declaration of declarations) this.place(declaration);
        if (this.uuidsByKey.size > 4 * this.byId.size + 1024) this.uuidsByKey = new Map();
    }

    /** Forget a document's declarations, renumbering the groups they shared with other documents. */
    remove(declarations: readonly SysMLSymbol[]): void {
        const touched = new Set<string>();
        for (const declaration of declarations) {
            const groupId = this.groupOf.get(declaration);
            if (groupId !== undefined) {
                this.leaveGroup(declaration, groupId);
                touched.add(groupId);
            }
            if (this.byId.get(declaration.symbolId) === declaration) this.byId.delete(declaration.symbolId);
        }
        for (const groupId of touched) this.renumber(groupId);
    }

    /** Derive `declaration`'s namespace and key (KerML 9.1), and join that key's group. */
    private place(declaration: SysMLSymbol): void {
        const owner = this.owners.get(declaration);
        declaration.parentId = owner?.symbolId;
        const path = declaration.qualifiedName !== undefined
            ? this.qualifiedNameAsWritten(declaration)
            : owner ? `${this.paths.get(owner)}/${segmentOf(declaration)}` : segmentOf(declaration);
        const namespace = owner ? this.topLevelOf(owner).symbolId : NAMESPACE_URL;
        const key = owner ? path : getUrlPrefix() + encodeURIComponent(path);
        const groupId = this.uuidOf(namespace, key);
        this.groupKeys.set(groupId, { namespace, key, path });
        this.groupOf.set(declaration, groupId);
        const group = this.groups.get(groupId) ?? [];
        group.push(declaration);
        this.groups.set(groupId, group);
        this.renumber(groupId);
    }

    /** Give each declaration in a group its symbol ID: packages the group's own, the others numbered by site. */
    private renumber(groupId: string): void {
        const group = this.groups.get(groupId);
        if (!group || group.length === 0) {
            this.groups.delete(groupId);
            this.groupKeys.delete(groupId);
            return;
        }
        const { namespace, key, path } = this.groupKeys.get(groupId)!;
        const packages = group.filter(s => s.kind === SysMLElementKind.Package);
        const others = group.filter(s => s.kind !== SysMLElementKind.Package).sort(compareDeclarationSites);
        for (const declaration of packages) this.assign(declaration, groupId, key, path);
        others.forEach((declaration, i) => {
            const n = packages.length + i;
            const suffix = n === 0 ? '' : `#${n + 1}`;
            this.assign(declaration, n === 0 ? groupId : this.uuidOf(namespace, key + suffix), key + suffix, path + suffix);
        });
    }

    /** Set `declaration`'s symbol ID and path; if it changed, re-derive its members' symbol IDs too. */
    private assign(declaration: SysMLSymbol, id: string, uniqueKey: string, uniquePath: string): void {
        this.keys.set(declaration, uniqueKey);
        this.paths.set(declaration, uniquePath);
        if (declaration.symbolId === id) {
            // Still found after another document's declaration of the same package left.
            if (!this.byId.has(id)) this.byId.set(id, declaration);
            return;
        }
        const previous = declaration.symbolId;
        if (previous && this.byId.get(previous) === declaration) this.byId.delete(previous);
        declaration.symbolId = id;
        // A package declared in several documents is one element: any of its declarations finds it.
        if (!this.byId.has(id) || declaration.kind !== SysMLElementKind.Package) this.byId.set(id, declaration);
        // A declaration just added has no members placed yet. An existing one's members depend on
        // its symbol ID (their namespace, if it is top-level) or its path (theirs, if they have no qualified name).
        if (previous) {
            for (const member of this.members.get(declaration) ?? []) {
                member.parentId = id;
                this.replace(member);
            }
        }
    }

    /** `declaration`'s qualified name as written in the notation, each name escaped (`Demo::'my car'`). */
    private qualifiedNameAsWritten(declaration: SysMLSymbol): string {
        const owner = this.owners.get(declaration);
        const name = escapeName(declaration.name);
        return owner ? `${this.qualifiedNameAsWritten(owner)}::${name}` : name;
    }

    /** The top-level element that owns `declaration`, directly or not, or `declaration` itself. */
    private topLevelOf(declaration: SysMLSymbol): SysMLSymbol {
        let topLevel = declaration;
        for (let owner = this.owners.get(topLevel); owner; owner = this.owners.get(topLevel)) topLevel = owner;
        return topLevel;
    }

    /** Re-derive the key of a member whose owner's symbol ID changed. */
    private replace(member: SysMLSymbol): void {
        const groupId = this.groupOf.get(member);
        if (groupId !== undefined) {
            this.leaveGroup(member, groupId);
            this.renumber(groupId);
        }
        this.place(member);
    }

    private leaveGroup(declaration: SysMLSymbol, groupId: string): void {
        const group = this.groups.get(groupId);
        const index = group?.indexOf(declaration) ?? -1;
        if (index >= 0) group!.splice(index, 1);
        this.groupOf.delete(declaration);
    }

    /** The UUID of `key` in `namespace`. */
    private uuidOf(namespace: string, key: string): string {
        // A namespace is a UUID of fixed length, so the two can't run into each other.
        const cacheKey = namespace + key;
        let uuid = this.uuidsByKey.get(cacheKey);
        if (!uuid) {
            uuid = uuidV5(namespace, key);
            this.uuidsByKey.set(cacheKey, uuid);
        }
        return uuid;
    }
}

/**
 * An element's own path segment: its name as written, or, anonymous, its
 * declaration as written. A declaration starts with a keyword or symbol, and a
 * path segment of it follows a `/`, so it never equals a qualified name.
 */
function segmentOf(declaration: SysMLSymbol): string {
    return isAnonymous(declaration) ? declaration.declaration ?? declaration.kind : escapeName(declaration.name);
}

/**
 * Order declarations by document, then by position in it -- the same on every
 * machine and locale, and for every spelling of a Windows path (`c%3A` / `C:`).
 */
function compareDeclarationSites(a: SysMLSymbol, b: SysMLSymbol): number {
    const uriA = canonicalUri(a.uri), uriB = canonicalUri(b.uri);
    if (uriA !== uriB) return uriA < uriB ? -1 : 1;
    return a.range.start.line - b.range.start.line || a.range.start.character - b.range.start.character;
}
