import { SysMLv2Lexer } from '../generated/SysMLv2Lexer.js';

/**
 * Lexer token types of the symbols that map to the "operator" semantic token: the feature
 * specialization operators (SysML 8.2.2.6.2), the feature value operators `=` and `:=`, the
 * multiplicity range `..` (KerML 8.2.4.2), the qualified name separator `::`, and the expression
 * operators (KerML 8.2.5.8.1, Table 5).
 */
export const OPERATOR_TOKENS: ReadonlySet<number> = new Set([
    SysMLv2Lexer.BANG_EQ_EQ,        // !==
    SysMLv2Lexer.COLON_COLON_GT,    // ::>
    SysMLv2Lexer.COLON_GT_GT,       // :>>
    SysMLv2Lexer.EQ_EQ_EQ,          // ===
    SysMLv2Lexer.BANG_EQ,           // !=
    SysMLv2Lexer.STAR_STAR,         // **
    SysMLv2Lexer.ARROW,             // ->
    SysMLv2Lexer.DOT_DOT,           // ..
    SysMLv2Lexer.DOT_QUESTION,      // .?
    SysMLv2Lexer.COLON_COLON,       // ::
    SysMLv2Lexer.COLON_EQ,          // :=
    SysMLv2Lexer.COLON_GT,          // :>
    SysMLv2Lexer.LE,                // <=
    SysMLv2Lexer.EQ_EQ,             // ==
    SysMLv2Lexer.FAT_ARROW,         // =>
    SysMLv2Lexer.GE,                // >=
    SysMLv2Lexer.QUESTION_QUESTION, // ??
    SysMLv2Lexer.AT_AT,             // @@
    SysMLv2Lexer.HASH,              // #
    SysMLv2Lexer.DOLLAR,            // $
    SysMLv2Lexer.PERCENT,           // %
    SysMLv2Lexer.AMP,               // &
    SysMLv2Lexer.STAR,              // *
    SysMLv2Lexer.PLUS,              // +
    SysMLv2Lexer.MINUS,             // -
    SysMLv2Lexer.SLASH,             // /
    SysMLv2Lexer.LT,                // <
    SysMLv2Lexer.EQ,                // =
    SysMLv2Lexer.GT,                // >
    SysMLv2Lexer.QUESTION,          // ?
    SysMLv2Lexer.AT_SIGN,           // @
    SysMLv2Lexer.CARET,             // ^
    SysMLv2Lexer.PIPE,              // |
    SysMLv2Lexer.TILDE,             // ~
]);

/** Lexer token types of the punctuation symbols, which get no semantic token (left to the grammar). */
export const PUNCTUATION_TOKENS: ReadonlySet<number> = new Set([
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
