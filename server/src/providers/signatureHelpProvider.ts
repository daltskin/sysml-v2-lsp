import { TextDocument } from 'vscode-languageserver-textdocument';
import {
    ParameterInformation,
    SignatureHelp,
    SignatureHelpParams,
    SignatureInformation,
    TextDocuments,
} from 'vscode-languageserver/node';
import { DocumentManager } from '../documentManager.js';
import { SysMLElementKind } from '../symbols/sysmlElements.js';
import { scanQualifiedNames, splitQualifiedName } from '../utils/identUtils.js';

/**
 * Provides signature help when typing inside action/calc invocations.
 *
 * Shows parameter names and types from the definition in a tooltip
 * when the cursor is inside `perform`, `include`, or inline action bodies.
 */
export class SignatureHelpProvider {

    constructor(
        private documentManager: DocumentManager,
        private documents: TextDocuments<TextDocument>,
    ) { }

    provideSignatureHelp(params: SignatureHelpParams): SignatureHelp | null {
        const uri = params.textDocument.uri;
        const doc = this.documents.get(uri);
        if (!doc) return null;

        const result = this.documentManager.get(uri);
        if (!result) return null;

        // Use shared workspace symbol table for cross-file resolution
        const symbolTable = this.documentManager.getWorkspaceSymbolTable();

        const text = doc.getText();
        const offset = doc.offsetAt(params.position);

        // Look backward from cursor for a pattern like `perform <name>(` or `include <name>(`
        // or simply for a name that resolves to a calc/action def
        const lineText = text.slice(
            text.lastIndexOf('\n', offset - 1) + 1,
            offset,
        );

        // Match patterns: `perform ActionName(`, `include CalcName(`, or just `CalcName(`
        // Scan backward from end of lineText to find a target name without regex.
        const targetName = extractInvocationTarget(lineText);
        if (!targetName) return null;

        // Find the definition
        const defs = symbolTable.findByName(splitQualifiedName(targetName).pop()!);
        const def = defs.find(d =>
            d.kind === SysMLElementKind.ActionDef ||
            d.kind === SysMLElementKind.CalcDef ||
            d.kind === SysMLElementKind.UseCaseDef ||
            d.kind === SysMLElementKind.ConstraintDef
        );
        if (!def) return null;

        // Extract parameters from the definition's children
        const allSymbols = symbolTable.getAllSymbols();
        const params_list = allSymbols.filter(s =>
            s.parentId === def.symbolId &&
            (s.kind === SysMLElementKind.AttributeUsage ||
                s.kind === SysMLElementKind.PartUsage ||
                s.kind === SysMLElementKind.ItemUsage ||
                s.kind === SysMLElementKind.PortUsage)
        );

        if (params_list.length === 0) return null;

        const paramInfos: ParameterInformation[] = params_list.map(p => ({
            label: p.typeNames.length > 0 ? `${p.name} : ${p.typeNames.join(', ')}` : p.name,
            documentation: p.documentation ?? `${p.kind} parameter`,
        }));

        const sigLabel = `${targetName}(${paramInfos.map(p => p.label).join(', ')})`;

        const sig: SignatureInformation = {
            label: sigLabel,
            documentation: def.documentation ?? `${def.kind} ${def.name}`,
            parameters: paramInfos,
        };

        // Count commas to determine which parameter the cursor is on
        const parenIdx = lineText.lastIndexOf('(');
        const textAfterParen = parenIdx >= 0 ? lineText.slice(parenIdx + 1) : '';
        let commaCount = 0;
        for (let c = 0; c < textAfterParen.length; c++) {
            if (textAfterParen[c] === ',') commaCount++;
        }

        return {
            signatures: [sig],
            activeSignature: 0,
            activeParameter: Math.min(commaCount, paramInfos.length - 1),
        };
    }
}

/**
 * Extract the invocation target name from a line prefix like
 * `perform ActionName(` or `CalcName(` — without regex.
 *
 * Scans backward from the end of the line.
 */
function extractInvocationTarget(lineText: string): string | undefined {
    let target: string | undefined;
    for (const name of scanQualifiedNames(lineText)) {
        if (lineText.slice(name.end).trimStart().startsWith('(')) target = name.name;
    }
    return target;
}
