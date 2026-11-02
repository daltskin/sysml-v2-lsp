import {
    CallHierarchyItem,
    CallHierarchyIncomingCall,
    CallHierarchyOutgoingCall,
    CallHierarchyIncomingCallsParams,
    CallHierarchyOutgoingCallsParams,
    CallHierarchyPrepareParams,
    SymbolKind,
    Range,
    Position,
} from 'vscode-languageserver/node';
import { DocumentManager } from '../documentManager.js';
import { displayName, SysMLElementKind, SysMLSymbol } from '../symbols/sysmlElements.js';
import { scanQualifiedNames, splitQualifiedName } from '../utils/identUtils.js';
import { NameReferences } from '../symbols/nameReferences.js';

/**
 * Action-related keywords that create "call" relationships in SysML.
 */
const CALL_KEYWORDS = new Set([
    'perform', 'include', 'accept', 'send', 'assign', 'assert',
]);

/**
 * Keywords whose typed usages (`action x : TypeDef`) represent calls.
 */
const USAGE_KEYWORDS = ['action', 'state', 'calc'];

/** Find all `keyword <whitespace> targetName` at word boundaries. */
function findKeywordTarget(text: string, keyword: string, target: string): { index: number; length: number }[] {
    return findKeywordCallees(text, keyword)
        .filter(call => splitQualifiedName(call.calledName).pop() === target);
}

/** Find all typed usages `(action|state|calc) <name> : <targetName>` at word boundaries. */
function findTypedUsageOfTarget(text: string, keywords: string[], target: string): { index: number; length: number }[] {
    return findTypedUsageCallees(text, keywords)
        .filter(call => splitQualifiedName(call.calledName).pop() === target);
}

/** Find all `keyword <name>` and capture the name. */
function findKeywordCallees(text: string, keyword: string): { index: number; length: number; calledName: string }[] {
    const results: { index: number; length: number; calledName: string }[] = [];
    const names = [...scanQualifiedNames(text)];
    for (let i = 0; i + 1 < names.length; i++) {
        const current = names[i];
        const next = names[i + 1];
        if (text.slice(current.start, current.end) === keyword &&
            /^\s+$/.test(text.slice(current.end, next.start))) {
            results.push({ index: current.start, length: next.end - current.start, calledName: next.name });
        }
    }
    return results;
}

/** Find all typed usages `(action|state|calc) <name> : <typeName>` and capture the type name. */
function findTypedUsageCallees(text: string, keywords: string[]): { index: number; length: number; calledName: string }[] {
    const results: { index: number; length: number; calledName: string }[] = [];
    const names = [...scanQualifiedNames(text)];
    for (let i = 0; i + 2 < names.length; i++) {
        const current = names[i];
        const usage = names[i + 1];
        const type = names[i + 2];
        if (keywords.includes(text.slice(current.start, current.end)) &&
            /^\s+$/.test(text.slice(current.end, usage.start)) &&
            /^\s*:\s*$/.test(text.slice(usage.end, type.start))) {
            results.push({ index: current.start, length: type.end - current.start, calledName: type.name });
        }
    }
    return results;
}

/** Convert a text offset to a Position. */
function offsetToPosition(text: string, offset: number): Position {
    let line = 0;
    let character = 0;
    for (let i = 0; i < offset && i < text.length; i++) {
        if (text[i] === '\n') {
            line++;
            character = 0;
        } else {
            character++;
        }
    }
    return Position.create(line, character);
}

/** Convert a Position to a text offset. */
function positionToOffset(text: string, pos: Position): number {
    let currentLine = 0;
    for (let i = 0; i < text.length; i++) {
        if (currentLine === pos.line) {
            return i + pos.character;
        }
        if (text[i] === '\n') {
            currentLine++;
        }
    }
    return text.length;
}

/**
 * Provides call hierarchy for SysML actions.
 *
 * Maps SysML concepts to call hierarchy:
 *  - "Calls" = perform, include, accept (explicit keywords)
 *  - "Calls" = `action x : ActionDef` (typed usage = composition call)
 *  - "Called by" = which actions perform/include/compose this one
 */
export class CallHierarchyProvider {

    constructor(private documentManager: DocumentManager) { }

    prepareCallHierarchy(params: CallHierarchyPrepareParams): CallHierarchyItem[] | null {
        const uri = params.textDocument.uri;
        const result = this.documentManager.get(uri);
        if (!result) return null;

        const symbolTable = this.documentManager.getWorkspaceSymbolTable();

        const reference = new NameReferences(this.documentManager).at(uri, params.position);
        if (reference?.isAmbiguous) return null;
        const symbol = reference?.symbol ??
            symbolTable.findSymbolAtPosition(uri, params.position.line, params.position.character);
        if (!symbol) return null;

        // Call hierarchy makes sense for actions, states, and similar behavioral elements
        const behavioral = new Set([
            SysMLElementKind.ActionDef, SysMLElementKind.ActionUsage,
            SysMLElementKind.StateDef, SysMLElementKind.StateUsage,
            SysMLElementKind.CalcDef, SysMLElementKind.CalcUsage,
            SysMLElementKind.UseCaseDef, SysMLElementKind.UseCaseUsage,
        ]);

        if (!behavioral.has(symbol.kind)) return null;

        return [this.toCallHierarchyItem(symbol)];
    }

    provideIncomingCalls(params: CallHierarchyIncomingCallsParams): CallHierarchyIncomingCall[] {
        const symbolTable = this.documentManager.getWorkspaceSymbolTable();
        const item = params.item;
        const targetName = item.name;
        const incoming: CallHierarchyIncomingCall[] = [];

        for (const uri of this.documentManager.getUris()) {
            const text = this.documentManager.getText(uri);
            if (!text) continue;

            const symbols = symbolTable.getSymbolsForUri(uri);

            // 1. Explicit call keywords: `perform Brake`, `accept Accelerate`, etc.
            for (const keyword of CALL_KEYWORDS) {
                for (const m of findKeywordTarget(text, keyword, targetName)) {
                    const pos = offsetToPosition(text, m.index);
                    const enclosing = this.findEnclosingBehavioral(symbols, pos.line);

                    if (enclosing) {
                        incoming.push({
                            from: this.toCallHierarchyItem(enclosing),
                            fromRanges: [Range.create(
                                pos,
                                offsetToPosition(text, m.index + m.length),
                            )],
                        });
                    }
                }
            }

            // 2. Typed usages: `action foo : TargetName` — composition is a call.
            //    skip=1 because the narrowest enclosing behavioral is the usage
            //    itself; the actual *caller* is the parent action/state.
            for (const m of findTypedUsageOfTarget(text, USAGE_KEYWORDS, targetName)) {
                const pos = offsetToPosition(text, m.index);
                const enclosing = this.findEnclosingBehavioral(symbols, pos.line, 1);
                if (enclosing) {
                    incoming.push({
                        from: this.toCallHierarchyItem(enclosing),
                        fromRanges: [Range.create(
                            pos,
                            offsetToPosition(text, m.index + m.length),
                        )],
                    });
                }
            }
        }

        return incoming;
    }

    provideOutgoingCalls(params: CallHierarchyOutgoingCallsParams): CallHierarchyOutgoingCall[] {
        const item = params.item;
        const symbolTable = this.documentManager.getWorkspaceSymbolTable();

        const fullText = this.documentManager.getText(item.uri);
        if (!fullText) return [];

        const outgoing: CallHierarchyOutgoingCall[] = [];

        // Find the symbol body range
        const symbols = symbolTable.getSymbolsForUri(item.uri);
        const sym = symbols.find(s =>
            s.name === item.name &&
            s.selectionRange.start.line === item.selectionRange.start.line
        );
        if (!sym) return [];

        const startOffset = positionToOffset(fullText, sym.range.start);
        const endOffset = positionToOffset(fullText, sym.range.end);
        const bodyText = fullText.slice(startOffset, endOffset);

        // 1. Explicit call keywords: `perform Brake`, `accept Accelerate`, etc.
        for (const keyword of CALL_KEYWORDS) {
            for (const m of findKeywordCallees(bodyText, keyword)) {
                const targets = symbolTable.findByName(splitQualifiedName(m.calledName).pop()!);

                if (targets.length > 0) {
                    const absOffset = startOffset + m.index;
                    outgoing.push({
                        to: this.toCallHierarchyItem(targets[0]),
                        fromRanges: [Range.create(
                            offsetToPosition(fullText, absOffset),
                            offsetToPosition(fullText, absOffset + m.length),
                        )],
                    });
                }
            }
        }

        // 2. Typed usages: `action foo : TypeDef` — composition is a call
        for (const m of findTypedUsageCallees(bodyText, USAGE_KEYWORDS)) {
            const targets = symbolTable.findByName(splitQualifiedName(m.calledName).pop()!);
            if (targets.length > 0) {
                const absOffset = startOffset + m.index;
                outgoing.push({
                    to: this.toCallHierarchyItem(targets[0]),
                    fromRanges: [Range.create(
                        offsetToPosition(fullText, absOffset),
                        offsetToPosition(fullText, absOffset + m.length),
                    )],
                });
            }
        }

        return outgoing;
    }

    private findEnclosingBehavioral(symbols: SysMLSymbol[], line: number, skip = 0): SysMLSymbol | undefined {
        const candidates: { sym: SysMLSymbol; size: number }[] = [];

        for (const sym of symbols) {
            const r = sym.range;
            if (line >= r.start.line && line <= r.end.line) {
                candidates.push({ sym, size: r.end.line - r.start.line });
            }
        }

        candidates.sort((a, b) => a.size - b.size);
        return candidates[skip]?.sym;
    }

    private toCallHierarchyItem(sym: SysMLSymbol): CallHierarchyItem {
        return {
            name: displayName(sym),
            kind: sym.kind.includes('action') ? SymbolKind.Method
                : sym.kind.includes('state') ? SymbolKind.Enum
                    : sym.kind.includes('calc') ? SymbolKind.Function
                        : SymbolKind.Event,
            uri: sym.uri,
            range: sym.range,
            selectionRange: sym.selectionRange,
            detail: sym.kind,
        };
    }
}
