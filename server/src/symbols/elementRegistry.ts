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
    /** Its path (KerML 8.3.2.1.2 `path()`), its ID derived from it. */
    path: string;
    /** Whether its path is its qualified name, so its members' paths can be theirs. */
    qualified: boolean;
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
     * position-based IDs, one may take relationship IDs another still lists,
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
                qualified: false,
                topLevelId: '',
            };
            if (key !== undefined) packages.set(key, node);
            (owner ? owner.members : this.roots).push(node);
            this.nodeOf.set(symbol, node);
            changedNodes.add(node);
        }

        if (rootsChanged) this.layoutRoots();
        for (const owner of changedOwners) if (this.isPlaced(owner)) this.layoutMembers(owner);
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
     * names, as members of the one root namespace of the workspace; one whose
     * segment an earlier one has (a package keeping its own) has its position
     * there instead (KerML 8.3.2.1.2 `path()`).
     */
    private layoutRoots(): void {
        this.roots.sort(byFirstDeclaration);
        // One root namespace per project: top-level elements compete for their paths only
        // with those of their project, whose URL prefix their URLs start with.
        const byProject = new Map<string, Node[]>();
        for (const root of this.roots) {
            const project = getUrlPrefix(root.symbols[0].uri);
            byProject.set(project, [...byProject.get(project) ?? [], root]);
        }
        for (const roots of byProject.values()) {
            const paths = pathsOf(roots, '', true);
            for (const root of roots) {
                const { path, qualified } = paths.get(root)!;
                const id = RegistryIds.topLevel(root.symbols[0].uri, path);
                this.place(root, id, path, qualified, id);
            }
        }
        this.rootIds = this.roots.map(root => root.element.symbolId);
    }

    /**
     * Give `owner`'s members their IDs: each its qualified name as its path, or,
     * when an earlier member has its segment (a package keeping its own), its
     * position (KerML 8.3.2.1.2 `path()`).
     */
    private layoutMembers(owner: Node): void {
        owner.members.sort(byFirstDeclaration);
        const paths = pathsOf(owner.members, owner.path, owner.qualified);
        for (const member of owner.members) {
            const { path, qualified } = paths.get(member)!;
            this.place(member, RegistryIds.member(owner.topLevelId, path), path, qualified, owner.topLevelId);
        }
        owner.element.ownedElementIds = owner.members.map(member => member.element.symbolId);
    }

    /**
     * Set `node`'s ID and path; when either changed (or it is new), re-derive its
     * relationships and its members, whose IDs depend on them.
     */
    private place(node: Node, id: string, path: string, qualified: boolean, topLevelId: string): void {
        node.element.ownerId = node.owner?.element.symbolId;
        if (this.writeIds) {
            for (const symbol of node.symbols) {
                symbol.symbolId = id;
                symbol.parentId = node.element.ownerId;
            }
        }
        if (node.element.symbolId === id && node.path === path && node.qualified === qualified && node.topLevelId === topLevelId) return;
        if (this.nodes.get(node.element.symbolId) === node) this.nodes.delete(node.element.symbolId);
        node.element.symbolId = id;
        node.path = path;
        node.qualified = qualified;
        node.topLevelId = topLevelId;
        this.nodes.set(id, node);
        this.refreshDeclarations(node);
        this.layoutMembers(node);
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
 * The paths of the members of one namespace whose own path is `ownerPath`
 * (`''` for the root namespace), and whether each is a qualified name. A
 * member keeps its segment unless an earlier one has it (a package keeping
 * its own): then a named one takes its position, as one without a qualified
 * name does (KerML 8.3.2.1.2 `path()`), and an unnamed one, identified by its
 * declaration as written, its occurrence among the same declarations (`#2`).
 */
function pathsOf(members: readonly Node[], ownerPath: string, ownerQualified: boolean): Map<Node, { path: string; qualified: boolean }> {
    const claimants = claimantsOf(members, () => '');
    const occurrences = new Map<string, number>();
    const paths = new Map<Node, { path: string; qualified: boolean }>();
    const join = (segment: string, qualifying: boolean) => ownerPath === '' ? segment : `${ownerPath}${qualifying ? '::' : '/'}${segment}`;
    members.forEach((member, index) => {
        const symbol = member.symbols[0];
        const segment = segmentOf(symbol);
        const named = escapedName(symbol) !== undefined;
        const occurrence = (occurrences.get(segment) ?? 0) + 1;
        occurrences.set(segment, occurrence);
        if (claimants.has(member)) {
            paths.set(member, { path: join(segment, named && ownerQualified), qualified: named && ownerQualified });
        } else if (named) {
            paths.set(member, { path: `${ownerPath}/${index + 1}/1`, qualified: false });
        } else {
            paths.set(member, { path: join(`${segment}#${occurrence}`, false), qualified: false });
        }
    });
    return paths;
}

/**
 * The members that keep their segment as their path: per segment, a package
 * if there is one, else the first, within each group `groupOf` gives.
 */
function claimantsOf(members: readonly Node[], groupOf: (node: Node) => string): Set<Node> {
    const bySegment = new Map<string, Node>();
    for (const member of members) {
        const key = `${groupOf(member)}\0${segmentOf(member.symbols[0])}`;
        const current = bySegment.get(key);
        const isPackage = member.element.kind === SysMLElementKind.Package;
        if (!current || (isPackage && current.element.kind !== SysMLElementKind.Package)) bySegment.set(key, member);
    }
    return new Set(bySegment.values());
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
