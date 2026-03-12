import {
    DiagnosticSeverity,
    Hover,
    MarkupContent,
    MarkupKind,
    TextDocumentPositionParams,
} from 'vscode-languageserver/node.js';
import { DocumentManager } from '../documentManager.js';
import { getLibraryHoverInfo } from '../library/libraryIndex.js';
import { SemanticValidator } from './semanticValidator.js';
import { toMetaclassName } from '../symbols/sysmlElements.js';
import { extractQualifiedNameAt } from '../utils/identUtils.js';

/**
 * Provides hover information for SysML elements.
 * Shows element kind, type, and documentation on hover.
 */
export class HoverProvider {

    constructor(private documentManager: DocumentManager) { }

    provideHover(params: TextDocumentPositionParams): Hover | null {
        const symbolTable = this.documentManager.getSymbolTable(params.textDocument.uri);
        if (!symbolTable) {
            return null;
        }

        // Try to extract the word at hover position (for qualified name lookup)
        const text = this.documentManager.getText(params.textDocument.uri);
        const word = text
            ? this.getWordAtPosition(text, params.position.line, params.position.character)
            : undefined;

        // For qualified names (e.g. ISQ::mass), check the standard
        // library first — the qualifier strongly suggests a library ref
        if (word && word.includes('::')) {
            const libHover = this.buildLibraryHover(word);
            if (libHover) return libHover;
        }

        // Find symbol at hover position
        const symbol = symbolTable.findSymbolAtPosition(
            params.textDocument.uri,
            params.position.line,
            params.position.character,
        );

        if (!symbol) {
            // No local symbol — try unqualified library lookup for
            // the plain word
            if (word) {
                const libHover = this.buildLibraryHover(word);
                if (libHover) return libHover;
            }
            return null;
        }

        // Build hover content
        const lines: string[] = [];

        // Header: metaclass name and symbol name
        const metaclass = toMetaclassName(symbol.kind);
        lines.push(`**${metaclass}** \`${symbol.name}\``);

        // Qualified name
        if (symbol.qualifiedName !== symbol.name) {
            lines.push(`\nFully qualified: \`${symbol.qualifiedName}\``);
        }

        // Type info — also enrich with library info when available
        if (symbol.typeName) {
            lines.push(`\nType: \`${symbol.typeName}\``);

            // If the type is a library type, show its declaration
            const libInfo = getLibraryHoverInfo(symbol.typeName);
            if (libInfo) {
                if (libInfo.packageName) {
                    lines.push(`\nFrom: \`${libInfo.packageName}\``);
                }
                lines.push(`\n\`\`\`sysml\n${libInfo.declaration}\n\`\`\``);
                if (libInfo.documentation) {
                    lines.push(`\n${libInfo.documentation}`);
                }
            }
        }

        // Documentation from the local symbol
        if (symbol.documentation) {
            lines.push(`\n---\n${symbol.documentation}`);
        }

        // Attach semantic diagnostics near the hovered symbol to provide
        // actionable guidance directly in hover.
        let semanticDiags = this.documentManager.getSemanticDiagnostics(params.textDocument.uri);
        if (!semanticDiags) {
            const semanticValidator = new SemanticValidator(this.documentManager);
            semanticDiags = semanticValidator.validate(params.textDocument.uri);
            this.documentManager.setSemanticDiagnostics(params.textDocument.uri, semanticDiags);
        }
        const hoverDiags = semanticDiags.filter((d) =>
            this.rangeContainsPosition(d.range, params.position),
        );

        if (hoverDiags.length > 0) {
            lines.push('\n---\n**Semantic Feedback**');
            for (const d of hoverDiags.slice(0, 3)) {
                const sev = d.severity === DiagnosticSeverity.Error
                    ? 'Error'
                    : d.severity === DiagnosticSeverity.Warning
                        ? 'Warning'
                        : 'Hint';
                lines.push(`- **${sev}**: ${d.message}`);
                const hint = this.getRepairHint(String(d.code ?? ''));
                if (hint) {
                    lines.push(`  - Suggestion: ${hint}`);
                }
            }
        }

        const content: MarkupContent = {
            kind: MarkupKind.Markdown,
            value: lines.join('\n'),
        };

        return {
            contents: content,
            range: symbol.selectionRange,
        };
    }

    /**
     * Build a hover result from the standard library for a name.
     */
    private buildLibraryHover(name: string): Hover | null {
        const info = getLibraryHoverInfo(name);
        if (!info) return null;

        const lines: string[] = [];

        // Header with package context
        const displayName = name.includes('::')
            ? name
            : (info.packageName ? `${info.packageName}::${name}` : name);
        lines.push(`**Standard Library** \`${displayName}\``);

        // Declaration
        lines.push(`\n\`\`\`sysml\n${info.declaration}\n\`\`\``);

        if (info.packageName) {
            lines.push(`\nPackage: \`${info.packageName}\``);
        }

        // Documentation (ISO reference, etc.)
        if (info.documentation) {
            lines.push(`\n---\n${info.documentation}`);
        }

        return {
            contents: {
                kind: MarkupKind.Markdown,
                value: lines.join('\n'),
            },
        };
    }

    /**
     * Extract the word (simple or qualified) at a text position.
     * Scans for identifier segments separated by '::' without regex.
     */
    private getWordAtPosition(text: string, line: number, character: number): string | undefined {
        const lines = text.split('\n');
        if (line >= lines.length) return undefined;

        const lineText = lines[line];
        if (character >= lineText.length) return undefined;

        return extractQualifiedNameAt(lineText, character);
    }

    private rangeContainsPosition(
        range: { start: { line: number; character: number }; end: { line: number; character: number } },
        position: { line: number; character: number },
    ): boolean {
        const afterStart =
            position.line > range.start.line
            || (position.line === range.start.line && position.character >= range.start.character);
        const beforeEnd =
            position.line < range.end.line
            || (position.line === range.end.line && position.character <= range.end.character);
        return afterStart && beforeEnd;
    }

    private getRepairHint(code: string): string | undefined {
        switch (code) {
            case 'invalid-redefinition-multiplicity':
                return 'Align the redefined feature multiplicity with its base feature bounds.';
            case 'incompatible-port-types':
                return 'Connect endpoints with matching port types, or update one endpoint type.';
            case 'unresolved-constraint-reference':
                return 'Fix the reference path or add the missing feature in the referenced type.';
            case 'unresolved-type':
                return 'Define/import the missing type or correct the type name.';
            case 'invalid-multiplicity':
                return 'Use a valid bound where lower <= upper and lower is non-negative.';
            default:
                return undefined;
        }
    }
}


