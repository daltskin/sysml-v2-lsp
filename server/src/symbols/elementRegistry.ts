import { Range } from 'vscode-languageserver/node';
import { canonicalUri } from '../utils/documentUri.js';
import { RegistryIds } from './ids.js';
import { OwnedSpecialization, SysMLElementKind, SysMLSymbol, escapedName } from './sysmlElements.js';

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
    /** For a package: whether it is a library package (KerML 8.3.4.13.3). */
    isLibraryPackage?: boolean;
    /** Its `owner` (KerML 8.3.2.1.2); none for a top-level element. */
    ownerId?: string;
    /** Its `ownedElement`s (KerML 8.3.2.1.2), whichever document declares them, in order. */
    ownedElementIds: string[];
    /** Its `ownedRelationship`s (KerML 8.3.2.1.2) the registry records, in order. */
    ownedRelationshipIds: string[];
    /** Its declarations, by document URI, then position: more than one only for a package. */
    declarations: Declaration[];
}

/** The kinds of relationship the registry records. */
export type RegistryRelationshipKind = OwnedSpecialization['kind'] | 'import';

/** A relationship of the registry, an element of its own (KerML 8.3.2.1.3). */
export interface RegistryRelationship {
    symbolId: string;
    kind: RegistryRelationshipKind;
    /** Its `owningRelatedElement`, also its `source`. */
    ownerId: string;
    sourceId: string;
    /** Its `target` as written: text only, never identifying the element. */
    target: string;
    /** The element its target resolves to; absent until resolved, and when unresolved or ambiguous. */
    targetId?: string;
    declarations: Declaration[];
}

/** An element while the registry is built: its declarations, and its place among its owner's. */
interface Draft {
    element: RegistryElement;
    symbols: SysMLSymbol[];
    owner?: Draft;
    members: Draft[];
    /** Its packages by name, so another declaration of one joins it. */
    packages: Map<string, Draft>;
}

/**
 * The model of the whole workspace by ID, not by document: every element once,
 * its owner and owned elements by ID, its declarations, and the relationships
 * it declares (KerML 8.3.2.1). Same-named packages of one namespace, in one
 * document or several, are one element. Built from the symbol table's
 * declarations, again when read after a document changed.
 */
export class ElementRegistry {
    private readonly documents = new Map<string, readonly SysMLSymbol[]>();
    private elements = new Map<string, RegistryElement>();
    private relationships = new Map<string, RegistryRelationship>();
    private rootIds: string[] = [];
    private bySymbol = new WeakMap<SysMLSymbol, RegistryElement>();
    private stale = true;

    /** @param ownerOf each declaration's owner, as declared in the parse tree */
    constructor(private readonly ownerOf: (symbol: SysMLSymbol) => SysMLSymbol | undefined) {}

    /** Set the declarations of document `uri`, every owner before its members. */
    setDocument(uri: string, declarations: readonly SysMLSymbol[]): void {
        this.documents.set(uri, [...declarations]);
        this.stale = true;
    }

    /** Forget the declarations of document `uri`. */
    removeDocument(uri: string): void {
        if (this.documents.delete(uri)) this.stale = true;
    }

    /** The element with `symbolId`, if any. */
    getElement(symbolId: string): RegistryElement | undefined {
        this.refresh();
        return this.elements.get(symbolId);
    }

    /** The relationship with `symbolId`, if any. */
    getRelationship(symbolId: string): RegistryRelationship | undefined {
        this.refresh();
        return this.relationships.get(symbolId);
    }

    /** The element a declaration belongs to. */
    elementOf(symbol: SysMLSymbol): RegistryElement | undefined {
        this.refresh();
        return this.bySymbol.get(symbol);
    }

    /** Every element, top-level elements and their owned elements in order. */
    getElements(): RegistryElement[] {
        this.refresh();
        return [...this.elements.values()];
    }

    /** Every relationship. */
    getRelationships(): RegistryRelationship[] {
        this.refresh();
        return [...this.relationships.values()];
    }

    /** The top-level elements of the workspace, by document URI, then position. */
    getRootIds(): readonly string[] {
        this.refresh();
        return this.rootIds;
    }

    /** Build the registry again from every document, if one changed since it was last built. */
    private refresh(): void {
        if (!this.stale) return;
        this.stale = false;
        this.elements = new Map();
        this.relationships = new Map();
        this.bySymbol = new WeakMap();
        const roots = this.draft();
        this.assignIds(roots);
        this.rootIds = roots.map(root => root.element.symbolId);
        for (const root of roots) this.publish(root);
    }

    /** Group the declarations into elements, packages of one name and namespace into one. */
    private draft(): Draft[] {
        const roots: Draft[] = [];
        const rootPackages = new Map<string, Draft>();
        const drafts = new Map<SysMLSymbol, Draft>();
        const uris = [...this.documents.keys()].sort((a, b) => compare(canonicalUri(a), canonicalUri(b)));
        for (const uri of uris) {
            for (const symbol of this.documents.get(uri)!) {
                const ownerSymbol = this.ownerOf(symbol);
                const owner = ownerSymbol ? drafts.get(ownerSymbol) : undefined;
                const packages = owner ? owner.packages : rootPackages;
                const key = packageKey(symbol);
                const existing = key === undefined ? undefined : packages.get(key);
                if (existing) {
                    existing.symbols.push(symbol);
                    drafts.set(symbol, existing);
                    continue;
                }
                const draft: Draft = {
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
                };
                if (key !== undefined) packages.set(key, draft);
                (owner ? owner.members : roots).push(draft);
                drafts.set(symbol, draft);
            }
        }
        return roots;
    }

    /** Give every element its symbol ID (`RegistryIds`), each owner before its members. */
    private assignIds(roots: Draft[]): void {
        const paths = new Map<Draft, { path: string; qualified: boolean; topLevelId: string }>();
        // Top-level packages of every document share one namespace for their names; any other
        // top-level element is in its own document's root namespace (KerML 7.2.5.3).
        const claimants = claimantsOf(roots, draft => draft.element.kind === SysMLElementKind.Package ? '' : documentOf(draft));
        const positions = new Map<SysMLSymbol, number>();
        for (const declarations of this.documents.values()) {
            declarations.filter(s => !this.ownerOf(s)).forEach((s, index) => positions.set(s, index + 1));
        }
        roots.forEach(root => {
            const symbol = root.symbols[0];
            const claims = claimants.has(root);
            const path = claims ? segmentOf(symbol) : `/${positions.get(symbol)}/1`;
            root.element.symbolId = claims && packageKey(symbol) !== undefined
                ? RegistryIds.topLevelPackage(symbol.uri, path)
                : RegistryIds.topLevelElement(symbol.uri, path);
            paths.set(root, { path, qualified: claims && escapedName(symbol) !== undefined, topLevelId: root.element.symbolId });
        });
        const pending = [...roots];
        for (let owner = pending.shift(); owner; owner = pending.shift()) {
            const { path: ownerPath, qualified: ownerQualified, topLevelId } = paths.get(owner)!;
            const memberClaimants = claimantsOf(owner.members, () => '');
            owner.members.forEach((member, index) => {
                const symbol = member.symbols[0];
                const named = escapedName(symbol) !== undefined;
                const claims = memberClaimants.has(member);
                // KerML 8.3.2.1.2: a member sharing its name with an earlier one has no qualified
                // name, and its path is its owning membership's position, then its own within it.
                const path = !claims ? `${ownerPath}/${index + 1}/1`
                    : named && ownerQualified ? `${ownerPath}::${segmentOf(symbol)}`
                    : `${ownerPath}/${segmentOf(symbol)}`;
                member.element.symbolId = RegistryIds.member(topLevelId, path);
                paths.set(member, { path, qualified: claims && named && ownerQualified, topLevelId });
                pending.push(member);
            });
        }
    }

    /** Record `draft` and everything it owns, with their relationships, by ID. */
    private publish(draft: Draft): void {
        const pending = [draft];
        for (let next = pending.pop(); next; next = pending.pop()) {
            const { element } = next;
            element.ownerId = next.owner?.element.symbolId;
            element.ownedElementIds = next.members.map(member => member.element.symbolId);
            element.declarations = next.symbols.map(({ uri, range }) => ({ uri, range }));
            element.ownedRelationshipIds = this.relationshipsOf(next);
            this.elements.set(element.symbolId, element);
            for (const symbol of next.symbols) this.bySymbol.set(symbol, element);
            pending.push(...[...next.members].reverse());
        }
    }

    /** Record the specializations and imports `draft`'s declarations declare, and give their IDs in order. */
    private relationshipsOf(draft: Draft): string[] {
        const ownerId = draft.element.symbolId;
        const ids: string[] = [];
        const seen = new Map<string, number>();
        const add = (kind: RegistryRelationshipKind, key: string, target: string, uri: string, range: Range): void => {
            const count = (seen.get(key) ?? 0) + 1;
            seen.set(key, count);
            const symbolId = RegistryIds.relationship(ownerId, count === 1 ? key : `${key}#${count}`);
            this.relationships.set(symbolId, { symbolId, kind, ownerId, sourceId: ownerId, target, declarations: [{ uri, range }] });
            ids.push(symbolId);
        };
        for (const symbol of draft.symbols) {
            for (const { kind, target, range } of symbol.ownedSpecializations ?? []) {
                add(kind, `${kind} ${target}`, target, symbol.uri, range ?? symbol.range);
            }
            for (const { kind, target, range } of symbol.importTargets ?? []) {
                add('import', `import ${kind} ${target}`, target, symbol.uri, range ?? symbol.range);
            }
        }
        return ids;
    }
}

/** The key under which same-named packages of one namespace are one element; undefined for any other declaration. */
function packageKey(symbol: SysMLSymbol): string | undefined {
    const name = escapedName(symbol);
    if (symbol.kind !== SysMLElementKind.Package || name === undefined) return undefined;
    return `${symbol.isLibraryPackage ? 'library ' : ''}${name}`;
}

/**
 * The members that keep their segment as their path: per segment, a package
 * if there is one, else the first, within each group `groupOf` gives.
 */
function claimantsOf(members: readonly Draft[], groupOf: (draft: Draft) => string): Set<Draft> {
    const bySegment = new Map<string, Draft>();
    for (const member of members) {
        const key = `${groupOf(member)}\0${segmentOf(member.symbols[0])}`;
        const current = bySegment.get(key);
        const isPackage = member.element.kind === SysMLElementKind.Package;
        if (!current || (isPackage && current.element.kind !== SysMLElementKind.Package)) bySegment.set(key, member);
    }
    return new Set(bySegment.values());
}

/** The document an element is declared in: its first declaration's. */
function documentOf(draft: Draft): string {
    return canonicalUri(draft.symbols[0].uri);
}

/** An element's own path segment: its name as written, or, anonymous, its declaration as written. */
function segmentOf(symbol: SysMLSymbol): string {
    return escapedName(symbol) ?? symbol.declaration ?? symbol.kind;
}

function compare(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}
