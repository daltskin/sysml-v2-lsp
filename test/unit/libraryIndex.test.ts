import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Library Index', () => {
    beforeAll(async () => {
        const { initLibraryIndex } = await import('../../server/src/library/libraryIndex.js');
        // Server lives at dist/server/ — library is at ../../sysml.library/
        // In tests, pass the project root's server dir so the bundled lib is found.
        const serverDir = resolve(__dirname, '..', '..', 'dist', 'server');
        initLibraryIndex(serverDir);
    });

    describe('package resolution', () => {
        it('should resolve ScalarValues package', async () => {
            const { resolveLibraryPackage } = await import('../../server/src/library/libraryIndex.js');
            const uri = resolveLibraryPackage('ScalarValues');
            expect(uri).toBeDefined();
            expect(uri).toContain('ScalarValues.kerml');
        });

        it('should resolve qualified names by first segment', async () => {
            const { resolveLibraryPackage } = await import('../../server/src/library/libraryIndex.js');
            const uri = resolveLibraryPackage('ScalarValues::Real');
            expect(uri).toBeDefined();
            expect(uri).toContain('ScalarValues.kerml');
        });
    });

    describe('type resolution', () => {
        it('should resolve Real to ScalarValues.kerml with a line number', async () => {
            const { resolveLibraryType } = await import('../../server/src/library/libraryIndex.js');
            const loc = resolveLibraryType('Real');
            expect(loc).toBeDefined();
            expect(loc!.uri).toContain('ScalarValues.kerml');
            expect(loc!.line).toBeGreaterThan(0);
        });

        it('should resolve String', async () => {
            const { resolveLibraryType } = await import('../../server/src/library/libraryIndex.js');
            const loc = resolveLibraryType('String');
            expect(loc).toBeDefined();
            expect(loc!.uri).toContain('ScalarValues.kerml');
        });

        it('should resolve Boolean', async () => {
            const { resolveLibraryType } = await import('../../server/src/library/libraryIndex.js');
            const loc = resolveLibraryType('Boolean');
            expect(loc).toBeDefined();
            expect(loc!.uri).toContain('ScalarValues.kerml');
        });

        it('should resolve Integer', async () => {
            const { resolveLibraryType } = await import('../../server/src/library/libraryIndex.js');
            const loc = resolveLibraryType('Integer');
            expect(loc).toBeDefined();
            expect(loc!.uri).toContain('ScalarValues.kerml');
        });

        it('should resolve Natural', async () => {
            const { resolveLibraryType } = await import('../../server/src/library/libraryIndex.js');
            const loc = resolveLibraryType('Natural');
            expect(loc).toBeDefined();
        });

        it('should resolve DataValue from Base.kerml', async () => {
            const { resolveLibraryType } = await import('../../server/src/library/libraryIndex.js');
            const loc = resolveLibraryType('DataValue');
            expect(loc).toBeDefined();
            expect(loc!.uri).toContain('Base.kerml');
        });

        it('should return undefined for unknown types', async () => {
            const { resolveLibraryType } = await import('../../server/src/library/libraryIndex.js');
            const loc = resolveLibraryType('NonExistentType');
            expect(loc).toBeUndefined();
        });

        it('should resolve a quoted short name by the name inside its quotes, also qualified', async () => {
            // SI.sysml: attribute <'Ω'> ohm : ResistanceUnit = V/A;
            const { resolveLibraryType } = await import('../../server/src/library/libraryIndex.js');
            const ohm = resolveLibraryType('ohm');
            expect(ohm?.uri).toContain('SI.sysml');
            expect(resolveLibraryType('Ω')).toEqual(ohm);
            expect(resolveLibraryType('SI::Ω')).toEqual(ohm);
        });

        it('should resolve a quoted usage name in full, including its spaces', async () => {
            // USCustomaryUnits.sysml: attribute 'circular mil' : AreaUnit { ... }
            const { resolveLibraryType } = await import('../../server/src/library/libraryIndex.js');
            expect(resolveLibraryType('circular mil')?.uri).toContain('USCustomaryUnits.sysml');
            expect(resolveLibraryType('USCustomaryUnits::circular mil')?.uri).toContain('USCustomaryUnits.sysml');
        });

        it('should index no name with its quotes', async () => {
            const { getLibraryTypeNames } = await import('../../server/src/library/libraryIndex.js');
            expect(getLibraryTypeNames().filter(name => name.startsWith("'") || name.includes("::'"))).toEqual([]);
        });

        it('should list type names including scalar types', async () => {
            const { getLibraryTypeNames } = await import('../../server/src/library/libraryIndex.js');
            const names = getLibraryTypeNames();
            expect(names).toContain('Real');
            expect(names).toContain('String');
            expect(names).toContain('Boolean');
            expect(names).toContain('Integer');
            expect(names.length).toBeGreaterThan(10);
        });
    });
});

// Last in this file: it indexes its own library, then restores the bundled one.
describe('Library Index: quoted short names with punctuation', () => {
    let dir: string;
    beforeAll(async () => {
        const { initLibraryIndex } = await import('../../server/src/library/libraryIndex.js');
        dir = mkdtempSync(join(tmpdir(), 'quoted-library-'));
        writeFileSync(join(dir, 'QuotedNames.sysml'), [
            'standard library package QuotedNames {',
            '    attribute def Unit;',
            "    attribute <'A : B'> colonUnit : Unit;",
            "    attribute <'A > B'> greaterUnit : Unit;",
            "    attribute <'A\\'B'> quoteUnit : Unit;",
            "    attribute <'A :> B'> subsetUnit : Unit;",
            "    attribute <'A :>> B'> redefineUnit : Unit;",
            "    attribute <S> 'long \\' name' : Unit;",
            '    attribute afterAll : Unit;',
            '}',
            '',
        ].join('\n'));
        initLibraryIndex(resolve(__dirname, '..', '..', 'dist', 'server'), dir);
    });

    afterAll(async () => {
        const { initLibraryIndex } = await import('../../server/src/library/libraryIndex.js');
        initLibraryIndex(resolve(__dirname, '..', '..', 'dist', 'server'));
        rmSync(dir, { recursive: true, force: true });
    });

    it.each([
        ['a colon', 'A : B', 'colonUnit'],
        ['a greater-than sign, which does not end the short name', 'A > B', 'greaterUnit'],
        ['an escaped quote, kept as written like the symbol table keeps it', "A\\'B", 'quoteUnit'],
        ['a subsetting symbol', 'A :> B', 'subsetUnit'],
        ['a redefinition symbol', 'A :>> B', 'redefineUnit'],
    ])('resolves a short name with %s', async (_case, shortName, name) => {
        const { resolveLibraryType } = await import('../../server/src/library/libraryIndex.js');
        const declaration = resolveLibraryType(name);
        expect(declaration).toBeDefined();
        expect(resolveLibraryType(shortName)).toEqual(declaration);
        expect(resolveLibraryType(`QuotedNames::${shortName}`)).toEqual(declaration);
    });

    it('reads a quoted long name with an escaped quote to its end', async () => {
        const { resolveLibraryType } = await import('../../server/src/library/libraryIndex.js');
        expect(resolveLibraryType('S')?.line).toBe(7);
        expect(resolveLibraryType('afterAll')?.line).toBe(8);
    });
});
