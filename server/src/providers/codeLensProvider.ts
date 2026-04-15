import {
    CodeLens,
    CodeLensParams,
    Command,
} from 'vscode-languageserver/node.js';
import { DocumentManager } from '../documentManager.js';
import { isDefinition, SysMLSymbol } from '../symbols/sysmlElements.js';

/**
 * Provides CodeLens annotations above SysML definitions.
 *
 * Shows "N references" above each definition, clickable to open
 * the references panel.
 */
export class CodeLensProvider {

    constructor(private documentManager: DocumentManager) { }

    provideCodeLenses(params: CodeLensParams): CodeLens[] {
        const uri = params.textDocument.uri;
        const symbolTable = this.documentManager.getSymbolTable(uri);
        if (!symbolTable) return [];

        const symbols = symbolTable.getSymbolsForUri(uri);
        const lenses: CodeLens[] = [];

        for (const sym of symbols) {
            // Only show lenses for definitions and packages
            if (!isDefinition(sym.kind) && sym.kind !== 'package') continue;

            const refCount = this.countReferences(sym);

            const command: Command = {
                title: refCount === 1
                    ? '1 reference'
                    : `${refCount} references`,
                command: 'sysml.findReferences',
                arguments: [
                    uri,
                    {
                        line: sym.selectionRange.start.line,
                        character: sym.selectionRange.start.character,
                    },
                ],
            };

            lenses.push({
                range: sym.selectionRange,
                command,
            });
        }

        return lenses;
    }

    private countReferences(sym: SysMLSymbol): number {
        // Count symbol references across all open documents
        const symbolTable = this.documentManager.getSymbolTable(sym.uri);
        return symbolTable ? symbolTable.findReferences(sym.name).length : 0;
    }
}
