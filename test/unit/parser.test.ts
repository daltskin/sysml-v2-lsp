import { readFileSync } from 'fs';
import { join } from 'path';
import { beforeAll, describe, expect, it } from 'vitest';

// Note: These tests require the ANTLR-generated parser to be present.
// Run `npm run generate` before running tests.

describe('Parser', () => {
    const fixturesDir = join(__dirname, '..', 'fixtures');

    // Load the DFA snapshot before tests to avoid cold-DFA timeouts.
    beforeAll(async () => {
        const { loadDFASnapshot } = await import('../../server/src/parser/dfaLoader.js');
        loadDFASnapshot();
    });

    it('should parse a valid vehicle model without errors', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const text = readFileSync(join(fixturesDir, 'valid', 'vehicle.sysml'), 'utf-8');
        const result = parseDocument(text);

        expect(result.tree).not.toBeNull();
        expect(result.errors.length).toBe(0);
    });

    it('should parse a valid camera model without errors', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const text = readFileSync(join(fixturesDir, 'valid', 'camera.sysml'), 'utf-8');
        const result = parseDocument(text);

        expect(result.tree).not.toBeNull();
        expect(result.errors.length).toBe(0);
    });

    it('should report errors for invalid syntax', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const text = readFileSync(join(fixturesDir, 'invalid', 'syntax-error.sysml'), 'utf-8');
        const result = parseDocument(text);

        expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return a token stream', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const result = parseDocument('package Test { }');

        expect(result.tokenStream).toBeDefined();
        result.tokenStream.fill();
        expect(result.tokenStream.getTokens().length).toBeGreaterThan(0);
    });
});
