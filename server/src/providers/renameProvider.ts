import {
    TextDocumentPositionParams,
    RenameParams,
    WorkspaceEdit,
    TextEdit,
    Range,
} from 'vscode-languageserver/node.js';
import { DocumentManager } from '../documentManager.js';
import { isIdentPart as isWordChar } from '../utils/identUtils.js';

/** Find all positions where `word` appears at word boundaries in `line`. */
function findWordOccurrences(line: string, word: string): number[] {
    const positions: number[] = [];
    let from = 0;
    while (from <= line.length - word.length) {
        const idx = line.indexOf(word, from);
        if (idx < 0) break;
        if ((idx === 0 || !isWordChar(line.charCodeAt(idx - 1))) &&
            (idx + word.length >= line.length || !isWordChar(line.charCodeAt(idx + word.length)))) {
            positions.push(idx);
        }
        from = idx + 1;
    }
    return positions;
}

/**
 * Provides symbol rename functionality.
 * Renames a symbol and updates all references within the document.
 */
export class RenameProvider {

    constructor(private documentManager: DocumentManager) { }

    /**
     * Check if the token at position is renameable and return its range.
     */
    prepareRename(params: TextDocumentPositionParams): Range | null {
        const symbolTable = this.documentManager.getSymbolTable(params.textDocument.uri);
        if (!symbolTable) return null;

        const symbol = symbolTable.findSymbolAtPosition(
            params.textDocument.uri,
            params.position.line,
            params.position.character,
        );

        if (!symbol) return null;

        return symbol.selectionRange;
    }

    /**
     * Perform the rename — update the symbol and all references.
     */
    provideRename(params: RenameParams): WorkspaceEdit | null {
        const symbolTable = this.documentManager.getSymbolTable(params.textDocument.uri);
        if (!symbolTable) return null;

        const symbol = symbolTable.findSymbolAtPosition(
            params.textDocument.uri,
            params.position.line,
            params.position.character,
        );

        if (!symbol) return null;

        // Find all occurrences of this symbol name in the document text
        const text = this.documentManager.getText(params.textDocument.uri);
        if (!text) return null;

        const edits: TextEdit[] = [];
        const oldName = symbol.name;
        const newName = params.newName;

        // Find all references by name match
        const references = symbolTable.findReferences(oldName);
        for (const ref of references) {
            if (ref.uri === params.textDocument.uri) {
                edits.push({
                    range: ref.selectionRange,
                    newText: newName,
                });
            }
        }

        // Also find text occurrences that might be type references
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            for (const col of findWordOccurrences(lines[i], oldName)) {
                const range: Range = {
                    start: { line: i, character: col },
                    end: { line: i, character: col + oldName.length },
                };
                // Avoid duplicates from symbol table
                if (!edits.some(e => e.range.start.line === i && e.range.start.character === col)) {
                    edits.push({ range, newText: newName });
                }
            }
        }

        if (edits.length === 0) return null;

        return {
            changes: {
                [params.textDocument.uri]: edits,
            },
        };
    }
}
