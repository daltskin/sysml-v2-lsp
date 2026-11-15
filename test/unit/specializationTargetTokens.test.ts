import { describe, expect, it } from 'vitest';

// The target of a specialization is a type or a feature by the production it is written in
// (SysML 8.2.2.6.5): an OwnedSubclassification's superClassifier and an OwnedFeatureTyping's type
// are types; the target of an OwnedSubsetting, OwnedReferenceSubsetting, OwnedCrossSubsetting and
// OwnedRedefinition, and each chainingFeature of an OwnedFeatureChain, is a feature. The symbol
// before it doesn't tell: `:>` is SPECIALIZES or SUBSETS (SysML 8.2.2.1.2).
const lines = [
    'package T {',
    "    part def A { part f; part g; part 'f 1'; part type; }",
    '    part def B1 :> A;',
    '    part def B2 specializes A, T::A;',
    '    part def B3 :> T::A;',
    '    part x1 : A;',
    '    part x2 defined by T::A;',
    '    part x3 typed by A;',
    '    part x4 : A, B1;',
    '    part y : A {',
    '        part s1 :> f;',
    '        part s2 subsets f, g;',
    '        part s3 :> A::f;',
    '        part :>> g;',
    '        part redefines f;',
    '        ref part r1 ::> f;',
    '        ref part r2 references f;',
    "        part s4 :> 'f 1';",
    '        part s5 :> type;',
    '    }',
    '    part c1 :> y.f;',
    '    part c2 : T::A;',
    '    part c3 :>> y.g;',
    '    part c4 : y.f;',
    '    connection def C {',
    '        end part e1 : A [1] => y.f;',
    '        end part e2 : A [1] crosses y.g;',
    '    }',
    '    connection conn connect y.f to y.g;',
    '    action def Act;',
    '    action act : Act;',
    '    part p { perform act; }',
    '    metadata def K;',
    '    #K part m1;',
    '    part m2 { @K; }',
    '    item def Sig;',
    '    flow of Sig from y.f to y.g;',
    '    state def S {',
    '        state s1; state s2;',
    '        transition first s1 accept sig : Sig then s2;',
    '    }',
    '    /* part q :> f; */',
    '    attribute v = y.f;',
    '    attribute u = "x :> f";',
    '    private import T::A;',
    '    calc def F { in v; }',
    '    attribute w = y->select {in x; F(x)};',
    '}',
];
const text = lines.join('\n');

/** A name expected to get a token: its line, the text just before it on that line, its text, and the token. */
type Expected = [line: number, before: string, name: string, token: string];

/** Targets that are types. */
const types: Expected[] = [
    [2, ':> ', 'A', 'type'],
    [3, 'specializes ', 'A', 'type'],
    [3, ', T::', 'A', 'type'],
    [4, ':> T::', 'A', 'type'],
    [5, ': ', 'A', 'type'],
    [6, 'defined by T::', 'A', 'type'],
    [7, 'typed by ', 'A', 'type'],
    [8, ': ', 'A', 'type'],
    [8, ', ', 'B1', 'type'],
    [21, ': T::', 'A', 'type'],
    [25, ': ', 'A', 'type'],
    [30, ': ', 'Act', 'type'],
    [33, '#', 'K', 'type'],
    [34, '@', 'K', 'type'],
    [36, 'of ', 'Sig', 'type'],
    [39, 'sig : ', 'Sig', 'type'],
];
/** Targets that are features, and the segments of a feature chain. */
const features: Expected[] = [
    [10, ':> ', 'f', 'variable'],
    [11, 'subsets ', 'f', 'variable'],
    [11, ', ', 'g', 'variable'],
    [12, ':> A::', 'f', 'variable'],
    [13, ':>> ', 'g', 'variable'],
    [14, 'redefines ', 'f', 'variable'],
    [15, '::> ', 'f', 'variable'],
    [16, 'references ', 'f', 'variable'],
    [17, ':> ', "'f 1'", 'variable'],
    [18, ':> ', 'type', 'variable'],
    [20, ':> ', 'y', 'variable'],
    [20, 'y.', 'f', 'variable'],
    [22, ':>> ', 'y', 'variable'],
    [22, 'y.', 'g', 'variable'],
    [23, ': ', 'y', 'variable'],
    [23, 'y.', 'f', 'variable'],
    [25, '=> ', 'y', 'variable'],
    [25, 'y.', 'f', 'variable'],
    [26, 'crosses ', 'y', 'variable'],
    [26, 'y.', 'g', 'variable'],
    [28, 'connect ', 'y', 'variable'],
    [28, 'connect y.', 'f', 'variable'],
    [28, 'to ', 'y', 'variable'],
    [28, 'to y.', 'g', 'variable'],
    [31, 'perform ', 'act', 'variable'],
];
/** Names outside these productions, whose token is unchanged. */
const unchanged: Expected[] = [
    [1, 'part def ', 'A', 'class'],
    [1, 'part ', 'f', 'variable'],
    [2, 'part def ', 'B1', 'class'],
    [9, 'part ', 'y', 'variable'],
    [10, 'part ', 's1', 'variable'],
    [30, 'action ', 'act', 'function'],
    [36, 'from ', 'y', 'variable'],
    [36, 'from y.', 'f', 'variable'],
    [39, 'accept ', 'sig', 'variable'],
    [42, 'attribute ', 'v', 'property'],
    [42, '= ', 'y', 'variable'],
    [42, '= y.', 'f', 'variable'],
    [44, 'import ', 'T', 'variable'],
    [44, 'T::', 'A', 'variable'],
    // The grammar parses the result of an expression body as a standalone `featureTyping`, which the
    // specification doesn't have (KerML 8.2.4.3.2): it is no typing target.
    [46, 'in x; ', 'F', 'variable'],
];

/** The semantic token of each token of `data` over `source`, by its `line:character:text`. */
async function tokensByPosition(data: number[], source: string[] = lines): Promise<Map<string, string>> {
    const { tokenTypes } = await import('../../server/src/providers/semanticTokensProvider.js');
    const found = new Map<string, string>();
    let line = 0;
    let character = 0;
    for (let i = 0; i < data.length; i += 5) {
        line += data[i];
        character = data[i] === 0 ? character + data[i + 1] : data[i + 1];
        found.set(`${line}:${character}:${source[line].substr(character, data[i + 2])}`, tokenTypes[data[i + 3]]);
    }
    return found;
}

/** The `line:character:text` of `name`, written right after `before` on line `line` of `source`. */
function at(line: number, before: string, name: string, source: string[] = lines): string {
    const index = source[line].indexOf(before + name);
    expect(index, `'${before}${name}' on line ${line}`).toBeGreaterThanOrEqual(0);
    return `${line}:${index + before.length}:${name}`;
}

async function providerTokens(source = lines): Promise<Map<string, string>> {
    const { DocumentManager } = await import('../../server/src/documentManager.js');
    const { SemanticTokensProvider } = await import('../../server/src/providers/semanticTokensProvider.js');
    const { TextDocument } = await import('vscode-languageserver-textdocument');
    const dm = new DocumentManager();
    dm.parse(TextDocument.create('test://targets.sysml', 'sysml', 1, source.join('\n')));
    return tokensByPosition(new SemanticTokensProvider(dm).provideSemanticTokens({ textDocument: { uri: 'test://targets.sysml' } }).data, source);
}

describe('specialization target semantic tokens', () => {
    it('parses the example without syntax errors', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        expect(parseDocument(text).errors).toEqual([]);
    });

    it.each(types)('line %i: %s%s is a type', async (line, before, name, token) => {
        expect((await providerTokens()).get(at(line, before, name))).toBe(token);
    });

    it.each(features)('line %i: %s%s is a feature', async (line, before, name, token) => {
        expect((await providerTokens()).get(at(line, before, name))).toBe(token);
    });

    it.each(unchanged)('line %i: %s%s keeps its token', async (line, before, name, token) => {
        expect((await providerTokens()).get(at(line, before, name))).toBe(token);
    });

    it('gives no name token inside a comment or a string', async () => {
        const tokens = await providerTokens();
        const inside = [...tokens].filter(([position]) => /^(41|43):/.test(position) && !position.endsWith(':=') && !position.includes('attribute'));
        expect(inside.map(([position, token]) => `${position} ${token}`)).toEqual([
            '41:4:/* part q :> f; */ comment',
            '43:14:u property',
            '43:18:"x :> f" string',
        ]);
    });
});

/** A small source, and the names in it expected to get a token (line, text before, name, token). */
const contexts: Array<[title: string, source: string[], expected: Expected[]]> = [
    ['a feature chain as a flow payload', [
        'package P {',
        '    part t { item fo; }',
        '    part a { out item x; } part b { in item y; }',
        '    flow of t.fo from a.x to b.y;',
        '}',
    ], [[3, 'of ', 't', 'variable'], [3, 'of t.', 'fo', 'variable'], [3, 'from ', 'a', 'variable']]],
    ['a named flow payload and a message payload', [
        'package P {',
        '    item def Sig;',
        '    part a { out item x; } part b { in item y; }',
        '    flow pl : Sig from a.x to b.y;',
        '    message m of Sig from a to b;',
        '}',
    ], [[3, 'pl : ', 'Sig', 'type'], [4, 'of ', 'Sig', 'type'], [4, 'from ', 'a', 'variable'], [4, 'to ', 'b', 'variable']]],
    ['an accept payload without a name', [
        'package P {',
        '    item def Sig;',
        '    state def S {',
        '        state s1; state s2;',
        '        transition first s1 accept Sig then s2;',
        '    }',
        '}',
    ], [[4, 'accept ', 'Sig', 'type'], [4, 'first ', 's1', 'variable'], [4, 'then ', 's2', 'variable']]],
    ['metadata typed with about, and a redefinition in a metadata body', [
        'package P {',
        '    part x;',
        '    metadata def K {',
        '        ref :>> annotatedElement : SysML::Usage;',
        '    }',
        '    metadata m : K about x;',
        '}',
    ], [[3, ':>> ', 'annotatedElement', 'variable'], [3, 'SysML::', 'Usage', 'type'], [5, 'm : ', 'K', 'type']]],
    ['a type named like an unreserved keyword', [
        'package P {',
        '    part def type;',
        '    part q : type;',
        '    part def D :> type;',
        '}',
    ], [[2, 'q : ', 'type', 'type'], [3, ':> ', 'type', 'type']]],
    // The grammar parses the result of an expression body as a standalone `featureTyping`, which the
    // specification doesn't have (KerML 8.2.4.3.2): a single or qualified name there is no target.
    ['the result of an expression body', [
        'package P {',
        '    calc def F { in v; }',
        '    attribute w1 = y->select {in x; x};',
        '    attribute w2 = y->select {in x; P::F(x)};',
        '}',
    ], [[2, 'in x; ', 'x', 'variable'], [3, 'in x; P::', 'F', 'variable']]],
    ['a conjugated port typing (SysML 8.2.2.12, 8.3.12.3)', [
        'package D {',
        '    port def P { in item x; }',
        '    port def Q { out item y; }',
        '    interface def I { end port e1 : ~P; end port e2 : P; }',
        '    part a {',
        '        port p1 : ~P;',
        '        port p2 : ~P, Q;',
        '        port p3 : ~D::P;',
        '        port p4 defined by ~P;',
        '        port p5 : Q, ~P;',
        '    }',
        '}',
    ], [
        [3, 'e1 : ~', 'P', 'type'], [3, 'e2 : ', 'P', 'type'],
        [5, ': ~', 'P', 'type'],
        [6, ': ~', 'P', 'type'], [6, ', ', 'Q', 'type'],
        [7, '~D::', 'P', 'type'],
        [8, 'by ~', 'P', 'type'],
        [9, ': ', 'Q', 'type'], [9, ', ~', 'P', 'type'],
    ]],
    // `~` is also the unary operator (KerML 8.2.5.8.1, Table 5): in an expression it is no typing.
    ['the unary operator ~ in an expression and an expression body', [
        'package P {',
        '    attribute x;',
        '    attribute w1 = ~x;',
        '    attribute w2 = y->select {in z; ~z};',
        '}',
    ], [[2, '= ~', 'x', 'variable'], [3, 'in z; ~', 'z', 'variable']]],
    ['a definition and a usage in a usage body', [
        'package P {',
        '    part def A { part f; }',
        '    part u : A {',
        '        part def D :> A;',
        '        part w :> f;',
        '    }',
        '}',
    ], [[3, ':> ', 'A', 'type'], [4, ':> ', 'f', 'variable']]],
];

describe('specialization target semantic tokens in other contexts', () => {
    it.each(contexts)('%s parses without syntax errors', async (_title, source) => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        expect(parseDocument(source.join('\n')).errors).toEqual([]);
    });

    it.each(contexts)('%s: each name gets its token', async (_title, source, expected) => {
        const tokens = await providerTokens(source);
        expect(expected.map(([line, before, name]) => tokens.get(at(line, before, name, source))))
            .toEqual(expected.map(([, , , token]) => token));
    });
});
