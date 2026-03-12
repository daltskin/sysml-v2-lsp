/**
 * Worker thread that runs ANTLR4 parsing off the main thread.
 *
 * The worker maintains a persistent process-level DFA cache, so the first
 * parse of a session is slow (~20 s for a large grammar) but every
 * subsequent parse of the same or different file is near-instant (~50 ms).
 *
 * Protocol (message-based):
 *   Main → Worker: ParseRequest  { id, text, uri, version }
 *   Worker → Main: ParseResponse { id, uri, version, errors, keywordDiagnostics, timing, mode }
 *   Main → Worker: CancelRequest { id, cancel: true }
 */

import {
    BailErrorStrategy,
    CharStream,
    CommonTokenStream,
    DefaultErrorStrategy,
    PredictionMode,
    Token,
} from 'antlr4ng';
import { parentPort, receiveMessageOnPort } from 'node:worker_threads';
import { SysMLv2Lexer } from '../generated/SysMLv2Lexer.js';
import { SysMLv2Parser } from '../generated/SysMLv2Parser.js';
import { SysMLErrorListener } from './errorListener.js';
import { WARMUP_TEXT } from './warmupText.js';

// ---------------------------------------------------------------------------
// Interruptible DFA warm-up
//
// The warm-up text is split into ~50-line chunks.  Each chunk is parsed as
// a standalone SysML text (wrapped in `package WU_N { … }`).  Between
// chunks we check `receiveMessageOnPort` for pending real parse requests.
// If one is found, we handle it immediately (with whatever partial DFA
// warming has been done) and then skip remaining warm-up (the real parse
// naturally finishes populating the DFA).
//
// This ensures that:
//  • If the user doesn't open a file for ~18 s, the DFA is pre-warmed → fast.
//  • If the user opens a file immediately, warm-up is cancelled → no penalty.
// ---------------------------------------------------------------------------

/** Split the monolithic warm-up text into independently parseable chunks. */
function createWarmupChunks(): string[] {
    const allLines = WARMUP_TEXT.split('\n');
    // Strip the outer `package WarmUp {` … `}` wrapper
    const inner = allLines.slice(1, allLines.length - 1);
    const CHUNK_SIZE = 30;          // ~30 lines per chunk ≈ 0.5-2 s each
    const chunks: string[] = [];
    for (let i = 0; i < inner.length; i += CHUNK_SIZE) {
        const slice = inner.slice(i, i + CHUNK_SIZE).join('\n');
        chunks.push(`package WU_${chunks.length} {\n${slice}\n}`);
    }
    return chunks;
}

function parseSnippet(text: string): void {
    const input = CharStream.fromString(text);
    const lexer = new SysMLv2Lexer(input);
    const tokens = new CommonTokenStream(lexer);
    tokens.fill();
    const parser = new SysMLv2Parser(tokens);
    parser.removeErrorListeners();
    parser.interpreter.predictionMode = PredictionMode.SLL;
    parser.errorHandler = new BailErrorStrategy();
    try {
        parser.rootNamespace();
    } catch {
        // SLL bail-out → try LL for remaining DFA coverage
        tokens.seek(0);
        parser.reset();
        parser.interpreter.predictionMode = PredictionMode.LL;
        parser.errorHandler = new DefaultErrorStrategy();
        parser.removeErrorListeners();
        try { parser.rootNamespace(); } catch { /* best effort */ }
    }
}

// ---- Keyword validator (inlined to avoid cross-dependency complexity) ----

const DEFINITION_KEYWORDS: ReadonlySet<string> = new Set([
    'about', 'abstract', 'accept', 'action', 'actor', 'after', 'alias',
    'all', 'allocate', 'allocation', 'analysis', 'assert', 'assign',
    'assume', 'attribute', 'bind', 'binding', 'calc', 'case', 'comment',
    'concern', 'connect', 'connection', 'constraint', 'decide', 'def',
    'default', 'defined', 'dependency', 'derived', 'do', 'doc', 'else',
    'end', 'entry', 'enum', 'event', 'exhibit', 'exit', 'expose',
    'feature', 'filter', 'first', 'flow', 'for', 'fork', 'frame', 'from',
    'if', 'import', 'in', 'include', 'individual', 'inout', 'interface',
    'item', 'join', 'language', 'library', 'locale', 'merge', 'message',
    'meta', 'metadata', 'multiplicity', 'namespace', 'nonunique', 'not',
    'null', 'objective', 'occurrence', 'of', 'ordered', 'out', 'package',
    'parallel', 'part', 'perform', 'port', 'private', 'protected',
    'public', 'readonly', 'redefines', 'ref', 'references', 'render',
    'rendering', 'rep', 'require', 'requirement', 'return', 'satisfy',
    'send', 'snapshot', 'specializes', 'stakeholder', 'state', 'subject',
    'subsets', 'succession', 'then', 'timeslice', 'to', 'transition',
    'type', 'use', 'variant', 'variation', 'verification', 'verify',
    'view', 'viewpoint', 'when', 'while', 'datatype',
]);

/** Two-row Levenshtein — O(min(m,n)) space. */
function levenshtein(a: string, b: string): number {
    if (a.length < b.length) { const t = a; a = b; b = t; }
    const m = a.length;
    const n = b.length;

    let prev = new Uint16Array(n + 1);
    let curr = new Uint16Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;

    for (let i = 1; i <= m; i++) {
        curr[0] = i;
        for (let j = 1; j <= n; j++) {
            const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
            curr[j] = Math.min(
                prev[j] + 1,
                curr[j - 1] + 1,
                prev[j - 1] + cost,
            );
        }
        [prev, curr] = [curr, prev];
    }
    return prev[n];
}

function findClosestKeyword(identifier: string): string | undefined {
    const lower = identifier.toLowerCase();
    if (lower.length < 4 || DEFINITION_KEYWORDS.has(lower)) return undefined;
    const maxDistance = lower.length <= 5 ? 1 : 2;
    let bestMatch: string | undefined;
    let bestDist = maxDistance + 1;
    for (const keyword of DEFINITION_KEYWORDS) {
        if (Math.abs(keyword.length - lower.length) > maxDistance) continue;
        const dist = levenshtein(lower, keyword);
        if (dist > 0 && dist < bestDist) {
            bestDist = dist;
            bestMatch = keyword;
        }
    }
    return bestMatch;
}

const KEYWORD_CONTINUATIONS: ReadonlySet<number> = new Set([
    SysMLv2Lexer.IDENTIFIER, SysMLv2Lexer.COLON, SysMLv2Lexer.DEF,
    SysMLv2Lexer.LBRACE, SysMLv2Lexer.LBRACK, SysMLv2Lexer.ABOUT,
]);

const NAME_PRECEDING_KEYWORDS: ReadonlySet<number> = new Set([
    // ── SysML definition/usage element keywords ──
    SysMLv2Lexer.PART, SysMLv2Lexer.PORT, SysMLv2Lexer.ITEM,
    SysMLv2Lexer.ATTRIBUTE, SysMLv2Lexer.ACTION, SysMLv2Lexer.CALC,
    SysMLv2Lexer.STATE, SysMLv2Lexer.CONSTRAINT, SysMLv2Lexer.REQUIREMENT,
    SysMLv2Lexer.CONCERN, SysMLv2Lexer.CASE, SysMLv2Lexer.ANALYSIS,
    SysMLv2Lexer.VERIFICATION, SysMLv2Lexer.VIEW, SysMLv2Lexer.VIEWPOINT,
    SysMLv2Lexer.RENDERING, SysMLv2Lexer.METADATA, SysMLv2Lexer.PACKAGE,
    SysMLv2Lexer.NAMESPACE, SysMLv2Lexer.ENUM, SysMLv2Lexer.ALLOCATION,
    SysMLv2Lexer.CONNECTION, SysMLv2Lexer.INTERFACE, SysMLv2Lexer.OCCURRENCE,
    SysMLv2Lexer.INDIVIDUAL, SysMLv2Lexer.FLOW, SysMLv2Lexer.SUCCESSION,
    SysMLv2Lexer.BINDING, SysMLv2Lexer.MESSAGE, SysMLv2Lexer.TRANSITION,
    // ── KerML element keywords ──
    SysMLv2Lexer.TYPE, SysMLv2Lexer.CLASSIFIER, SysMLv2Lexer.DATATYPE,
    SysMLv2Lexer.CLASS, SysMLv2Lexer.STRUCT, SysMLv2Lexer.ASSOC,
    SysMLv2Lexer.METACLASS, SysMLv2Lexer.INTERACTION, SysMLv2Lexer.BEHAVIOR,
    SysMLv2Lexer.FUNCTION, SysMLv2Lexer.PREDICATE, SysMLv2Lexer.FEATURE,
    SysMLv2Lexer.CONNECTOR, SysMLv2Lexer.STEP, SysMLv2Lexer.EXPR,
    SysMLv2Lexer.BOOL, SysMLv2Lexer.INV, SysMLv2Lexer.MULTIPLICITY,
    // ── Annotation / membership keywords ──
    SysMLv2Lexer.ALIAS, SysMLv2Lexer.COMMENT, SysMLv2Lexer.DOC,
    SysMLv2Lexer.REP, SysMLv2Lexer.DEPENDENCY, SysMLv2Lexer.IMPORT,
    // ── Keyword + DEF / keyword modifiers ──
    SysMLv2Lexer.DEF, SysMLv2Lexer.REF, SysMLv2Lexer.ALL,
    // ── Feature prefix / visibility modifiers ──
    SysMLv2Lexer.ABSTRACT, SysMLv2Lexer.VARIATION, SysMLv2Lexer.DERIVED,
    SysMLv2Lexer.COMPOSITE, SysMLv2Lexer.CONST, SysMLv2Lexer.CONSTANT,
    SysMLv2Lexer.VAR, SysMLv2Lexer.MEMBER, SysMLv2Lexer.RETURN,
    SysMLv2Lexer.PUBLIC, SysMLv2Lexer.PRIVATE, SysMLv2Lexer.PROTECTED,
    // ── Directionality ──
    SysMLv2Lexer.IN, SysMLv2Lexer.OUT, SysMLv2Lexer.INOUT, SysMLv2Lexer.END,
    // ── Actor / role keywords ──
    SysMLv2Lexer.ACTOR, SysMLv2Lexer.STAKEHOLDER, SysMLv2Lexer.SUBJECT,
    SysMLv2Lexer.VARIANT, SysMLv2Lexer.SNAPSHOT, SysMLv2Lexer.TIMESLICE,
    // ── Action control node keywords ──
    SysMLv2Lexer.FORK, SysMLv2Lexer.JOIN, SysMLv2Lexer.MERGE,
    SysMLv2Lexer.DECIDE,
    // ── Reference-preceding keywords ──
    SysMLv2Lexer.PERFORM, SysMLv2Lexer.EXHIBIT, SysMLv2Lexer.INCLUDE,
    SysMLv2Lexer.SATISFY, SysMLv2Lexer.ASSERT, SysMLv2Lexer.VERIFY,
    SysMLv2Lexer.RENDER, SysMLv2Lexer.CONNECT, SysMLv2Lexer.ALLOCATE,
    SysMLv2Lexer.BIND, SysMLv2Lexer.EXPOSE, SysMLv2Lexer.EVENT,
    // ── Succession / flow keywords ──
    SysMLv2Lexer.FIRST, SysMLv2Lexer.THEN, SysMLv2Lexer.TO,
    SysMLv2Lexer.FROM,
    // ── Relationship keywords ──
    SysMLv2Lexer.REDEFINES, SysMLv2Lexer.SUBSETS,
    SysMLv2Lexer.SPECIALIZES, SysMLv2Lexer.REFERENCES,
    SysMLv2Lexer.CONJUGATES, SysMLv2Lexer.CHAINS, SysMLv2Lexer.CROSSES,
    SysMLv2Lexer.UNIONS, SysMLv2Lexer.INTERSECTS, SysMLv2Lexer.DIFFERENCES,
    // ── KerML relationship element keywords ──
    SysMLv2Lexer.SPECIALIZATION, SysMLv2Lexer.CONJUGATION,
    SysMLv2Lexer.DISJOINING, SysMLv2Lexer.INVERTING,
    SysMLv2Lexer.FEATURING, SysMLv2Lexer.TYPING, SysMLv2Lexer.REDEFINITION,
    SysMLv2Lexer.SUBTYPE, SysMLv2Lexer.SUBCLASSIFIER,
    SysMLv2Lexer.SUBSET, SysMLv2Lexer.CONJUGATE,
    SysMLv2Lexer.DISJOINT, SysMLv2Lexer.INVERSE,
    // ── Requirement / state body keywords ──
    SysMLv2Lexer.ASSUME, SysMLv2Lexer.REQUIRE, SysMLv2Lexer.FRAME,
    SysMLv2Lexer.OBJECTIVE, SysMLv2Lexer.ENTRY, SysMLv2Lexer.DO,
    SysMLv2Lexer.EXIT,
    // ── Misc keywords preceding names ──
    SysMLv2Lexer.ACCEPT, SysMLv2Lexer.SEND, SysMLv2Lexer.ASSIGN,
    SysMLv2Lexer.TERMINATE, SysMLv2Lexer.FOR, SysMLv2Lexer.ABOUT,
    SysMLv2Lexer.BY, SysMLv2Lexer.FILTER, SysMLv2Lexer.NEW,
    SysMLv2Lexer.META, SysMLv2Lexer.OF,
    // ── Punctuation that precedes names ──
    SysMLv2Lexer.COLON, SysMLv2Lexer.COLON_GT, SysMLv2Lexer.COLON_GT_GT,
    SysMLv2Lexer.COLON_COLON, SysMLv2Lexer.COLON_COLON_GT,
    SysMLv2Lexer.GT, SysMLv2Lexer.FAT_ARROW, SysMLv2Lexer.TILDE,
    SysMLv2Lexer.COMMA, SysMLv2Lexer.HASH, SysMLv2Lexer.AT,
]);

interface SerializedDiagnostic {
    severity: number;
    range: { start: { line: number; character: number }; end: { line: number; character: number } };
    message: string;
    source: string;
    data?: Record<string, unknown>;
}

export function validateKeywordsFromTokens(tokenStream: CommonTokenStream): SerializedDiagnostic[] {
    const diagnostics: SerializedDiagnostic[] = [];
    tokenStream.fill();
    const allTokens = tokenStream.getTokens();

    const visible: Token[] = [];
    for (let j = 0; j < allTokens.length; j++) {
        const t = allTokens[j];
        if (t.channel === 0 && t.type !== Token.EOF) visible.push(t);
    }

    for (let i = 0; i < visible.length; i++) {
        const tok = visible[i];
        if (tok.type !== SysMLv2Lexer.IDENTIFIER || !tok.text) continue;

        // Check previous token — if it's a definition keyword, this is a name
        if (i > 0 && NAME_PRECEDING_KEYWORDS.has(visible[i - 1].type)) continue;

        // If preceded by dot, '=', or ':=' — this is a value/path, not a keyword
        if (i > 0) {
            const prevType = visible[i - 1].type;
            if (prevType === SysMLv2Lexer.DOT ||
                prevType === SysMLv2Lexer.EQ ||
                prevType === SysMLv2Lexer.COLON_EQ) {
                continue;
            }
        }

        // Check next token — if it's a keyword continuation, this might be a typo
        let positionOk = i === 0;
        if (!positionOk && i + 1 < visible.length && KEYWORD_CONTINUATIONS.has(visible[i + 1].type)) {
            positionOk = true;
        }
        if (!positionOk) continue;

        const suggestion = findClosestKeyword(tok.text);
        if (!suggestion) continue; // No close keyword match → likely a valid shorthand usage name

        const line = (tok.line ?? 1) - 1;
        const char = tok.column ?? 0;
        const message = `Unknown keyword '${tok.text}'. Did you mean '${suggestion}'?`;
        diagnostics.push({
            severity: 1, // DiagnosticSeverity.Error
            range: {
                start: { line, character: char },
                end: { line, character: char + tok.text.length },
            },
            message,
            source: 'sysml',
            data: { typo: tok.text, suggestion },
        });
    }
    return diagnostics;
}

// ---- Worker message types ----

export interface ParseRequest {
    id: number;
    text: string;
    uri: string;
    version: number;
}

export interface CancelRequest {
    id: number;
    cancel: true;
}

export interface SerializedError {
    line: number;
    column: number;
    message: string;
    length: number;
}

export interface ParseResponse {
    id: number;
    uri: string;
    version: number;
    errors: SerializedError[];
    keywordDiagnostics: SerializedDiagnostic[];
    /** Encoded semantic token data (SemanticTokensBuilder format) */
    semanticTokenData: number[];
    timing: { lexMs: number; parseMs: number };
    mode: 'SLL' | 'LL';
}

// ---- Semantic token classification ----

const SEMANTIC_KEYWORDS = new Set([
    'about', 'abstract', 'accept', 'action', 'actor', 'after', 'alias',
    'all', 'allocate', 'allocation', 'analysis', 'and', 'as', 'assert',
    'assign', 'assume', 'attribute', 'bind', 'binding', 'bool', 'by',
    'calc', 'case', 'comment', 'concern', 'connect', 'connection',
    'constraint', 'decide', 'def', 'default', 'defined', 'dependency',
    'derived', 'do', 'doc', 'else', 'end', 'entry', 'enum', 'event',
    'exhibit', 'exit', 'expose', 'false', 'feature', 'filter', 'first',
    'flow', 'for', 'fork', 'frame', 'from', 'hastype', 'if', 'implies',
    'import', 'in', 'include', 'individual', 'inout', 'interface',
    'istype', 'item', 'join', 'language', 'library', 'locale', 'merge',
    'message', 'meta', 'metadata', 'multiplicity', 'namespace', 'nonunique',
    'not', 'null', 'objective', 'occurrence', 'of', 'or', 'ordered', 'out',
    'package', 'parallel', 'part', 'perform', 'port', 'private',
    'protected', 'public', 'readonly', 'redefines', 'ref', 'references',
    'render', 'rendering', 'rep', 'require', 'requirement', 'return',
    'satisfy', 'send', 'snapshot', 'specializes', 'stakeholder', 'state',
    'subject', 'subsets', 'succession', 'then', 'timeslice', 'to', 'transition',
    'true', 'type', 'use', 'variant', 'variation', 'verification', 'verify',
    'view', 'viewpoint', 'when', 'while', 'xor',
]);

// Semantic token type indices — must match the legend in semanticTokensProvider.ts
const ST_VARIABLE = 3;
const ST_KEYWORD = 6;
const ST_COMMENT = 7;
const ST_STRING = 8;
const ST_NUMBER = 9;
const ST_OPERATOR = 10;

/** Lexer token types that map to the "operator" semantic token. */
const OPERATOR_TOKENS = new Set([
    SysMLv2Lexer.BANG_EQ_EQ,    // !==
    SysMLv2Lexer.STAR_STAR,     // **
    SysMLv2Lexer.COLON_GT,      // :>
    SysMLv2Lexer.COLON_GT_GT,   // :>>
    SysMLv2Lexer.AMP,           // &
    SysMLv2Lexer.COLON_COLON,   // ::
    SysMLv2Lexer.STAR,          // *
    SysMLv2Lexer.PIPE,          // |
    SysMLv2Lexer.EQ_EQ,         // ==
    SysMLv2Lexer.BANG_EQ,        // !=
    SysMLv2Lexer.PLUS,          // +
    SysMLv2Lexer.MINUS,         // -
    SysMLv2Lexer.ARROW,         // ->
    SysMLv2Lexer.SLASH,         // /
    SysMLv2Lexer.LT,            // <
    SysMLv2Lexer.EQ,            // =
    SysMLv2Lexer.GT,            // >
    SysMLv2Lexer.CARET,         // ^
    SysMLv2Lexer.TILDE,         // ~
]);

function classifyTokenType(text: string, lexerType: number): number | undefined {
    if (lexerType === SysMLv2Lexer.REGULAR_COMMENT || lexerType === SysMLv2Lexer.SINGLE_LINE_NOTE) return ST_COMMENT;
    if (lexerType === SysMLv2Lexer.STRING || lexerType === SysMLv2Lexer.DOUBLE_STRING) return ST_STRING;
    if (lexerType === SysMLv2Lexer.INTEGER || lexerType === SysMLv2Lexer.REAL) return ST_NUMBER;
    if (OPERATOR_TOKENS.has(lexerType)) return ST_OPERATOR;
    if (SEMANTIC_KEYWORDS.has(text)) return ST_KEYWORD;
    if (lexerType === SysMLv2Lexer.IDENTIFIER) return ST_VARIABLE;
    return undefined;
}

/**
 * Build encoded semantic token data from the token stream.
 * Returns a flat array of [deltaLine, deltaStart, length, tokenType, modifiers]
 * tuples matching SemanticTokensBuilder output format.
 */
function buildSemanticTokenData(tokenStream: CommonTokenStream): number[] {
    tokenStream.fill();
    const allTokens = tokenStream.getTokens();
    const data: number[] = [];
    let prevLine = 0;
    let prevChar = 0;

    for (let i = 0; i < allTokens.length; i++) {
        const tok = allTokens[i];
        if (!tok.text || tok.channel !== 0) continue;

        const tokenType = classifyTokenType(tok.text, tok.type);
        if (tokenType === undefined) continue;

        const line = (tok.line ?? 1) - 1; // 0-based
        const char = tok.column ?? 0;
        const length = tok.text.length;

        const deltaLine = line - prevLine;
        const deltaChar = deltaLine === 0 ? char - prevChar : char;

        data.push(deltaLine, deltaChar, length, tokenType, 0);

        prevLine = line;
        prevChar = char;
    }

    return data;
}

// ---- Error location improvement ----

/**
 * Tokens that indicate the end of a statement / block — when ANTLR reports
 * an error on one of these, the real culprit is likely the preceding token.
 */
const BOUNDARY_TOKENS = new Set([
    Token.EOF,
    SysMLv2Lexer.RBRACE,       // }
    SysMLv2Lexer.SEMI,          // ;
]);

/**
 * When ANTLR reports an error on `}`, `<EOF>`, or `;`, and the previous
 * visible token is an identifier that isn't a keyword, relocate the error
 * to that identifier — it's almost certainly the real problem.
 */
function improveErrorLocations(
    errors: SerializedError[],
    tokenStream: CommonTokenStream,
): SerializedError[] {
    if (errors.length === 0) return errors;

    tokenStream.fill();
    const allTokens = tokenStream.getTokens();

    // Build a list of visible tokens for quick lookup
    const visible: Token[] = [];
    for (const t of allTokens) {
        if (t.channel === 0) visible.push(t);
    }

    return errors.map(err => {
        // Find the token at the error position
        const errToken = visible.find(
            t => (t.line - 1) === err.line && t.column === err.column
        );
        if (!errToken) return err;

        // Only relocate for boundary tokens
        if (!BOUNDARY_TOKENS.has(errToken.type) && errToken.type !== Token.EOF) return err;

        // Find the previous visible token
        const errIdx = visible.indexOf(errToken);
        if (errIdx <= 0) return err;

        const prev = visible[errIdx - 1];
        if (!prev.text) return err;

        // If the previous token is an identifier (not a keyword), point there
        if (prev.type === SysMLv2Lexer.IDENTIFIER) {
            return {
                line: (prev.line ?? 1) - 1,
                column: prev.column ?? 0,
                length: prev.text.length,
                message: `Unexpected identifier '${prev.text}'. Expected a SysML keyword (package, part, attribute, action, etc.)`,
            };
        }

        return err;
    });
}

/**
 * All SysML keywords that can appear at the start of a statement inside
 * a definition/usage body. Used to detect identifiers in keyword positions.
 */
const STATEMENT_START_KEYWORDS: ReadonlySet<string> = new Set([
    'abstract', 'accept', 'action', 'actor', 'alias', 'allocate',
    'allocation', 'analysis', 'assert', 'assign', 'assume', 'attribute',
    'bind', 'binding', 'calc', 'case', 'comment', 'concern', 'connect',
    'connection', 'constraint', 'decide', 'dependency', 'doc', 'end',
    'entry', 'enum', 'event', 'exhibit', 'exit', 'expose', 'feature',
    'filter', 'first', 'flow', 'for', 'fork', 'frame', 'if', 'import',
    'in', 'include', 'individual', 'inout', 'interface', 'item', 'join',
    'merge', 'message', 'metadata', 'multiplicity', 'namespace',
    'objective', 'occurrence', 'of', 'ordered', 'out', 'package',
    'parallel', 'part', 'perform', 'port', 'private', 'protected',
    'public', 'readonly', 'redefines', 'ref', 'render', 'rendering',
    'rep', 'require', 'requirement', 'return', 'satisfy', 'send',
    'snapshot', 'specializes', 'stakeholder', 'state', 'subject',
    'subsets', 'succession', 'then', 'timeslice', 'to', 'transition',
    'type', 'use', 'variant', 'variation', 'verification', 'verify',
    'view', 'viewpoint', 'when', 'while',
]);

/**
 * Flag identifiers that appear in positions where a SysML statement keyword
 * is expected. These are words like "banana" that aren't close enough to any
 * keyword to trigger the typo detector, yet clearly don't belong.
 */
export function flagUnknownIdentifiers(tokenStream: CommonTokenStream): SerializedDiagnostic[] {
    const diagnostics: SerializedDiagnostic[] = [];
    tokenStream.fill();
    const allTokens = tokenStream.getTokens();

    const visible: Token[] = [];
    for (const t of allTokens) {
        if (t.channel === 0 && t.type !== Token.EOF) visible.push(t);
    }

    for (let i = 0; i < visible.length; i++) {
        const tok = visible[i];
        if (tok.type !== SysMLv2Lexer.IDENTIFIER || !tok.text) continue;

        const lower = tok.text.toLowerCase();

        // Skip if it IS a known keyword (shouldn't happen since keywords
        // have their own token types, but belt-and-suspenders)
        if (STATEMENT_START_KEYWORDS.has(lower)) continue;
        if (DEFINITION_KEYWORDS.has(lower)) continue;

        // Check if this identifier is in a "statement start" position:
        // - First token in the file (i === 0)
        // - Preceded by '{', '}', ';', or start-of-body keywords
        // - Preceded by another identifier that looked like a name
        //   (i.e., the one before it was a keyword like `part`, `attribute`)
        let isStatementPosition = (i === 0);

        if (!isStatementPosition && i > 0) {
            const prev = visible[i - 1];
            const prevType = prev.type;

            // After opening brace, closing brace, or semicolon → statement start
            if (prevType === SysMLv2Lexer.LBRACE ||
                prevType === SysMLv2Lexer.RBRACE ||
                prevType === SysMLv2Lexer.SEMI) {
                isStatementPosition = true;
            }

            // If prev is a keyword that takes a name, then THIS token is
            // the name, not an error.  Skip it.
            if (NAME_PRECEDING_KEYWORDS.has(prevType)) continue;

            // If prev is a ':' ':>' ':>>' '::>' '=' then this is a value/type, skip
            if (prevType === SysMLv2Lexer.COLON ||
                prevType === SysMLv2Lexer.COLON_GT ||
                prevType === SysMLv2Lexer.COLON_GT_GT ||
                prevType === SysMLv2Lexer.COLON_COLON ||
                prevType === SysMLv2Lexer.EQ) {
                continue;
            }

            // If prev is a dot (feature chain), skip
            if (prevType === SysMLv2Lexer.DOT) continue;
        }

        if (!isStatementPosition) continue;

        // Check what follows: if it's followed by something that makes it
        // look like a valid usage (: for typing, = for value, { for body),
        // then it might be a valid defaultReferenceUsage name — but we still
        // want to flag it if there's no definition for it.
        // For now, only flag if the NEXT token is also suspicious
        // (another identifier, '}', or EOF — indicating it's not valid syntax).
        if (i + 1 < visible.length) {
            const next = visible[i + 1];
            // If followed by ':', '=', '{', ':>', ':>>', ';' →
            // this could be a valid usage name — skip
            if (next.type === SysMLv2Lexer.COLON ||
                next.type === SysMLv2Lexer.EQ ||
                next.type === SysMLv2Lexer.LBRACE ||
                next.type === SysMLv2Lexer.COLON_GT ||
                next.type === SysMLv2Lexer.COLON_GT_GT ||
                next.type === SysMLv2Lexer.SEMI ||
                next.type === SysMLv2Lexer.LBRACK ||
                // If followed by '::', this is a qualified name / namespace path
                // (e.g., toaster::maxTemp in a constraint body)
                next.type === SysMLv2Lexer.COLON_COLON ||
                // If followed by '.', this is a feature chain expression
                // (e.g., bicycle.totalMass in a constraint body)
                next.type === SysMLv2Lexer.DOT ||
                // If followed by an operator, this is an expression
                // (e.g., maxSpeed > 0, width == 100)
                next.type === SysMLv2Lexer.LT ||
                next.type === SysMLv2Lexer.GT ||
                next.type === SysMLv2Lexer.LE ||
                next.type === SysMLv2Lexer.GE ||
                next.type === SysMLv2Lexer.EQ_EQ ||
                next.type === SysMLv2Lexer.BANG_EQ ||
                next.type === SysMLv2Lexer.PLUS ||
                next.type === SysMLv2Lexer.MINUS ||
                next.type === SysMLv2Lexer.STAR ||
                next.type === SysMLv2Lexer.SLASH ||
                next.type === SysMLv2Lexer.AND ||
                next.type === SysMLv2Lexer.OR ||
                next.type === SysMLv2Lexer.IMPLIES) {
                continue;
            }
        }

        const line = (tok.line ?? 1) - 1;
        const char = tok.column ?? 0;
        diagnostics.push({
            severity: 1, // DiagnosticSeverity.Error
            range: {
                start: { line, character: char },
                end: { line, character: char + tok.text.length },
            },
            message: `Unexpected '${tok.text}'. Expected a SysML keyword (package, part, attribute, action, etc.)`,
            source: 'sysml',
        });
    }

    return diagnostics;
}

// ---- Main worker loop ----

// Track cancelled request IDs (we can't interrupt a running parse, but we
// can skip sending the result if the parse was cancelled while running).
const cancelledIds = new Set<number>();

/** Handle a single parse request (real file). */
function handleParseRequest(msg: ParseRequest): void {
    const { id, text, uri, version } = msg;

    // --- Lex ---
    const lexStart = Date.now();
    const inputStream = CharStream.fromString(text);
    const lexer = new SysMLv2Lexer(inputStream);
    const tokenStream = new CommonTokenStream(lexer);
    tokenStream.fill();
    const lexMs = Date.now() - lexStart;

    // --- SLL attempt ---
    const parseStart = Date.now();
    const parser = new SysMLv2Parser(tokenStream);
    parser.removeErrorListeners();
    parser.interpreter.predictionMode = PredictionMode.SLL;
    parser.errorHandler = new BailErrorStrategy();

    let errors: SerializedError[] = [];
    let mode: 'SLL' | 'LL' = 'SLL';

    try {
        parser.rootNamespace();
    } catch {
        // SLL failed → LL fallback
        mode = 'LL';
        tokenStream.seek(0);
        parser.reset();
        parser.interpreter.predictionMode = PredictionMode.LL;
        parser.errorHandler = new DefaultErrorStrategy();

        const errorListener = new SysMLErrorListener();
        lexer.removeErrorListeners();
        parser.removeErrorListeners();
        parser.addErrorListener(errorListener);

        try {
            parser.rootNamespace();
        } catch {
            // best effort
        }

        errors = errorListener.getErrors().map(e => ({
            line: e.line,
            column: e.column,
            message: e.message,
            length: e.length,
        }));
    }

    // --- Improve error locations ---
    // ANTLR often reports "mismatched input '}'" or "<EOF>" when the real
    // problem is an unknown identifier on the line/token before.  Walk the
    // errors and relocate them to the actual culprit identifier.
    errors = improveErrorLocations(errors, tokenStream);

    // --- Flag unknown identifiers in statement-start positions ---
    // If an identifier isn't a SysML keyword and appears where a statement
    // keyword is expected, flag it as an error.  This catches "banana" etc.
    const unknownIdDiags = flagUnknownIdentifiers(tokenStream);

    const parseMs = Date.now() - parseStart;

    // Check if this request was cancelled while we were parsing
    if (cancelledIds.has(id)) {
        cancelledIds.delete(id);
        return; // don't send stale results
    }

    // Keyword validation (uses token stream, runs in ~5ms)
    const keywordDiagnostics = validateKeywordsFromTokens(tokenStream);

    // Merge unknown-identifier diagnostics (avoids duplicates with ANTLR errors)
    const errorPositions = new Set(errors.map(e => `${e.line}:${e.column}`));
    for (const uid of unknownIdDiags) {
        const key = `${uid.range.start.line}:${uid.range.start.character}`;
        if (!errorPositions.has(key)) {
            keywordDiagnostics.push(uid);
        }
    }

    // Build semantic tokens (uses token stream, runs in ~5ms)
    const semanticTokenData = buildSemanticTokenData(tokenStream);

    const response: ParseResponse = {
        id,
        uri,
        version,
        errors,
        keywordDiagnostics,
        semanticTokenData,
        timing: { lexMs, parseMs },
        mode,
    };

    parentPort?.postMessage(response);
}

// ---- Cooperative warm-up with message interleaving ----
//
// We use setImmediate to kick off warm-up AFTER the event handler is
// registered.  Inside the warm-up loop we call receiveMessageOnPort()
// between chunk parses so that any real parse requests are serviced
// immediately rather than waiting for the full warm-up to complete.

setImmediate(() => {
    const chunks = createWarmupChunks();
    const t0 = Date.now();
    let interrupted = false;

    for (let i = 0; i < chunks.length; i++) {
        // Check for pending real parse requests between chunks
        if (parentPort) {
            let pending = receiveMessageOnPort(parentPort);
            while (pending) {
                const msg = pending.message as ParseRequest | CancelRequest;
                if ('cancel' in msg) {
                    cancelledIds.add(msg.id);
                } else {
                    // Real parse request — handle it now. The DFA is partially
                    // warm from the chunks we've already parsed. The real file
                    // will finish warming whatever remains.
                    handleParseRequest(msg);
                    interrupted = true;
                }
                // Drain any additional queued messages
                pending = receiveMessageOnPort(parentPort);
            }
        }

        // If we handled a real parse, skip remaining warm-up.
        // The real parse has already warmed the DFA for the user's file.
        if (interrupted) {
            parentPort?.postMessage({
                warmup: true,
                elapsed: Date.now() - t0,
                interrupted: true,
                chunksCompleted: i,
                totalChunks: chunks.length,
            });
            return;
        }

        // Parse this warm-up chunk (SLL with LL fallback)
        try {
            parseSnippet(chunks[i]);
        } catch {
            // best effort
        }
    }

    parentPort?.postMessage({
        warmup: true,
        elapsed: Date.now() - t0,
        interrupted: false,
        chunksCompleted: chunks.length,
        totalChunks: chunks.length,
    });
});

// After warm-up completes (or is interrupted), subsequent messages go
// through the standard event handler.
parentPort?.on('message', (msg: ParseRequest | CancelRequest) => {
    if ('cancel' in msg) {
        cancelledIds.add(msg.id);
        return;
    }
    handleParseRequest(msg);
});
