import {
    SymbolKind,
    TypeHierarchyItem,
    TypeHierarchyPrepareParams,
    TypeHierarchySubtypesParams,
    TypeHierarchySupertypesParams,
} from 'vscode-languageserver/node';
import { DocumentManager } from '../documentManager.js';
import { displayName, isDefinition, SysMLElementKind, SysMLSymbol } from '../symbols/sysmlElements.js';
import { NameReferences } from '../symbols/nameReferences.js';

/**
 * Provides type hierarchy for SysML definitions.
 *
 * Navigate `:>` (specializes) chains:
 *  - Supertypes: what does this type specialize?
 *  - Subtypes: what specializes this type?
 */
export class TypeHierarchyProvider {

    constructor(private documentManager: DocumentManager) { }

    prepareTypeHierarchy(params: TypeHierarchyPrepareParams): TypeHierarchyItem[] | null {
        const uri = params.textDocument.uri;
        const result = this.documentManager.get(uri);
        if (!result) return null;

        const text = this.documentManager.getText(uri);
        if (!text) return null;

        const symbolTable = this.documentManager.getWorkspaceSymbolTable();

        const reference = new NameReferences(this.documentManager).at(uri, params.position);
        if (reference?.isAmbiguous) return null;
        const symbol = reference?.symbol ??
            symbolTable.findSymbolAtPosition(
            uri, params.position.line, params.position.character,
        );
        if (!symbol || !isDefinition(symbol.kind)) return null;

        return [this.toTypeHierarchyItem(symbol)];
    }

    provideSupertypes(params: TypeHierarchySupertypesParams): TypeHierarchyItem[] {
        const symbolTable = this.documentManager.getWorkspaceSymbolTable();

        const item = params.item;
        // Find the symbol for this item
        const sym = this.symbolOf(item);
        if (!sym || sym.typeNames.length === 0) return [];

        // The typeNames holds all supertype names
        const items: TypeHierarchyItem[] = [];
        for (const tn of sym.typeNames) {
            const supertypes = symbolTable.findByName(tn);
            for (const s of supertypes) {
                if (isDefinition(s.kind)) {
                    items.push(this.toTypeHierarchyItem(s));
                }
            }
        }
        return items;
    }

    provideSubtypes(params: TypeHierarchySubtypesParams): TypeHierarchyItem[] {
        const symbolTable = this.documentManager.getWorkspaceSymbolTable();

        const item = params.item;
        const allSymbols = symbolTable.getAllSymbols();
        const base = allSymbols.find(s => s.uri === item.uri &&
            s.selectionRange.start.line === item.selectionRange.start.line &&
            s.selectionRange.start.character === item.selectionRange.start.character);
        if (!base) return [];

        // Find all definitions whose typeNames includes this item's name
        const subtypes = allSymbols.filter(s =>
            isDefinition(s.kind) && s.typeNames.some(type =>
                symbolTable.findByName(type).some(parent => parent.symbolId === base.symbolId))
        );

        return subtypes.map(s => this.toTypeHierarchyItem(s));
    }

    /** The symbol `item` stands for: by the symbol ID it carries, else by its name and line. */
    private symbolOf(item: TypeHierarchyItem): SysMLSymbol | undefined {
        const symbolTable = this.documentManager.getWorkspaceSymbolTable();
        const id = (item.data as { symbolId?: string } | undefined)?.symbolId;
        return (id !== undefined ? symbolTable.getSymbolById(id) : undefined)
            ?? symbolTable.getSymbolsForUri(item.uri).find(s =>
                displayName(s) === item.name && s.selectionRange.start.line === item.selectionRange.start.line);
    }

    private toTypeHierarchyItem(sym: SysMLSymbol): TypeHierarchyItem {
        return {
            name: displayName(sym),
            data: { symbolId: sym.symbolId },
            kind: this.toSymbolKind(sym.kind),
            uri: sym.uri,
            range: sym.range,
            selectionRange: sym.selectionRange,
            detail: sym.typeNames.length > 0 ? `specializes ${sym.typeNames.join(', ')}` : sym.kind,
        };
    }

    private toSymbolKind(kind: SysMLElementKind): SymbolKind {
        switch (kind) {
            case SysMLElementKind.Package: return SymbolKind.Package;
            case SysMLElementKind.PartDef: return SymbolKind.Class;
            case SysMLElementKind.ActionDef: return SymbolKind.Method;
            case SysMLElementKind.StateDef: return SymbolKind.Enum;
            case SysMLElementKind.ItemDef: return SymbolKind.Struct;
            case SysMLElementKind.PortDef:
            case SysMLElementKind.InterfaceDef:
            case SysMLElementKind.ConnectionDef:
            case SysMLElementKind.FlowDef: return SymbolKind.Interface;
            case SysMLElementKind.EnumDef: return SymbolKind.Enum;
            case SysMLElementKind.CalcDef: return SymbolKind.Function;
            case SysMLElementKind.RequirementDef:
            case SysMLElementKind.ConcernDef: return SymbolKind.Object;
            case SysMLElementKind.ConstraintDef: return SymbolKind.Constant;
            default: return SymbolKind.Class;
        }
    }
}
