import {
    DocumentFormattingParams,
    DocumentRangeFormattingParams,
    TextEdit,
    Range,
} from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { TextDocuments } from 'vscode-languageserver/node.js';

/**
 * Provides document formatting for SysML files.
 *
 * Formatting rules:
 *  - Consistent indentation (spaces, configurable tab size)
 *  - Opening brace on same line as declaration
 *  - Closing brace aligned with opening statement
 *  - Remove trailing whitespace
 *  - Ensure single newline at end of file
 *  - Collapse multiple blank lines into one
 *  - Normalize spacing around operators (:, :>, :>>, =, ;)
 */
export class FormattingProvider {
    constructor(private documents: TextDocuments<TextDocument>) { }

    provideDocumentFormatting(params: DocumentFormattingParams): TextEdit[] {
        const doc = this.documents.get(params.textDocument.uri);
        if (!doc) return [];

        const tabSize = params.options.tabSize ?? 4;
        const insertSpaces = params.options.insertSpaces ?? true;
        const indent = insertSpaces ? ' '.repeat(tabSize) : '\t';

        const text = doc.getText();
        const formatted = this.formatSysML(text, indent);

        if (formatted === text) return [];

        // Replace entire document
        return [
            TextEdit.replace(
                Range.create(0, 0, doc.lineCount, 0),
                formatted,
            ),
        ];
    }

    provideRangeFormatting(params: DocumentRangeFormattingParams): TextEdit[] {
        const doc = this.documents.get(params.textDocument.uri);
        if (!doc) return [];

        const tabSize = params.options.tabSize ?? 4;
        const insertSpaces = params.options.insertSpaces ?? true;
        const indent = insertSpaces ? ' '.repeat(tabSize) : '\t';

        // Extract the range text
        const rangeText = doc.getText(params.range);
        const formatted = this.formatSysML(rangeText, indent);

        if (formatted === rangeText) return [];

        return [TextEdit.replace(params.range, formatted)];
    }

    private formatSysML(text: string, indent: string): string {
        const lines = text.split('\n');
        const result: string[] = [];
        let depth = 0;
        let prevBlank = false;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];

            // Remove trailing whitespace
            line = line.trimEnd();

            // Skip processing for empty lines (collapse multiples)
            if (line.trim() === '') {
                if (!prevBlank && result.length > 0) {
                    result.push('');
                    prevBlank = true;
                }
                continue;
            }
            prevBlank = false;

            const trimmed = line.trim();

            // Handle closing braces — decrease indent before this line
            let leadingCloses = 0;
            for (let c = 0; c < trimmed.length; c++) {
                const ch = trimmed[c];
                if (ch === '}' || ch === ']') leadingCloses++;
                else break;
            }
            if (leadingCloses > 0) {
                depth = Math.max(0, depth - leadingCloses);
            }

            // Check if this line is inside a string or comment
            const isLineComment = trimmed.startsWith('//');
            const isBlockCommentContinuation =
                !trimmed.startsWith('/*') &&
                (trimmed.startsWith('*') || trimmed.startsWith('*/'));

            // Apply indentation
            let indented: string;
            if (isBlockCommentContinuation) {
                // Align block comment continuation with one extra space
                indented = indent.repeat(depth) + ' ' + trimmed;
            } else if (isLineComment) {
                indented = indent.repeat(depth) + trimmed;
            } else {
                // Normalize spacing in the trimmed line
                const normalized = this.normalizeSpacing(trimmed);
                indented = indent.repeat(depth) + normalized;
            }

            result.push(indented);

            // Count braces for depth tracking (ignoring those in strings/comments)
            if (!isLineComment) {
                const opens = this.countOutsideStrings(trimmed, '{') +
                    this.countOutsideStrings(trimmed, '[');
                const closes = this.countOutsideStrings(trimmed, '}') +
                    this.countOutsideStrings(trimmed, ']');
                // We already accounted for leading closes above
                depth += opens - closes + leadingCloses;
                depth = Math.max(0, depth);
            }
        }

        // Ensure single trailing newline
        while (result.length > 0 && result[result.length - 1] === '') {
            result.pop();
        }
        result.push('');

        return result.join('\n');
    }

    /**
     * Normalize spacing around common SysML operators.
     * Preserves spacing inside strings. No regex.
     */
    private normalizeSpacing(line: string): string {
        // Don't modify lines that are primarily strings
        if (line.startsWith('"') || line.startsWith("'")) return line;

        const len = line.length;
        let result = '';
        let inString = false;
        let stringChar = '';

        for (let i = 0; i < len; i++) {
            const ch = line[i];

            // Track string boundaries
            if (inString) {
                result += ch;
                if (ch === stringChar && (i === 0 || line[i - 1] !== '\\')) {
                    inString = false;
                }
                continue;
            }
            if (ch === '"' || ch === "'") {
                inString = true;
                stringChar = ch;
                result += ch;
                continue;
            }

            // Normalize space before opening brace: collapse whitespace before '{'
            if (ch === '{') {
                // Remove trailing whitespace from result, then add single space
                let end = result.length;
                while (end > 0 && (result[end - 1] === ' ' || result[end - 1] === '\t')) end--;
                result = result.substring(0, end) + ' {';
                continue;
            }

            // Ensure space after semicolons (for inline statements)
            if (ch === ';' && i + 1 < len) {
                result += ';';
                // Skip whitespace after semicolon
                let j = i + 1;
                while (j < len && (line[j] === ' ' || line[j] === '\t')) j++;
                // If there's a non-whitespace character after, add single space
                if (j < len) {
                    result += ' ';
                    i = j - 1; // loop will increment
                }
                continue;
            }

            // Collapse multiple spaces (outside strings)
            if (ch === ' ' || ch === '\t') {
                // Skip consecutive whitespace
                let j = i + 1;
                while (j < len && (line[j] === ' ' || line[j] === '\t')) j++;
                result += ' ';
                i = j - 1; // loop will increment
                continue;
            }

            result += ch;
        }

        return result;
    }

    /**
     * Count occurrences of a character outside of string literals.
     */
    private countOutsideStrings(line: string, char: string): number {
        let count = 0;
        let inString = false;
        let stringChar = '';

        for (let i = 0; i < line.length; i++) {
            const c = line[i];

            if (inString) {
                if (c === stringChar && line[i - 1] !== '\\') {
                    inString = false;
                }
            } else if (c === '"' || c === "'") {
                inString = true;
                stringChar = c;
            } else if (c === '/' && i + 1 < line.length) {
                if (line[i + 1] === '/') break; // line comment
                if (line[i + 1] === '*') break; // block comment start
            } else if (c === char) {
                count++;
            }
        }

        return count;
    }
}
