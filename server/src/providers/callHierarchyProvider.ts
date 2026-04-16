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
} from 'vscode-languageserver/node.js';
import { DocumentManager } from '../documentManager.js';
import { SysMLElementKind, SysMLSymbol } from '../symbols/sysmlElements.js';
import { isIdentPart as isWordChar } from '../utils/identUtils.js';

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

// ---- String scanning helpers ----

function skipWS(text: string, pos: number): number {
    while (pos < text.length && (text[pos] === ' ' || text[pos] === '\t' || text[pos] === '\n' || text[pos] === '\r')) pos++;
    return pos;
}

function readIdent(text: string, pos: number): [string, number] | undefined {
    pos = skipWS(text, pos);
    const start = pos;
    while (pos < text.length && isWordChar(text.charCodeAt(pos))) pos++;
    return pos > start ? [text.slice(start, pos), pos] : undefined;
}

/** Check word boundary before position. */
function wordBoundaryBefore(text: string, pos: number): boolean {
    return pos === 0 || !isWordChar(text.charCodeAt(pos - 1));
}

/** Check word boundary after position. */
function wordBoundaryAfter(text: string, pos: number): boolean {
    return pos >= text.length || !isWordChar(text.charCodeAt(pos));
}

/** Find all `keyword <whitespace> targetName` at word boundaries. */
function findKeywordTarget(text: string, keyword: string, target: string): { index: number; length: number }[] {
    const results: { index: number; length: number }[] = [];
    let from = 0;
    while (from < text.length) {
        const idx = text.indexOf(keyword, from);
        if (idx < 0) break;
        if (!wordBoundaryBefore(text, idx) || !wordBoundaryAfter(text, idx + keyword.length)) {
            from = idx + 1; continue;
        }
        const nameStart = skipWS(text, idx + keyword.length);
        if (text.startsWith(target, nameStart) && wordBoundaryAfter(text, nameStart + target.length)) {
            results.push({ index: idx, length: nameStart + target.length - idx });
        }
        from = idx + 1;
    }
    return results;
}

/** Find all typed usages `(action|state|calc) <name> : <targetName>` at word boundaries. */
function findTypedUsageOfTarget(text: string, keywords: string[], target: string): { index: number; length: number }[] {
    const results: { index: number; length: number }[] = [];
    for (const kw of keywords) {
        let from = 0;
        while (from < text.length) {
            const idx = text.indexOf(kw, from);
            if (idx < 0) break;
            if (!wordBoundaryBefore(text, idx) || !wordBoundaryAfter(text, idx + kw.length)) {
                from = idx + 1; continue;
            }
            const nameResult = readIdent(text, idx + kw.length);
            if (!nameResult) { from = idx + 1; continue; }
            let pos = skipWS(text, nameResult[1]);
            if (pos >= text.length || text[pos] !== ':') { from = idx + 1; continue; }
            pos = skipWS(text, pos + 1);
            if (text.startsWith(target, pos) && wordBoundaryAfter(text, pos + target.length)) {
                results.push({ index: idx, length: pos + target.length - idx });
            }
            from = idx + 1;
        }
    }
    return results;
}

/** Find all `keyword <name>` and capture the name. */
function findKeywordCallees(text: string, keyword: string): { index: number; length: number; calledName: string }[] {
    const results: { index: number; length: number; calledName: string }[] = [];
    let from = 0;
    while (from < text.length) {
        const idx = text.indexOf(keyword, from);
        if (idx < 0) break;
        if (!wordBoundaryBefore(text, idx) || !wordBoundaryAfter(text, idx + keyword.length)) {
            from = idx + 1; continue;
        }
        const nameResult = readIdent(text, idx + keyword.length);
        if (nameResult) {
            results.push({ index: idx, length: nameResult[1] - idx, calledName: nameResult[0] });
        }
        from = idx + 1;
    }
    return results;
}

/** Find all typed usages `(action|state|calc) <name> : <typeName>` and capture the type name. */
function findTypedUsageCallees(text: string, keywords: string[]): { index: number; length: number; calledName: string }[] {
    const results: { index: number; length: number; calledName: string }[] = [];
    for (const kw of keywords) {
        let from = 0;
        while (from < text.length) {
            const idx = text.indexOf(kw, from);
            if (idx < 0) break;
            if (!wordBoundaryBefore(text, idx) || !wordBoundaryAfter(text, idx + kw.length)) {
                from = idx + 1; continue;
            }
            const nameResult = readIdent(text, idx + kw.length);
            if (!nameResult) { from = idx + 1; continue; }
            let pos = skipWS(text, nameResult[1]);
            if (pos >= text.length || text[pos] !== ':') { from = idx + 1; continue; }
            pos = skipWS(text, pos + 1);
            const typeResult = readIdent(text, pos);
            if (typeResult) {
                results.push({ index: idx, length: typeResult[1] - idx, calledName: typeResult[0] });
            }
            from = idx + 1;
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

        const symbol = symbolTable.findSymbolAtPosition(uri, params.position.line, params.position.character);
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
                const targets = symbolTable.findByName(m.calledName);

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
            const targets = symbolTable.findByName(m.calledName);
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
            name: sym.name,
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
