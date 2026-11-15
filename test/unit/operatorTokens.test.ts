import { describe, expect, it } from 'vitest';

// Every symbol of the notation (KerML 8.2.2.7) that isn't punctuation is an operator: the symbolic
// forms of the special lexical terminals (SysML 8.2.2.1.2: SPECIALIZES, SUBSETS, REFERENCES,
// CROSSES, REDEFINES), the feature value operators `=` and `:=`, the multiplicity range `..`
// (KerML 8.2.4.2) and the expression operators (KerML 8.2.5.8.1, Table 5).
const lines = [
    'package Ops {',
    '    metadata def Safety;',
    '    part def Wheel { attribute w; }',
    '    part def Vehicle {',
    '        part wheels : Wheel [2..4];',
    '        ref part spare ::> wheels;',
    '        attribute count := 4;',
    '        attribute a1 = count >= 3;',
    '        attribute a2 = count <= 3;',
    '        attribute a3 = count === 3;',
    '        attribute a4 = count ?? 0;',
    '        attribute a5 = count % 2;',
    '        attribute a6 = if count > 1 ? 1 else 0;',
    '        attribute a7 = wheels.?{ in x; true };',
    '        attribute a8 = wheels @ Wheel;',
    '        attribute a9 = wheels @@ Safety;',
    '        attribute a10 = count == 3;',
    '        part p3 : $::Ops::Wheel;',
    '        #Safety part p4;',
    '        attribute small :> count;',
    '        part w2 : Wheel { attribute :>> w; }',
    '    }',
    '    connection def Axle {',
    '        end part left : Wheel [1] => Vehicle::wheels;',
    '    }',
    '    /* a ::> b := c [1..2] */',
    '    attribute s = "x ::> y := z";',
    '}',
];
const text = lines.join('\n');

/** An expected operator: its lexer token name, its line, and the text just before it on that line. */
type Occurrence = [token: string, line: number, before: string];

/** Symbols that had no semantic token. */
const operators: Occurrence[] = [
    ['DOT_DOT', 4, 'Wheel [2'],
    ['COLON_COLON_GT', 5, 'spare '],
    ['COLON_EQ', 6, 'count '],
    ['GE', 7, 'count '],
    ['LE', 8, 'count '],
    ['EQ_EQ_EQ', 9, 'count '],
    ['QUESTION_QUESTION', 10, 'count '],
    ['PERCENT', 11, 'count '],
    ['QUESTION', 12, '1 '],
    ['DOT_QUESTION', 13, 'wheels'],
    ['AT_SIGN', 14, 'wheels '],
    ['AT_AT', 15, 'wheels '],
    ['DOLLAR', 17, 'p3 : '],
    ['HASH', 18, '        '],
    ['FAT_ARROW', 23, '[1] '],
];
/** Symbols that were operators already, and stay so. */
const unchanged: Occurrence[] = [
    ['EQ', 7, 'a1 '],
    ['EQ_EQ', 16, 'count '],
    ['COLON_GT', 19, 'small '],
    ['COLON_GT_GT', 20, 'attribute '],
    ['COLON_COLON', 17, '$'],
    ['GT', 12, 'count '],
];

/**
 * The special lexical terminals with a symbolic form (SysML 8.2.2.1.2; CONJUGATES from KerML
 * 8.2.2.7), and the lexer token of that symbol.
 */
const specialTerminals: Array<[terminal: string, symbol: string, token: string]> = [
    ['SPECIALIZES', ':>', 'COLON_GT'],
    ['SUBSETS', ':>', 'COLON_GT'],
    ['REFERENCES', '::>', 'COLON_COLON_GT'],
    ['CROSSES', '=>', 'FAT_ARROW'],
    ['REDEFINES', ':>>', 'COLON_GT_GT'],
    ['CONJUGATES', '~', 'TILDE'],
];

/** The symbol tokens of the notation, as listed in KerML 8.2.2.7. */
const specSymbols = '( ) { } [ ] ; , ~ @ # % & ^ | * ** + - / -> $ . .. : :: :> :>> ::> => < <= = := == === != !== > >= ? ?? .?'.split(' ');

async function lexer() {
    const { CharStream } = await import('antlr4ng');
    const { SysMLv2Lexer } = await import('../../server/src/generated/SysMLv2Lexer.js');
    /** The tokens of `source` on the default channel. */
    const lex = (source: string) => new SysMLv2Lexer(CharStream.fromString(source)).getAllTokens().filter((token) => token.channel === 0);
    /** The lexer token type named `name`. */
    const typeOf = (name: string): number => {
        const type = SysMLv2Lexer.symbolicNames.indexOf(name);
        expect(type, `lexer token ${name}`).toBeGreaterThan(0);
        return type;
    };
    /** The symbol of the lexer token named `name`, without the grammar's quotes. */
    const symbolOf = (name: string): string => SysMLv2Lexer.literalNames[typeOf(name)]!.slice(1, -1);
    return { SysMLv2Lexer, lex, typeOf, symbolOf };
}

/** The `line:character:text` of each token of `data` with the semantic token type `type`. */
function tokensOfType(data: number[], type: number): string[] {
    const found: string[] = [];
    let line = 0;
    let character = 0;
    for (let i = 0; i < data.length; i += 5) {
        line += data[i];
        character = data[i] === 0 ? character + data[i + 1] : data[i + 1];
        if (data[i + 3] === type) found.push(`${line}:${character}:${lines[line].substr(character, data[i + 2])}`);
    }
    return found;
}

/** The `line:character:text` of the symbol of lexer token `token`, written right after `before`. */
async function at([token, line, before]: Occurrence): Promise<string> {
    const symbol = (await lexer()).symbolOf(token);
    const index = lines[line].indexOf(before + symbol);
    expect(index, `'${before}${symbol}' on line ${line}`).toBeGreaterThanOrEqual(0);
    return `${line}:${index + before.length}:${symbol}`;
}

async function operatorType(): Promise<number> {
    const { tokenTypes } = await import('../../server/src/providers/semanticTokensProvider.js');
    return tokenTypes.indexOf('operator');
}

async function providerData(): Promise<number[]> {
    const { DocumentManager } = await import('../../server/src/documentManager.js');
    const { SemanticTokensProvider } = await import('../../server/src/providers/semanticTokensProvider.js');
    const { TextDocument } = await import('vscode-languageserver-textdocument');
    const dm = new DocumentManager();
    dm.parse(TextDocument.create('test://ops.sysml', 'sysml', 1, text));
    return new SemanticTokensProvider(dm).provideSemanticTokens({ textDocument: { uri: 'test://ops.sysml' } }).data;
}

describe('operator semantic tokens', () => {
    it('parses the example without syntax errors', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        expect(parseDocument(text).errors).toEqual([]);
    });

    it.each([...operators, ...unchanged])('gives %s on line %i the operator token', async (...occurrence) => {
        const found = tokensOfType(await providerData(), await operatorType());
        expect(found).toContain(await at(occurrence));
    });

    it('gives no operator token inside a comment or a string', async () => {
        const found = tokensOfType(await providerData(), await operatorType());
        expect(found.filter((token) => token.startsWith('25:') || token.startsWith('26:'))).toEqual(['26:16:=']);
    });

    it('gives the parse worker the same operator tokens as the provider', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const { buildSemanticTokenData } = await import('../../server/src/parser/parseWorker.js');
        const type = await operatorType();
        const fromWorker = tokensOfType(buildSemanticTokenData(parseDocument(text).tokenStream), type);
        expect(fromWorker).toEqual(tokensOfType(await providerData(), type));
        for (const occurrence of operators) expect(fromWorker).toContain(await at(occurrence));
    });
});

describe('symbol token classification', () => {
    it.each(specialTerminals)('gives the symbol of %s (`%s`, %s) the operator token', async (_terminal, symbol, token) => {
        const { lex, typeOf } = await lexer();
        const { OPERATOR_TOKENS } = await import('../../server/src/utils/symbolTokens.js');
        expect(lex(symbol).map((t) => t.type)).toEqual([typeOf(token)]);
        expect(OPERATOR_TOKENS.has(typeOf(token))).toBe(true);
    });

    it('leaves the symbol of DEFINED_BY and TYPED_BY (`:`) punctuation', async () => {
        const { lex, typeOf } = await lexer();
        const { OPERATOR_TOKENS, PUNCTUATION_TOKENS } = await import('../../server/src/utils/symbolTokens.js');
        expect(lex(':').map((t) => t.type)).toEqual([typeOf('COLON')]);
        expect(PUNCTUATION_TOKENS.has(typeOf('COLON'))).toBe(true);
        expect(OPERATOR_TOKENS.has(typeOf('COLON'))).toBe(false);
    });

    it('puts every symbol of the specification in exactly one of the operator and punctuation sets', async () => {
        const { lex } = await lexer();
        const { OPERATOR_TOKENS, PUNCTUATION_TOKENS } = await import('../../server/src/utils/symbolTokens.js');
        expect(specSymbols).toHaveLength(43);
        const unclassified = specSymbols.filter((symbol) => {
            const tokens = lex(symbol);
            return tokens.length !== 1 || OPERATOR_TOKENS.has(tokens[0].type) === PUNCTUATION_TOKENS.has(tokens[0].type);
        });
        expect(unclassified).toEqual([]);
    });

    it('puts every symbol of the lexer in exactly one of the operator and punctuation sets', async () => {
        const { SysMLv2Lexer, lex } = await lexer();
        const { OPERATOR_TOKENS, PUNCTUATION_TOKENS } = await import('../../server/src/utils/symbolTokens.js');
        const symbols = SysMLv2Lexer.literalNames
            .map((literal, type) => ({ literal, type }))
            .filter(({ literal }) => literal && !/^'[A-Za-z]/.test(literal));
        expect(symbols.length).toBeGreaterThan(40);

        const unclassified: string[] = [];
        for (const { literal, type } of symbols) {
            // A symbol the lexer skips (a bare `//` comment) never reaches the token stream.
            if (!lex(literal!.slice(1, -1)).some((token) => token.type === type)) continue;
            if (OPERATOR_TOKENS.has(type) === PUNCTUATION_TOKENS.has(type)) unclassified.push(literal!);
        }
        expect(unclassified).toEqual([]);
    });
});
