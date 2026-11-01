import {
    CodeLens,
    CodeLensParams,
    Command,
} from 'vscode-languageserver/node';
import { DocumentManager } from '../documentManager.js';
import { memberNamesOf } from '../symbols/namespaceResolver.js';
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
        // Use O(1) counting instead of allocating a result array
        const symbolTable = this.documentManager.getSymbolTable(sym.uri);
        // References written with its name or its short name (KerML 8.3.2.1.2).
        return symbolTable ? memberNamesOf(sym).reduce((count, name) => count + symbolTable.countReferences(name), 0) : 0;
    }
}
