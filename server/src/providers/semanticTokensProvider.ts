import {
    SemanticTokens,
    SemanticTokensBuilder,
    SemanticTokensParams,
} from 'vscode-languageserver/node';
import { DocumentManager } from '../documentManager.js';
import { SysMLv2Lexer } from '../generated/SysMLv2Lexer.js';
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
    /** Cached semantic tokens keyed by URI + version. */
    private tokenCache?: { uri: string; version: number; tokens: SemanticTokens };

    constructor(private documentManager: DocumentManager) { }

    provideSemanticTokens(params: SemanticTokensParams): SemanticTokens {
        const uri = params.textDocument.uri;
        const version = this.documentManager.getVersion(uri);

        // Return cached tokens if the document hasn't changed.
        if (this.tokenCache && this.tokenCache.uri === uri && this.tokenCache.version === version) {
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

        let prevMeaningful: string | undefined;

        for (const token of tokens) {
            if (!token.text || token.channel !== 0) {
                continue; // Skip hidden channel tokens (whitespace)
            }

            const text = token.text;
            const tokenType = this.classifyTokenInContext(text, prevMeaningful, token.type);

            // Track previous meaningful token for context-sensitive classification
            prevMeaningful = text;

            if (tokenType === undefined) {
                continue;
            }

            const line = (token.line ?? 1) - 1; // 0-based
            const char = token.column ?? 0;
            const length = text.length;

            builder.push(line, char, length, tokenType, 0);
        }

        const built = builder.build();

        // Cache the result for this URI + version.
        this.tokenCache = { uri, version, tokens: built };

        return built;
    }

    /**
     * Classify a token using surrounding context to match tmLanguage scopes.
     */
    private classifyTokenInContext(text: string, prev: string | undefined, lexerType: number): number | undefined {
        // Comments
        if (lexerType === SysMLv2Lexer.REGULAR_COMMENT || lexerType === SysMLv2Lexer.SINGLE_LINE_NOTE) {
            return 7; // comment
        }

        // Strings
        if (lexerType === SysMLv2Lexer.STRING || lexerType === SysMLv2Lexer.DOUBLE_STRING) {
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

        // Identifiers — context-sensitive classification
        if (lexerType === SysMLv2Lexer.IDENTIFIER) {
            return this.classifyIdentifier(prev);
        }

        return undefined;
    }

    /**
     * Classify an identifier based on the previous meaningful token,
     * mirroring the tmLanguage patterns for consistent highlighting.
     */
    private classifyIdentifier(prev: string | undefined): number {
        if (!prev) return 3; // default: variable

        // After 'def' → type definition (matches entity.name.type.sysml)
        if (prev === 'def') return 2; // class

        // After package/namespace/library → namespace (matches entity.name.namespace.sysml)
        if (prev === 'package' || prev === 'namespace' || prev === 'library') return 0; // namespace

        // After action/calc → function name (matches entity.name.function.sysml)
        if (prev === 'action' || prev === 'calc' || prev === 'analysis' || prev === 'verification') return 5; // function

        // After ':' or ':>' or ':>>' → type reference (matches entity.name.type.sysml)
        if (prev === ':' || prev === ':>' || prev === ':>>') return 1; // type

        // After 'attribute' → property (matches variable.other.property.sysml)
        if (prev === 'attribute') return 4; // property

        // After structural/usage keywords → member variable (matches variable.other.member.sysml)
        if (this.isStructuralKeyword(prev)) return 3; // variable

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
