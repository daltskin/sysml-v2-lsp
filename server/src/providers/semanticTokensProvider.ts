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

/** Rules whose target is a feature (SysML 8.2.2.6.5): subsetted, referenced, crossed or redefined. */
const FEATURE_TARGET_RULES = new Set([
    SysMLv2Parser.RULE_ownedSubsetting,
    SysMLv2Parser.RULE_ownedReferenceSubsetting,
    SysMLv2Parser.RULE_ownedCrossSubsetting,
    SysMLv2Parser.RULE_ownedRedefinition,
]);

/**
 * The semantic token type of each specialization target name, by token index, from the production
 * it is written in (SysML 8.2.2.6.5): an OwnedSubclassification's superClassifier, an
 * OwnedFeatureTyping's type and a ConjugatedPortTyping's port definition (SysML 8.2.2.12,
 * 8.3.12.3) are types; a subsetted, referenced, crossed or redefined feature, and
 * each chainingFeature of an OwnedFeatureChain, are features. Only the last name of each qualified
 * name is the target; its qualifiers are left to the context classification.
 */
function specializationTargetTokens(tree: ParserRuleContext): Map<number, number> {
    const targets = new Map<number, number>();
    const visit = (ctx: ParserRuleContext): void => {
        if (isStandaloneFeatureTyping(ctx)) return;
        const qualifiedNames = ctx.children.filter(
            (child): child is ParserRuleContext => child instanceof ParserRuleContext && child.ruleIndex === SysMLv2Parser.RULE_qualifiedName);
        let target: number | undefined;
        if (ctx.ruleIndex === SysMLv2Parser.RULE_ownedSubclassification || ctx.ruleIndex === SysMLv2Parser.RULE_conjugatedPortTyping) target = TYPE_TARGET;
        else if (ctx.ruleIndex === SysMLv2Parser.RULE_ownedFeatureTyping) target = qualifiedNames.length === 1 ? TYPE_TARGET : FEATURE_TARGET;
        else if (FEATURE_TARGET_RULES.has(ctx.ruleIndex)) target = FEATURE_TARGET;
        if (target !== undefined) {
            for (const qualifiedName of qualifiedNames) {
                const names = qualifiedName.children.filter(
                    (child): child is ParserRuleContext => child instanceof ParserRuleContext && child.ruleIndex === SysMLv2Parser.RULE_name);
                const last = names[names.length - 1]?.start;
                if (last) targets.set(last.tokenIndex, target);
            }
            return; // A target is only qualified names: it owns nothing further to classify.
        }
        for (const child of ctx.children) {
            if (child instanceof ParserRuleContext) visit(child);
        }
    };
    visit(tree);
    return targets;
}

/**
 * Whether `ctx` is a bare name, or `~` and a name, that the grammar accepts as a standalone
 * `featureTyping` element (`nonFeatureElement > featureTyping`), as it parses the result `f(x)` or
 * `~x` of an expression body. The specification has no such element: a standalone FeatureTyping is
 * written with `typing` (KerML 8.2.4.3.2), and an OwnedFeatureTyping or ConjugatedPortTyping is
 * only part of a feature's declaration (SysML 8.2.2.6.5), so it is no typing target.
 */
function isStandaloneFeatureTyping(ctx: ParserRuleContext): boolean {
    return ctx.ruleIndex === SysMLv2Parser.RULE_featureTyping
        && ctx.parent?.ruleIndex === SysMLv2Parser.RULE_nonFeatureElement
        && ctx.children.some((child) => child instanceof ParserRuleContext
            && (child.ruleIndex === SysMLv2Parser.RULE_ownedFeatureTyping || child.ruleIndex === SysMLv2Parser.RULE_conjugatedPortTyping));
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

/** Semantic token types of a specialization's target: a type, or a feature (as for usages). */
const TYPE_TARGET = tokenTypes.indexOf('type');
const FEATURE_TARGET = tokenTypes.indexOf('variable');

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

        // The text of the last two tokens on the default channel (whitespace skipped), for
        // context-sensitive classification: `previousText` is the one just before this token.
        let previousText: string | undefined;
        let textBeforePrevious: string | undefined;
        const targets = result.tree ? specializationTargetTokens(result.tree) : new Map<number, number>();

        for (const token of tokens) {
            if (!token.text || token.channel !== 0) {
                continue; // Skip hidden channel tokens (whitespace)
            }

            const text = token.text;
            const tokenType = targets.get(token.tokenIndex) ?? this.classifyTokenInContext(text, previousText, textBeforePrevious, token.type);

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

        // Cache the result for this URI + version.
        this.tokenCache = { uri, version, tokens: built };

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

        // A specialization's target is classified by its production (specializationTargetTokens).
        // What still comes here after ':', ':>', ':>>', 'specializes', 'defined by' or 'typed by'
        // is a target's first qualifier (`T` in `: T::A`) or a name the parser recovered outside a
        // target production: it keeps the classification by the previous token.
        if (previous === ':' || previous === ':>' || previous === ':>>') return 1; // type
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
