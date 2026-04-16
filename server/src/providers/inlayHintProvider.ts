import {
    InlayHint,
    InlayHintKind,
    InlayHintParams,
    Position,
} from 'vscode-languageserver/node.js';
import { DocumentManager } from '../documentManager.js';
import { isDefinition, isUsage, SysMLElementKind } from '../symbols/sysmlElements.js';

/**
 * Provides inlay hints — ghost text shown inline for:
 *  - Inferred types on usages (`: TypeName`)
 *  - Supertypes on definitions (`:> SuperType`)
 *  - Element kind labels on anonymous usages
 */
export class InlayHintProvider {

    constructor(private documentManager: DocumentManager) { }

    provideInlayHints(params: InlayHintParams): InlayHint[] {
        const uri = params.textDocument.uri;
        const symbolTable = this.documentManager.getSymbolTable(uri);
        if (!symbolTable) return [];

        const symbols = symbolTable.getSymbolsForUri(uri);
        const hints: InlayHint[] = [];
        const { range } = params;

        for (const sym of symbols) {
            // Only show hints within the requested range
            if (sym.selectionRange.end.line < range.start.line ||
                sym.selectionRange.start.line > range.end.line) {
                continue;
            }

            // Show type hints for usages that have a type but don't show it inline
            if (isUsage(sym.kind) && sym.typeNames.length > 0) {
                hints.push({
                    position: Position.create(
                        sym.selectionRange.end.line,
                        sym.selectionRange.end.character,
                    ),
                    label: `: ${sym.typeNames.join(', ')}`,
                    kind: InlayHintKind.Type,
                    paddingLeft: false,
                    paddingRight: true,
                });
            }

            // Show supertype hints for definitions
            if (isDefinition(sym.kind) && sym.typeNames.length > 0) {
                hints.push({
                    position: Position.create(
                        sym.selectionRange.end.line,
                        sym.selectionRange.end.character,
                    ),
                    label: `:> ${sym.typeNames.join(', ')}`,
                    kind: InlayHintKind.Type,
                    paddingLeft: true,
                    paddingRight: true,
                });
            }

            // Show element kind for parts/attributes with children (structural context)
            if (sym.kind === SysMLElementKind.Package && sym.children.length > 0) {
                hints.push({
                    position: Position.create(
                        sym.selectionRange.end.line,
                        sym.selectionRange.end.character,
                    ),
                    label: `(${sym.children.length} members)`,
                    kind: InlayHintKind.Parameter,
                    paddingLeft: true,
                    paddingRight: false,
                });
            }
        }

        return hints;
    }
}
