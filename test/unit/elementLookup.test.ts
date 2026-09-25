/**
 * Tests for `ElementLookupProvider.elementLookup` (`sysml/elementLookup`).
 *
 * Uses dynamic imports so vscode-languageserver and
 * vscode-languageserver-textdocument resolve from server/node_modules.
 */
import { describe, expect, it } from 'vitest';
import type { SysMLElementLookupResult } from '../../server/src/model/elementLookupTypes.js';

describe('ElementLookupProvider', () => {

    it('reflects live LSP edits before debounced validation runs', async () => {
        const { build } = await import('esbuild');
        const { spawn } = await import('node:child_process');
        const { mkdtemp, rm } = await import('node:fs/promises');
        const { tmpdir } = await import('node:os');
        const { join } = await import('node:path');
        const { createMessageConnection, StreamMessageReader, StreamMessageWriter } = await import('vscode-languageserver/node');
        const directory = await mkdtemp(join(tmpdir(), 'sysml-lookup-'));

        try {
            await build({
                entryPoints: {
                    server: 'server/src/server.ts',
                    parseWorker: 'server/src/parser/parseWorker.ts',
                },
                bundle: true,
                platform: 'node',
                format: 'cjs',
                outdir: directory,
                logLevel: 'silent',
            });
            const child = spawn(process.execPath, [join(directory, 'server.js'), '--stdio'], {
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            const exited = new Promise<void>(resolve => child.once('exit', () => resolve()));
            const connection = createMessageConnection(
                new StreamMessageReader(child.stdout),
                new StreamMessageWriter(child.stdin),
            );
            child.stderr.resume();
            connection.onClose(() => connection.dispose());
            connection.listen();
            const deadline = setTimeout(() => child.kill(), 20000);

            try {
                await connection.sendRequest('initialize', { processId: null, rootUri: null, capabilities: {} });
                await connection.sendNotification('initialized', {});
                const uri = 'untitled:live-lookup.sysml';
                await connection.sendNotification('textDocument/didOpen', {
                    textDocument: { uri, languageId: 'sysml', version: 1, text: 'part def Before;' },
                });
                const params = { queries: [{ name: 'Before' }, { name: 'After' }] };
                const initial = await connection.sendRequest<SysMLElementLookupResult>('sysml/elementLookup', params);
                expect(initial.results.Before).toHaveLength(1);

                await connection.sendNotification('textDocument/didChange', {
                    textDocument: { uri, version: 2 },
                    contentChanges: [{ text: 'part def After;' }],
                });
                const renamed = await connection.sendRequest<SysMLElementLookupResult>('sysml/elementLookup', params);
                expect(renamed.indexingComplete).toBe(true);
                expect(renamed.results.Before).toEqual([]);
                expect(renamed.results.After).toHaveLength(1);

                await connection.sendNotification('textDocument/didChange', {
                    textDocument: { uri, version: 3 },
                    contentChanges: [{
                        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 15 } },
                        text: '',
                    }],
                });
                const removed = await connection.sendRequest<SysMLElementLookupResult>('sysml/elementLookup', params);
                expect(removed.results.Before).toEqual([]);
                expect(removed.results.After).toEqual([]);
            } finally {
                clearTimeout(deadline);
                connection.dispose();
                child.kill();
                await exited;
            }
        } finally {
            await rm(directory, { recursive: true, force: true });
        }
    });

    it.each(['package', 'part def', 'part'])('does not assign a child alias to an unaliased %s', async (kind) => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');
        const uri = 'test://parent.sysml';
        const dm = await setupMulti([{
            uri,
            text: `${kind} Parent { part <childAlias> child; }`,
        }]);
        expect(dm.get(uri)?.errors).toEqual([]);
        const provider = new ElementLookupProvider(dm);
        const { results } = provider.elementLookup({ queries: [
            { name: 'childAlias', kind: 'shortName' },
            { name: 'Parent' },
        ] });
        expect(results.childAlias.map(match => match.qualifiedName)).toEqual(['Parent::child']);
        expect(results.Parent[0].shortName).toBeUndefined();
    });

    /** Helper: Create a TextDocument from raw SysML text */
    async function makeDoc(text: string, uri = 'test://test.sysml', version = 1) {
        const { TextDocument } = await import('vscode-languageserver-textdocument');
        return TextDocument.create(uri, 'sysml', version, text);
    }

    /** Helper: Parse multiple texts into the same DocumentManager, mirroring a multi-file workspace */
    async function setupMulti(entries: { text: string; uri: string }[]) {
        const { DocumentManager } = await import('../../server/src/documentManager.js');
        const dm = new DocumentManager();
        for (const { text, uri } of entries) {
            const doc = await makeDoc(text, uri);
            dm.parse(doc);
        }
        return dm;
    }

    it('returns an empty array for a name that does not exist', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const text = `
part def Wheel;`;

        const dm = await setupMulti([{ uri: 'test://a.sysml', text }]);
        const provider = new ElementLookupProvider(dm);

        const { results } = provider.elementLookup({ queries: [{ name: 'Engine' }] });

        expect(results).toEqual({ Engine: [] });
    });

    it('finds exactly one match for a bare name that exists once', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const text = `
part def Wheel;`;

        const dm = await setupMulti([{ uri: 'test://a.sysml', text }]);
        const provider = new ElementLookupProvider(dm);

        const { results } = provider.elementLookup({ queries: [{ name: 'Wheel' }] });

        expect(results.Wheel).toHaveLength(1);
        expect(results.Wheel[0].name).toBe('Wheel');
        expect(results.Wheel[0].shortName).toBeUndefined();
        expect(results.Wheel[0].qualifiedName).toBe('Wheel');
        expect(results.Wheel[0].type).toBe('part def');
        expect(results.Wheel[0].uri).toBe('test://a.sysml');
        // `part def Wheel;` is on line 1 (line 0 is the leading blank line in `text`).
        expect(results.Wheel[0].range.start.line).toBe(1);
        expect(typeof results.Wheel[0].range.start.character).toBe('number');
        expect(typeof results.Wheel[0].range.end.line).toBe('number');
        expect(typeof results.Wheel[0].range.end.character).toBe('number');
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

        expect(results.Wheel).toHaveLength(1);
        expect(results.Wheel[0].qualifiedName).toBe('A::Wheel');
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

        expect(results.Wheel).toHaveLength(2);
        expect(new Set(results.Wheel.map(m => m.qualifiedName))).toEqual(new Set(['Wheel', 'A::Wheel']));
    });

    it('finds an exact match by full qualified name, distinguishing same-named elements in different packages', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const textA = `
package PkgA {
    part def Wheel;
}`;
        const textB = `
package PkgB {
    part def Wheel;
}`;

        const dm = await setupMulti([
            { uri: 'test://a.sysml', text: textA },
            { uri: 'test://b.sysml', text: textB },
        ]);
        const provider = new ElementLookupProvider(dm);

        const { results } = provider.elementLookup({ queries: [{ name: 'PkgA::Wheel' }] });

        expect(results['PkgA::Wheel']).toHaveLength(1);
        expect(results['PkgA::Wheel'][0].qualifiedName).toBe('PkgA::Wheel');
        expect(results['PkgA::Wheel'][0].uri).toBe('test://a.sysml');
    });

    it('returns no results for a qualified-name query when the declaration is actually global, not in that package', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const text = `part def Wheel;`;

        const dm = await setupMulti([{ uri: 'test://a.sysml', text }]);
        const provider = new ElementLookupProvider(dm);

        const { results } = provider.elementLookup({ queries: [{ name: 'A::Wheel' }] });

        expect(results).toEqual({ 'A::Wheel': [] });
    });

    it('returns two separate matches for a genuine same-name collision, not a "duplicate" label', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const text = `
part def Wheel;`;

        const dm = await setupMulti([
            { uri: 'test://a.sysml', text },
            { uri: 'test://b.sysml', text },
        ]);
        const provider = new ElementLookupProvider(dm);

        const { results } = provider.elementLookup({ queries: [{ name: 'Wheel' }] });

        expect(results.Wheel).toHaveLength(2);
        expect(new Set(results.Wheel.map(m => m.uri))).toEqual(new Set(['test://a.sysml', 'test://b.sysml']));
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

        expect(results.Wheel.map(m => m.qualifiedName)).toEqual(['Wheel']);
        expect(results.wheel.map(m => m.qualifiedName)).toEqual(['wheel']);
    });

    it('batches multiple queries in one request, keyed by each query\'s name', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const text = `
part def Wheel;
part def Engine;`;

        const dm = await setupMulti([{ uri: 'test://a.sysml', text }]);
        const provider = new ElementLookupProvider(dm);

        const { results } = provider.elementLookup({
            queries: [{ name: 'Wheel' }, { name: 'DoesNotExist' }, { name: 'Engine' }],
        });

        expect(Object.keys(results)).toEqual(['Wheel', 'DoesNotExist', 'Engine']);
        expect(results.Wheel.map(m => m.qualifiedName)).toEqual(['Wheel']);
        expect(results.DoesNotExist).toEqual([]);
        expect(results.Engine.map(m => m.qualifiedName)).toEqual(['Engine']);
    });

    it('restricts a bare-name match to the given scope, excluding same-named elements outside it', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const text = `
part def Wheel;
package A {
    part def Wheel;
}
package B {
    part def Wheel;
}`;

        const dm = await setupMulti([{ uri: 'test://a.sysml', text }]);
        const provider = new ElementLookupProvider(dm);

        const { results } = provider.elementLookup({ queries: [{ name: 'Wheel', scope: 'A' }] });

        expect(results.Wheel).toHaveLength(1);
        expect(results.Wheel[0].qualifiedName).toBe('A::Wheel');
    });

    it('treats an empty scope the same as no scope -- searches the whole workspace', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const text = `
part def Wheel;
package A {
    part def Wheel;
}`;

        const dm = await setupMulti([{ uri: 'test://a.sysml', text }]);
        const provider = new ElementLookupProvider(dm);

        const { results } = provider.elementLookup({ queries: [{ name: 'Wheel', scope: '' }] });

        expect(results.Wheel).toHaveLength(2);
    });

    it('treats an empty scope the same as no scope for a qualified-name query too', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const text = `
package A {
    part def Wheel;
}
package X {
    package A {
        part def Wheel;
    }
}`;

        const dm = await setupMulti([{ uri: 'test://a.sysml', text }]);
        const provider = new ElementLookupProvider(dm);

        const { results } = provider.elementLookup({ queries: [{ name: 'A::Wheel', scope: '' }] });

        expect(results['A::Wheel']).toHaveLength(2);
        expect(new Set(results['A::Wheel'].map(m => m.qualifiedName))).toEqual(new Set(['A::Wheel', 'X::A::Wheel']));
    });

    it('finds a match nested arbitrarily deep under scope, not just direct children', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const text = `
package A {
    package Inner {
        part def Wheel;
    }
}`;

        const dm = await setupMulti([{ uri: 'test://a.sysml', text }]);
        const provider = new ElementLookupProvider(dm);

        const { results } = provider.elementLookup({ queries: [{ name: 'Wheel', scope: 'A' }] });

        expect(results.Wheel).toHaveLength(1);
        expect(results.Wheel[0].qualifiedName).toBe('A::Inner::Wheel');
    });

    it('find match if name is a part of the qualified name, but for a specific scope', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const text = `
package A {
    part def Wheel;
}
package X {
    package A {
        part def Wheel;
    }
}`;

        const dm = await setupMulti([{ uri: 'test://a.sysml', text }]);
        const provider = new ElementLookupProvider(dm);

        const { results } = provider.elementLookup({ queries: [{ name: 'A::Wheel', scope: 'X' }] });

        expect(results['A::Wheel']).toHaveLength(1);
        expect(results['A::Wheel'][0].qualifiedName).toBe('X::A::Wheel');
    });

    it('find match if name is a part of the qualified name, without scope', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const text = `
package A {
    part def Wheel;
}
package X {
    package A {
        part def Wheel;
    }
}`;

        const dm = await setupMulti([{ uri: 'test://a.sysml', text }]);
        const provider = new ElementLookupProvider(dm);

        const { results } = provider.elementLookup({ queries: [{ name: 'A::Wheel' }] });

        expect(results['A::Wheel']).toHaveLength(2);
        expect(new Set(results['A::Wheel'].map(m => m.qualifiedName))).toEqual(new Set(['A::Wheel', 'X::A::Wheel']));
    });

    it('ignores a scope that is already the leading segment of a qualified name, instead of doubling it up', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const text = `
package A {
    part def Wheel;
}
package X {
    package A {
        part def Wheel;
    }
}`;

        const dm = await setupMulti([{ uri: 'test://a.sysml', text }]);
        const provider = new ElementLookupProvider(dm);

        // scope "A" is already the leading segment of name "A::Wheel" -- prepending it would
        // build the nonsensical target "A::A::Wheel", which must not happen. Instead this must
        // behave exactly like the no-scope case: match "A::Wheel" itself and, as a trailing
        // segment, "X::A::Wheel" too.
        const { results } = provider.elementLookup({ queries: [{ name: 'A::Wheel', scope: 'A' }] });

        expect(results['A::Wheel']).toHaveLength(2);
        expect(new Set(results['A::Wheel'].map(m => m.qualifiedName))).toEqual(new Set(['A::Wheel', 'X::A::Wheel']));
    });

    it('matches a declared shortName alias only when kind is explicitly "shortName"', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const text = `
part def <whl> Wheel;`;

        const dm = await setupMulti([{ uri: 'test://a.sysml', text }]);
        const provider = new ElementLookupProvider(dm);

        const { results } = provider.elementLookup({
            queries: [{ name: 'whl', kind: 'shortName' }, { name: 'Wheel' }],
        });

        expect(results.whl).toHaveLength(1);
        expect(results.whl[0].name).toBe('Wheel');
        expect(results.whl[0].shortName).toBe('whl');
        expect(results.whl[0].qualifiedName).toBe('Wheel');
        expect(results.Wheel).toHaveLength(1);
        expect(results.Wheel[0].shortName).toBe('whl');
        expect(results.Wheel[0].qualifiedName).toBe('Wheel');
    });

    it('never infers kind "shortName" -- a plain name query must not fall back to matching a short-name alias', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const text = `
part def <whl> Wheel;`;

        const dm = await setupMulti([{ uri: 'test://a.sysml', text }]);
        const provider = new ElementLookupProvider(dm);

        const { results } = provider.elementLookup({ queries: [{ name: 'whl' }] });

        expect(results.whl).toEqual([]);
    });

    it('treats a declared <shortName> with no long name as the element\'s only name', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const text = `
part def <whl>;`;

        const dm = await setupMulti([{ uri: 'test://a.sysml', text }]);
        const provider = new ElementLookupProvider(dm);

        const { results } = provider.elementLookup({ queries: [{ name: 'whl', kind: 'shortName' }] });

        expect(results.whl).toHaveLength(1);
        expect(results.whl[0].qualifiedName).toBe('whl');

        // Same underlying element, reached the other way: its only name also serves as its
        // plain declared `name`.
        const { results: byPlainName } = provider.elementLookup({ queries: [{ name: 'whl' }] });
        expect(byPlainName.whl).toHaveLength(1);
        expect(byPlainName.whl[0].qualifiedName).toBe('whl');
    });

    it('restricts a shortName-kind match to the given scope too', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const text = `
part def <whl> Wheel;
package A {
    part def <whl> Wheel;
}`;

        const dm = await setupMulti([{ uri: 'test://a.sysml', text }]);
        const provider = new ElementLookupProvider(dm);

        const { results } = provider.elementLookup({ queries: [{ name: 'whl', kind: 'shortName', scope: 'A' }] });

        expect(results.whl).toHaveLength(1);
        expect(results.whl[0].qualifiedName).toBe('A::Wheel');
    });

    it('does not double-count a declaration reachable through an import in another file', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const textA = `
package PkgA {
    part def Wheel;
}`;
        const textB = `
package PkgB {
    import PkgA::*;
}`;

        const dm = await setupMulti([
            { uri: 'test://a.sysml', text: textA },
            { uri: 'test://b.sysml', text: textB },
        ]);
        const provider = new ElementLookupProvider(dm);

        const { results } = provider.elementLookup({ queries: [{ name: 'PkgA::Wheel' }] });

        expect(results['PkgA::Wheel']).toHaveLength(1);
    });

    it('reflects an element added via an unsaved edit (no save required)', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');
        const { TextDocument } = await import('vscode-languageserver-textdocument');

        const text = `
part def Wheel;`;

        const dm = await setupMulti([{ uri: 'test://a.sysml', text }]);
        const provider = new ElementLookupProvider(dm);

        expect(provider.elementLookup({ queries: [{ name: 'Engine' }] }).results.Engine).toEqual([]);

        // Simulate a didChange: same URI, bumped version, new content, never saved to disk.
        const edited = TextDocument.create('test://a.sysml', 'sysml', 2, `part def Wheel;\npart def Engine;`);
        dm.parse(edited);

        const { results } = provider.elementLookup({ queries: [{ name: 'Engine' }] });
        expect(results.Engine).toHaveLength(1);
    });

    it('reflects an element removed via an unsaved edit', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');
        const { TextDocument } = await import('vscode-languageserver-textdocument');

        const text = `
part def Wheel;
part def Engine;`;

        const dm = await setupMulti([{ uri: 'test://a.sysml', text }]);
        const provider = new ElementLookupProvider(dm);

        expect(provider.elementLookup({ queries: [{ name: 'Engine' }] }).results.Engine).toHaveLength(1);

        const edited = TextDocument.create('test://a.sysml', 'sysml', 2, `part def Wheel;`);
        dm.parse(edited);

        const { results } = provider.elementLookup({ queries: [{ name: 'Engine' }] });
        expect(results.Engine).toEqual([]);
    });

    it('reports indexingComplete: true once the (single-document, non-workspace) scan has nothing pending', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const text = `
part def Wheel;`;

        const dm = await setupMulti([{ uri: 'test://a.sysml', text }]);
        const provider = new ElementLookupProvider(dm);

        const { indexingComplete } = provider.elementLookup({ queries: [{ name: 'Wheel' }] });
        expect(indexingComplete).toBe(true);
    });

    it('reports indexingComplete: false while a workspace scan is in flight, so an empty result is not mistaken for "doesn\'t exist"', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');
        const { DocumentManager } = await import('../../server/src/documentManager.js');

        const dm = new DocumentManager();
        dm.setWorkspaceScanComplete(false);
        const provider = new ElementLookupProvider(dm);

        const { results, indexingComplete } = provider.elementLookup({ queries: [{ name: 'Wheel' }] });
        expect(indexingComplete).toBe(false);
        expect(results.Wheel).toEqual([]);
    });

    // "__proto__" is a legal SysML identifier but, as a key on a plain {} object, is
    // special-cased by JS to set the object's prototype rather than a real own
    // property -- silently dropping the entry instead of storing it. `results` must
    // be built on a null-prototype object so this key behaves like any other.
    it('returns matches for the element name "__proto__" and survives JSON round-tripping', async () => {
        const { ElementLookupProvider } = await import('../../server/src/model/elementLookupProvider.js');

        const text = `
part def __proto__;`;

        const dm = await setupMulti([{ uri: 'test://a.sysml', text }]);
        const provider = new ElementLookupProvider(dm);

        const { results } = provider.elementLookup({ queries: [{ name: '__proto__' }] });

        expect(Object.prototype.hasOwnProperty.call(results, '__proto__')).toBe(true);
        expect(results.__proto__).toHaveLength(1);
        expect(results.__proto__[0].qualifiedName).toBe('__proto__');

        const roundTripped = JSON.parse(JSON.stringify({ results }));
        expect(roundTripped.results.__proto__).toHaveLength(1);
        expect(roundTripped.results.__proto__[0].qualifiedName).toBe('__proto__');
    });

});
