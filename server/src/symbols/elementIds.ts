import { canonicalUri } from '../utils/documentUri.js';
import { ELEMENT_ID_NAMESPACE, OWNED_ELEMENT_ID_NAMESPACE, uuidV5 } from '../utils/uuid.js';
import { SysMLElementKind, SysMLSymbol, isAnonymous } from './sysmlElements.js';

/**
 * Gives each declaration its `elementId` and `parentId`, and finds it
 * by them. An elementId is the version 5 UUID of a key derived only from the
 * text of the workspace, so an element keeps its ID across edits elsewhere
 * and reloads:
 *
 * - an element with a qualified name: that qualified name;
 * - an anonymous element: `anonymous/`, its owner's elementId, kind and
 *   header (`SysMLSymbol.label`, types, multiplicity);
 * - a member of an anonymous element: `member/`, its owner's elementId and name.
 *
 * The last two are hashed in their own namespace (`OWNED_ELEMENT_ID_NAMESPACE`),
 * so no qualified name, whatever it quotes, can give the same UUID; their
 * fixed first segment keeps them apart from each other.
 *
 * Declarations with the same key form a group, identified by the UUID of that
 * key. A package, one element however many documents declare it, takes the
 * group's UUID; the other declarations are numbered by document and position
 * (`key`, `key#2`, ...), so the result never depends on the order documents
 * are indexed in. A document is added or removed on its own: only groups it
 * shares with other documents, and the members of a declaration whose ID
 * changes as a result, are revisited.
 */
export class ElementIdRegistry {
    /** Declarations by elementId */
    private readonly byId = new Map<string, SysMLSymbol>();
    /** Declarations sharing a key, by the UUID of that key */
    private readonly groups = new Map<string, SysMLSymbol[]>();
    /** The key, and its namespace, each group's UUID was derived from */
    private readonly groupKeys = new Map<string, { namespace: string; key: string }>();
    /** The group each declaration is in */
    private readonly groupOf = new WeakMap<SysMLSymbol, string>();
    /** For debugging only: the unique key each elementId was derived from */
    private readonly keys = new WeakMap<SysMLSymbol, string>();
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

    /** The declaration with `elementId`, if any. */
    get(elementId: string): SysMLSymbol | undefined {
        return this.byId.get(elementId);
    }

    /** Give a document's declarations their IDs; `declarations` lists every owner before its members. */
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
            if (this.byId.get(declaration.elementId) === declaration) this.byId.delete(declaration.elementId);
        }
        for (const groupId of touched) this.renumber(groupId);
    }

    /** Derive `declaration`'s key from its owner's ID, and join that key's group. */
    private place(declaration: SysMLSymbol): void {
        const owner = this.owners.get(declaration);
        const ownerId = owner?.elementId ?? '';
        declaration.parentId = owner?.elementId;
        const qualifiedName = declaration.qualifiedName;
        const namespace = qualifiedName !== undefined ? ELEMENT_ID_NAMESPACE : OWNED_ELEMENT_ID_NAMESPACE;
        const key = qualifiedName !== undefined
            ? qualifiedName
            : isAnonymous(declaration)
                ? `anonymous/${ownerId}/${declaration.kind}:${declaration.label ?? ''}:${declaration.typeNames.join(',')}:${declaration.multiplicity ?? ''}`
                : `member/${ownerId}/${declaration.name}`;
        const groupId = this.uuidOf(namespace, key);
        this.groupKeys.set(groupId, { namespace, key });
        this.groupOf.set(declaration, groupId);
        const group = this.groups.get(groupId) ?? [];
        group.push(declaration);
        this.groups.set(groupId, group);
        this.renumber(groupId);
    }

    /** Give each declaration in a group its ID: packages the group's own, the others numbered by site. */
    private renumber(groupId: string): void {
        const group = this.groups.get(groupId);
        if (!group || group.length === 0) {
            this.groups.delete(groupId);
            this.groupKeys.delete(groupId);
            return;
        }
        const { namespace, key } = this.groupKeys.get(groupId)!;
        const packages = group.filter(s => s.kind === SysMLElementKind.Package);
        const others = group.filter(s => s.kind !== SysMLElementKind.Package).sort(compareDeclarationSites);
        for (const declaration of packages) this.assign(declaration, groupId, key);
        others.forEach((declaration, i) => {
            const n = packages.length + i;
            const uniqueKey = n === 0 ? key : `${key}#${n + 1}`;
            this.assign(declaration, n === 0 ? groupId : this.uuidOf(namespace, uniqueKey), uniqueKey);
        });
    }

    /** Set `declaration`'s ID; if it had another one, move its members along. */
    private assign(declaration: SysMLSymbol, elementId: string, uniqueKey: string): void {
        this.keys.set(declaration, uniqueKey);
        if (declaration.elementId === elementId) {
            // Still found after another document's declaration of the same package left.
            if (!this.byId.has(elementId)) this.byId.set(elementId, declaration);
            return;
        }
        const previous = declaration.elementId;
        if (previous && this.byId.get(previous) === declaration) this.byId.delete(previous);
        declaration.elementId = elementId;
        // A package declared in several documents is one element: any of its declarations finds it.
        if (!this.byId.has(elementId) || declaration.kind !== SysMLElementKind.Package) this.byId.set(elementId, declaration);
        // A declaration just added has no members placed yet; an existing one's members follow its new ID.
        if (previous) {
            for (const member of this.members.get(declaration) ?? []) {
                member.parentId = elementId;
                // A member with a qualified name is identified by it, not through its owner.
                if (member.qualifiedName === undefined) this.replace(member);
            }
        }
    }

    /** Re-derive the key of a member whose owner's ID changed. */
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
 * Order declarations by document, then by position in it -- the same on every
 * machine and locale, and for every spelling of a Windows path (`c%3A` / `C:`).
 */
function compareDeclarationSites(a: SysMLSymbol, b: SysMLSymbol): number {
    const uriA = canonicalUri(a.uri), uriB = canonicalUri(b.uri);
    if (uriA !== uriB) return uriA < uriB ? -1 : 1;
    return a.range.start.line - b.range.start.line || a.range.start.character - b.range.start.character;
}
