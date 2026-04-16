import { Token, ParserRuleContext } from 'antlr4ng';
import { Position, Range } from 'vscode-languageserver/node.js';

/**
 * Convert an ANTLR token to an LSP Position.
 * ANTLR lines are 1-based, LSP positions are 0-based.
 */
export function tokenToPosition(token: Token): Position {
    return {
        line: (token.line ?? 1) - 1,
        character: token.column ?? 0,
    };
}

/**
 * Convert an ANTLR token to an LSP Range (single token span).
 */
export function tokenToRange(token: Token): Range {
    const start = tokenToPosition(token);
    const length = token.text?.length ?? 1;
    return {
        start,
        end: { line: start.line, character: start.character + length },
    };
}

/**
 * Convert an ANTLR ParserRuleContext to an LSP Range (spanning start to stop tokens).
 */
export function contextToRange(ctx: ParserRuleContext): Range {
    const startToken = ctx.start;
    const stopToken = ctx.stop ?? ctx.start;

    if (!startToken) {
        return { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
    }

    const start: Position = {
        line: (startToken.line ?? 1) - 1,
        character: startToken.column ?? 0,
    };

    const end: Position = stopToken
        ? {
            line: (stopToken.line ?? 1) - 1,
            character: (stopToken.column ?? 0) + (stopToken.text?.length ?? 1),
        }
        : { line: start.line, character: start.character + 1 };

    return { start, end };
}

/**
 * Check if an LSP position falls within a token's range.
 */
export function isPositionInToken(position: Position, token: Token): boolean {
    const range = tokenToRange(token);
    return isPositionInRange(position, range);
}

/**
 * Check if an LSP position falls within a range.
 */
export function isPositionInRange(position: Position, range: Range): boolean {
    if (position.line < range.start.line || position.line > range.end.line) {
        return false;
    }
    if (position.line === range.start.line && position.character < range.start.character) {
        return false;
    }
    if (position.line === range.end.line && position.character > range.end.character) {
        return false;
    }
    return true;
}

/**
 * Find the token at a given LSP position in a token stream.
 * Uses binary search on the sorted token list for O(log n) performance.
 */
export function findTokenAtPosition(
    tokens: Token[],
    position: Position,
): Token | undefined {
    let lo = 0;
    let hi = tokens.length - 1;

    while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        const token = tokens[mid];
        const tokenLine = (token.line ?? 1) - 1;
        const tokenCol = token.column ?? 0;
        const tokenEnd = tokenCol + (token.text?.length ?? 1);

        if (tokenLine < position.line || (tokenLine === position.line && tokenEnd <= position.character)) {
            lo = mid + 1;
        } else if (tokenLine > position.line || (tokenLine === position.line && tokenCol > position.character)) {
            hi = mid - 1;
        } else {
            // tokenLine === position.line && tokenCol <= position.character < tokenEnd
            return token;
        }
    }
    return undefined;
}

/**
 * Get the token index closest to a given LSP position.
 * Uses binary search for O(log n) performance.
 */
export function getTokenIndexAtPosition(
    tokens: Token[],
    position: Position,
): number {
    if (tokens.length === 0) return 0;

    let lo = 0;
    let hi = tokens.length - 1;

    while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        const token = tokens[mid];
        const tokenLine = (token.line ?? 1) - 1;
        const tokenCol = token.column ?? 0;
        const tokenEnd = tokenCol + (token.text?.length ?? 1);

        if (tokenLine < position.line || (tokenLine === position.line && tokenEnd <= position.character)) {
            lo = mid + 1;
        } else if (tokenLine > position.line || (tokenLine === position.line && tokenCol > position.character)) {
            hi = mid - 1;
        } else {
            return mid;
        }
    }
    // lo is the insertion point — return the nearest preceding token
    return Math.max(0, lo - 1);
}
