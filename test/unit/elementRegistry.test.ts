import { readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';
import { describe, expect, it } from 'vitest';
import { parseDocument } from '../../server/src/parser/parseDocument.js';
import type { ElementRegistry, RegistryElement } from '../../server/src/symbols/elementRegistry.js';
import { SysMLElementKind, escapedName, type SysMLSymbol } from '../../server/src/symbols/sysmlElements.js';
import { SymbolTable } from '../../server/src/symbols/symbolTable.js';

const ROOT = resolve(__dirname, '..', '..');

/** A symbol table of `documents`, indexed in the given order. */
function build(documents: Array<{ uri: string; text: string }>): SymbolTable {
    const st = new SymbolTable();
    for (const { uri, text } of documents) st.build(uri, parseDocument(text));
    return st;
}

/** The elements named `name`, in registry order. */
function named(registry: ElementRegistry, name: string): RegistryElement[] {
    return registry.getElements().filter(e => e.name === name);
}

/** The single element named `name`. */
function one(registry: ElementRegistry, name: string): RegistryElement {
    const found = named(registry, name);
    expect(found).toHaveLength(1);
    return found[0];
}

/** The names of the elements `element` owns, in order. */
function memberNames(registry: ElementRegistry, element: RegistryElement): (string | undefined)[] {
    return element.ownedElementIds.map(id => registry.getElement(id)!.name);
}

/** Every `.sysml`/`.kerml` file under `dir`. */
function filesUnder(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true, recursive: true })
        .filter(entry => entry.isFile() && /\.(sysml|kerml)$/.test(entry.name))
        .map(entry => join(entry.parentPath, entry.name))
        .sort();
}

/** The registry's invariants: every ID it refers to is an entry, and owners and owned elements agree. */
function expectWellFormed(registry: ElementRegistry): void {
    const elements = registry.getElements();
    const ids = new Set(elements.map(e => e.symbolId));
    expect(ids.size).toBe(elements.length);
    const listed = new Map<string, number>();
    const count = (id: string) => listed.set(id, (listed.get(id) ?? 0) + 1);
    for (const id of registry.getRootIds()) {
        expect(registry.getElement(id)?.ownerId).toBeUndefined();
        count(id);
    }
    for (const element of elements) {
        if (element.ownerId !== undefined) expect(ids.has(element.ownerId)).toBe(true);
        for (const id of element.ownedElementIds) {
            expect(registry.getElement(id)?.ownerId).toBe(element.symbolId);
            count(id);
        }
        for (const id of element.ownedRelationshipIds) {
            expect(registry.getRelationship(id)?.ownerId).toBe(element.symbolId);
        }
        expect(element.declarations.length).toBeGreaterThan(0);
        if (element.kind !== SysMLElementKind.Package) expect(element.declarations).toHaveLength(1);
    }
    // Every element is a top-level element or owned by exactly one element.
    expect([...listed.values()].every(n => n === 1)).toBe(true);
    expect(listed.size).toBe(elements.length);
}

/** The registry as plain data, to compare two registries. */
function snapshot(registry: ElementRegistry): unknown {
    return {
        rootIds: registry.getRootIds(),
        elements: registry.getElements().sort((a, b) => a.symbolId.localeCompare(b.symbolId)),
        relationships: registry.getRelationships().sort((a, b) => a.symbolId.localeCompare(b.symbolId)),
    };
}

describe('ElementRegistry: packages', () => {
    it('makes two same-named packages of one namespace in one document one element, keeping both declarations', () => {
        const st = build([{ uri: 'file:///w/a.sysml', text: `package L {
    package A { private import X::*; part def m; }
    package A { part def m2; }
}
package X { part def x; }
` }]);
        const registry = st.getElementRegistry();
        const a = one(registry, 'A');
        expect(a.declarations).toHaveLength(2);
        expect(memberNames(registry, a)).toEqual(['m', 'm2']);
        const imports = a.ownedRelationshipIds.map(id => registry.getRelationship(id)!);
        expect(imports.map(r => [r.kind, r.target])).toEqual([['import', 'X']]);
        expect(imports[0].declarations[0].range.start.line).toBe(1);
        expectWellFormed(registry);
    });

    it('makes a package declared in two documents one element with one ID, in either indexing order', () => {
        const a = { uri: 'file:///w/a.sysml', text: 'package P { part def Engine; package A { part def m; } }\n' };
        const b = { uri: 'file:///w/b.sysml', text: 'package P { part def Wheel; package A { part def n; } }\n' };
        const forward = build([a, b]).getElementRegistry();
        const backward = build([b, a]).getElementRegistry();
        expect(snapshot(backward)).toEqual(snapshot(forward));
        const p = one(forward, 'P');
        expect(p.declarations.map(d => d.uri)).toEqual([a.uri, b.uri]);
        expect(memberNames(forward, p)).toEqual(['Engine', 'A', 'Wheel']);
        expect(memberNames(forward, one(forward, 'A'))).toEqual(['m', 'n']);
        expect(forward.getRootIds()).toEqual([p.symbolId]);
        expectWellFormed(forward);
    });

    it('keeps a package and a same-named library package, and a package and a same-named definition, apart', () => {
        const registry = build([{ uri: 'file:///w/a.sysml', text: `package A;
library package A;
package Q { package B; library package B; part def B; }
` }]).getElementRegistry();
        expect(named(registry, 'A').map(e => e.isLibraryPackage ?? false)).toEqual([false, true]);
        expect(named(registry, 'B').map(e => [e.kind, e.isLibraryPackage ?? false])).toEqual([
            [SysMLElementKind.Package, false], [SysMLElementKind.Package, true], [SysMLElementKind.PartDef, false],
        ]);
        expectWellFormed(registry);
    });

    it('gives a top-level package and its named members the symbol table\'s IDs', () => {
        const st = build([{ uri: 'file:///w/a.sysml', text: 'package P { part def E { part x; } package Q { attribute a; } }\n' }]);
        const registry = st.getElementRegistry();
        for (const symbol of st.getAllSymbolsIncludingDuplicates()) {
            expect(registry.elementOf(symbol)?.symbolId).toBe(symbol.symbolId);
        }
    });

    it('keeps a package\'s ID when another document declaring it is added or removed', () => {
        const st = build([{ uri: 'file:///w/a.sysml', text: 'package P { part def E; }\n' }]);
        const id = one(st.getElementRegistry(), 'P').symbolId;
        st.build('file:///w/0.sysml', parseDocument('package P { part def F; }\n'));
        const p = one(st.getElementRegistry(), 'P');
        expect(p.symbolId).toBe(id);
        expect(memberNames(st.getElementRegistry(), p)).toEqual(['F', 'E']);
        st.removeUri('file:///w/0.sysml');
        expect(one(st.getElementRegistry(), 'P').symbolId).toBe(id);
        expect(one(st.getElementRegistry(), 'P').declarations).toHaveLength(1);
    });
});

describe('ElementRegistry: same-named elements', () => {
    it('gives same-named top-level elements of two documents distinct IDs, in either indexing order', () => {
        const a = { uri: 'file:///w/a.sysml', text: 'part def T { part x; }\n' };
        const b = { uri: 'file:///w/b.sysml', text: 'part def T { part x; }\n' };
        const forward = build([a, b]).getElementRegistry();
        expect(new Set(named(forward, 'T').map(e => e.symbolId)).size).toBe(2);
        expect(new Set(named(forward, 'x').map(e => e.symbolId)).size).toBe(2);
        expect(snapshot(build([b, a]).getElementRegistry())).toEqual(snapshot(forward));
        expectWellFormed(forward);
    });

    it('gives the later of two same-named members of one namespace, also across a package\'s declarations, an ID of its own', () => {
        const registry = build([
            { uri: 'file:///w/a.sysml', text: 'package P { part def m { part y; } }\npart def T; part def T;\n' },
            { uri: 'file:///w/b.sysml', text: 'package P { part def m { part y; } }\n' },
        ]).getElementRegistry();
        expect(new Set(named(registry, 'm').map(e => e.symbolId)).size).toBe(2);
        expect(new Set(named(registry, 'y').map(e => e.symbolId)).size).toBe(2);
        expect(new Set(named(registry, 'T').map(e => e.symbolId)).size).toBe(2);
        expectWellFormed(registry);
    });

    it('keeps the package\'s ID for a package next to a same-named element of another kind declared before it', () => {
        const withDefinition = build([{ uri: 'file:///w/a.sysml', text: 'package Q { part def B; package B { part def c; } }\n' }]);
        const alone = build([{ uri: 'file:///w/a.sysml', text: 'package Q { package B { part def c; } }\n' }]);
        const packageB = (st: SymbolTable) => named(st.getElementRegistry(), 'B').find(e => e.kind === SysMLElementKind.Package)!;
        expect(packageB(withDefinition).symbolId).toBe(packageB(alone).symbolId);
        expect(one(withDefinition.getElementRegistry(), 'c').symbolId).toBe(one(alone.getElementRegistry(), 'c').symbolId);
    });
});

describe('ElementRegistry: relationships', () => {
    const text = `package R {
    part def Base;
    part def Sub :> Base, Base;
    part def W { part w; }
    part v : W {
        part u :> w;
        part :>> w;
    }
    part s : Base;
}
`;

    it('records each specialization with its owner, source, target as written and the target\'s range', () => {
        const registry = build([{ uri: 'file:///w/a.sysml', text }]).getElementRegistry();
        const relationshipsOf = (element: RegistryElement) => element.ownedRelationshipIds.map(id => registry.getRelationship(id)!);
        const sub = relationshipsOf(one(registry, 'Sub'));
        expect(sub.map(r => [r.kind, r.target])).toEqual([['specializes', 'Base'], ['specializes', 'Base']]);
        expect(new Set(sub.map(r => r.symbolId)).size).toBe(2);
        expect(sub[0].declarations[0].range.start).toEqual({ line: 2, character: 20 });
        expect(relationshipsOf(one(registry, 's')).map(r => [r.kind, r.target])).toEqual([['typing', 'Base']]);
        expect(relationshipsOf(one(registry, 'u')).map(r => [r.kind, r.target])).toEqual([['subsetting', 'w']]);
        // An unnamed redefining usage takes the name of the feature it redefines (KerML 8.3.3.3.4).
        const redefining = registry.getElements().find(e => e.declarations[0].range.start.line === 6)!;
        expect(relationshipsOf(redefining).map(r => [r.kind, r.target])).toEqual([['redefinition', 'w']]);
        for (const r of registry.getRelationships()) expect(r.sourceId).toBe(r.ownerId);
        expectWellFormed(registry);
    });

    it('gives relationships the same IDs after a reload', () => {
        const first = build([{ uri: 'file:///w/a.sysml', text }]).getElementRegistry();
        const second = build([{ uri: 'file:///w/a.sysml', text }]).getElementRegistry();
        expect(second.getRelationships().map(r => r.symbolId)).toEqual(first.getRelationships().map(r => r.symbolId));
    });
});

describe('ElementRegistry: corpus', () => {
    const files = [
        ...filesUnder(join(ROOT, 'sysml.library')),
        ...filesUnder(join(ROOT, 'examples')),
        ...filesUnder(join(ROOT, 'test', 'fixtures', 'valid')),
    ];
    const documents = files.map(file => ({ uri: pathToFileURL(file).href, text: readFileSync(file, 'utf8') }));
    const st = build(documents);
    const registry = st.getElementRegistry();

    it('is well formed', () => {
        expect(files.length).toBeGreaterThan(100);
        expectWellFormed(registry);
    });

    it('has an element for every declaration, owned as the symbol table owns it', () => {
        for (const symbol of st.getAllSymbolsIncludingDuplicates()) {
            const element = registry.elementOf(symbol);
            expect(element, `${symbol.uri} ${symbol.qualifiedName ?? symbol.declaration}`).toBeDefined();
            expect(element!.ownerId).toBe(ownerElementId(st, registry, symbol));
        }
    });

    it('gives the symbol table\'s ID to every element but those the new ID rules give another', () => {
        const changed = st.getAllSymbolsIncludingDuplicates().filter(s => registry.elementOf(s)!.symbolId !== s.symbolId);
        for (const symbol of changed) {
            expect(isChangedByIdRules(st, registry, symbol), `${symbol.uri} ${symbol.qualifiedName ?? symbol.declaration}`).toBe(true);
        }
    });

    it('is the same in reverse indexing order, and after removing a document and adding it back', () => {
        const reversed = build([...documents].reverse()).getElementRegistry();
        expect(snapshot(reversed)).toEqual(snapshot(registry));
        const again = build(documents);
        const last = documents[documents.length - 1];
        again.removeUri(last.uri);
        again.build(last.uri, parseDocument(last.text));
        expect(snapshot(again.getElementRegistry())).toEqual(snapshot(registry));
    });
});

/**
 * The registry element of `symbol`'s owner, as the symbol table records it:
 * `getOwner` gives a package declared more than once as its merged copy,
 * found by its ID, which the registry keeps for a package.
 */
function ownerElement(st: SymbolTable, registry: ElementRegistry, symbol: SysMLSymbol): RegistryElement | undefined {
    const owner = st.getOwner(symbol);
    return owner && (registry.elementOf(owner) ?? registry.getElement(owner.symbolId));
}

/** The registry ID of `symbol`'s owner, as the symbol table records it. */
function ownerElementId(st: SymbolTable, registry: ElementRegistry, symbol: SysMLSymbol): string | undefined {
    return ownerElement(st, registry, symbol)?.symbolId;
}

/**
 * Whether the registry's ID rules account for `symbol`'s ID differing from the
 * symbol table's: it is, or is owned by, a top-level element other than a
 * package (whose URL has its document), or one sharing its segment (its name,
 * or, unnamed, its declaration) with a sibling (whose path is then its position).
 */
function isChangedByIdRules(st: SymbolTable, registry: ElementRegistry, symbol: SysMLSymbol): boolean {
    const segments = new Map<RegistryElement, string>();
    for (const s of st.getAllSymbolsIncludingDuplicates()) {
        const element = registry.elementOf(s);
        if (element && !segments.has(element)) segments.set(element, escapedName(s) ?? s.declaration ?? s.kind);
    }
    for (let current: SysMLSymbol | undefined = symbol; current; current = st.getOwner(current)) {
        const owner = st.getOwner(current);
        if (!owner && current.kind !== SysMLElementKind.Package) return true;
        const element = (registry.elementOf(current) ?? registry.getElement(current.symbolId))!;
        const siblings = owner ? ownerElement(st, registry, current)!.ownedElementIds : registry.getRootIds();
        const segment = segments.get(element);
        if (siblings.some(id => registry.getElement(id) !== element && segments.get(registry.getElement(id)!) === segment)) return true;
    }
    return false;
}
