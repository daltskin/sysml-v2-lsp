import {
    SelectionRange,
    SelectionRangeParams,
    Range,
} from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { TextDocuments } from 'vscode-languageserver/node.js';

/** Check if a char code is whitespace (space, tab, CR, LF, etc.) without regex. */
function isWhitespace(c: number): boolean {
    return c === 32 || c === 9 || c === 10 || c === 13 || // space, tab, LF, CR
        c === 12 || c === 11;                          // form feed, vertical tab
}

/**
 * Provides smart selection ranges for SysML documents.
 *
 * When the user expands their selection (Shift+Alt+Right), this provider
 * guides the selection through semantically meaningful regions:
 *   word → expression → statement → block → definition → package
 */
export class SelectionRangeProvider {
    constructor(private documents: TextDocuments<TextDocument>) { }

    provideSelectionRanges(params: SelectionRangeParams): SelectionRange[] {
        const doc = this.documents.get(params.textDocument.uri);
        if (!doc) return [];

        const text = doc.getText();
        return params.positions.map((pos) => {
            const offset = doc.offsetAt(pos);
            return this.buildSelectionRange(doc, text, offset);
        });
    }

    private buildSelectionRange(
        doc: TextDocument,
        text: string,
        offset: number,
    ): SelectionRange {
        // Build a chain of increasingly larger ranges
        const ranges: Range[] = [];

        // 1. Current word
        const wordRange = this.getWordRange(doc, text, offset);
        if (wordRange) ranges.push(wordRange);

        // 2. Current statement (up to next semicolon or brace)
        const stmtRange = this.getStatementRange(doc, text, offset);
        if (stmtRange) ranges.push(stmtRange);

        // 3. Enclosing brace blocks (innermost first)
        const braceRanges = this.getEnclosingBraceRanges(doc, text, offset);
        ranges.push(...braceRanges);

        // 4. Entire document
        ranges.push(Range.create(0, 0, doc.lineCount - 1, doc.getText().length));

        // Deduplicate and sort by size (smallest first)
        const unique = this.deduplicateRanges(ranges);

        // Build chain from innermost to outermost
        let current: SelectionRange | undefined;
        for (let i = unique.length - 1; i >= 0; i--) {
            current = { range: unique[i], parent: current };
        }

        return current ?? { range: Range.create(0, 0, 0, 0) };
    }

    private getWordRange(
        doc: TextDocument,
        text: string,
        offset: number,
    ): Range | undefined {
        // Find word boundaries
        const wordPattern = /[a-zA-Z_]\w*/g;
        let match;
        while ((match = wordPattern.exec(text)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (start <= offset && offset <= end) {
                return Range.create(
                    doc.positionAt(start),
                    doc.positionAt(end),
                );
            }
            if (start > offset) break;
        }
        return undefined;
    }

    private getStatementRange(
        doc: TextDocument,
        text: string,
        offset: number,
    ): Range | undefined {
        // Find the statement containing this offset
        // A statement ends at ';' or at a '{' (start of block)
        let stmtStart = offset;
        let stmtEnd = offset;

        // Scan backward for statement start
        while (stmtStart > 0) {
            const ch = text[stmtStart - 1];
            if (ch === ';' || ch === '{' || ch === '}') break;
            stmtStart--;
        }

        // Scan forward for statement end
        while (stmtEnd < text.length) {
            const ch = text[stmtEnd];
            if (ch === ';') {
                stmtEnd++; // include semicolon
                break;
            }
            if (ch === '{') break;
            stmtEnd++;
        }

        // Trim whitespace
        while (stmtStart < offset && isWhitespace(text.charCodeAt(stmtStart))) stmtStart++;
        while (stmtEnd > offset && stmtEnd > stmtStart && isWhitespace(text.charCodeAt(stmtEnd - 1))) stmtEnd--;

        if (stmtEnd <= stmtStart) return undefined;

        return Range.create(
            doc.positionAt(stmtStart),
            doc.positionAt(stmtEnd),
        );
    }

    private getEnclosingBraceRanges(
        doc: TextDocument,
        text: string,
        offset: number,
    ): Range[] {
        const ranges: Range[] = [];

        // Find matching brace pairs that contain the offset
        const braceStack: number[] = [];
        const pairs: [number, number][] = [];

        for (let i = 0; i < text.length; i++) {
            if (text[i] === '{') {
                braceStack.push(i);
            } else if (text[i] === '}') {
                const open = braceStack.pop();
                if (open !== undefined && open < offset && i >= offset) {
                    pairs.push([open, i + 1]);
                }
            }
        }

        // Sort by range size (smallest/innermost first)
        pairs.sort((a, b) => (a[1] - a[0]) - (b[1] - b[0]));

        for (const [start, end] of pairs) {
            // Include the content inside braces
            ranges.push(
                Range.create(doc.positionAt(start), doc.positionAt(end)),
            );

            // Also include the declaration before the opening brace
            let declStart = start;
            while (declStart > 0 && text[declStart - 1] !== ';' &&
                text[declStart - 1] !== '{' && text[declStart - 1] !== '}') {
                declStart--;
            }
            while (declStart < start && isWhitespace(text.charCodeAt(declStart))) declStart++;
            if (declStart < start) {
                ranges.push(
                    Range.create(doc.positionAt(declStart), doc.positionAt(end)),
                );
            }
        }

        return ranges;
    }

    private deduplicateRanges(ranges: Range[]): Range[] {
        const unique: Range[] = [];
        const seen = new Set<string>();

        // Sort by range size
        const sorted = ranges.sort((a, b) => {
            const sizeA = (a.end.line - a.start.line) * 10000 +
                (a.end.character - a.start.character);
            const sizeB = (b.end.line - b.start.line) * 10000 +
                (b.end.character - b.start.character);
            return sizeA - sizeB;
        });

        for (const range of sorted) {
            const key = `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(range);
            }
        }

        return unique;
    }
}
