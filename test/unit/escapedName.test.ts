/**
 * Tests for writing names as KerML `escapedName()` does (KerML 8.3.2.1.2), for qualified names
 * reported by the server, and for reading a qualified name written in the textual notation
 * (KerML 8.2.3.5.1).
 */
import { describe, expect, it } from 'vitest';
import {
    escapedName, escapedQualifiedName, joinQualifiedName, joinReference, parseQualifiedName,
} from '../../server/src/utils/identUtils.js';
import { SYSML_KEYWORDS, SYSML_RESERVED_KEYWORDS } from '../../server/src/utils/sysmlKeywords.js';

describe('escapedName', () => {
    it('keeps a basic name, including one spelled like an unreserved keyword of the grammar', () => {
        for (const name of ['Vehicle', '_x1', 'type', 'feature', 'var', 'language']) expect(escapedName(name)).toBe(name);
    });

    it('quotes a name spelled like a reserved keyword (SysML v2 7.2.2, 8.2.2.1.2)', () => {
        for (const name of ['part', 'specializes', 'true', 'class']) expect(escapedName(name)).toBe(`'${name}'`);
    });

    it('quotes a name that has not the form of a basic name', () => {
        expect(escapedName('P-1')).toBe("'P-1'");
        expect(escapedName('Part Def')).toBe("'Part Def'");
        expect(escapedName('a.b')).toBe("'a.b'");
        expect(escapedName('a::b')).toBe("'a::b'");
        expect(escapedName('~P')).toBe("'~P'");
        expect(escapedName('$')).toBe("'$'");
        expect(escapedName('1st')).toBe("'1st'");
        expect(escapedName('Ω')).toBe("'Ω'");
        expect(escapedName('')).toBe("''");
    });

    it('escapes a quote, a backslash and control characters (KerML 8.2.2.3)', () => {
        expect(escapedName("it's")).toBe("'it\\'s'");
        expect(escapedName('a\\b')).toBe("'a\\\\b'");
        expect(escapedName('a\tb\nc')).toBe("'a\\tb\\nc'");
    });

    it("takes the reserved keywords from the grammar: every lexer keyword its `name` rule doesn't accept", () => {
        const unreserved = ['type', 'multiplicity', 'var', 'language', 'locale', 'crosses', 'step', 'feature',
            'behavior', 'function', 'member', 'predicate', 'interaction', 'metaclass'];
        expect([...SYSML_KEYWORDS].filter(keyword => !SYSML_RESERVED_KEYWORDS.has(keyword)).sort()).toEqual(unreserved.sort());
        for (const keyword of SYSML_RESERVED_KEYWORDS) expect(SYSML_KEYWORDS.has(keyword)).toBe(true);
    });
});

describe('escapedQualifiedName', () => {
    it('writes each segment of an internal qualified name as escapedName() does', () => {
        expect(escapedQualifiedName(joinQualifiedName(['Q', 'P-1']))).toBe("Q::'P-1'");
        expect(escapedQualifiedName(joinQualifiedName(['Q', 'Part Def', 'part']))).toBe("Q::'Part Def'::'part'");
        expect(escapedQualifiedName(joinQualifiedName(['a::b', 'c']))).toBe("'a::b'::c");
        expect(escapedQualifiedName(joinQualifiedName(["it's", ' x ']))).toBe("'it\\'s'::' x '");
        expect(escapedQualifiedName(joinQualifiedName(['Q', 'Vehicle']))).toBe('Q::Vehicle');
    });
});

describe('joinReference', () => {
    it('writes each name as escapedName() does, with `$::`, `.` and `~` outside the quotes', () => {
        expect(joinReference([{ global: false, names: ['P-1'] }], true)).toBe("~'P-1'");
        expect(joinReference([{ global: false, names: ['Q', 'P-1'] }], true)).toBe("~Q::'P-1'");
        expect(joinReference([{ global: false, names: ['tank a'] }, { global: false, names: ['out-1'] }])).toBe("'tank a'.'out-1'");
        expect(joinReference([{ global: true, names: ['Q', 'part'] }])).toBe("$::Q::'part'");
        expect(joinReference([{ global: false, names: ['Q', 'type'] }])).toBe('Q::type');
        expect(joinReference([{ global: false, names: ['Q', 'class'] }])).toBe("Q::'class'");
    });
});

describe('parseQualifiedName', () => {
    it('reads basic and unrestricted names, separated by `::`', () => {
        expect(parseQualifiedName("Q::'P-1'")).toEqual(['Q', 'P-1']);
        expect(parseQualifiedName("Q::'part'")).toEqual(['Q', 'part']);
        expect(parseQualifiedName("'Vehicle'")).toEqual(['Vehicle']);
        expect(parseQualifiedName('Q::type')).toEqual(['Q', 'type']);
        expect(parseQualifiedName("Q::'class'")).toEqual(['Q', 'class']);
        expect(parseQualifiedName("'a::b'::c")).toEqual(['a::b', 'c']);
        expect(parseQualifiedName("'it\\'s'::'a\\\\b'")).toEqual(["it's", 'a\\b']);
        expect(parseQualifiedName("''")).toEqual(['']);
        expect(parseQualifiedName("Q :: 'P-1'")).toEqual(['Q', 'P-1']);
    });

    it('reads nothing from text that is not a qualified name', () => {
        for (const text of ['', 'Q::P-1', 'Q::part', 'Q::class', 'Part Def', 'Q::', '::Q', 'Q:::R', "Q::'open", '$::Q', 'a.b', '~P']) {
            expect(parseQualifiedName(text)).toBeUndefined();
        }
    });

    it('reads back what escapedQualifiedName() writes', () => {
        const names = ['Q', 'P-1', 'part', 'a::b', "it's", '', 'Ω', 'type'];
        expect(parseQualifiedName(escapedQualifiedName(joinQualifiedName(names)))).toEqual(names);
    });
});
