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
    describe('a root namespace per document (KerML 7.2.5.3, 8.2.3.5.4)', () => {
        const a = { uri: 'file:///w/a.sysml', text: 'part def T { part x; }\npart t : T;\npackage U { part u : T; }\n' };
        const b = { uri: 'file:///w/b.sysml', text: 'part def T { part x; }\npart t : T;\n' };
        const c = { uri: 'file:///w/c.sysml', text: 'part v : T;\n' };

        it('resolves a document\'s own top-level element from it, at the top level and nested', () => {
            const { from } = resolver([a, b, c]);
            expect(from(a.uri, 1, 'T')).toBe(`${a.uri}:0`);
            expect(from(a.uri, 2, 'T')).toBe(`${a.uri}:0`);
            expect(from(b.uri, 1, 'T')).toBe(`${b.uri}:0`);
        });

        it('leaves a name unresolved from another document that has more than one element of it to choose from', () => {
            expect(resolver([a, b, c]).from(c.uri, 0, 'T')).toBeUndefined();
        });

        it('resolves a name from another document that has only one element of it', () => {
            expect(resolver([a, c]).from(c.uri, 0, 'T')).toBe(`${a.uri}:0`);
        });
    });

    describe('imports at the top level of a document (KerML 7.2.5.3, SysML 7.5.5)', () => {
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

        it('does not make them visible in another document, nor in its declaration of a package both declare', () => {
            const a = { uri: 'file:///w/a.sysml', text: 'private import L::A::*;\npackage P { part x : m; }\n' };
            const b = { uri: 'file:///w/b.sysml', text: 'part u : m;\npackage P { part y : m; }\n' };
            const { from } = resolver([lib, a, b]);
            expect(from(a.uri, 1, 'm')).toBe(`${lib.uri}:0`);
            expect(from(b.uri, 0, 'm')).toBeUndefined();
            expect(from(b.uri, 1, 'm')).toBeUndefined();
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
