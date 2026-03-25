import { Token } from 'antlr4ng';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node.js';
import { SysMLv2Lexer } from '../generated/SysMLv2Lexer.js';
import { ParseResult } from '../parser/parseDocument.js';

/**
 * SysML definition/usage keywords — tokens that can appear at the start
 * of a top-level or body-level element. If an identifier looks very close
 * to one of these, it's likely a typo.
 */
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

/**
 * Compute Levenshtein distance between two strings.
 * Uses two-row optimisation for O(min(m,n)) space.
 */
function levenshtein(a: string, b: string): number {
    // Ensure b is the shorter string to minimise memory
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
                prev[j] + 1,        // deletion
                curr[j - 1] + 1,    // insertion
                prev[j - 1] + cost, // substitution
            );
        }
        [prev, curr] = [curr, prev];
    }
    return prev[n];
}

/**
 * Find the closest keyword to the given identifier, if within distance threshold.
 */
function findClosestKeyword(identifier: string, maxDistance = 2): string | undefined {
    const lower = identifier.toLowerCase();

    // Don't flag very short identifiers (too many false positives)
    if (lower.length < 4) return undefined;

    // Don't flag if it's already a keyword
    if (DEFINITION_KEYWORDS.has(lower)) return undefined;

    // Scale max distance with word length: short words need closer match
    const effectiveMax = lower.length <= 5 ? 1 : maxDistance;

    let bestMatch: string | undefined;
    let bestDist = effectiveMax + 1;

    for (const keyword of DEFINITION_KEYWORDS) {
        // Quick length check to avoid unnecessary computation
        if (Math.abs(keyword.length - lower.length) > maxDistance) continue;

        const dist = levenshtein(lower, keyword);
        if (dist > 0 && dist < bestDist) {
            bestDist = dist;
            bestMatch = keyword;
        }
    }

    return bestMatch;
}

/**
 * Set of token types that are SysML definition/usage keywords —
 * tokens that typically precede a name, `:`, `def`, `{`, etc.
 * If an identifier is followed by one of these "keyword-like continuations",
 * it's likely a misspelled keyword, not a user-defined name.
 */
const KEYWORD_CONTINUATIONS: ReadonlySet<number> = new Set([
    SysMLv2Lexer.IDENTIFIER,  // e.g. "attributedd power" — followed by a name
    SysMLv2Lexer.COLON,       // e.g. "attributedd : Type"
    SysMLv2Lexer.DEF,         // e.g. "party def Foo"
    SysMLv2Lexer.LBRACE,      // e.g. "packge { ... }"
    SysMLv2Lexer.LBRACK,      // e.g. "attributedd [2]"
    SysMLv2Lexer.ABOUT,       // e.g. keyword misuse
]);

/**
 * Token types that, when they precede an identifier, indicate the
 * identifier is a user-defined name — not a keyword typo.
 *
 * Derived from the SysML v2 grammar (formal-25-09-03):  every production
 * rule where a keyword or punctuation token directly precedes
 * an `identification`, `featureDeclaration`, `usageDeclaration`,
 * `qualifiedName`, or `ownedReferenceSubsetting`.
 */
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
    SysMLv2Lexer.IN, SysMLv2Lexer.OUT, SysMLv2Lexer.INOUT,
    SysMLv2Lexer.END,

    // ── Actor / role keywords ──
    SysMLv2Lexer.ACTOR, SysMLv2Lexer.STAKEHOLDER, SysMLv2Lexer.SUBJECT,
    SysMLv2Lexer.VARIANT, SysMLv2Lexer.SNAPSHOT, SysMLv2Lexer.TIMESLICE,

    // ── Action control node keywords ──
    SysMLv2Lexer.FORK, SysMLv2Lexer.JOIN, SysMLv2Lexer.MERGE,
    SysMLv2Lexer.DECIDE,

    // ── Reference-preceding keywords (perform x, exhibit x, …) ──
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

    // ── Misc keywords preceding a name or qualified name ──
    SysMLv2Lexer.ACCEPT, SysMLv2Lexer.SEND, SysMLv2Lexer.ASSIGN,
    SysMLv2Lexer.TERMINATE, SysMLv2Lexer.FOR, SysMLv2Lexer.ABOUT,
    SysMLv2Lexer.BY, SysMLv2Lexer.FILTER, SysMLv2Lexer.NEW,
    SysMLv2Lexer.META, SysMLv2Lexer.OF,

    // ── Punctuation that precedes names ──
    SysMLv2Lexer.COLON, SysMLv2Lexer.COLON_GT, SysMLv2Lexer.COLON_GT_GT,
    SysMLv2Lexer.COLON_COLON, SysMLv2Lexer.COLON_COLON_GT,
    SysMLv2Lexer.GT,           // closing angle bracket: <'shortName'> name
    SysMLv2Lexer.FAT_ARROW,    // => target (crosses)
    SysMLv2Lexer.TILDE,        // ~ conjugatedType
    SysMLv2Lexer.COMMA,        // list separator in specializations
    SysMLv2Lexer.HASH,         // # prefixMetadataFeature
    SysMLv2Lexer.AT,           // @ metadata annotation
]);

/**
 * Check if an identifier looks like a keyword typo based on context:
 * - The NEXT visible token is something that typically follows a keyword
 * - The PREVIOUS visible token is NOT a definition keyword (which would mean
 *   this identifier is a user-defined name, not a typo)
 */
function looksLikeKeywordPosition(visibleTokens: Token[], index: number): boolean {
    // Check previous token — if it's a definition keyword, this is a name, not a typo
    if (index > 0) {
        const prev = visibleTokens[index - 1];
        if (NAME_PRECEDING_KEYWORDS.has(prev.type)) {
            return false; // This identifier is a name after a keyword
        }
        // If preceded by dot, '=', ':=', or path/type punctuation — this is
        // a value, type reference, or path segment, not a keyword position.
        if (prev.type === SysMLv2Lexer.DOT ||
            prev.type === SysMLv2Lexer.EQ ||
            prev.type === SysMLv2Lexer.COLON_EQ) {
            return false;
        }
        // If preceded by '->' (collection invoke operator), this is a
        // function name (select, collect, reject, etc.), not a keyword.
        if (prev.text === '->') {
            return false;
        }
    }

    // Check next token — if it's something that follows a keyword, this is likely a typo
    if (index + 1 < visibleTokens.length) {
        const next = visibleTokens[index + 1];
        if (KEYWORD_CONTINUATIONS.has(next.type)) {
            return true;
        }
    }

    // First token in file is likely a keyword position
    if (index === 0) return true;

    return false;
}

/**
 * Walk the token stream and produce diagnostics for identifiers
 * that look like misspelled SysML keywords.
 */
export function validateKeywords(result: ParseResult): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    result.tokenStream.fill();
    const allTokens = result.tokenStream.getTokens();

    // Build visible token list without allocating a filtered copy on every call
    // For large files this avoids creating a huge intermediate array
    const visibleTokens: Token[] = [];
    for (let j = 0; j < allTokens.length; j++) {
        const t = allTokens[j];
        if (t.channel === 0 && t.type !== Token.EOF) {
            visibleTokens.push(t);
        }
    }

    for (let i = 0; i < visibleTokens.length; i++) {
        const token = visibleTokens[i];

        // Only check IDENTIFIER tokens
        if (token.type !== SysMLv2Lexer.IDENTIFIER) continue;

        const text = token.text;
        if (!text) continue;

        // Only flag identifiers that look like they're in a keyword position
        if (!looksLikeKeywordPosition(visibleTokens, i)) continue;

        const suggestion = findClosestKeyword(text);
        if (!suggestion) continue; // No close keyword match → likely a valid shorthand usage name

        const line = (token.line ?? 1) - 1; // 0-based
        const char = token.column ?? 0;

        const message = `Unknown keyword '${text}'. Did you mean '${suggestion}'?`;

        diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: {
                start: { line, character: char },
                end: { line, character: char + text.length },
            },
            message,
            source: 'sysml',
            data: { typo: text, suggestion },
        });
    }

    return diagnostics;
}
