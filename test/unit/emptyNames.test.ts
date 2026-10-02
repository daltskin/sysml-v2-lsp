import { describe, expect, it } from 'vitest';

// An unrestricted name is "a non-empty sequence of characters surrounded by
// single quotes" (SysML v2 7.2.2): `''` is not a name.
const cases = [
    { text: "package D { part ''; }", positions: [[0, 17]] },
    { text: "package D { part def P; part '' : P; }", positions: [[0, 29]] },
    { text: "package D { part def ''; part x : ''; }", positions: [[0, 21], [0, 34]] },
] as const;

/** The start (line, character) of each `empty-name` diagnostic. */
function positionsOf(diagnostics: Array<{ code?: unknown; range: { start: { line: number; character: number } } }>) {
    return diagnostics.filter((d) => d.code === 'empty-name').map((d) => [d.range.start.line, d.range.start.character]);
}

describe('empty quoted names', () => {
    it.each(cases)('reports each `\'\'` in `$text` as an error', async ({ text, positions }) => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const { validateKeywords } = await import('../../server/src/providers/keywordValidator.js');
        const diagnostics = validateKeywords(parseDocument(text));
        expect(positionsOf(diagnostics)).toEqual(positions);
        expect(diagnostics.find((d) => d.code === 'empty-name')).toMatchObject({
            severity: 1,
            message: "Empty name '': a name in single quotes must contain at least one character",
        });
    });

    it.each(cases)('reports each `\'\'` in `$text` from the parse worker too', async ({ text, positions }) => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const { validateKeywordsFromTokens } = await import('../../server/src/parser/parseWorker.js');
        expect(positionsOf(validateKeywordsFromTokens(parseDocument(text).tokenStream))).toEqual(positions);
    });

    it('does not report a quoted name with at least one character', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const { validateKeywords } = await import('../../server/src/providers/keywordValidator.js');
        expect(positionsOf(validateKeywords(parseDocument("package D { part ' '; part 'a b'; }")))).toEqual([]);
    });

    it.each([
        ["part '';", "part ''"],
        ["part '' : P;", ': P'],
        ["part def '';", "part def ''"],
    ])('treats `%s` as anonymous, shown as `%s`', async (body, shown) => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
        const { displayName, isAnonymous } = await import('../../server/src/symbols/sysmlElements.js');
        const st = new SymbolTable();
        st.build('test://t.sysml', parseDocument(`package D { part def P; ${body} }`));
        const [element] = st.getSymbolsForUri('test://t.sysml').filter((s) => isAnonymous(s));
        expect([element.name, element.qualifiedName, displayName(element)]).toEqual(['', undefined, shown]);
    });

    it('keeps an element typed by `\'\'` named, with nothing to resolve its type to', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
        const st = new SymbolTable();
        st.build('test://t.sysml', parseDocument("package D { part def ''; part x : ''; }"));
        expect(st.getSymbol('D::x')?.kind).toBe('part');
        expect(st.findByName('')).toEqual([]);
    });
});
