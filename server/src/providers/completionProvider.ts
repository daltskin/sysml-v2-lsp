import {
    CompletionItem,
    CompletionItemKind,
    TextDocumentPositionParams,
    InsertTextFormat,
} from 'vscode-languageserver/node.js';
import { DocumentManager } from '../documentManager.js';
import { isDefinition, SysMLElementKind } from '../symbols/sysmlElements.js';

/**
 * SysML v2 keyword completions organized by category.
 */
const SYSML_KEYWORDS: { label: string; kind: CompletionItemKind; detail: string; documentation: string; insertText?: string; insertTextFormat?: InsertTextFormat }[] = [
    // Definitions
    { label: 'part def', kind: CompletionItemKind.Class, detail: 'Part definition', documentation: 'Defines a type of part that can be instantiated', insertText: 'part def ${1:Name} {\n\t$0\n}', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'action def', kind: CompletionItemKind.Function, detail: 'Action definition', documentation: 'Defines a type of action/behavior', insertText: 'action def ${1:Name} {\n\t$0\n}', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'state def', kind: CompletionItemKind.Enum, detail: 'State definition', documentation: 'Defines a state machine', insertText: 'state def ${1:Name} {\n\t$0\n}', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'requirement def', kind: CompletionItemKind.Interface, detail: 'Requirement definition', documentation: 'Defines a type of requirement', insertText: 'requirement def ${1:Name} {\n\tdoc /* ${2:description} */\n\t$0\n}', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'constraint def', kind: CompletionItemKind.Constant, detail: 'Constraint definition', documentation: 'Defines a reusable constraint', insertText: 'constraint def ${1:Name} {\n\t$0\n}', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'attribute def', kind: CompletionItemKind.Property, detail: 'Attribute definition', documentation: 'Defines a type of attribute/value', insertText: 'attribute def ${1:Name} {\n\t$0\n}', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'item def', kind: CompletionItemKind.Class, detail: 'Item definition', documentation: 'Defines a type of item that can flow', insertText: 'item def ${1:Name} {\n\t$0\n}', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'port def', kind: CompletionItemKind.Interface, detail: 'Port definition', documentation: 'Defines a type of port for connections', insertText: 'port def ${1:Name} {\n\t$0\n}', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'interface def', kind: CompletionItemKind.Interface, detail: 'Interface definition', documentation: 'Defines an interface contract', insertText: 'interface def ${1:Name} {\n\t$0\n}', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'connection def', kind: CompletionItemKind.Interface, detail: 'Connection definition', documentation: 'Defines a type of connection', insertText: 'connection def ${1:Name} {\n\t$0\n}', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'allocation def', kind: CompletionItemKind.Interface, detail: 'Allocation definition', documentation: 'Defines a type of allocation', insertText: 'allocation def ${1:Name} {\n\t$0\n}', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'use case def', kind: CompletionItemKind.Event, detail: 'Use case definition', documentation: 'Defines a use case', insertText: 'use case def ${1:Name} {\n\t$0\n}', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'view def', kind: CompletionItemKind.Struct, detail: 'View definition', documentation: 'Defines a view of the model', insertText: 'view def ${1:Name} {\n\t$0\n}', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'viewpoint def', kind: CompletionItemKind.Struct, detail: 'Viewpoint definition', documentation: 'Defines a viewpoint for stakeholders', insertText: 'viewpoint def ${1:Name} {\n\t$0\n}', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'enum def', kind: CompletionItemKind.Enum, detail: 'Enumeration definition', documentation: 'Defines an enumeration type', insertText: 'enum def ${1:Name} {\n\t${2:value1};\n\t${3:value2};\n}', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'calc def', kind: CompletionItemKind.Function, detail: 'Calculation definition', documentation: 'Defines a calculation/function', insertText: 'calc def ${1:Name} {\n\t$0\n}', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'metadata def', kind: CompletionItemKind.TypeParameter, detail: 'Metadata definition', documentation: 'Defines custom metadata/stereotypes', insertText: 'metadata def ${1:Name} {\n\t$0\n}', insertTextFormat: InsertTextFormat.Snippet },

    // Usages
    { label: 'part', kind: CompletionItemKind.Variable, detail: 'Part usage', documentation: 'Creates a part instance', insertText: 'part ${1:name} : ${2:Type};', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'action', kind: CompletionItemKind.Function, detail: 'Action usage', documentation: 'Creates an action/behavior instance', insertText: 'action ${1:name} {\n\t$0\n}', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'state', kind: CompletionItemKind.Enum, detail: 'State usage', documentation: 'Creates a state instance', insertText: 'state ${1:name} {\n\t$0\n}', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'attribute', kind: CompletionItemKind.Property, detail: 'Attribute usage', documentation: 'Creates an attribute/value', insertText: 'attribute ${1:name} : ${2:Type};', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'port', kind: CompletionItemKind.Interface, detail: 'Port usage', documentation: 'Creates a port', insertText: 'port ${1:name} : ${2:PortType};', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'item', kind: CompletionItemKind.Variable, detail: 'Item usage', documentation: 'Creates an item instance', insertText: 'item ${1:name} : ${2:Type};', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'requirement', kind: CompletionItemKind.Interface, detail: 'Requirement usage', documentation: 'Creates a requirement instance', insertText: 'requirement ${1:name} {\n\t$0\n}', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'connection', kind: CompletionItemKind.Reference, detail: 'Connection usage', documentation: 'Creates a connection between parts', insertText: 'connection ${1:name} connect ${2:source} to ${3:target};', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'ref', kind: CompletionItemKind.Reference, detail: 'Reference usage', documentation: 'Creates a reference to another element', insertText: 'ref ${1:name} : ${2:Type};', insertTextFormat: InsertTextFormat.Snippet },

    // Structure
    { label: 'package', kind: CompletionItemKind.Module, detail: 'Package', documentation: 'Creates a namespace container', insertText: 'package ${1:Name} {\n\t$0\n}', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'import', kind: CompletionItemKind.Module, detail: 'Import', documentation: 'Imports elements from another namespace', insertText: 'import ${1:namespace}::*;', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'alias', kind: CompletionItemKind.Reference, detail: 'Alias', documentation: 'Creates an alias for an element', insertText: 'alias ${1:newName} for ${2:existingElement};', insertTextFormat: InsertTextFormat.Snippet },

    // Relationships
    { label: 'connect', kind: CompletionItemKind.Operator, detail: 'Connection', documentation: 'Connects two endpoints', insertText: 'connect ${1:source} to ${2:target};', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'bind', kind: CompletionItemKind.Operator, detail: 'Binding', documentation: 'Binds two features together', insertText: 'bind ${1:source} = ${2:target};', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'flow', kind: CompletionItemKind.Operator, detail: 'Flow', documentation: 'Defines item flow between parts', insertText: 'flow of ${1:ItemType} from ${2:source} to ${3:target};', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'satisfy', kind: CompletionItemKind.Operator, detail: 'Satisfaction', documentation: 'Indicates requirement satisfaction', insertText: 'satisfy ${1:requirement} by ${2:element};', insertTextFormat: InsertTextFormat.Snippet },

    // Modifiers
    { label: 'abstract', kind: CompletionItemKind.Keyword, detail: 'Abstract modifier', documentation: 'Makes element abstract' },
    { label: 'readonly', kind: CompletionItemKind.Keyword, detail: 'Readonly modifier', documentation: 'Makes attribute readonly' },
    { label: 'derived', kind: CompletionItemKind.Keyword, detail: 'Derived modifier', documentation: 'Indicates value is derived/calculated' },
    { label: 'in', kind: CompletionItemKind.Keyword, detail: 'Input direction', documentation: 'Port/parameter receives input' },
    { label: 'out', kind: CompletionItemKind.Keyword, detail: 'Output direction', documentation: 'Port/parameter provides output' },
    { label: 'inout', kind: CompletionItemKind.Keyword, detail: 'Bidirectional direction', documentation: 'Port/parameter is bidirectional' },

    // Documentation
    { label: 'doc', kind: CompletionItemKind.Text, detail: 'Documentation', documentation: 'Creates a documentation comment', insertText: 'doc /* ${1:description} */', insertTextFormat: InsertTextFormat.Snippet },
    { label: 'comment', kind: CompletionItemKind.Text, detail: 'Comment', documentation: 'Creates a comment element', insertText: 'comment /* ${1:text} */', insertTextFormat: InsertTextFormat.Snippet },
];

/**
 * Provides code completions for SysML v2 documents.
 *
 * Currently provides keyword completions and snippet templates.
 * TODO: integrate antlr4-c3 for grammar-aware contextual completions.
 */
export class CompletionProvider {
    constructor(private documentManager: DocumentManager) { }

    provideCompletions(params: TextDocumentPositionParams): CompletionItem[] {
        const items: CompletionItem[] = [];
        const uri = params.textDocument.uri;
        const context = this.detectContext(uri, params.position.line, params.position.character);

        for (const kw of SYSML_KEYWORDS) {
            const item: CompletionItem = {
                label: kw.label,
                kind: kw.kind,
                detail: kw.detail,
                documentation: kw.documentation,
                data: kw.label, // used for resolve
                sortText: `2_${kw.label}`,
            };

            if (kw.insertText) {
                item.insertText = kw.insertText;
                item.insertTextFormat = kw.insertTextFormat;
            }

            items.push(item);
        }

        // Add definition symbols from all cached documents to improve type completion.
        const workspaceTable = this.documentManager.getWorkspaceSymbolTable();
        const allSymbols = workspaceTable.getAllSymbols();
        const definitionSymbols = allSymbols.filter((s) => isDefinition(s.kind));

        const seen = new Set<string>();
        for (const sym of definitionSymbols) {
            if (!sym.name || seen.has(sym.name)) continue;
            seen.add(sym.name);

            items.push({
                label: sym.name,
                kind: this.mapSymbolKindToCompletionKind(sym.kind),
                detail: `${sym.kind}${sym.qualifiedName !== sym.name ? ` (${sym.qualifiedName})` : ''}`,
                documentation: sym.documentation,
                data: sym.qualifiedName,
                sortText: `1_${sym.name}`,
            });
        }

        // Add port endpoint symbols for connect contexts.
        if (context === 'connect-endpoint') {
            const portSymbols = allSymbols.filter((s) =>
                s.kind === SysMLElementKind.PortUsage || s.kind === SysMLElementKind.PortDef,
            );
            const seenPorts = new Set<string>();
            for (const sym of portSymbols) {
                if (!sym.name || seenPorts.has(sym.name)) continue;
                seenPorts.add(sym.name);
                items.push({
                    label: sym.name,
                    kind: CompletionItemKind.Interface,
                    detail: `${sym.kind}${sym.typeNames[0] ? ` : ${sym.typeNames[0]}` : ''}`,
                    data: sym.qualifiedName,
                    sortText: `0_${sym.name}`,
                });
            }
        }

        if (context === 'type-annotation') {
            return items.filter((i) => this.isTypeOrDefinitionCompletion(i));
        }

        if (context === 'connect-endpoint') {
            return items.filter((i) => this.isConnectContextCompletion(i));
        }

        // TODO: Add antlr4-c3 grammar-aware context-sensitive completions.

        return items;
    }

    resolveCompletion(item: CompletionItem): CompletionItem {
        // Resolve additional details for a completion item
        return item;
    }

    private mapSymbolKindToCompletionKind(kind: SysMLElementKind): CompletionItemKind {
        if (kind === SysMLElementKind.PartDef || kind === SysMLElementKind.ItemDef) {
            return CompletionItemKind.Class;
        }
        if (kind === SysMLElementKind.ActionDef || kind === SysMLElementKind.CalcDef) {
            return CompletionItemKind.Function;
        }
        if (kind === SysMLElementKind.PortDef || kind === SysMLElementKind.InterfaceDef) {
            return CompletionItemKind.Interface;
        }
        if (kind === SysMLElementKind.EnumDef) {
            return CompletionItemKind.Enum;
        }
        if (kind === SysMLElementKind.AttributeDef) {
            return CompletionItemKind.Property;
        }
        return CompletionItemKind.Text;
    }

    private detectContext(uri: string, line: number, character: number): 'general' | 'type-annotation' | 'connect-endpoint' {
        const text = this.documentManager.getText(uri);
        if (!text) return 'general';

        const lines = text.split('\n');
        if (line < 0 || line >= lines.length) return 'general';
        const lineText = lines[line] ?? '';
        const beforeCursor = lineText.slice(0, Math.max(0, Math.min(character, lineText.length)));

        const beforeTrim = beforeCursor.trimEnd();
        if (/\bconnect\b/.test(beforeCursor) && !beforeCursor.includes(';')) {
            return 'connect-endpoint';
        }
        if ((/\bconnect\b/.test(beforeCursor) && /\b(to|from)$/.test(beforeTrim))
            || /\bconnect\s*$/.test(beforeTrim)
            || /\bconnect\s+[A-Za-z_][\w.]*\s*$/.test(beforeTrim)) {
            return 'connect-endpoint';
        }

        if (/:\s*[A-Za-z_\d]*$/.test(beforeCursor)) {
            return 'type-annotation';
        }

        return 'general';
    }

    private isTypeOrDefinitionCompletion(item: CompletionItem): boolean {
        if (typeof item.detail === 'string' && item.detail.includes(' def')) return true;
        if (typeof item.data === 'string' && item.data.includes('::')) return true;
        return [
            'part def', 'action def', 'state def', 'requirement def', 'constraint def',
            'attribute def', 'item def', 'port def', 'interface def', 'connection def',
            'allocation def', 'use case def', 'view def', 'viewpoint def', 'enum def',
            'calc def', 'metadata def',
        ].includes(item.label);
    }

    private isConnectContextCompletion(item: CompletionItem): boolean {
        if (typeof item.detail === 'string' && (item.detail.startsWith('port') || item.detail.includes(' port'))) {
            return true;
        }
        return item.label === 'connect' || item.label === 'port' || item.label === 'port def';
    }
}
