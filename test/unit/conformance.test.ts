/**
 * SysML v2 Standard Library Parse Test
 *
 * Smoke test that parses every .sysml file from the bundled standard library
 * to verify the TypeScript ANTLR parser accepts all valid constructs.
 *
 * Full conformance testing (training, validation, examples) lives in the
 * sysml-v2-grammar repo: https://github.com/daltskin/sysml-v2-grammar
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, relative } from 'path';

// ── Helpers ──────────────────────────────────────────────────────────────────

const ROOT = join(__dirname, '..', '..');
const LIBRARY_DIR = join(ROOT, 'sysml.library');

/** Recursively find files by extension */
function findFiles(dir: string, extensions: string[]): string[] {
    if (!existsSync(dir)) return [];
    const results: string[] = [];

    function walk(d: string) {
        for (const entry of readdirSync(d, { withFileTypes: true })) {
            const full = join(d, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (extensions.some(ext => entry.name.endsWith(ext))) {
                results.push(full);
            }
        }
    }

    walk(dir);
    return results.sort();
}

/** Short display path relative to repo root */
function rel(filePath: string): string {
    return relative(ROOT, filePath);
}

interface ParseFailure {
    file: string;
    errorCount: number;
    firstError: string;
}

/**
 * Parse all files in a list and return failures.
 */
async function parseAllFiles(files: string[]): Promise<ParseFailure[]> {
    const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
    const failures: ParseFailure[] = [];

    for (const filePath of files) {
        const text = readFileSync(filePath, 'utf-8');
        const result = parseDocument(text);

        if (!result.tree || result.errors.length > 0) {
            failures.push({
                file: rel(filePath),
                errorCount: result.errors.length,
                firstError: result.errors[0]
                    ? `Line ${result.errors[0].line}: ${result.errors[0].message}`
                    : 'parse tree is null',
            });
        }
    }

    return failures;
}

function formatFailures(failures: ParseFailure[]): string {
    return failures
        .map(f => `  ✗ ${f.file} (${f.errorCount} error${f.errorCount !== 1 ? 's' : ''}) — ${f.firstError}`)
        .join('\n');
}

// ── Test Suite ───────────────────────────────────────────────────────────────

describe('Standard Library Parse Test', () => {
    const allFiles = findFiles(LIBRARY_DIR, ['.sysml']);

    it('should find standard library files', () => {
        expect(allFiles.length).toBeGreaterThan(0);
    });

    it(`should parse all ${allFiles.length} standard library .sysml files without syntax errors`, async () => {
        const failures = await parseAllFiles(allFiles);

        if (failures.length > 0) {
            expect.fail(
                `${failures.length} of ${allFiles.length} standard library files had parse errors:\n${formatFailures(failures)}`
            );
        }
    }, 300_000);
});
