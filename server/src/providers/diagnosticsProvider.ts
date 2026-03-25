import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node.js';
import { DocumentManager } from '../documentManager.js';
import { SyntaxError } from '../parser/errorListener.js';

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
            // Suppress syntax errors inside blocks where the ANTLR grammar
            // has known limitations: constraint bodies (arithmetic operators),
            // requirement usage bodies (nested :>>), calc/analysis bodies.
            if (suppressedRanges.length > 0) {
                if (this.isLineInRanges(error.line, suppressedRanges)) {
                    continue;
                }
                // Also suppress cascading "extraneous input '}'" errors
                // caused by the parser losing brace-depth tracking after
                // earlier expression failures in suppressed blocks.
                if (error.message.startsWith('extraneous input \'}\' expecting')) {
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
     * The grammar can't handle arithmetic operators (+, -, *, /, ^),
     * unit expressions (W/m^2), collection operators (->select, ->collect),
     * or Boolean operators (and, or, xor) in value expressions. These
     * appear in virtually any block type (part def, calc def, analysis,
     * constraint, requirement, etc.), so we suppress errors in all
     * definition and usage blocks that contain value expressions.
     */
    private findGrammarLimitationRanges(text: string): Array<{ startLine: number; endLine: number }> {
        const ranges: Array<{ startLine: number; endLine: number }> = [];
        // Match any block opened by a SysML keyword followed by `{`.
        // This catches part def, calc def, analysis, constraint, requirement,
        // action def, state, occurrence, etc.
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
}
