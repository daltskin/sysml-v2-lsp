import { describe, expect, it } from 'vitest';
import { parseDocument } from '../../server/src/parser/parseDocument.js';
import { buildSymbolIndexes, NamespaceResolver } from '../../server/src/symbols/namespaceResolver.js';
import type { SysMLSymbol } from '../../server/src/symbols/sysmlElements.js';
import { SymbolTable } from '../../server/src/symbols/symbolTable.js';

/** A symbol table of `documents`, and a resolution of `name` from the declaration at `line` of document `uri`. */
function resolver(documents: Array<{ uri: string; text: string }>) {
    const st = new SymbolTable();
    st.buildAll(documents.map(({ uri, text }) => [uri, parseDocument(text)]));
    const indexes = buildSymbolIndexes(st.getAllSymbols(), st.getElementRegistry());
    const resolve = new NamespaceResolver();
    const at = (uri: string, line: number): SysMLSymbol => {
        const found = st.getSymbolsForUri(uri).filter(s => s.range.start.line === line);
        expect(found, `a declaration at ${uri}:${line}`).not.toHaveLength(0);
        return found[found.length - 1];
    };
    return {
        /** What `name` resolves to from the declaration at `line` of `uri`: its document and line, if any. */
        from(uri: string, line: number, name: string): string | undefined {
            const symbol = resolve.resolveNameFrom(at(uri, line), name, indexes);
            return symbol && `${symbol.uri}:${symbol.range.start.line}`;
        },
    };
}

describe('name resolution over the element registry', () => {
    describe('one root namespace for the workspace (SysML 7.5.5, 8.2.3.5.4)', () => {
        const a = { uri: 'file:///w/a.sysml', text: 'part def T { part x; }\npart t : T;\npackage U { part u : T; }\n' };
        const b = { uri: 'file:///w/b.sysml', text: 'part def T { part x; }\npart t : T;\n' };
        const c = { uri: 'file:///w/c.sysml', text: 'part v : T;\n' };

        it('leaves a name two same-kind top-level elements of two documents share unresolved, from either and from a third', () => {
            const { from } = resolver([a, b, c]);
            expect(from(a.uri, 1, 'T')).toBeUndefined();
            expect(from(a.uri, 2, 'T')).toBeUndefined();
            expect(from(b.uri, 1, 'T')).toBeUndefined();
            expect(from(c.uri, 0, 'T')).toBeUndefined();
        });

        it('resolves a top-level element of one document from every other', () => {
            const { from } = resolver([a, c]);
            expect(from(c.uri, 0, 'T')).toBe(`${a.uri}:0`);
            expect(from(a.uri, 2, 'T')).toBe(`${a.uri}:0`);
        });
    });

    describe('imports at the top level of a document, memberships of the root namespace (SysML 7.5.5, SysML 7.5.5)', () => {
        const lib = { uri: 'file:///w/lib.sysml', text: 'package L { package A { part def m; package Deep { part def d; } } part def n; }\n' };

        it('makes the imported names visible in the document\'s top-level elements and those nested in them', () => {
            const doc = { uri: 'file:///w/a.sysml', text: `private import L::A::*;
part t : m;
package W { part w : m; part def Own { part o : m; } }
` };
            const { from } = resolver([lib, doc]);
            expect(from(doc.uri, 1, 'm')).toBe(`${lib.uri}:0`);
            expect(from(doc.uri, 2, 'm')).toBe(`${lib.uri}:0`);
        });

        it('imports through every import form', () => {
            const doc = { uri: 'file:///w/a.sysml', text: `private import L::n;
private import L::A::**;
part a : n;
part b : d;
` };
            const { from } = resolver([lib, doc]);
            expect(from(doc.uri, 2, 'n')).toBe(`${lib.uri}:0`);
            expect(from(doc.uri, 3, 'd')).toBe(`${lib.uri}:0`);
        });

        it('makes them visible in every document, the workspace being one root namespace', () => {
            const a = { uri: 'file:///w/a.sysml', text: 'private import L::A::*;\npackage P { part x : m; }\n' };
            const b = { uri: 'file:///w/b.sysml', text: 'part u : m;\npackage P { part y : m; }\n' };
            const { from } = resolver([lib, a, b]);
            expect(from(a.uri, 1, 'm')).toBe(`${lib.uri}:0`);
            expect(from(b.uri, 0, 'm')).toBe(`${lib.uri}:0`);
            expect(from(b.uri, 1, 'm')).toBe(`${lib.uri}:0`);
        });

        it('lets a top-level element of the document hide an imported one of the same name', () => {
            const doc = { uri: 'file:///w/a.sysml', text: 'private import L::A::*;\npart def m;\npart t : m;\n' };
            expect(resolver([lib, doc]).from(doc.uri, 2, 'm')).toBe(`${doc.uri}:1`);
        });
    });

    describe('a package declared more than once is one namespace', () => {
        it('keeps the imports of each declaration in one document', () => {
            const doc = { uri: 'file:///w/a.sysml', text: `package L {
    package A { private import X::x; }
    package A { part y : x; }
}
package X { part def x; }
` };
            expect(resolver([doc]).from(doc.uri, 2, 'x')).toBe(`${doc.uri}:4`);
        });

        it('resolves the members of every declaration, in either document', () => {
            const a = { uri: 'file:///w/a.sysml', text: 'package P { part def E; part e : W; }\n' };
            const b = { uri: 'file:///w/b.sysml', text: 'package P { part def W; part w : E; }\n' };
            const { from } = resolver([a, b]);
            expect(from(a.uri, 0, 'W')).toBe(`${b.uri}:0`);
            expect(from(b.uri, 0, 'E')).toBe(`${a.uri}:0`);
            expect(from(a.uri, 0, 'P::W')).toBe(`${b.uri}:0`);
        });
    });

    describe('each of two same-named declarations of another kind is a namespace of its own', () => {
        const doc = { uri: 'file:///w/a.sysml', text: `package P {
    part def A { part def m; }
    part def A { part def m; part j : m; }
    part k : A::m;
}
` };

        it('resolves a member from inside its own declaration', () => {
            expect(resolver([doc]).from(doc.uri, 2, 'm')).toBe(`${doc.uri}:2`);
        });

        it('leaves a name through them ambiguous from outside', () => {
            expect(resolver([doc]).from(doc.uri, 3, 'A::m')).toBeUndefined();
        });
    });

    describe('a qualifying segment naming a package and a same-named definition (KerML 8.3.2.4.3)', () => {
        const doc = { uri: 'file:///w/a.sysml', text: `package Q {
    package A { part def B; }
    part def A { part def B2; }
    part b : A::B;
    part b2 : A::B2;
}
` };

        it('qualifies through each of them', () => {
            const { from } = resolver([doc]);
            expect(from(doc.uri, 3, 'A::B')).toBe(`${doc.uri}:1`);
            expect(from(doc.uri, 4, 'A::B2')).toBe(`${doc.uri}:2`);
        });
    });
});

describe('name clashes per namespace (KerML 8.3.2.4.3)', () => {
    /** The declarations that clash, as `document:line` and the names they clash on. */
    async function clashes(documents: Array<{ uri: string; text: string }>): Promise<string[]> {
        const { findConflicts } = await import('../../server/src/symbols/namespaceResolver.js');
        const st = new SymbolTable();
        st.buildAll(documents.map(({ uri, text }) => [uri, parseDocument(text)]));
        return [...findConflicts(st.getIndexes())]
            .map(([symbol, { names }]) => `${symbol.uri.split('/').pop()}:${symbol.range.start.line} ${names.join(',')}`).sort();
    }

    it('flags same-kind top-level elements of two documents, members of the one root namespace', async () => {
        expect(await clashes([
            { uri: 'file:///w/a.sysml', text: 'part def A;\n' },
            { uri: 'file:///w/b.sysml', text: 'part def A;\n' },
        ])).toEqual(['a.sysml:0 A', 'b.sysml:0 A']);
    });

    it('flags same-kind top-level elements of one document', async () => {
        expect(await clashes([{ uri: 'file:///w/a.sysml', text: 'part def A;\npart def A;\n' }])).toEqual(['a.sysml:0 A', 'a.sysml:1 A']);
    });

    it('flags same-kind members of a package two documents declare, one namespace', async () => {
        expect(await clashes([
            { uri: 'file:///w/a.sysml', text: 'package P { part def A; }\n' },
            { uri: 'file:///w/b.sysml', text: 'package P { part def A; }\n' },
        ])).toEqual(['a.sysml:0 A', 'b.sysml:0 A']);
    });

    it('flags same-kind members of an anonymous element, and a name clashing with a short name', async () => {
        expect(await clashes([{ uri: 'file:///w/a.sysml', text: `package P {
    part a { port p; }
    part b { port p; }
    interface a.p to b.p { part x; part x; }
    part def <S> First;
    part def S;
}
` }])).toEqual(['a.sysml:3 x', 'a.sysml:3 x', 'a.sysml:4 S', 'a.sysml:5 S']);
    });

    it('does not flag a package and a definition of one name, nor two declarations of one package', async () => {
        expect(await clashes([{ uri: 'file:///w/a.sysml', text: 'package P { package A; part def A; package A; }\n' }])).toEqual([]);
    });
});

describe('the structure of each declaration, not of its qualified name', () => {
    /** `sysml/model`'s element tree of `text`, each node as its name and children. */
    async function tree(text: string): Promise<unknown> {
        const { DocumentManager } = await import('../../server/src/documentManager.js');
        const { SysMLModelProvider } = await import('../../server/src/model/sysmlModelProvider.js');
        const { TextDocument } = await import('vscode-languageserver-textdocument');
        const dm = new DocumentManager();
        dm.parse(TextDocument.create('file:///w/a.sysml', 'sysml', 1, text));
        const model = new SysMLModelProvider(dm).getModel('file:///w/a.sysml', 1, ['elements']);
        type Node = { name: string; children: Node[] };
        const shape = (node: Node): unknown => node.children.length ? { [node.name]: node.children.map(shape) } : node.name;
        return (model.elements as Node[]).map(shape);
    }

    it('lists in `sysml/model` only the children each of two same-named declarations declares', async () => {
        expect(await tree(`package P {
    part def A { part x; }
    part def A { part y; }
    package Q { part def m; }
    package Q { part def n; }
}
`)).toEqual([{ P: [{ A: ['x'] }, { A: ['y'] }, { Q: ['m'] }, { Q: ['n'] }] }]);
    });

    it('checks the definitions of each of two same-named declarations for duplicates apart', async () => {
        const { DocumentManager } = await import('../../server/src/documentManager.js');
        const { SemanticValidator } = await import('../../server/src/providers/semanticValidator.js');
        const { TextDocument } = await import('vscode-languageserver-textdocument');
        const dm = new DocumentManager();
        const text = 'package P {\n    part def A {\n        part def X;\n    }\n    part def A {\n        part def X;\n    }\n    part def B {\n        part def Y;\n        part def Y;\n    }\n}\n';
        dm.parse(TextDocument.create('file:///w/a.sysml', 'sysml', 1, text));
        const duplicates = new SemanticValidator(dm).validate('file:///w/a.sysml')
            .filter(d => d.code === 'duplicate-definition').map(d => d.range.start.line);
        // The two `A`s are duplicates in `P`, the two `Y`s in `B`; each `X` is the only one in its `A`.
        expect([...new Set(duplicates)].sort((x, y) => x - y)).toEqual([1, 4, 8, 9]);
    });
});

describe('the symbol table over the element registry', () => {
    it('gives a package declared twice in one document one symbol, with the imports and first documentation of both', () => {
        const st = new SymbolTable();
        st.build('file:///w/a.sysml', parseDocument(`package L {
    package A { doc /* first */ private import X::x; }
    package A { doc /* second */ private import Y::y; }
}
package X { part def x; }
package Y { part def y; }
`));
        const a = st.getSymbol('L::A')!;
        expect(a.importTargets!.map(i => i.target)).toEqual(['X::x', 'Y::y']);
        expect(a.documentation).toBe('first');
        expect(st.getSymbolById(a.symbolId)).toBe(a);
        expect(st.getAllSymbols().filter(s => s.qualifiedName === 'L::A')).toEqual([a]);
        // Each declaration is still a symbol of its document, with the package's ID.
        expect(st.getSymbolsForUri('file:///w/a.sysml').filter(s => s.name === 'A').map(s => s.symbolId)).toEqual([a.symbolId, a.symbolId]);
    });

    it('lists one symbol per element, and finds every one by its ID', () => {
        const st = new SymbolTable();
        st.buildAll([
            ['file:///w/a.sysml', parseDocument('package P { part def A; part def A; connect x to y; }\n')],
            ['file:///w/b.sysml', parseDocument('package P { part def B; }\n')],
        ]);
        const all = st.getAllSymbols();
        expect(all.map(s => s.name || s.declaration)).toEqual(['P', 'A', 'A', 'B', 'connect x to y']);
        for (const s of all) expect(st.getSymbolById(s.symbolId)).toBe(s);
    });
});

describe('navigation resolves a name as `sysml/model` does', () => {
    /** Each document parsed, and what the token at `needle` (its `n`th occurrence, `offset` into it) resolves to. */
    async function navigation(documents: Array<{ uri: string; text: string }>) {
        const { DocumentManager } = await import('../../server/src/documentManager.js');
        const { NameReferences } = await import('../../server/src/symbols/nameReferences.js');
        const { TextDocument } = await import('vscode-languageserver-textdocument');
        const dm = new DocumentManager();
        for (const { uri, text } of documents) dm.parse(TextDocument.create(uri, 'sysml', 1, text));
        const [{ uri, text }] = documents;
        const positionOf = (needle: string, offset: number) => {
            const index = text.indexOf(needle) + offset;
            const before = text.slice(0, index).split('\n');
            return { line: before.length - 1, character: before[before.length - 1].length };
        };
        const references = new NameReferences(dm);
        return {
            /** The element the token resolves to, as its kind and line. */
            at(needle: string, offset = 0): string | undefined {
                const symbol = references.at(uri, positionOf(needle, offset))?.symbol;
                return symbol && `${symbol.kind}:${symbol.range.start.line}`;
            },
            /** The lines of the references to the element declared at `needle`. */
            to(needle: string, offset = 0): number[] {
                const symbol = references.at(uri, positionOf(needle, offset))?.symbol;
                return symbol ? references.to(symbol, false).map(r => r.range.start.line).sort((a, b) => a - b) : [];
            },
        };
    }

    const packageFirst = `package Q {
    package B { part def b; }
    part def B { part bb; }
    part def C :> B;
    part y : B;
    part z :> B::bb;
    part x : B::b;
}
`;
    const definitionFirst = `package Q {
    part def B { part bb; }
    package B { part def b; }
    part def C :> B;
    part y : B;
    part z :> B::bb;
    part x : B::b;
}
`;

    it('resolves a general named like a package and a definition to the definition, in either order (KerML 8.3.3.1.8)', async () => {
        for (const [text, definitionLine] of [[packageFirst, 2], [definitionFirst, 1]] as const) {
            const { at } = await navigation([{ uri: 'file:///w/a.sysml', text }]);
            expect(at(':> B;', 3)).toBe(`part def:${definitionLine}`);
            expect(at(': B;', 2)).toBe(`part def:${definitionLine}`);
        }
    });

    it('resolves a qualified name through the qualifier having its last name, and the qualifier to that one', async () => {
        for (const [text, definitionLine, packageLine] of [[packageFirst, 2, 1], [definitionFirst, 1, 2]] as const) {
            const { at } = await navigation([{ uri: 'file:///w/a.sysml', text }]);
            expect(at('B::bb', 3)).toBe(`part:${definitionLine}`);
            expect(at('B::bb', 0)).toBe(`part def:${definitionLine}`);
            expect(at('B::b;', 3)).toBe(`part def:${packageLine}`);
            expect(at('B::b;', 0)).toBe(`package:${packageLine}`);
        }
    });

    it('lists as references of the definition only the names resolving to it, not the package\'s', async () => {
        for (const text of [packageFirst, definitionFirst]) {
            const { to } = await navigation([{ uri: 'file:///w/a.sysml', text }]);
            expect(to('part def B', 9)).toEqual([3, 4, 5]);
            expect(to('package B', 8)).toEqual([6]);
        }
    });
});

describe('navigation through a package and a same-named definition, in either declaration order', () => {
    /** Whether navigation finds no single element for the token at `needle` (`offset` into it) of `text`. */
    async function navigationAt(text: string, needle: string, offset: number) {
        const { DocumentManager } = await import('../../server/src/documentManager.js');
        const { NameReferences } = await import('../../server/src/symbols/nameReferences.js');
        const { TextDocument } = await import('vscode-languageserver-textdocument');
        const dm = new DocumentManager();
        dm.parse(TextDocument.create('file:///w/a.sysml', 'sysml', 1, text));
        const index = text.indexOf(needle) + offset;
        const before = text.slice(0, index).split('\n');
        const reference = new NameReferences(dm).at('file:///w/a.sysml', { line: before.length - 1, character: before[before.length - 1].length });
        return { symbol: reference?.symbol && `${reference.symbol.kind}:${reference.symbol.range.start.line}`, ambiguous: reference?.isAmbiguous ?? false };
    }

    const orders = [['package K { part def Inner; }', 'part def K { part def Inner; }'], ['part def K { part def Inner; }', 'package K { part def Inner; }']];

    it('finds no single element for a qualified name each of them owns the last name of', async () => {
        for (const [first, second] of orders) {
            const text = `package W {\n    ${first}\n    ${second}\n    part y : K::Inner;\n}\n`;
            expect(await navigationAt(text, 'K::Inner', 3), first).toEqual({ symbol: undefined, ambiguous: true });
            expect(await navigationAt(text, 'K::Inner', 0), first).toEqual({ symbol: undefined, ambiguous: true });
        }
    });

    it('finds no single element for an import of both, though the import imports from each', async () => {
        for (const [first, second] of orders) {
            const text = `package W {\n    ${first}\n    ${second}\n    package U { private import K::*; part u : Inner; }\n}\n`;
            expect(await navigationAt(text, 'K::*', 0), first).toEqual({ symbol: undefined, ambiguous: true });
        }
    });

    it('goes to the one element an import names, and resolves a name in its filter as a reference', async () => {
        const text = 'package W {\n    metadata def K;\n    package L { part def a; }\n    package U { private import L::*[@K]; }\n}\n';
        expect(await navigationAt(text, 'L::*', 0)).toEqual({ symbol: 'package:2', ambiguous: false });
        expect(await navigationAt(text, '@K', 1)).toEqual({ symbol: 'metadata def:1', ambiguous: false });
    });
});

describe('duplicate definitions over every declaration of a namespace (KerML 8.3.2.4.3)', () => {
    /** The `duplicate-definition` diagnostics of each document, as `line message`. */
    async function duplicates(documents: Array<{ uri: string; text: string }>): Promise<Record<string, string[]>> {
        const { DocumentManager } = await import('../../server/src/documentManager.js');
        const { SemanticValidator } = await import('../../server/src/providers/semanticValidator.js');
        const { TextDocument } = await import('vscode-languageserver-textdocument');
        const dm = new DocumentManager();
        for (const { uri, text } of documents) dm.parse(TextDocument.create(uri, 'sysml', 1, text));
        const validator = new SemanticValidator(dm);
        return Object.fromEntries(documents.map(({ uri }) => [uri.split('/').pop(), validator.validate(uri)
            .filter(d => d.code === 'duplicate-definition').map(d => `${d.range.start.line} ${d.message}`).sort()]));
    }

    it('counts the definitions of a package declared in two documents in both', async () => {
        expect(await duplicates([
            { uri: 'file:///w/a.sysml', text: 'package M {\n    part def D;\n    part def D;\n}\n' },
            { uri: 'file:///w/b.sysml', text: 'package M {\n    part def D;\n}\n' },
        ])).toEqual({
            'a.sysml': [`1 Duplicate definition: 'D' is defined 3 times in the same scope`, `2 Duplicate definition: 'D' is defined 3 times in the same scope`],
            'b.sysml': [`1 Duplicate definition: 'D' is defined 3 times in the same scope`],
        });
    });

    it('counts the top-level definitions of two documents, members of the one root namespace', async () => {
        expect(await duplicates([
            { uri: 'file:///w/a.sysml', text: 'part def W;\n' },
            { uri: 'file:///w/b.sysml', text: 'part def W;\n' },
        ])).toEqual({
            'a.sysml': [`0 Duplicate definition: 'W' is defined 2 times in the same scope`],
            'b.sysml': [`0 Duplicate definition: 'W' is defined 2 times in the same scope`],
        });
    });

    it('does not count same-named definitions of two namespaces, nor a definition and a usage', async () => {
        expect(await duplicates([
            { uri: 'file:///w/a.sysml', text: 'package M { part def D; part D; }\npackage N { part def D; }\n' },
            { uri: 'file:///w/b.sysml', text: 'package O { part def D; }\n' },
        ])).toEqual({ 'a.sysml': [], 'b.sysml': [] });
    });
});
