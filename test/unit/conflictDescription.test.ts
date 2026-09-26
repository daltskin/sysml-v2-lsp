import { describe, expect, it } from 'vitest';
import { describeConflictingDeclarations, describeDocumentLocation, otherDeclarations } from '../../server/src/symbols/namespaceResolver.js';
import { SysMLElementKind, type SysMLSymbol } from '../../server/src/symbols/sysmlElements.js';

/** Just the fields the description reads. */
function symbol(uri: string, line: number, kind = SysMLElementKind.PartDef): SysMLSymbol {
    const range = { start: { line, character: 0 }, end: { line, character: 1 } };
    return { uri, kind, name: 'A', qualifiedName: 'A', range, selectionRange: range } as unknown as SysMLSymbol;
}

describe('describeDocumentLocation', () => {
    it('is "this document" for the diagnosed document itself', () => {
        expect(describeDocumentLocation('file:///ws/a.sysml', 'file:///ws/a.sysml')).toBe('this document');
    });

    it('is a relative URI reference from the diagnosed document, whatever the (shared) scheme', () => {
        expect(describeDocumentLocation('file:///ws/b.sysml', 'file:///ws/a.sysml')).toBe('b.sysml');
        expect(describeDocumentLocation('file:///ws/lib/b.sysml', 'file:///ws/a.sysml')).toBe('lib/b.sysml');
        expect(describeDocumentLocation('file:///ws/b.sysml', 'file:///ws/sub/a.sysml')).toBe('../b.sysml');
        expect(describeDocumentLocation('file:///ws/my%20lib/b.sysml', 'file:///ws/a.sysml')).toBe('my lib/b.sysml');
        expect(describeDocumentLocation('memfs:/project/lib/b.sysml', 'memfs:/project/a.sysml')).toBe('lib/b.sysml');
    });

    it('is the full URI when scheme or authority differ, or a URI does not parse', () => {
        expect(describeDocumentLocation('untitled:Untitled-1', 'file:///ws/a.sysml')).toBe('untitled:Untitled-1');
        expect(describeDocumentLocation('https://host-b/b.sysml', 'https://host-a/a.sysml')).toBe('https://host-b/b.sysml');
        expect(describeDocumentLocation('not a uri', 'file:///ws/a.sysml')).toBe('not a uri');
    });
});

describe('describeConflictingDeclarations', () => {
    it("lists each other declaration's kind, location and 1-based line", () => {
        expect(describeConflictingDeclarations([symbol('file:///ws/b.sysml', 2)], 'file:///ws/a.sysml')).toBe('part def in document b.sysml (line 3)');
    });

    it('names only the first of several, then counts the rest as other occurrences', () => {
        const two = [symbol('file:///ws/b.sysml', 0), symbol('file:///ws/a.sysml', 9)];
        expect(describeConflictingDeclarations(two, 'file:///ws/a.sysml')).toBe('part def in document b.sysml (line 1) and 1 other occurrence');

        const three = [...two, symbol('file:///ws/c.sysml', 4)];
        expect(describeConflictingDeclarations(three, 'file:///ws/a.sysml')).toBe('part def in document b.sysml (line 1) and 2 other occurrences');
    });
});

describe('otherDeclarations', () => {
    it('leaves out the declaration itself by document and position -- also a copy of it from another symbol table', () => {
        const self = symbol('file:///ws/a.sysml', 0);
        const copyOfSelf = symbol('file:///ws/a.sysml', 0);
        const other = symbol('file:///ws/b.sysml', 0);
        expect(otherDeclarations([copyOfSelf, other], self)).toEqual([other]);
    });

    it('orders the rest by document URI, then line', () => {
        const self = symbol('file:///ws/a.sysml', 0);
        const d = symbol('file:///ws/d.sysml', 0);
        const b5 = symbol('file:///ws/b.sysml', 5);
        const b1 = symbol('file:///ws/b.sysml', 1);
        expect(otherDeclarations([d, self, b5, b1], self)).toEqual([b1, b5, d]);
    });
});
