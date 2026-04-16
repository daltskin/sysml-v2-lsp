import { BaseErrorListener, RecognitionException, Recognizer, Token } from 'antlr4ng';

/**
 * A syntax error captured during ANTLR parsing.
 */
export interface SyntaxError {
    /** 0-based line number */
    line: number;
    /** 0-based column */
    column: number;
    /** Human-readable error message */
    message: string;
    /** The offending token (if available) */
    offendingSymbol?: Token;
    /** Length of the offending region (for underlining) */
    length: number;
}

/**
 * Custom ANTLR error listener that collects syntax errors
 * instead of printing them to stderr.
 */
export class SysMLErrorListener extends BaseErrorListener {
    private errors: SyntaxError[] = [];

    syntaxError(
        recognizer: Recognizer<any>,
        offendingSymbol: unknown,
        line: number,
        charPositionInLine: number,
        msg: string,
        _e: RecognitionException | null,
    ): void {
        const token = offendingSymbol as Token | undefined;
        const length = token?.text?.length ?? 1;

        this.errors.push({
            // ANTLR lines are 1-based, convert to 0-based for LSP.
            // Clamp to 0 to guard against edge cases (e.g. EOF at line 0).
            line: Math.max(0, line - 1),
            column: charPositionInLine,
            message: msg,
            offendingSymbol: token,
            length,
        });
    }

    getErrors(): SyntaxError[] {
        return this.errors;
    }

    hasErrors(): boolean {
        return this.errors.length > 0;
    }
}
