import { BailErrorStrategy, CharStream, CommonTokenStream, DefaultErrorStrategy, ParserRuleContext, PredictionMode } from 'antlr4ng';
import { SysMLv2Lexer } from '../generated/SysMLv2Lexer.js';
import { SysMLv2Parser } from '../generated/SysMLv2Parser.js';
import { clearAllDFAStates, hasStaleDfaStates, isDfaPreSeeded, markDfaNotPreSeeded } from './dfaLoader.js';
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

    // If errors occurred and the DFA still has stale pre-seeded states,
    // clear ALL DFA states and retry with LL-only mode.  Pre-seeded
    // child states deep in the DFA graph may have bogus ERROR edges.
    // Uses hasStaleDfaStates() so the retry fires even when a previous
    // successful parse already cleared the pre-seeded flag.
    // Reuse the lexer & token stream from the first attempt to skip re-lexing.
    if (result.errors.length > 0 && hasStaleDfaStates()) {
        markDfaNotPreSeeded();
        clearAllDFAStates();
        return parseDocumentLL(text, result.lexer, result.tokenStream);
    }

    // First successful parse with pre-seeded DFA: the pre-seeded
    // states are working correctly (SLL fast path succeeded).  Just
    // clear the flag so we don't re-enter the error retry branch on
    // future parses.  The pre-seeded edges remain in the DFA and
    // keep subsequent parses fast.
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
 *
 * Reuses the lexer/token stream from the failed SLL attempt to
 * avoid re-lexing (tokens are immutable once fill() is called).
 */
function parseDocumentLL(text: string, prevLexer?: SysMLv2Lexer, prevTokenStream?: CommonTokenStream): ParseResult {
    let lexer: SysMLv2Lexer;
    let tokenStream: CommonTokenStream;
    let lexMs: number;

    if (prevLexer && prevTokenStream) {
        // Reuse existing lexer and token stream — skip re-lexing
        lexer = prevLexer;
        tokenStream = prevTokenStream;
        tokenStream.seek(0);
        lexMs = 0;
    } else {
        const inputStream = CharStream.fromString(text);
        lexer = new SysMLv2Lexer(inputStream);
        tokenStream = new CommonTokenStream(lexer);
        const lexStart = Date.now();
        tokenStream.fill();
        lexMs = Date.now() - lexStart;
    }

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

// ── Batch parsing with instance reuse ───────────────────────────────
// Reuses a single SysMLv2Lexer and SysMLv2Parser instance across
// multiple files to avoid per-file constructor overhead.  The DFA
// cache is static (shared across all instances anyway), but the
// lexer/parser objects themselves carry non-trivial state that is
// expensive to re-initialise 279+ times during a workspace scan.

/** Shared lexer instance for batch parsing — lazily created. */
let _batchLexer: SysMLv2Lexer | undefined;
/** Shared parser instance for batch parsing — lazily created. */
let _batchParser: SysMLv2Parser | undefined;
/** Shared error strategy instances to avoid per-parse allocation. */
const _batchBailStrategy = new BailErrorStrategy();
const _batchDefaultStrategy = new DefaultErrorStrategy();

function getBatchLexer(input: CharStream): SysMLv2Lexer {
    if (!_batchLexer) {
        _batchLexer = new SysMLv2Lexer(input);
    } else {
        _batchLexer.inputStream = input;
        _batchLexer.reset();
    }
    _batchLexer.removeErrorListeners();
    return _batchLexer;
}

function getBatchParser(tokenStream: CommonTokenStream): SysMLv2Parser {
    if (!_batchParser) {
        _batchParser = new SysMLv2Parser(tokenStream);
    } else {
        _batchParser.tokenStream = tokenStream;
    }
    _batchParser.removeErrorListeners();
    return _batchParser;
}

/**
 * Parse a SysML document reusing shared lexer/parser instances.
 *
 * Designed for batch / workspace-scan scenarios where many files are
 * parsed sequentially.  Avoids allocating new Lexer/Parser objects
 * per file while preserving the SLL→LL two-stage strategy.
 *
 * Mirrors the DFA pre-seed retry logic from parseDocument(): if the
 * pre-seeded DFA produces errors, all DFA states are cleared and the
 * file is re-parsed with LL-only mode.
 *
 * IMPORTANT: The returned ParseResult references the shared parser/lexer
 * instances, so callers must NOT hold references across multiple calls.
 * The DocumentManager only retains tree + tokenStream + errors, which
 * is fine.
 */
export function parseDocumentBatch(text: string): ParseResult {
    const inputStream = CharStream.fromString(text);
    const lexer = getBatchLexer(inputStream);
    const tokenStream = new CommonTokenStream(lexer);

    const lexStart = Date.now();
    tokenStream.fill();
    const lexMs = Date.now() - lexStart;

    const parser = getBatchParser(tokenStream);
    const errorListener = new SysMLErrorListener();

    let tree: ParserRuleContext | null = null;
    const parseStart = Date.now();

    // Stage 1: SLL (fast path)
    // Attach error listener during SLL so errors are captured even
    // when SLL succeeds but the grammar produces recovery tokens.
    parser.addErrorListener(errorListener);
    try {
        parser.interpreter.predictionMode = PredictionMode.SLL;
        parser.errorHandler = _batchBailStrategy;
        tree = parser.rootNamespace();
    } catch {
        tree = null;
    }

    if (!tree) {
        // Stage 2: LL (full context)
        // Reset error listener state so LL errors don't merge with SLL errors
        errorListener.clear();
        tokenStream.seek(0);
        parser.reset();
        parser.addErrorListener(errorListener);
        parser.interpreter.predictionMode = PredictionMode.LL;
        parser.errorHandler = _batchDefaultStrategy;
        try {
            tree = parser.rootNamespace();
        } catch {
            // If parsing fails completely, tree remains null
        }
    }

    const parseMs = Date.now() - parseStart;
    const errors = errorListener.getErrors();

    // If errors occurred and the DFA still has stale pre-seeded states,
    // clear ALL DFA states and retry with LL-only mode.
    if (errors.length > 0 && hasStaleDfaStates()) {
        markDfaNotPreSeeded();
        clearAllDFAStates();
        return parseDocumentBatchLL(text, lexer, tokenStream, lexMs);
    }

    // Pre-seeded DFA working correctly — clear the flag but keep the
    // DFA edges for future parses.
    if (isDfaPreSeeded()) {
        markDfaNotPreSeeded();
    }

    return {
        tree,
        tokenStream,
        parser,
        lexer,
        errors,
        timing: { lexMs, parseMs },
    };
}

/**
 * LL-only batch parse — used when pre-seeded DFA produced errors.
 * Reuses the already-filled token stream to skip re-lexing.
 */
function parseDocumentBatchLL(
    _text: string,
    lexer: SysMLv2Lexer,
    tokenStream: CommonTokenStream,
    lexMs: number,
): ParseResult {
    tokenStream.seek(0);
    const parser = getBatchParser(tokenStream);
    const errorListener = new SysMLErrorListener();
    parser.addErrorListener(errorListener);

    let tree: ParserRuleContext | null = null;
    const parseStart = Date.now();

    parser.interpreter.predictionMode = PredictionMode.LL;
    parser.errorHandler = _batchDefaultStrategy;
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
