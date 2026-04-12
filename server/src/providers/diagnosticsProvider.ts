import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node.js';
import { DocumentManager } from '../documentManager.js';
import { SyntaxError } from '../parser/errorListener.js';

/**
 * Patterns that indicate expression-level constructs the ANTLR grammar
 * cannot handle.  Only blocks whose body text matches at least one of
 * these patterns will have their syntax errors suppressed.
 *
 *  - Arithmetic / unit operators:  +  -  *  /  ^  **  used as infix
 *    operators in value expressions (e.g. `mass * 9.81`, `W/m^2`).
 *  - Collection / streaming operators:  ->  .?
 *  - Assignment operator inside expressions:  :=
 *
 * The patterns are intentionally conservative: a bare `+` adjacent to a
 * word character or digit on both sides is required, so that a `+` in a
 * comment or string doesn't trigger suppression.
 */
const EXPRESSION_OPERATOR_RE =
    /(\w\s*[+\-*/^]\s*\w)|(\w\s*\*\*\s*\w)|->|\.(?:\?)|:=/;

/**
 * Provides diagnostics (errors/warnings) for SysML documents.
 * Converts ANTLR parse errors into LSP Diagnostic objects.
 */
export class DiagnosticsProvider {
    constructor(private documentManager: DocumentManager) {}

    /**
     * Get diagnostics for a parsed document.
     */
    getDiagnostics(uri: string): Diagnostic[] {
        const result = this.documentManager.get(uri);
        if (!result) {
            return [];
        }

        const text = this.documentManager.getText(uri);
        const suppressedRanges = text ? this.findGrammarLimitationRanges(text) : [];

        const diagnostics: Diagnostic[] = [];

        for (const error of result.errors) {
            // Suppress syntax errors only inside blocks that actually
            // contain expression operators the ANTLR grammar cannot parse.
            if (suppressedRanges.length > 0) {
                if (this.isLineInRanges(error.line, suppressedRanges)) {
                    continue;
                }
                // Suppress cascading "extraneous input '}'" errors only
                // when they fall on the closing line of a suppressed block,
                // not document-wide.
                if (
                    error.message.startsWith('extraneous input \'}\' expecting') &&
                    this.isLineAtEndOfRanges(error.line, suppressedRanges)
                ) {
                    continue;
                }
            }
            diagnostics.push(this.syntaxErrorToDiagnostic(error));
        }

        return diagnostics;
    }

    private syntaxErrorToDiagnostic(error: SyntaxError): Diagnostic {
        return {
            severity: DiagnosticSeverity.Error,
            range: {
                start: { line: error.line, character: error.column },
                end: { line: error.line, character: error.column + error.length },
            },
            message: error.message,
            source: 'sysml',
        };
    }

    /**
     * Find 0-based line ranges of blocks where the ANTLR grammar has
     * known limitations and syntax errors should be suppressed.
     *
     * Only suppress errors in blocks whose body text actually contains
     * expression-level operators that the grammar cannot handle
     * (arithmetic, unit, collection, or assignment operators).  Blocks
     * without such operators will correctly report all syntax errors.
     */
    private findGrammarLimitationRanges(text: string): Array<{ startLine: number; endLine: number }> {
        const ranges: Array<{ startLine: number; endLine: number }> = [];
        // Match any block opened by a SysML keyword followed by `{`.
        const re = /\b(part|attribute|item|port|action|state|constraint|requirement|analysis|calc|occurrence|interface|connection|allocation|flow|use|verification|individual|exhibit|view|viewpoint|concern|rendering|metadata)\b([^;{]*)\{/g;
        let m: RegExpExecArray | null;

        let lineOffsets: number[] | undefined;

        while ((m = re.exec(text)) !== null) {
            const open = m.index + m[0].length - 1;
            let depth = 1;
            let i = open + 1;
            while (i < text.length && depth > 0) {
                if (text[i] === '{') depth++;
                if (text[i] === '}') depth--;
                i++;
            }
            if (depth !== 0) continue;

            // Extract the body text (between the braces, exclusive).
            const bodyText = text.slice(open + 1, i - 1);

            // Only suppress when the body actually contains expression
            // operators the grammar cannot handle.
            if (!EXPRESSION_OPERATOR_RE.test(bodyText)) {
                continue;
            }

            if (!lineOffsets) {
                lineOffsets = [0];
                for (let j = 0; j < text.length; j++) {
                    if (text[j] === '\n') lineOffsets.push(j + 1);
                }
            }

            ranges.push({
                startLine: this.offsetToLine(lineOffsets, open),
                endLine: this.offsetToLine(lineOffsets, i - 1),
            });
        }
        return ranges;
    }

    private offsetToLine(lineOffsets: number[], offset: number): number {
        let lo = 0;
        let hi = lineOffsets.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >>> 1;
            if (lineOffsets[mid] <= offset) lo = mid;
            else hi = mid - 1;
        }
        return lo;
    }

    private isLineInRanges(line: number, ranges: Array<{ startLine: number; endLine: number }>): boolean {
        return ranges.some(r => line >= r.startLine && line <= r.endLine);
    }

    private isLineAtEndOfRanges(line: number, ranges: Array<{ startLine: number; endLine: number }>): boolean {
        return ranges.some(r => line === r.endLine);
    }
}
