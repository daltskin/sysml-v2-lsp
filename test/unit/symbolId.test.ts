import { describe, expect, it } from 'vitest';
import { isAnonymous, type SysMLSymbol } from '../../server/src/symbols/sysmlElements.js';
import type { SymbolTable } from '../../server/src/symbols/symbolTable.js';

const UUID_V5 = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Helper: build one symbol table from documents, indexed in the given order. */
async function build(documents: Array<{ uri: string; text: string }>): Promise<SymbolTable> {
    const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
    const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
    const st = new SymbolTable();
    for (const { uri, text } of documents) st.build(uri, parseDocument(text));
    return st;
}

/** Every declaration, by document and position, with the symbol IDs it got. */
function idsByDeclaration(st: SymbolTable): Map<string, [string, string | undefined]> {
    return new Map(st.getAllSymbolsIncludingDuplicates().map((s) => [
        `${s.uri}:${s.range.start.line}:${s.range.start.character}:${s.kind}`,
        [s.symbolId, s.parentId],
    ]));
}

/**
 * The symbol ID of each symbol by a key that survives a move: its qualified
 * name, or, without one (an anonymous element or a member of one), its owner's
 * key followed by its own kind and name (or, anonymous, its own declaration).
 */
function idsByKey(st: SymbolTable): Map<string, string> {
    const keyOf = (s: SysMLSymbol): string => {
        if (s.qualifiedName !== undefined) return `${s.kind} ${s.qualifiedName}`;
        const owner = st.getOwner(s);
        return `${owner ? keyOf(owner) : ''} / ${s.kind} ${s.name || s.declaration}`;
    };
    return new Map(st.getAllSymbols().map((s) => [keyOf(s), s.symbolId]));
}

describe('symbolId', () => {
    const text = `package Demo {
    part def P { port p; }
    part a : P;
    part b : P;
    connect a.p to b.p { attribute w; }
}
`;

    it('gives every element a unique version 5 UUID that finds it and links its members to it', async () => {
        const st = await build([{ uri: 'file:///w/a.sysml', text }]);
        const symbols = st.getAllSymbols();
        expect(symbols.every((s) => UUID_V5.test(s.symbolId))).toBe(true);
        expect(new Set(symbols.map((s) => s.symbolId)).size).toBe(symbols.length);
        for (const s of symbols) {
            expect(st.getSymbolById(s.symbolId)).toBe(s);
            expect(s.parentId).toBe(st.getOwner(s)?.symbolId);
        }
        const connector = symbols.find((s) => isAnonymous(s))!;
        const w = st.findByName('w')[0];
        expect(st.getOwner(w)).toBe(connector);
        expect(st.getSymbol('Demo')!.parentId).toBeUndefined();
    });

    it('gives the same symbol IDs after a reload, whatever order the documents are indexed in', async () => {
        // A package split across documents, a clash across them, and identical anonymous connectors.
        const a = { uri: 'file:///w/a.sysml', text: 'package Demo { part def P; part x; part y; connect x to y; }' };
        const b = { uri: 'file:///w/b.sysml', text: 'package Demo { part def P; part q; connect x to y; }' };
        const first = idsByDeclaration(await build([a, b]));
        const reloaded = idsByDeclaration(await build([a, b]));
        const reversed = idsByDeclaration(await build([b, a]));
        expect(reloaded).toEqual(first);
        expect(reversed).toEqual(first);
        expect(new Set([...first.values()].map(([id]) => id)).size).toBe(first.size - 1); // Demo is one element
    });

    it('keeps anonymous elements with different headers on their symbol IDs when namespace fragments are swapped', async () => {
        const original = 'package A { connect a to b; connect c to d; } package A { connect e to f; connect a to b; }';
        const swapped = 'package A { connect e to f; connect a to b; } package A { connect a to b; connect c to d; }';
        const connectors = async (source: string): Promise<SysMLSymbol[]> =>
            (await build([{ uri: 'file:///w/a.sysml', text: source }])).getAllSymbols().filter((s) => isAnonymous(s));
        const before = await connectors(original);
        const after = await connectors(swapped);
        const idOf = (list: SysMLSymbol[], declaration: string) => list.filter((s) => s.declaration === declaration).map((s) => s.symbolId).sort();
        expect(idOf(after, 'connect c to d')).toEqual(idOf(before, 'connect c to d'));
        expect(idOf(after, 'connect e to f')).toEqual(idOf(before, 'connect e to f'));
        // Two identical declarations stay apart, and keep the same two symbol IDs between them.
        expect(new Set(idOf(before, 'connect a to b')).size).toBe(2);
        expect(idOf(after, 'connect a to b')).toEqual(idOf(before, 'connect a to b'));
    });

    it('keeps symbol IDs when a document moves to another folder', async () => {
        const before = idsByKey(await build([{ uri: 'file:///w/a.sysml', text }]));
        const after = idsByKey(await build([{ uri: 'file:///w/sub/renamed.sysml', text }]));
        expect(after).toEqual(before);
    });

    it('keeps symbol IDs, of anonymous elements and their members too, when lines are inserted above them', async () => {
        const edited = text.replace('package Demo {\n', 'package Demo {\n    // a comment\n    part extra;\n\n');
        const before = idsByKey(await build([{ uri: 'file:///w/a.sysml', text }]));
        const after = idsByKey(await build([{ uri: 'file:///w/a.sysml', text: edited }]));
        const memberId = async (source: string) => (await build([{ uri: 'file:///w/a.sysml', text: source }])).findByName('w')[0].symbolId;
        expect([...before].every(([key, id]) => after.get(key) === id)).toBe(true);
        expect(await memberId(edited)).toBe(await memberId(text));
    });

    it('keeps the symbol ID of an anonymous element, and of its members, when a member is added to it', async () => {
        const edited = text.replace('connect a.p to b.p { attribute w; }', 'connect a.p to b.p { attribute v; attribute w; }');
        const ids = async (source: string) => {
            const st = await build([{ uri: 'file:///w/a.sysml', text: source }]);
            return { connector: st.getAllSymbols().find((s) => isAnonymous(s))!.symbolId, w: st.findByName('w')[0].symbolId };
        };
        expect(await ids(edited)).toEqual(await ids(text));
    });

    it('never gives a named element the symbol ID of an anonymous element or its member, whatever its quoted name spells', async () => {
        const plain = await build([{ uri: 'file:///w/a.sysml', text }]);
        const connectorId = plain.getAllSymbols().find((s) => isAnonymous(s))!.symbolId;
        // Top-level names spelling out the keys the connector and its member are identified by,
        // declared first: if they shared a key, they would take the first number of it.
        const imitations = `part 'member/${connectorId}/w';\npart 'anonymous/${plain.getSymbol('Demo')!.symbolId}/connection:connect a.p to b.p::';\n`;
        const st = await build([{ uri: 'file:///w/a.sysml', text: imitations + text }]);
        const symbols = st.getAllSymbols();
        expect(new Set(symbols.map((s) => s.symbolId)).size).toBe(symbols.length);
        expect(st.findByName('w')[0].symbolId).toBe(plain.findByName('w')[0].symbolId);
        expect(st.getAllSymbols().find((s) => isAnonymous(s))!.symbolId).toBe(connectorId);
        for (const s of symbols) expect(st.getSymbolById(s.symbolId)).toBe(s);
    });

    it('keeps names and symbol IDs apart when an element is named like another symbol\'s ID', async () => {
        const plain = await build([{ uri: 'file:///w/a.sysml', text }]);
        const engineId = plain.getSymbol('Demo::a')!.symbolId;
        const connectorId = plain.getAllSymbols().find((s) => isAnonymous(s))!.symbolId;
        const st = await build([{ uri: 'file:///w/a.sysml', text: `${text}part '${engineId}';\npart '${connectorId}';\n` }]);

        for (const id of [engineId, connectorId]) {
            const namedLikeId = st.getSymbol(id)!;
            // Found by its name, but its symbol ID is a hash of that name, not the name itself.
            expect(namedLikeId.name).toBe(id);
            expect(namedLikeId.symbolId).not.toBe(id);
            expect(st.getSymbolById(namedLikeId.symbolId)).toBe(namedLikeId);
        }
        // The elements whose symbol IDs were spelled out keep them, and are the ones those symbol IDs find.
        expect(st.getSymbolById(engineId)).toBe(st.getSymbol('Demo::a'));
        expect(isAnonymous(st.getSymbolById(connectorId)!)).toBe(true);
        const symbols = st.getAllSymbols();
        expect(new Set(symbols.map((s) => s.symbolId)).size).toBe(symbols.length);
    });

    it('numbers declarations across documents the same way for every spelling of a Windows path', async () => {
        const text = 'package Demo { part def P; }';
        const idsOf = async (aUri: string, bUri: string) => {
            const st = await build([{ uri: bUri, text }, { uri: aUri, text }]);
            const { canonicalUri } = await import('../../server/src/utils/documentUri.js');
            return st.getAllSymbolsIncludingDuplicates().filter((s) => s.name === 'P').map((s) => [canonicalUri(s.uri), s.symbolId]).sort();
        };
        // Raw, `C:` sorts before `c%3A`: spelled one way round, b.sysml would come first.
        const one = await idsOf('file:///c%3A/w/a.sysml', 'file:///C:/w/b.sysml');
        const other = await idsOf('file:///C:/w/a.sysml', 'file:///c%3A/w/b.sysml');
        expect(other).toEqual(one);
    });

    it('keeps anonymous transitions on their symbol IDs when lines are inserted above them or they are swapped', async () => {
        const machine = (transitions: string) => `package Demo { state def S { state s1; state s2; ${transitions} } }`;
        const idsOfTransitions = async (source: string) => new Map(
            (await build([{ uri: 'file:///w/a.sysml', text: source }])).getAllSymbols()
                .filter((s) => s.kind === 'transition').map((s) => [s.declaration, s.symbolId]),
        );
        const before = await idsOfTransitions(machine('transition first s1 then s2; transition first s2 then s1;'));
        const swapped = await idsOfTransitions(machine('transition first s2 then s1; transition first s1 then s2;'));
        const shifted = await idsOfTransitions(`\n\n${machine('state s3; transition first s1 then s2; transition first s2 then s1;')}`);
        expect(before.size).toBe(2);
        expect(swapped).toEqual(before);
        expect(shifted).toEqual(before);
    });

    it('keeps the symbol ID of an anonymous element identified only by its type when lines are inserted above it', async () => {
        const source = 'package Demo { connection def Cn; connection : Cn; connection : Cn; }';
        // Such elements are only kept per document, for navigation (not in `getAllSymbols`).
        const ids = async (text: string) => (await build([{ uri: 'file:///w/a.sysml', text }])).getSymbolsForUri('file:///w/a.sysml')
            .filter((s) => s.kind === 'connection').map((s) => s.symbolId);
        const before = await ids(source);
        expect(new Set(before).size).toBe(2);
        expect(await ids(`\n\n${source.replace('connection def Cn;', 'connection def Cn;\n    part extra;\n')}`)).toEqual(before);
    });

    it('changes the symbol ID of an anonymous element, and of its members, when its owner is renamed', async () => {
        const owned = 'package Demo { part def Car { part a { port p; } part b { port p; } connect a.p to b.p { attribute w; } } }';
        const ids = async (source: string) => {
            const st = await build([{ uri: 'file:///w/a.sysml', text: source }]);
            return [st.getAllSymbols().find((s) => isAnonymous(s))!.symbolId, st.findByName('w')[0].symbolId];
        };
        const [connectorBefore, memberBefore] = await ids(owned);
        const [connectorAfter, memberAfter] = await ids(owned.replace('part def Car', 'part def Truck'));
        expect(connectorAfter).not.toBe(connectorBefore);
        expect(memberAfter).not.toBe(memberBefore);
    });

    it('gives clashing declarations distinct symbol IDs, and the remaining one its usual symbol ID once the clash is gone', async () => {
        const a = { uri: 'file:///w/a.sysml', text: 'package Demo { part def P { port p; } }' };
        const b = { uri: 'file:///w/b.sysml', text: 'package Demo { part def P { port p; } }' };
        const st = await build([a, b]);
        const clashing = st.getAllSymbolsIncludingDuplicates().filter((s) => s.name === 'P' || s.name === 'p');
        expect(new Set(clashing.map((s) => s.symbolId)).size).toBe(4);

        st.removeUri(b.uri);
        const alone = await build([a]);
        expect(idsByDeclaration(st)).toEqual(idsByDeclaration(alone));
    });

    it('gives a package declared in several documents one symbol ID, and its members that symbol ID as parent', async () => {
        const st = await build([
            { uri: 'file:///w/a.sysml', text: 'package Demo { part x; }' },
            { uri: 'file:///w/b.sysml', text: 'package Demo { part y; }' },
        ]);
        const demo = st.getSymbol('Demo')!;
        const fragments = st.getAllSymbolsIncludingDuplicates().filter((s) => s.qualifiedName === 'Demo');
        expect(fragments.map((s) => s.symbolId)).toEqual([demo.symbolId, demo.symbolId]);
        expect(st.getSymbolById(demo.symbolId)).toBe(demo);
        expect([st.findByName('x')[0].parentId, st.findByName('y')[0].parentId]).toEqual([demo.symbolId, demo.symbolId]);
    });

    it('never gives a definition the symbol ID of a package with the same qualified name', async () => {
        const st = await build([{ uri: 'file:///w/a.sysml', text: 'package Demo { package X; part def X; }' }]);
        const [first, second] = st.getAllSymbolsIncludingDuplicates().filter((s) => s.name === 'X');
        expect(first.symbolId).not.toBe(second.symbolId);
    });

    it('gives the same symbol IDs after a series of document edits as a fresh build of the result', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const shared = 'package Demo { part def P { port p; } connect x to y { attribute w; } }';
        const st = await build([
            { uri: 'file:///w/a.sysml', text: shared },
            { uri: 'file:///w/b.sysml', text: shared },
            { uri: 'file:///w/c.sysml', text: 'package Demo { package X; part def X; }' },
        ]);
        st.build('file:///w/b.sysml', parseDocument('package Demo { connect x to y { attribute w; } part def P; }'));
        st.removeUri('file:///w/c.sysml');
        st.build('file:///w/0.sysml', parseDocument(shared));
        st.build('file:///w/a.sysml', parseDocument(`package Other { }\n${shared}`));

        const fresh = await build([
            { uri: 'file:///w/a.sysml', text: `package Other { }\n${shared}` },
            { uri: 'file:///w/0.sysml', text: shared },
            { uri: 'file:///w/b.sysml', text: 'package Demo { connect x to y { attribute w; } part def P; }' },
        ]);
        expect(idsByDeclaration(st)).toEqual(idsByDeclaration(fresh));
        for (const s of st.getAllSymbols()) expect(st.getSymbolById(s.symbolId)).toBe(s);
    });

    it('moves the members of a declaration renumbered by another document along with it', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const text = 'package Demo { connect x to y { attribute w; } }';
        const st = await build([{ uri: 'file:///w/b.sysml', text }]);
        const connectorBefore = st.getSymbolsForUri('file:///w/b.sysml').find((s) => isAnonymous(s))!.symbolId;
        // A document sorting before b.sysml takes the first number of the identical connectors.
        st.build('file:///w/a.sysml', parseDocument(text));
        const connector = st.getSymbolsForUri('file:///w/b.sysml').find((s) => isAnonymous(s))!;
        const w = st.getSymbolsForUri('file:///w/b.sysml').find((s) => s.name === 'w')!;
        expect(connector.symbolId).not.toBe(connectorBefore);
        expect(w.parentId).toBe(connector.symbolId);
        expect(st.getOwner(w)).toBe(connector);
        expect(st.getSymbolById(w.symbolId)).toBe(w);
        expect(new Set(st.getAllSymbols().map((s) => s.symbolId)).size).toBe(st.getAllSymbols().length);
    });

    it('gives a document removed and added again with the same content the same symbol IDs', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const st = await build([{ uri: 'file:///w/a.sysml', text }]);
        const before = idsByDeclaration(st);

        st.removeUri('file:///w/a.sysml');
        expect(st.getAllSymbols()).toEqual([]);
        st.build('file:///w/a.sysml', parseDocument(text));
        expect(idsByDeclaration(st)).toEqual(before);
    });

    it('restores the symbol IDs of other documents when a document sharing their package is added and removed again', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const shared = 'package Demo { part def P; connect x to y { attribute w; } }';
        const st = await build([
            { uri: 'file:///w/b.sysml', text: shared },
            { uri: 'file:///w/c.sysml', text: 'package Demo { part q; }' },
        ]);
        const before = idsByDeclaration(st);
        const connectorOfB = () => st.getSymbolsForUri('file:///w/b.sysml').find((s) => isAnonymous(s))!.symbolId;
        const connectorBefore = connectorOfB();

        // Sorting before b.sysml, it takes the first number of P and of the identical connector.
        st.build('file:///w/a.sysml', parseDocument(shared));
        expect(connectorOfB()).not.toBe(connectorBefore);

        st.removeUri('file:///w/a.sysml');
        expect(idsByDeclaration(st)).toEqual(before);
    });

    it('gives a document removed and added again under another name the same symbol IDs', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const st = await build([{ uri: 'file:///w/a.sysml', text }]);
        const before = idsByKey(st);

        st.removeUri('file:///w/a.sysml');
        st.build('file:///w/models/vehicle.sysml', parseDocument(text));
        expect(idsByKey(st)).toEqual(before);
    });

    it('changes the symbol ID of a renamed element and of its members', async () => {
        const renamed = text.replace('part def P { port p; }', 'part def Q { port p; }');
        const before = await build([{ uri: 'file:///w/a.sysml', text }]);
        const after = await build([{ uri: 'file:///w/a.sysml', text: renamed }]);
        expect(after.getSymbol('Demo::Q')!.symbolId).not.toBe(before.getSymbol('Demo::P')!.symbolId);
        expect(after.getSymbol('Demo::Q::p')!.symbolId).not.toBe(before.getSymbol('Demo::P::p')!.symbolId);
        expect(after.getSymbol('Demo::a')!.symbolId).toBe(before.getSymbol('Demo::a')!.symbolId);
    });
});

describe('symbolId of named elements', () => {
    const named = `package Vehicles {
    part def Engine { attribute power; port fuel; }
    part def Vehicle {
        part engine : Engine;
        attribute mass;
    }
    part car : Vehicle;
}
`;
    const uri = 'file:///w/vehicles.sysml';

    /** The symbol ID of each named element by its qualified name. */
    function idsByQualifiedName(st: SymbolTable): Map<string, string> {
        return new Map(st.getAllSymbols().map((s) => [s.qualifiedName, s.symbolId]));
    }

    it('keeps named elements on their symbol IDs when namespace fragments are swapped', async () => {
        const original = 'package A { part p; part def P; } package A { part q; part def Q; }';
        const swapped = 'package A { part q; part def Q; } package A { part p; part def P; }';
        const before = idsByQualifiedName(await build([{ uri, text: original }]));
        const after = idsByQualifiedName(await build([{ uri, text: swapped }]));
        expect(after).toEqual(before);
    });

    it('keeps clashing named declarations unique when swapped, numbering them by position', async () => {
        const original = 'package A { part def P { attribute alpha; } } package A { part def P { attribute beta; } }';
        const swapped = 'package A { part def P { attribute beta; } } package A { part def P { attribute alpha; } }';
        /** The symbol ID of the P that owns `member`. */
        const idOfP = async (source: string, member: string) => {
            const st = await build([{ uri, text: source }]);
            return st.getOwner(st.findByName(member)[0])!.symbolId;
        };
        const before = [await idOfP(original, 'alpha'), await idOfP(original, 'beta')];
        const after = [await idOfP(swapped, 'alpha'), await idOfP(swapped, 'beta')];
        expect(new Set(before).size).toBe(2);
        // Numbered by position: the same two symbol IDs, now held by the other declaration.
        expect(after).toEqual([before[1], before[0]]);
    });

    it('moves the members of a named declaration renumbered by another document along with it', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const text = 'package Demo { part def P { attribute w; } }';
        const st = await build([{ uri: 'file:///w/b.sysml', text }]);
        const ownerBefore = st.getSymbolsForUri('file:///w/b.sysml').find((s) => s.name === 'P')!.symbolId;
        // A document sorting before b.sysml declares the same P, and takes the first number.
        st.build('file:///w/a.sysml', parseDocument(text));
        const owner = st.getSymbolsForUri('file:///w/b.sysml').find((s) => s.name === 'P')!;
        const w = st.getSymbolsForUri('file:///w/b.sysml').find((s) => s.name === 'w')!;
        expect(owner.symbolId).not.toBe(ownerBefore);
        expect(w.parentId).toBe(owner.symbolId);
        expect(st.getOwner(w)).toBe(owner);
        expect(st.getSymbolById(w.symbolId)).toBe(w);
    });

    it('keeps the symbol IDs of named elements and their members when lines are inserted above them', async () => {
        const edited = named.replace('package Vehicles {\n', 'package Vehicles {\n    // a comment\n    part def Wheel;\n\n');
        const before = idsByQualifiedName(await build([{ uri, text: named }]));
        const after = idsByQualifiedName(await build([{ uri, text: edited }]));
        expect([...before].every(([qualifiedName, id]) => after.get(qualifiedName) === id)).toBe(true);
    });

    it('keeps the symbol ID of a named element, and of its members, when a member is added to it', async () => {
        const edited = named.replace('        attribute mass;\n', '        attribute mass;\n        attribute range;\n        part wheels[4];\n');
        const before = idsByQualifiedName(await build([{ uri, text: named }]));
        const after = idsByQualifiedName(await build([{ uri, text: edited }]));
        for (const qualifiedName of ['Vehicles::Vehicle', 'Vehicles::Vehicle::engine', 'Vehicles::Vehicle::mass', 'Vehicles::car']) {
            expect(after.get(qualifiedName)).toBe(before.get(qualifiedName));
        }
        expect(after.get('Vehicles::Vehicle::range')).toBeDefined();
    });

    it('keeps the symbol IDs of named elements when their document moves to another folder', async () => {
        const before = idsByQualifiedName(await build([{ uri, text: named }]));
        const after = idsByQualifiedName(await build([{ uri: 'file:///w/models/cars.sysml', text: named }]));
        expect(after).toEqual(before);
    });

    it('gives named elements the same symbol IDs when their document is removed and added again', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const st = await build([{ uri, text: named }]);
        const before = idsByQualifiedName(st);
        st.removeUri(uri);
        st.build(uri, parseDocument(named));
        expect(idsByQualifiedName(st)).toEqual(before);
        st.removeUri(uri);
        st.build('file:///w/models/cars.sysml', parseDocument(named));
        expect(idsByQualifiedName(st)).toEqual(before);
    });

    it('links each named member to its owner by symbol ID', async () => {
        const st = await build([{ uri, text: named }]);
        const engine = st.getSymbol('Vehicles::Vehicle::engine')!;
        expect(engine.parentId).toBe(st.getSymbol('Vehicles::Vehicle')!.symbolId);
        expect(st.getSymbol('Vehicles::Vehicle')!.parentId).toBe(st.getSymbol('Vehicles')!.symbolId);
        expect(st.getOwner(engine)).toBe(st.getSymbol('Vehicles::Vehicle'));
    });

    it('gives the same symbol IDs after a long series of edits has cleared the cache of derived UUIDs', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const kept = { uri: 'file:///w/kept.sysml', text: 'package Kept { part def P; part : P { part q; } }' };
        const edited = { uri: 'file:///w/edited.sysml', text: 'package Kept { part def P; }' };
        const st = await build([kept]);
        // Two large edits leave many derived UUIDs no element uses any more; the small last one clears them.
        for (const round of [1, 2]) {
            const parts = Array.from({ length: 1100 }, (_, i) => `part x${round}_${i};`).join(' ');
            st.build(edited.uri, parseDocument(`package Edited { ${parts} }`));
        }
        st.build(edited.uri, parseDocument(edited.text));
        expect(idsByDeclaration(st)).toEqual(idsByDeclaration(await build([kept, edited])));
        // symbol IDs are still derived the same way afterwards.
        st.build(edited.uri, parseDocument('package Kept { part def P; part : P; }'));
        expect(idsByDeclaration(st)).toEqual(idsByDeclaration(await build([kept, { ...edited, text: 'package Kept { part def P; part : P; }' }])));
    });

    it('gives a typed transition without a source state a symbol ID, owned like any other element', async () => {
        const text = 'package D { part def T; state def M { state s1; state s2; transition : T then s2; } }';
        const st = await build([{ uri: 'file:///w/a.sysml', text }]);
        const transition = st.getSymbolsForUri('file:///w/a.sysml').find((s) => s.kind === 'transition')!;
        expect(transition.symbolId).toMatch(UUID_V5);
        expect(transition.parentId).toBe(st.getSymbol('D::M')!.symbolId);
        expect(transition.qualifiedName).toBeUndefined();
        // A clash in a document sorted first renumbers M; the transition follows its owner.
        const before = transition.parentId;
        st.build('file:///w/0.sysml', (await import('../../server/src/parser/parseDocument.js')).parseDocument('package D { state def M; }'));
        const m = st.getSymbolsForUri('file:///w/a.sysml').find((s) => s.name === 'M')!;
        expect(m.symbolId).not.toBe(before);
        expect(transition.parentId).toBe(m.symbolId);
    });

    it('derives symbol IDs from the project symbol ID a client passes in its initialization options', async () => {
        const { build } = await import('esbuild');
        const { spawn } = await import('node:child_process');
        const { mkdtemp, rm } = await import('node:fs/promises');
        const { tmpdir } = await import('node:os');
        const { join } = await import('node:path');
        const { createMessageConnection, StreamMessageReader, StreamMessageWriter } = await import('vscode-languageserver/node');
        const { DEFAULT_URL_PREFIX, NAMESPACE_URL, uuidV5 } = await import('../../server/src/utils/uuid.js');
        const directory = await mkdtemp(join(tmpdir(), 'sysml-project-id-'));
        /** The symbol ID the server reports for `package Demo`, initialized with `initializationOptions`. */
        const demoId = async (initializationOptions: object) => {
            const child = spawn(process.execPath, [join(directory, 'server.js'), '--stdio'], { stdio: ['pipe', 'pipe', 'pipe'] });
            const exited = new Promise<void>(resolve => child.once('exit', () => resolve()));
            const connection = createMessageConnection(new StreamMessageReader(child.stdout), new StreamMessageWriter(child.stdin));
            child.stderr.resume();
            connection.listen();
            try {
                await connection.sendRequest('initialize', { processId: null, rootUri: null, capabilities: {}, initializationOptions });
                await connection.sendNotification('initialized', {});
                await connection.sendNotification('textDocument/didOpen', {
                    textDocument: { uri: 'untitled:demo.sysml', languageId: 'sysml', version: 1, text: 'package Demo;' },
                });
                const { results } = await connection.sendRequest<{ results: Record<string, Array<{ symbolId: string }>> }>(
                    'sysml/elementLookup', { queries: [{ name: 'Demo' }] });
                return results.Demo[0].symbolId;
            } finally {
                connection.dispose();
                child.kill();
                await exited;
            }
        };
        try {
            await build({
                entryPoints: { server: 'server/src/server.ts', parseWorker: 'server/src/parser/parseWorker.ts' },
                bundle: true, platform: 'node', format: 'cjs', outdir: directory, logLevel: 'silent',
            });
            const projectId = '3f9c2b1e-7a4d-4e8b-9c2f-1d5e6a7b8c9d';
            expect(await demoId({ projectId })).toBe(uuidV5(NAMESPACE_URL, `urn:uuid:${projectId}/Demo`));
            // Not a UUID: ignored, with the default prefix.
            expect(await demoId({ projectId: 'my-project' })).toBe(uuidV5(NAMESPACE_URL, `${DEFAULT_URL_PREFIX}Demo`));
        } finally {
            await rm(directory, { recursive: true, force: true });
        }
    }, 60_000);
});
