import { BailErrorStrategy, CharStream, CommonTokenStream, DefaultErrorStrategy, ParserRuleContext, PredictionMode } from 'antlr4ng';
import { SysMLv2Lexer } from '../generated/SysMLv2Lexer.js';
import { SysMLv2Parser } from '../generated/SysMLv2Parser.js';
import { clearPreSeededDFAStates, isDfaPreSeeded, markDfaNotPreSeeded } from './dfaLoader.js';
import { SyntaxError, SysMLErrorListener } from './errorListener.js';

/**
 * Result of parsing a SysML document.
 */
export interface ParseResult {
    /** The root parse tree (null if parsing failed completely) */
    tree: ParserRuleContext | null;
    /** The token stream (for position lookup and semantic tokens) */
    tokenStream: CommonTokenStream;
    /** The parser instance (needed for antlr4-c3 completion) */
    parser: SysMLv2Parser;
    /** The lexer instance */
    lexer: SysMLv2Lexer;
    /** Syntax errors collected during parsing */
    errors: SyntaxError[];
    /** Timing breakdown */
    timing: { lexMs: number; parseMs: number };
}

/**
 * Parse a SysML document from raw text.
 *
 * Uses SLL prediction mode first (fast path). If SLL fails with a
 * parse error, falls back to LL mode for correct error recovery.
 * This two-stage strategy is the standard ANTLR4 optimisation —
 * SLL handles the vast majority of inputs and is ~2-3x faster.
 *
 * When the DFA has been pre-seeded from a snapshot, SLL may bail out
 * on grammar paths not in the snapshot (empty ATNConfigSets trigger
 * an LL fallback).  The LL pass always produces correct results
 * because it works from the ATN, not the DFA.  As a side effect,
 * LL builds correct DFA states for the uncovered paths, so the NEXT
 * parse of any file benefits from the corrected DFA.
 *
 * If a pre-seeded DFA parse produces errors, the first file that
 * triggers this pays a small one-time penalty (~200-500 ms for the
 * LL computation).  All subsequent parses are fast.
 */
export function parseDocument(text: string): ParseResult {
    const result = parseDocumentCore(text);

    // If errors occurred with a pre-seeded DFA, they might be false
    // positives from incomplete snapshot coverage.  Clear all pre-seeded
    // DFA states and re-parse with LL-only mode — this computes
    // transitions from the ATN directly for correct results, AND
    // populates the DFA for future parses.
    if (result.errors.length > 0 && isDfaPreSeeded()) {
        markDfaNotPreSeeded();
        clearPreSeededDFAStates();
        return parseDocumentLL(text);
    }

    // Clear the flag after first successful parse so the check
    // doesn't run on every subsequent parse.
    if (isDfaPreSeeded()) {
        markDfaNotPreSeeded();
    }

    return result;
}

function parseDocumentCore(text: string): ParseResult {
    const inputStream = CharStream.fromString(text);
    const lexer = new SysMLv2Lexer(inputStream);
    const tokenStream = new CommonTokenStream(lexer);

    const lexStart = Date.now();
    tokenStream.fill();
    const lexMs = Date.now() - lexStart;

    const parser = new SysMLv2Parser(tokenStream);

    // Collect errors instead of throwing
    const errorListener = new SysMLErrorListener();
    lexer.removeErrorListeners();
    parser.removeErrorListeners();

    let tree: ParserRuleContext | null = null;
    const parseStart = Date.now();

    // Stage 1: SLL (fast path — no full context, bail on ambiguity)
    try {
        parser.interpreter.predictionMode = PredictionMode.SLL;
        parser.errorHandler = new BailErrorStrategy();
        tree = parser.rootNamespace();
    } catch {
        // SLL failed — fall back to LL with full error recovery
        tree = null;
    }

    if (!tree) {
        // Stage 2: LL (full context — proper error recovery & messages)
        tokenStream.seek(0);
        parser.reset();
        parser.interpreter.predictionMode = PredictionMode.LL;
        parser.errorHandler = new DefaultErrorStrategy();
        parser.addErrorListener(errorListener);
        try {
            tree = parser.rootNamespace();
        } catch {
            // If parsing fails completely, tree remains null
        }
    }

    const parseMs = Date.now() - parseStart;

    return {
        tree,
        tokenStream,
        parser,
        lexer,
        errors: errorListener.getErrors(),
        timing: { lexMs, parseMs },
    };
}

/**
 * Parse using LL mode only (no SLL fast path).
 *
 * Used when the pre-seeded DFA produced errors — LL computes all
 * transitions from the ATN directly, producing correct results.
 * As a side effect, it builds correct DFA states for any grammar
 * paths not covered by the snapshot, so future parses benefit.
 */
function parseDocumentLL(text: string): ParseResult {
    const inputStream = CharStream.fromString(text);
    const lexer = new SysMLv2Lexer(inputStream);
    const tokenStream = new CommonTokenStream(lexer);

    const lexStart = Date.now();
    tokenStream.fill();
    const lexMs = Date.now() - lexStart;

    const parser = new SysMLv2Parser(tokenStream);
    const errorListener = new SysMLErrorListener();
    lexer.removeErrorListeners();
    parser.removeErrorListeners();
    parser.addErrorListener(errorListener);

    let tree: ParserRuleContext | null = null;
    const parseStart = Date.now();

    // LL only — computes from ATN, bypasses stale DFA states
    parser.interpreter.predictionMode = PredictionMode.LL;
    parser.errorHandler = new DefaultErrorStrategy();
    try {
        tree = parser.rootNamespace();
    } catch {
        // If parsing fails completely, tree remains null
    }

    const parseMs = Date.now() - parseStart;

    return {
        tree,
        tokenStream,
        parser,
        lexer,
        errors: errorListener.getErrors(),
        timing: { lexMs, parseMs },
    };
}
