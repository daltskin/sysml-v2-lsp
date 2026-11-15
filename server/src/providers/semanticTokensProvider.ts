import { ParserRuleContext } from 'antlr4ng';
import {
    SemanticTokens,
    SemanticTokensBuilder,
    SemanticTokensParams,
} from 'vscode-languageserver/node';
import { DocumentManager } from '../documentManager.js';
import { SysMLv2Lexer } from '../generated/SysMLv2Lexer.js';
import { SysMLv2Parser } from '../generated/SysMLv2Parser.js';
import { SYSML_KEYWORDS } from '../utils/sysmlKeywords.js';

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

/** Lexer token types for punctuation — let tmLanguage handle these. */
const PUNCTUATION_TOKENS = new Set([
    SysMLv2Lexer.LBRACE,        // {
    SysMLv2Lexer.RBRACE,        // }
    SysMLv2Lexer.LPAREN,        // (
    SysMLv2Lexer.RPAREN,        // )
    SysMLv2Lexer.SEMI,          // ;
    SysMLv2Lexer.COMMA,         // ,
    SysMLv2Lexer.DOT,           // .
    SysMLv2Lexer.LBRACK,        // [
    SysMLv2Lexer.RBRACK,        // ]
    SysMLv2Lexer.COLON,         // :
]);

/**
 * The token index of each flow or message payload type written without a payload name (8.2.2.16
 * `PayloadFeature`): the last token of the payload's own typing. A payload with a name is typed
 * after `:`, which the context classification handles.
 */
function payloadTypeTokenIndices(tree: ParserRuleContext): Set<number> {
    const indices = new Set<number>();
    const visit = (ctx: ParserRuleContext): void => {
        for (const child of ctx.children) {
            if (!(child instanceof ParserRuleContext)) continue;
            if (ctx.ruleIndex === SysMLv2Parser.RULE_payloadFeature && child.ruleIndex === SysMLv2Parser.RULE_ownedFeatureTyping && child.stop) {
                indices.add(child.stop.tokenIndex);
            }
            visit(child);
        }
    };
    visit(tree);
    return indices;
}

/** Module-level keyword sets — allocated once, shared by all provider instances. */
const STRUCTURAL_KEYWORDS = new Set([
    'part', 'port', 'item', 'state', 'constraint', 'requirement',
    'concern', 'case', 'view', 'viewpoint', 'rendering',
    'allocation', 'connection', 'interface', 'occurrence',
    'individual', 'flow', 'binding', 'succession', 'metadata',
    'enum', 'actor', 'subject', 'ref', 'use',
]);

/**
 * Semantic token types — must match the legend registered in server capabilities.
 */
export const tokenTypes = [
    'namespace',    // 0 — packages
    'type',         // 1 — type references
    'class',        // 2 — definitions
    'variable',     // 3 — usages
    'property',     // 4 — attributes
    'function',     // 5 — actions, calcs
    'keyword',      // 6 — SysML keywords
    'comment',      // 7 — comments
    'string',       // 8 — string literals
    'number',       // 9 — numeric literals
    'operator',     // 10 — operators
    'enum',         // 11 — enumerations, states
    'interface',    // 12 — ports, interfaces
];

export const tokenModifiers = [
    'declaration',   // 0
    'definition',    // 1
    'readonly',      // 2
    'abstract',      // 3
];

/**
 * Provides semantic tokens for rich syntax highlighting.
 *
 * Walks the token stream and classifies tokens based on their type
 * and surrounding context, matching the tmLanguage patterns so that
 * editor and Copilot/MCP chat highlighting agree.
 */
export class SemanticTokensProvider {
    /**
     * The last semantic tokens, keyed by URI and text revision
     * (`DocumentManager.getRevision`), not the version, which starts over when
     * a closed document is opened again.
     */
    private tokenCache?: { uri: string; revision: number; tokens: SemanticTokens };

    constructor(private documentManager: DocumentManager) { }

    provideSemanticTokens(params: SemanticTokensParams): SemanticTokens {
        const uri = params.textDocument.uri;
        const revision = this.documentManager.getRevision(uri);

        // Return cached tokens if the document's text hasn't changed.
        if (this.tokenCache && this.tokenCache.uri === uri && this.tokenCache.revision === revision) {
            return this.tokenCache.tokens;
        }

        const builder = new SemanticTokensBuilder();

        const result = this.documentManager.get(uri);
        if (!result) {
            return builder.build();
        }

        // Get all tokens from the token stream
        result.tokenStream.fill();
        const tokens = result.tokenStream.getTokens();

        // The text of the last two tokens on the default channel (whitespace skipped), for
        // context-sensitive classification: `previousText` is the one just before this token.
        let previousText: string | undefined;
        let textBeforePrevious: string | undefined;
        const payloadTypes = result.tree ? payloadTypeTokenIndices(result.tree) : new Set<number>();

        for (const token of tokens) {
            if (!token.text || token.channel !== 0) {
                continue; // Skip hidden channel tokens (whitespace)
            }

            const text = token.text;
            const tokenType = payloadTypes.has(token.tokenIndex) ? 1 : this.classifyTokenInContext(text, previousText, textBeforePrevious, token.type);

            textBeforePrevious = previousText;
            previousText = text;

            if (tokenType === undefined) {
                continue;
            }

            const line = (token.line ?? 1) - 1; // 0-based
            const char = token.column ?? 0;
            const length = text.length;

            builder.push(line, char, length, tokenType, 0);
        }

        const built = builder.build();

        // Cache the result for this URI and text revision.
        this.tokenCache = { uri, revision, tokens: built };

        return built;
    }

    /**
     * Classify a token using surrounding context to match tmLanguage scopes.
     */
    private classifyTokenInContext(text: string, previous: string | undefined, beforePrevious: string | undefined, lexerType: number): number | undefined {
        // Comments
        if (lexerType === SysMLv2Lexer.REGULAR_COMMENT || lexerType === SysMLv2Lexer.SINGLE_LINE_NOTE) {
            return 7; // comment
        }

        // Strings: only the double-quoted form is a string literal (KerML 8.2.2.5, STRING_VALUE)
        if (lexerType === SysMLv2Lexer.DOUBLE_STRING) {
            return 8; // string
        }

        // Numbers
        if (lexerType === SysMLv2Lexer.INTEGER || lexerType === SysMLv2Lexer.REAL) {
            return 9; // number
        }

        // Operators
        if (OPERATOR_TOKENS.has(lexerType)) {
            return 10; // operator
        }

        // Punctuation — let tmLanguage handle
        if (PUNCTUATION_TOKENS.has(lexerType)) {
            return undefined;
        }

        // SysML keywords
        if (this.isKeyword(text)) {
            return 6; // keyword
        }

        // Names — context-sensitive classification. A single-quoted name (KerML 8.2.2.3,
        // UNRESTRICTED_NAME) is a name like a basic one, not a string literal.
        if (lexerType === SysMLv2Lexer.IDENTIFIER || lexerType === SysMLv2Lexer.STRING) {
            return this.classifyIdentifier(previous, beforePrevious);
        }

        return undefined;
    }

    /**
     * Classify an identifier by the text of the two tokens before it,
     * mirroring the tmLanguage patterns for consistent highlighting.
     */
    private classifyIdentifier(previous: string | undefined, beforePrevious: string | undefined): number {
        if (!previous) return 3; // default: variable

        // After 'def' → type definition (matches entity.name.type.sysml)
        if (previous === 'def') return 2; // class

        // After package/namespace/library → namespace (matches entity.name.namespace.sysml)
        if (previous === 'package' || previous === 'namespace' || previous === 'library') return 0; // namespace

        // After action/calc → function name (matches entity.name.function.sysml)
        if (previous === 'action' || previous === 'calc' || previous === 'analysis' || previous === 'verification') return 5; // function

        // After ':' or ':>' or ':>>' → type reference (matches entity.name.type.sysml)
        if (previous === ':' || previous === ':>' || previous === ':>>') return 1; // type

        // After the keyword forms of ':' and ':>' naming a type → type reference, like the symbol
        // (SysML 8.2.2.1: DEFINED_BY = ':' | 'defined' 'by', SPECIALIZES = ':>' | 'specializes';
        // KerML 8.2.2.1: TYPED_BY = ':' | 'typed' 'by')
        if (previous === 'specializes') return 1; // type
        if (previous === 'by' && (beforePrevious === 'defined' || beforePrevious === 'typed')) return 1; // type

        // After 'attribute' → property (matches variable.other.property.sysml)
        if (previous === 'attribute') return 4; // property

        // After structural/usage keywords → member variable (matches variable.other.member.sysml)
        if (this.isStructuralKeyword(previous)) return 3; // variable

        // Default: generic identifier
        return 3; // variable
    }

    /**
     * Keywords that precede member/instance names in usage declarations.
     */
    private isStructuralKeyword(text: string): boolean {
        return STRUCTURAL_KEYWORDS.has(text);
    }

    private isKeyword(text: string): boolean {
        return SYSML_KEYWORDS.has(text);
    }
}
