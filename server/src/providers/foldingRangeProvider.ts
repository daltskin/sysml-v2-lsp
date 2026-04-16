import {
    FoldingRangeParams,
    FoldingRange,
    FoldingRangeKind,
} from 'vscode-languageserver/node.js';
import { DocumentManager } from '../documentManager.js';

/**
 * Provides folding ranges for SysML documents.
 * Detects brace blocks and block comments for folding.
 */
export class FoldingRangeProvider {
    constructor(private documentManager: DocumentManager) { }

    provideFoldingRanges(params: FoldingRangeParams): FoldingRange[] {
        const text = this.documentManager.getText(params.textDocument.uri);
        if (!text) {
            return [];
        }

        const ranges: FoldingRange[] = [];
        const lines = text.split('\n');

        // Track brace-delimited blocks
        const braceStack: number[] = [];
        // Track comment blocks
        let commentStart: number | undefined;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Block comments
            if (line.includes('/*') && !line.includes('*/')) {
                commentStart = i;
            } else if (commentStart !== undefined && line.includes('*/')) {
                ranges.push({
                    startLine: commentStart,
                    endLine: i,
                    kind: FoldingRangeKind.Comment,
                });
                commentStart = undefined;
            }

            // Braces
            for (const ch of line) {
                if (ch === '{') {
                    braceStack.push(i);
                } else if (ch === '}') {
                    const startLine = braceStack.pop();
                    if (startLine !== undefined && i > startLine) {
                        ranges.push({
                            startLine,
                            endLine: i,
                            kind: FoldingRangeKind.Region,
                        });
                    }
                }
            }
        }

        return ranges;
    }
}
