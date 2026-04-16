import { resolve } from 'path';
import { beforeAll, describe, expect, it } from 'vitest';

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
