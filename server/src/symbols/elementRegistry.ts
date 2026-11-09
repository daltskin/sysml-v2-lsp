import { Range } from 'vscode-languageserver/node';
import { canonicalUri } from '../utils/documentUri.js';
import { getUrlPrefix } from '../utils/uuid.js';
import { RegistryIds } from './ids.js';
import { ImportTarget, OwnedSpecialization, ReferenceChain, SysMLElementKind, SysMLSymbol, escapedName } from './sysmlElements.js';

/** Where an element or relationship is declared. */
export interface Declaration {
    uri: string;
    range: Range;
}

/** An element of the registry: one per element, however many declarations it has. */
export interface RegistryElement {
    symbolId: string;
    kind: SysMLElementKind;
    name?: string;
    shortName?: string;
    /** For a package: whether it is a library package (SysML 8.2.2.5). */
    isLibraryPackage?: boolean;
    /** Its `owner` (SysML 7.2.1); none for a top-level element. */
    ownerId?: string;
    /** Its `ownedElement`s (SysML 7.2.1), whichever document declares them, in order. */
    ownedElementIds: string[];
    /** Its `ownedRelationship`s (SysML 7.2.1) the registry records, in order. */
    ownedRelationshipIds: string[];
    /** Its declarations, by document URI, then position: more than one only for a package. */
    declarations: Declaration[];
}

/** The kinds of relationship the registry records. */
export type RegistryRelationshipKind = OwnedSpecialization['kind'] | 'import';

/** A relationship of the registry, an element of its own (SysML 7.2.3). */
export interface RegistryRelationship {
    symbolId: string;
    kind: RegistryRelationshipKind;
    /** Its `owningRelatedElement`, also its `source`. */
    ownerId: string;
    sourceId: string;
    /** Its `target` as written: text only, never identifying the element (see `NamespaceResolver.resolveTarget`). */
    target: string;
    /** For a specialization: its target as parsed, a feature chain of qualified names. */
    chain?: ReferenceChain;
    /** For a typing: whether it is a conjugated port typing (`~P`). */
    conjugated?: boolean;
    declarations: Declaration[];
}

/** An element of the registry with what it is derived from: its declarations, owner, members and path. */
interface Node {
    element: RegistryElement;
    /** Its declarations, by document URI, then position. */
    symbols: SysMLSymbol[];
    owner?: Node;
    /** Its members, in the order of their first declarations. */
    members: Node[];
    /** Its members that are packages, by name, so another declaration of one joins it. */
    packages: Map<string, Node>;
    /** Its path, unique in its top-level element (`#2` for a later one of the same path); its ID derived from it. */
    path: string;
    /** Its qualified name as written, without any `#2`; none when it or an owner is unnamed. */
    qualifiedPath?: string;
    /** The ID of its top-level element, the namespace of its own ID. */
    topLevelId: string;
}

/**
 * The model of the whole workspace by ID, not by document: every element once,
 * its owner and owned elements by ID, its declarations, and the relationships
 * it declares (SysML 7.2). Same-named packages of one namespace, in one
 * document or several, are one element. Kept up to date document by document:
 * a change re-derives only that document's elements and the namespaces it
 * shares with others.
 */
export class ElementRegistry {
    private readonly documents = new Map<string, readonly SysMLSymbol[]>();
    private readonly nodes = new Map<string, Node>();
    private readonly nodeOf = new Map<SysMLSymbol, Node>();
    private readonly relationships = new Map<string, RegistryRelationship>();
    /**
     * The element each relationship was recorded for: when elements trade
     * numbered IDs (`#2`), one may take relationship IDs another still lists,
     * and each removes only those it recorded.
     */
    private readonly relationshipNodes = new Map<string, Node>();
    /** The relationship each parsed specialization and import is, by the object the parse gave it. */
    private relationshipIds = new WeakMap<OwnedSpecialization | ImportTarget, string>();
    private readonly roots: Node[] = [];
    private readonly rootPackages = new Map<string, Node>();
    /** Each document's top-level imports, imports of the root namespace, by `canonicalUri`. */
    private readonly rootImports = new Map<string, readonly ImportTarget[]>();
    private rootIds: string[] = [];

    /**
     * @param ownerOf each declaration's owner, as declared in the parse tree
     * @param writeIds whether to give each declaration its element's ID as its
     * `symbolId`, and its owner's as its `parentId`, so the registry is where
     * symbol IDs come from
     */
    constructor(
        private readonly ownerOf: (symbol: SysMLSymbol) => SysMLSymbol | undefined,
        private readonly writeIds = false,
    ) {}

    /**
     * A registry of `symbols` alone, each owned by the symbol its `parentId`
     * names, for a caller with symbols but no symbol table.
     */
    static fromSymbols(symbols: readonly SysMLSymbol[]): ElementRegistry {
        const byId = new Map(symbols.map(symbol => [symbol.symbolId, symbol]));
        const registry = new ElementRegistry(symbol => symbol.parentId === undefined ? undefined : byId.get(symbol.parentId));
        const byUri = new Map<string, SysMLSymbol[]>();
        for (const symbol of symbols) byUri.set(symbol.uri, [...byUri.get(symbol.uri) ?? [], symbol]);
        registry.update([...byUri.keys()], [...byUri]);
        return registry;
    }

    /**
     * Set the declarations of document `uri`, in place of any it had, and the
     * imports written at its top level, which the root namespace owns (SysML 7.5.5).
     */
    setDocument(uri: string, declarations: readonly SysMLSymbol[], rootImports: readonly ImportTarget[] = []): void {
        this.update([uri], [[uri, declarations]]);
        if (rootImports.length > 0) this.rootImports.set(canonicalUri(uri), rootImports);
        else this.rootImports.delete(canonicalUri(uri));
    }

    /** Forget the declarations of document `uri`. */
    removeDocument(uri: string): void {
        this.rootImports.delete(canonicalUri(uri));
        if (this.documents.has(uri)) this.update([uri], []);
    }

    /** The imports written at the top level of every document, by document URI: those of the root namespace. */
    getAllRootImports(): readonly ImportTarget[] {
        return [...this.rootImports].sort(([a], [b]) => compare(a, b)).flatMap(([, imports]) => imports);
    }

    /** The element with `symbolId`, if any. */
    getElement(symbolId: string): RegistryElement | undefined {
        return this.nodes.get(symbolId)?.element;
    }

    /** The relationship with `symbolId`, if any. */
    getRelationship(symbolId: string): RegistryRelationship | undefined {
        return this.relationships.get(symbolId);
    }

    /** The relationship a declaration's parsed specialization or import is. */
    relationshipOf(parsed: OwnedSpecialization | ImportTarget): RegistryRelationship | undefined {
        const id = this.relationshipIds.get(parsed);
        return id === undefined ? undefined : this.relationships.get(id);
    }

    /** The element a declaration belongs to. */
    elementOf(symbol: SysMLSymbol): RegistryElement | undefined {
        return this.nodeOf.get(symbol)?.element;
    }

    /** The declarations of `element`, in its order of declarations. */
    symbolsOf(element: RegistryElement): readonly SysMLSymbol[] {
        return this.nodes.get(element.symbolId)?.symbols ?? [];
    }

    /** Every element. */
    getElements(): RegistryElement[] {
        return [...this.nodes.values()].map(node => node.element);
    }

    /** Every relationship. */
    getRelationships(): RegistryRelationship[] {
        return [...this.relationships.values()];
    }

    /** The top-level elements of the workspace, by document URI, then position. */
    getRootIds(): readonly string[] {
        return this.rootIds;
    }

    /**
     * Take out the declarations of documents `removed`, add those of `added`,
     * and re-derive the namespaces that changed: those losing or gaining a
     * member or a declaration, and below them only what their paths change.
     */
    private update(removed: readonly string[], added: readonly [string, readonly SysMLSymbol[]][]): void {
        const changedOwners = new Set<Node>();
        const changedNodes = new Set<Node>();
        let rootsChanged = false;
        const touch = (owner: Node | undefined) => {
            if (owner) changedOwners.add(owner);
            else rootsChanged = true;
        };

        for (const uri of removed) {
            const declarations = this.documents.get(uri) ?? [];
            this.documents.delete(uri);
            for (const symbol of [...declarations].reverse()) {
                const node = this.nodeOf.get(symbol);
                this.nodeOf.delete(symbol);
                if (!node) continue;
                node.symbols = node.symbols.filter(s => s !== symbol);
                touch(node.owner);
                if (node.symbols.length > 0) {
                    changedNodes.add(node);
                    continue;
                }
                const siblings = node.owner ? node.owner.members : this.roots;
                siblings.splice(siblings.indexOf(node), 1);
                const packages = node.owner ? node.owner.packages : this.rootPackages;
                for (const [key, other] of packages) if (other === node) packages.delete(key);
                this.forget(node);
            }
        }

        for (const [uri, declarations] of added) {
            this.documents.set(uri, [...declarations]);
        }
        for (const symbol of this.ownersFirst(added.flatMap(([, declarations]) => declarations))) {
            const ownerSymbol = this.ownerOf(symbol);
            const owner = ownerSymbol ? this.nodeOf.get(ownerSymbol) : undefined;
            const packages = owner ? owner.packages : this.rootPackages;
            const key = packageKey(symbol, owner === undefined);
            const existing = key === undefined ? undefined : packages.get(key);
            touch(owner);
            if (existing) {
                existing.symbols = [...existing.symbols, symbol].sort(compareSites);
                this.nodeOf.set(symbol, existing);
                changedNodes.add(existing);
                continue;
            }
            const node: Node = {
                element: {
                    symbolId: '',
                    kind: symbol.kind,
                    name: symbol.name || undefined,
                    shortName: symbol.shortName,
                    isLibraryPackage: symbol.isLibraryPackage,
                    ownedElementIds: [],
                    ownedRelationshipIds: [],
                    declarations: [],
                },
                symbols: [symbol],
                owner,
                members: [],
                packages: new Map(),
                path: '',
                topLevelId: '',
            };
            if (key !== undefined) packages.set(key, node);
            (owner ? owner.members : this.roots).push(node);
            this.nodeOf.set(symbol, node);
            changedNodes.add(node);
        }

        // A top-level element's members are numbered across its whole tree, so a change lays out the
        // trees it touches: those owning a changed namespace, and those whose own ID changed.
        const trees = new Set<Node>(rootsChanged ? this.layoutRoots() : []);
        const roots = new Set(this.roots);
        for (const owner of changedOwners) {
            let top = owner;
            while (top.owner) top = top.owner;
            if (roots.has(top)) trees.add(top);
        }
        for (const tree of trees) this.layoutTree(tree);
        for (const node of changedNodes) if (this.isPlaced(node)) this.refreshDeclarations(node);
    }

    /** Whether `node` is still in the registry, with its ID. */
    private isPlaced(node: Node): boolean {
        return node.element.symbolId !== '' && this.nodes.get(node.element.symbolId) === node;
    }

    /** `symbols`, each owner before its members, then by document URI and position. */
    private ownersFirst(symbols: readonly SysMLSymbol[]): SysMLSymbol[] {
        const depths = new Map<SysMLSymbol, number>();
        for (const symbol of symbols) {
            let depth = 0;
            const seen = new Set<SysMLSymbol>();
            for (let owner = this.ownerOf(symbol); owner && !seen.has(owner); owner = this.ownerOf(owner)) {
                seen.add(owner);
                depth++;
            }
            depths.set(symbol, depth);
        }
        return [...symbols].sort((a, b) => depths.get(a)! - depths.get(b)! || compareSites(a, b));
    }

    /**
     * Give the top-level elements their IDs (SysML 9.1): their URLs are their
     * names, as members of the one root namespace of their project; a later one
     * with an earlier one's name (a package first, then by document URI and
     * position) is numbered, `#2`, as in earlier releases, so its ID stays the
     * same: not compatible with KerML 8.3.2.1.2 `path()`, which gives it a path
     * by its position. Gives the top-level elements whose IDs changed.
     */
    private layoutRoots(): Node[] {
        this.roots.sort(byFirstDeclaration);
        const changed: Node[] = [];
        const byProject = new Map<string, Node[]>();
        for (const root of this.roots) {
            const project = getUrlPrefix(root.symbols[0].uri);
            byProject.set(project, [...byProject.get(project) ?? [], root]);
        }
        for (const roots of byProject.values()) {
            for (const [segment, group] of groupByPath(roots.map(root => ({ node: root, path: segmentOf(root.symbols[0]) })))) {
                group.forEach((root, index) => {
                    const suffix = index === 0 ? '' : `#${index + 1}`;
                    const symbol = root.symbols[0];
                    const id = RegistryIds.topLevel(symbol.uri, segment, suffix);
                    const qualifiedPath = escapedName(symbol) !== undefined ? segment : undefined;
                    if (this.place(root, id, segment + suffix, qualifiedPath, id)) changed.push(root);
                });
            }
        }
        this.rootIds = this.roots.map(root => root.element.symbolId);
        return changed;
    }

    /**
     * Give the elements of top-level element `root`'s tree their IDs, owners
     * before members: a named member's path is its qualified name as written,
     * an unnamed one's its owner's path, `/` and its declaration as written; a
     * later one with an earlier one's path in the tree (a package first, then
     * by document URI and position) is numbered, `#2`, as in earlier releases,
     * so its ID stays the same: not compatible with KerML 8.3.2.1.2 `path()`,
     * which gives an element without a qualified name a path by its position.
     */
    private layoutTree(root: Node): void {
        for (let level = [root]; level.length > 0;) {
            const entries: { node: Node; path: string; qualifiedPath?: string }[] = [];
            for (const owner of level) {
                owner.members.sort(byFirstDeclaration);
                for (const member of owner.members) {
                    const segment = segmentOf(member.symbols[0]);
                    const qualifiedPath = escapedName(member.symbols[0]) !== undefined && owner.qualifiedPath !== undefined
                        ? `${owner.qualifiedPath}::${segment}` : undefined;
                    entries.push({ node: member, path: qualifiedPath ?? `${owner.path}/${segment}`, qualifiedPath });
                }
            }
            const qualifiedPaths = new Map(entries.map(entry => [entry.node, entry.qualifiedPath]));
            for (const [path, group] of groupByPath(entries)) {
                group.forEach((node, index) => {
                    const unique = index === 0 ? path : `${path}#${index + 1}`;
                    this.place(node, RegistryIds.member(root.element.symbolId, unique), unique, qualifiedPaths.get(node), root.element.symbolId);
                });
            }
            for (const owner of level) owner.element.ownedElementIds = owner.members.map(member => member.element.symbolId);
            level = level.flatMap(owner => owner.members);
        }
    }

    /**
     * Set `node`'s ID and paths; when its ID changed (or it is new), re-derive
     * its relationships, whose IDs depend on it. Gives whether its ID changed.
     */
    private place(node: Node, id: string, path: string, qualifiedPath: string | undefined, topLevelId: string): boolean {
        node.element.ownerId = node.owner?.element.symbolId;
        if (this.writeIds) {
            for (const symbol of node.symbols) {
                symbol.symbolId = id;
                symbol.parentId = node.element.ownerId;
            }
        }
        node.path = path;
        node.qualifiedPath = qualifiedPath;
        node.topLevelId = topLevelId;
        if (node.element.symbolId === id && this.nodes.get(id) === node) return false;
        if (this.nodes.get(node.element.symbolId) === node) this.nodes.delete(node.element.symbolId);
        node.element.symbolId = id;
        this.nodes.set(id, node);
        this.refreshDeclarations(node);
        return true;
    }

    /** Re-derive `node`'s declarations and the relationships they declare, by its current ID. */
    private refreshDeclarations(node: Node): void {
        node.element.declarations = node.symbols.map(({ uri, range }) => ({ uri, range }));
        this.forgetRelationships(node);
        node.element.ownedRelationshipIds = this.relationshipsOf(node);
    }

    /** Take `node` and what it declares out of the registry. */
    private forget(node: Node): void {
        if (this.nodes.get(node.element.symbolId) === node) this.nodes.delete(node.element.symbolId);
        this.forgetRelationships(node);
        node.element.symbolId = '';
    }

    /** Take out the relationships recorded for `node`, not ones another element has since taken the IDs of. */
    private forgetRelationships(node: Node): void {
        for (const id of node.element.ownedRelationshipIds) {
            if (this.relationshipNodes.get(id) !== node) continue;
            this.relationships.delete(id);
            this.relationshipNodes.delete(id);
        }
    }

    /** Record the specializations and imports `node`'s declarations declare, and give their IDs in order. */
    private relationshipsOf(node: Node): string[] {
        const ownerId = node.element.symbolId;
        const ids: string[] = [];
        const seen = new Map<string, number>();
        const add = (parsed: OwnedSpecialization | ImportTarget, relationship: Omit<RegistryRelationship, 'symbolId' | 'ownerId' | 'sourceId'>, key: string): void => {
            const count = (seen.get(key) ?? 0) + 1;
            seen.set(key, count);
            const symbolId = RegistryIds.relationship(ownerId, count === 1 ? key : `${key}#${count}`);
            this.relationships.set(symbolId, { symbolId, ownerId, sourceId: ownerId, ...relationship });
            this.relationshipNodes.set(symbolId, node);
            this.relationshipIds.set(parsed, symbolId);
            ids.push(symbolId);
        };
        for (const symbol of node.symbols) {
            for (const specialization of symbol.ownedSpecializations ?? []) {
                const { kind, target, range, chain, conjugated } = specialization;
                add(specialization, { kind, target, chain, conjugated, declarations: [{ uri: symbol.uri, range: range ?? symbol.range }] }, `${kind} ${target}`);
            }
            for (const imp of symbol.importTargets ?? []) {
                add(imp, { kind: 'import', target: imp.target, declarations: [{ uri: symbol.uri, range: imp.range ?? symbol.range }] }, `import ${imp.kind} ${imp.target}`);
            }
        }
        return ids;
    }
}

/** Order elements by their first declarations. */
function byFirstDeclaration(a: Node, b: Node): number {
    return compareSites(a.symbols[0], b.symbols[0]);
}

/**
 * The key under which same-named packages of one namespace are one element;
 * undefined for any other declaration. At the top level, only those of one
 * project (one URL prefix) are one package.
 */
function packageKey(symbol: SysMLSymbol, topLevel = false): string | undefined {
    const name = escapedName(symbol);
    if (symbol.kind !== SysMLElementKind.Package || name === undefined) return undefined;
    return `${topLevel ? `${getUrlPrefix(symbol.uri)}\0` : ''}${symbol.isLibraryPackage ? 'library ' : ''}${name}`;
}

/**
 * `entries` grouped by path, each group in the order its elements are
 * numbered in: packages first, then by first declaration, by document URI,
 * then position.
 */
function groupByPath<T extends { node: Node; path: string }>(entries: readonly T[]): Map<string, Node[]> {
    const groups = new Map<string, Node[]>();
    for (const { node, path } of entries) groups.set(path, [...groups.get(path) ?? [], node]);
    const isPackage = (node: Node) => node.element.kind === SysMLElementKind.Package ? 0 : 1;
    for (const group of groups.values()) group.sort((a, b) => isPackage(a) - isPackage(b) || byFirstDeclaration(a, b));
    return groups;
}

/** An element's own path segment: its name as written, or, anonymous, its declaration as written. */
function segmentOf(symbol: SysMLSymbol): string {
    return escapedName(symbol) ?? symbol.declaration ?? symbol.kind;
}

function compare(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

/** Order declarations by document URI (`canonicalUri`), then by position in it. */
function compareSites(a: SysMLSymbol, b: SysMLSymbol): number {
    return compare(canonicalUri(a.uri), canonicalUri(b.uri))
        || a.range.start.line - b.range.start.line || a.range.start.character - b.range.start.character;
}
