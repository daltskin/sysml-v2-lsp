/**
 * Tests for `ElementLookupProvider.elementLookup` (`sysml/elementLookup`).
 *
 * Uses dynamic imports so vscode-languageserver and
 * vscode-languageserver-textdocument resolve from server/node_modules.
 */
import { describe, expect, it } from 'vitest';

/** Create a TextDocument from raw SysML text */
async function makeDoc(text: string, uri = 'test://test.sysml') {
    const { TextDocument } = await import('vscode-languageserver-textdocument');
    return TextDocument.create(uri, 'sysml', 1, text);
}

/** Parse multiple texts into the same DocumentManager, mirroring a multi-file workspace */
async function setupMulti(entries: { text: string; uri: string }[]) {
    const { DocumentManager } = await import('../../server/src/documentManager.js');
    const dm = new DocumentManager();
    for (const { text, uri } of entries) {
        const doc = await makeDoc(text, uri);
        dm.parse(doc);
    }
    return dm;
}

describe('ElementLookupProvider', () => {
    it('returns an empty array for a name that does not exist', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const text = `part def Wheel;`;

        const dm = await setupMulti([{ uri: 'test://a.sysml', text }]);
        const provider = new ElementLookupProvider(dm);

        const { results } = provider.elementLookup({ queries: [{ name: 'Engine' }] });

        expect(results).toEqual([[]]);
    });

    it('finds exactly one match for a bare name that exists once', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const text = `part def Wheel;`;

        const dm = await setupMulti([{ uri: 'test://a.sysml', text }]);
        const provider = new ElementLookupProvider(dm);

        const { results } = provider.elementLookup({ queries: [{ name: 'Wheel' }] });

        expect(results).toHaveLength(1);
        expect(results[0]).toHaveLength(1);
        expect(results[0][0].qualifiedName).toBe('Wheel');
        expect(results[0][0].type).toBe('part def');
        expect(results[0][0].uri).toBe('test://a.sysml');
    });

    it('finds a match at any nesting depth, not just top-level', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const text = `
package A {
    part def Wheel;
}`;

        const dm = await setupMulti([{ uri: 'test://a.sysml', text }]);
        const provider = new ElementLookupProvider(dm);

        const { results } = provider.elementLookup({ queries: [{ name: 'Wheel' }] });

        expect(results[0]).toHaveLength(1);
        expect(results[0][0].qualifiedName).toBe('A::Wheel');
    });

    it('finds every match for a bare name declared both globally and nested in a package', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const text = `
part def Wheel;
package A {
    part def Wheel;
}`;

        const dm = await setupMulti([{ uri: 'test://a.sysml', text }]);
        const provider = new ElementLookupProvider(dm);

        const { results } = provider.elementLookup({ queries: [{ name: 'Wheel' }] });

        expect(results[0]).toHaveLength(2);
        expect(new Set(results[0].map(m => m.qualifiedName))).toEqual(new Set(['Wheel', 'A::Wheel']));
    });

    it('finds an exact match by full qualified name, distinguishing same-named elements in different packages', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const textA = `package PkgA {
    part def Wheel;
}`;
        const textB = `package PkgB {
    part def Wheel;
}`;

        const dm = await setupMulti([
            { uri: 'test://a.sysml', text: textA },
            { uri: 'test://b.sysml', text: textB },
        ]);
        const provider = new ElementLookupProvider(dm);

        const { results } = provider.elementLookup({ queries: [{ name: 'PkgA::Wheel' }] });

        expect(results[0]).toHaveLength(1);
        expect(results[0][0].qualifiedName).toBe('PkgA::Wheel');
        expect(results[0][0].uri).toBe('test://a.sysml');
    });

    it('returns no results for a qualified-name query when the declaration is actually global, not in that package', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const text = `part def Wheel;`;

        const dm = await setupMulti([{ uri: 'test://a.sysml', text }]);
        const provider = new ElementLookupProvider(dm);

        const { results } = provider.elementLookup({ queries: [{ name: 'A::Wheel' }] });

        expect(results).toEqual([[]]);
    });

    it('finds a duplicate top-level name declared in two different files', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const text = `part def Wheel;`;
        const dm = await setupMulti([
            { uri: 'test://a.sysml', text },
            { uri: 'test://b.sysml', text },
        ]);
        const provider = new ElementLookupProvider(dm);

        const { results } = provider.elementLookup({ queries: [{ name: 'Wheel' }] });

        expect(results[0]).toHaveLength(2);
        expect(new Set(results[0].map(m => m.uri))).toEqual(new Set(['test://a.sysml', 'test://b.sysml']));
    });

    // SysML v2 identifiers are case-sensitive -- a definition and a same-named-but-case usage
    // of it are two different, both-legal elements.
    it('is case-sensitive', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const text = `
part def Wheel;
part wheel : Wheel;`;

        const dm = await setupMulti([{ uri: 'test://a.sysml', text }]);
        const provider = new ElementLookupProvider(dm);

        const { results } = provider.elementLookup({ queries: [{ name: 'Wheel' }, { name: 'wheel' }] });

        expect(results[0].map(m => m.qualifiedName)).toEqual(['Wheel']);
        expect(results[1].map(m => m.qualifiedName)).toEqual(['wheel']);
    });

    it('batches multiple queries in one request, in order', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const text = `
part def Wheel;
part def Engine;`;

        const dm = await setupMulti([{ uri: 'test://a.sysml', text }]);
        const provider = new ElementLookupProvider(dm);

        const { results } = provider.elementLookup({
            queries: [{ name: 'Wheel' }, { name: 'DoesNotExist' }, { name: 'Engine' }],
        });

        expect(results).toHaveLength(3);
        expect(results[0].map(m => m.qualifiedName)).toEqual(['Wheel']);
        expect(results[1]).toEqual([]);
        expect(results[2].map(m => m.qualifiedName)).toEqual(['Engine']);
    });
});
