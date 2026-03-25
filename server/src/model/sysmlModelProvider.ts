/**
 * SysML Model Provider — converts the LSP server's internal representations
 * (ANTLR parse tree + SymbolTable) into the DTO shapes defined in
 * `sysmlModelTypes.ts`.
 *
 * This is the core of the `sysml/model` custom LSP request.  It reuses
 * the existing parse cache (via DocumentManager) so responses are near-instant.
 */

import { Range } from 'vscode-languageserver/node.js';
import { analyseComplexity } from '../analysis/complexityAnalyzer.js';
import { DocumentManager } from '../documentManager.js';
import { ParseResult } from '../parser/parseDocument.js';
import { SymbolTable } from '../symbols/symbolTable.js';
import { SysMLElementKind, SysMLSymbol, isDefinition, isUsage } from '../symbols/sysmlElements.js';

import type {
    ActivityActionDTO,
    ActivityDiagramDTO,
    ActivityStateDTO,
    ControlFlowDTO,
    DecisionNodeDTO,
    MessageDTO,
    ParticipantDTO,
    RangeDTO,
    RelationshipDTO,
    ResolvedFeatureDTO,
    ResolvedTypeDTO,
    SemanticDiagnosticDTO,
    SequenceDiagramDTO,
    SysMLElementDTO,
    SysMLModelResult,
    SysMLModelScope,
} from './sysmlModelTypes.js';

import { isIdentPart as isWordChar } from '../utils/identUtils.js';

// ── String-based extraction helpers (replacing regex) ──

/**
 * Check if `text` contains `word` as a whole word (word-boundary check).
 * Equivalent to `/\bword\b/.test(text)` but without regex.
 */
function containsWord(text: string, word: string): boolean {
    let idx = 0;
    while ((idx = text.indexOf(word, idx)) !== -1) {
        const before = idx > 0 ? text.charCodeAt(idx - 1) : 32;
        const after = idx + word.length < text.length ? text.charCodeAt(idx + word.length) : 32;
        if (!isWordChar(before) && !isWordChar(after)) return true;
        idx += 1;
    }
    return false;
}

/**
 * Find all positions where `word` appears as a whole word in `text`.
 * Returns array of { pos, afterPos } where afterPos is the index right after the word.
 */
function findWordPositions(text: string, word: string): { pos: number; afterPos: number }[] {
    const results: { pos: number; afterPos: number }[] = [];
    let idx = 0;
    while ((idx = text.indexOf(word, idx)) !== -1) {
        const before = idx > 0 ? text.charCodeAt(idx - 1) : 32;
        const afterIdx = idx + word.length;
        const after = afterIdx < text.length ? text.charCodeAt(afterIdx) : 32;
        if (!isWordChar(before) && !isWordChar(after)) {
            results.push({ pos: idx, afterPos: afterIdx });
        }
        idx += 1;
    }
    return results;
}

/** Case-insensitive findWordPositions. */
function findWordPositionsCI(text: string, word: string): { pos: number; afterPos: number }[] {
    const lower = text.toLowerCase();
    const wordLower = word.toLowerCase();
    const results: { pos: number; afterPos: number }[] = [];
    let idx = 0;
    while ((idx = lower.indexOf(wordLower, idx)) !== -1) {
        const before = idx > 0 ? lower.charCodeAt(idx - 1) : 32;
        const afterIdx = idx + wordLower.length;
        const after = afterIdx < lower.length ? lower.charCodeAt(afterIdx) : 32;
        if (!isWordChar(before) && !isWordChar(after)) {
            results.push({ pos: idx, afterPos: afterIdx });
        }
        idx += 1;
    }
    return results;
}

/** Skip whitespace characters starting at `pos`. */
function skipWS(text: string, pos: number): number {
    while (pos < text.length) {
        const ch = text[pos];
        if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') pos++;
        else break;
    }
    return pos;
}

/**
 * Read an identifier (letters, digits, underscores, `::` separators, and
 * optionally `.`) starting at `pos`.  Returns [identifier, endPos].
 */
function readIdent(text: string, pos: number, allowDots = false): [string, number] {
    let end = pos;
    while (end < text.length) {
        const ch = text.charCodeAt(end);
        if (isWordChar(ch)) {
            end++;
        } else if (allowDots && text[end] === '.') {
            end++;
        } else if (text[end] === ':' && end + 1 < text.length && text[end + 1] === ':') {
            end += 2;
        } else {
            break;
        }
    }
    return [text.substring(pos, end), end];
}

/**
 * Read a quoted name (' ... ') or plain identifier at `pos`.
 * Returns [name, endPos].
 */
function readNameOrQuoted(text: string, pos: number, allowDots = false): [string, number] {
    if (pos < text.length && text[pos] === "'") {
        const close = text.indexOf("'", pos + 1);
        if (close >= 0) return [text.substring(pos + 1, close), close + 1];
    }
    return readIdent(text, pos, allowDots);
}

/**
 * After finding a keyword at `afterPos`, skip whitespace and read an identifier.
 * Returns [identifier, endPos] or ['', afterPos] if none found.
 */
function readWordAfterKeyword(text: string, afterPos: number, allowDots = false): [string, number] {
    const start = skipWS(text, afterPos);
    return readIdent(text, start, allowDots);
}

/**
 * Read comma-separated identifiers starting at `pos`.
 * Stops at the first token that isn't an identifier, comma, `::`, or whitespace.
 * Returns an array of trimmed identifier strings.
 */
function readCommaSeparatedIdents(text: string, pos: number): string[] {
    const names: string[] = [];
    let p = skipWS(text, pos);
    while (p < text.length) {
        const [name, end] = readIdent(text, p);
        if (!name) break;
        names.push(name);
        p = skipWS(text, end);
        if (p < text.length && text[p] === ',') {
            p = skipWS(text, p + 1);
        } else {
            break;
        }
    }
    return names;
}

/**
 * Provides the full semantic model for a document by converting the
 * server's internal ANTLR parse tree and symbol table into serializable DTOs.
 *
 * The symbol table is cached per URI + document version so repeated
 * `getModel()` calls (dashboard refresh, explorer update, etc.) skip
 * the ANTLR tree walk when the source hasn't changed.
 */
export class SysMLModelProvider {
    /** Cached symbol tables keyed by URI. */
    private _stCache = new Map<string, { version: number; table: SymbolTable }>();

    constructor(private readonly documentManager: DocumentManager) { }

    /** Remove cached symbol table for a URI (e.g. on document close). */
    removeUri(uri: string): void {
        this._stCache.delete(uri);
    }

    /**
     * Drop **all** cached symbol tables.
     * Returns the number of entries that were evicted.
     */
    clearAll(): number {
        const count = this._stCache.size;
        this._stCache.clear();
        return count;
    }

    /** Number of cached symbol tables (for diagnostics / stats). */
    get cacheSize(): number {
        return this._stCache.size;
    }

    /**
     * Return a cached-or-fresh SymbolTable for a URI.
     *
     * The table is rebuilt only when the document version changes.
     */
    private _getSymbolTable(uri: string, parseResult: ParseResult): SymbolTable {
        const version = this.documentManager.getVersion(uri);
        const cached = this._stCache.get(uri);
        if (cached && cached.version === version) {
            return cached.table;
        }
        const table = new SymbolTable();
        table.build(uri, parseResult);
        this._stCache.set(uri, { version, table });
        return table;
    }

    /**
     * Build the model response for a document.
     *
     * @param uri       Document URI
     * @param version   Document version (for staleness detection)
     * @param scopes    Which sections to include (empty/undefined = all)
     */
    getModel(uri: string, version: number, scopes?: SysMLModelScope[]): SysMLModelResult {
        const startTime = Date.now();
        const parseResult = this.documentManager.get(uri);
        if (!parseResult) {
            return { version: -1 };
        }

        const scopeSet = new Set<SysMLModelScope>(
            scopes && scopes.length > 0
                ? scopes
                : ['elements', 'relationships', 'sequenceDiagrams', 'activityDiagrams', 'resolvedTypes', 'diagnostics'],
        );

        // Build (or retrieve cached) symbol table from parse result
        const symbolTable = this._getSymbolTable(uri, parseResult);

        const text = this.documentManager.getText(uri) ?? '';
        const lines = text.split('\n');

        const result: SysMLModelResult = { version };

        // --- Elements ---
        if (scopeSet.has('elements')) {
            result.elements = this.convertToElementDTOs(symbolTable, uri, lines);
        }

        // --- Relationships ---
        if (scopeSet.has('relationships')) {
            result.relationships = this.extractRelationships(symbolTable, uri, lines);
        }

        // --- Sequence Diagrams ---
        if (scopeSet.has('sequenceDiagrams')) {
            result.sequenceDiagrams = this.extractSequenceDiagrams(symbolTable, uri, lines);
        }

        // --- Activity Diagrams ---
        if (scopeSet.has('activityDiagrams')) {
            result.activityDiagrams = this.extractActivityDiagrams(symbolTable, uri, lines);
        }

        // --- Resolved Types ---
        if (scopeSet.has('resolvedTypes')) {
            result.resolvedTypes = this.extractResolvedTypes(symbolTable, uri, lines);
        }

        // --- Semantic Diagnostics ---
        if (scopeSet.has('diagnostics')) {
            result.diagnostics = this.extractSemanticDiagnostics(symbolTable, uri);
        }

        // --- Stats ---
        const allSymbols = symbolTable.getSymbolsForUri(uri);
        const resolved = allSymbols.filter(s => s.typeNames.length > 0);
        // Use the real ANTLR parse time (from worker or lazy main-thread),
        // not the model-build time which is much smaller on cache hits.
        const parseTimeMs = this.documentManager.getParseTimeMs(uri);
        const timingBreakdown = this.documentManager.getTimingBreakdown(uri);
        const modelBuildTimeMs = Date.now() - startTime;

        result.stats = {
            totalElements: allSymbols.length,
            resolvedElements: resolved.length,
            unresolvedElements: allSymbols.length - resolved.length,
            parseTimeMs,
            lexTimeMs: timingBreakdown.lexMs,
            parseOnlyTimeMs: timingBreakdown.parseMs,
            modelBuildTimeMs,
            complexity: analyseComplexity(allSymbols),
        };

        return result;
    }

    // -----------------------------------------------------------------------
    // Element Tree Conversion
    // -----------------------------------------------------------------------

    /**
     * Convert the symbol table into a recursive element tree.
     *
     * The symbol table stores a flat list with `parentQualifiedName` pointers.
     * We rebuild the tree by grouping symbols by parent and recursively
     * attaching children.
     */
    private convertToElementDTOs(
        symbolTable: SymbolTable,
        uri: string,
        lines: string[],
    ): SysMLElementDTO[] {
        const symbols = symbolTable.getSymbolsForUri(uri);

        // Index symbols by qualified name
        const byQualifiedName = new Map<string, SysMLSymbol>();
        for (const sym of symbols) {
            byQualifiedName.set(sym.qualifiedName, sym);
        }

        // Build parent → children index from parentQualifiedName
        const childrenOf = new Map<string, SysMLSymbol[]>();
        for (const sym of symbols) {
            if (sym.parentQualifiedName && byQualifiedName.has(sym.parentQualifiedName)) {
                const list = childrenOf.get(sym.parentQualifiedName) ?? [];
                list.push(sym);
                childrenOf.set(sym.parentQualifiedName, list);
            }
        }

        // Find roots: symbols with no parent or whose parent is not in this URI
        const roots = symbols.filter(
            s => !s.parentQualifiedName || !byQualifiedName.has(s.parentQualifiedName),
        );

        return roots.map(s => this.symbolToElementDTO(s, childrenOf, lines));
    }

    /**
     * Convert a single SysMLSymbol into an SysMLElementDTO, recursively
     * including children.
     */
    private symbolToElementDTO(
        symbol: SysMLSymbol,
        childrenOf: Map<string, SysMLSymbol[]>,
        lines: string[],
    ): SysMLElementDTO {
        // Build children recursively from the parent→children index
        const childSymbols = (childrenOf.get(symbol.qualifiedName) ?? [])
            // B1: Filter phantom self-referencing package children
            .filter(c => c.qualifiedName !== symbol.qualifiedName);
        const children: SysMLElementDTO[] = childSymbols.map(c =>
            this.symbolToElementDTO(c, childrenOf, lines),
        );

        // Build attributes
        const attributes: Record<string, string | number | boolean> = {};

        if (symbol.typeNames.length > 0) {
            // Determine correct attribute key based on kind
            // Store all type names as comma-separated string
            const typeLabel = symbol.typeNames.join(', ');
            if (symbol.kind === SysMLElementKind.PortUsage || symbol.kind === SysMLElementKind.PortDef) {
                attributes['portType'] = typeLabel;
            } else {
                attributes['partType'] = typeLabel;
            }
        }

        if (symbol.documentation) {
            attributes['documentation'] = symbol.documentation;
        }

        // Include prefix metadata annotations (#name)
        if (symbol.metadataAnnotations && symbol.metadataAnnotations.length > 0) {
            attributes['metadataAnnotations'] = symbol.metadataAnnotations.join(', ');
        }

        // Extract direction for ports from the source text
        const direction = this.extractDirection(symbol, lines);
        if (direction) {
            attributes['direction'] = direction;
        }

        // Extract multiplicity from the source text
        const multiplicity = this.extractMultiplicity(symbol, lines);
        if (multiplicity) {
            attributes['multiplicity'] = multiplicity;
        }

        // Extract modifiers
        const modifier = this.extractModifier(symbol, lines);
        if (modifier) {
            attributes['modifier'] = modifier;
        }

        // Extract visibility
        const visibility = this.extractVisibility(symbol, lines);
        if (visibility) {
            attributes['visibility'] = visibility;
        }

        // Extract value
        const value = this.extractValue(symbol, lines);
        if (value) {
            attributes['value'] = value;
        }

        // Inline relationships for this element
        const relationships: RelationshipDTO[] = [];

        // Typing relationships (part x : Type, or defined by A, B)
        for (const tn of symbol.typeNames) {
            relationships.push({
                type: 'typing',
                source: symbol.name,
                target: tn,
            });
        }

        // Specialization (detected from text ":>" / "specializes" syntax)
        const specializations = this.extractSpecializations(symbol, lines);
        for (const spec of specializations) {
            relationships.push({
                type: 'specializes',
                source: symbol.name,
                target: spec,
            });
        }

        return {
            type: symbol.kind as string,
            name: symbol.name,
            range: this.rangeToDTO(symbol.range),
            children,
            attributes,
            relationships,
        };
    }

    // -----------------------------------------------------------------------
    // Relationship Extraction
    // -----------------------------------------------------------------------

    /**
     * Extract a flat list of relationships from the symbol table.
     * Includes typing, specialization, connections, and more.
     */
    private extractRelationships(
        symbolTable: SymbolTable,
        uri: string,
        lines: string[],
    ): RelationshipDTO[] {
        const symbols = symbolTable.getSymbolsForUri(uri);
        const relationships: RelationshipDTO[] = [];

        for (const symbol of symbols) {
            // Skip packages and imports for relationship extraction —
            // their text spans child elements and causes false matches
            if (symbol.kind === SysMLElementKind.Package ||
                symbol.kind === SysMLElementKind.Import ||
                symbol.kind === SysMLElementKind.Comment ||
                symbol.kind === SysMLElementKind.Doc) {
                continue;
            }

            // Typing relationships (part x : Type, or defined by A, B)
            // Only for usages — definitions' typeName can be a false positive
            // from child element text captured by ctx.getText()
            if (symbol.typeNames.length > 0 && isUsage(symbol.kind)) {
                for (const tn of symbol.typeNames) {
                    relationships.push({
                        type: 'typing',
                        source: symbol.name,
                        target: tn,
                    });
                }
            }

            // Specialization (part def X :> Y, Z  or  specializes Y, Z)
            const specializations = this.extractSpecializations(symbol, lines);
            for (const spec of specializations) {
                relationships.push({
                    type: 'specializes',
                    source: symbol.name,
                    target: spec,
                });
            }

            // Connection usages create connection relationships
            if (symbol.kind === SysMLElementKind.ConnectionUsage) {
                const connectionTargets = this.extractConnectionEndpoints(symbol, lines);
                if (connectionTargets.length === 2) {
                    relationships.push({
                        type: 'connection',
                        source: connectionTargets[0],
                        target: connectionTargets[1],
                        name: symbol.name,
                    });
                }
            }

            // Allocation usages create allocation relationships
            if (symbol.kind === SysMLElementKind.AllocationUsage) {
                const allocTargets = this.extractConnectionEndpoints(symbol, lines);
                if (allocTargets.length === 2) {
                    relationships.push({
                        type: 'allocation',
                        source: allocTargets[0],
                        target: allocTargets[1],
                        name: symbol.name,
                    });
                }
            }

            // Scan for relationship keywords in the element text
            const elementText = this.getElementText(symbol, lines);
            const additionalRels = this.extractKeywordRelationships(symbol.name, elementText);
            relationships.push(...additionalRels);
        }

        // Scan for standalone satisfy/verify statements that aren't part of any
        // symbol (e.g. top-level `satisfy X by Y;` inside a package).
        const fullText = lines.join('\n');
        const standaloneSatisfy = this.extractStandaloneSatisfyVerify(fullText);
        for (const rel of standaloneSatisfy) {
            // Avoid duplicates — only add if not already present
            const isDup = relationships.some(
                r => r.type === rel.type && r.source === rel.source && r.target === rel.target,
            );
            if (!isDup) relationships.push(rel);
        }

        return relationships;
    }

    // -----------------------------------------------------------------------
    // Sequence Diagram Extraction
    // -----------------------------------------------------------------------

    /**
     * Extract sequence diagram data from the symbol table.
     *
     * Sequence diagrams are built from:
     * 1. Action definitions/usages with explicit send/accept message patterns
     * 2. Synthesised from action definitions that have first/then/done flows
     *    (flow-to-sequence synthesis — matches ANTLR behaviour)
     */
    private extractSequenceDiagrams(
        symbolTable: SymbolTable,
        uri: string,
        lines: string[],
    ): SequenceDiagramDTO[] {
        const symbols = symbolTable.getSymbolsForUri(uri);
        const diagrams: SequenceDiagramDTO[] = [];
        const seen = new Set<string>();

        for (const symbol of symbols) {
            if (symbol.kind !== SysMLElementKind.ActionDef &&
                symbol.kind !== SysMLElementKind.ActionUsage) {
                continue;
            }

            const children = this.getChildSymbols(symbol, symbolTable);
            const participants: ParticipantDTO[] = [];
            const messages: MessageDTO[] = [];

            // Parts/items inside an action are participants
            for (const child of children) {
                if (child.kind === SysMLElementKind.PartUsage ||
                    child.kind === SysMLElementKind.ItemUsage) {
                    participants.push({
                        name: child.name,
                        type: child.typeNames.join(', ') || child.kind,
                        range: this.rangeToDTO(child.range),
                    });
                }
            }

            // ── D4: Extract send/accept messages from full body text ──
            const fullText = this.getFullElementText(symbol, lines);
            let occurrence = 1;

            // Broader send patterns: send <signal> via|to <target>
            for (const { afterPos } of findWordPositionsCI(fullText, 'send')) {
                const sigStart = skipWS(fullText, afterPos);
                const [signal, afterSig] = readIdent(fullText, sigStart, true);
                if (!signal) continue;
                const kwStart = skipWS(fullText, afterSig);
                const [kw, afterKw] = readIdent(fullText, kwStart);
                if (kw !== 'via' && kw !== 'to') continue;
                const tgtStart = skipWS(fullText, afterKw);
                const [target] = readIdent(fullText, tgtStart, true);
                if (!target) continue;
                messages.push({
                    name: `send_${occurrence}`,
                    from: symbol.name,
                    to: target,
                    payload: signal,
                    occurrence: occurrence++,
                    range: this.rangeToDTO(symbol.range),
                });
            }

            // Broader accept patterns: accept <signal> via|from <source>
            for (const { afterPos } of findWordPositionsCI(fullText, 'accept')) {
                const sigStart = skipWS(fullText, afterPos);
                const [signal, afterSig] = readIdent(fullText, sigStart, true);
                if (!signal) continue;
                const kwStart = skipWS(fullText, afterSig);
                const [kw, afterKw] = readIdent(fullText, kwStart);
                if (kw !== 'via' && kw !== 'from') continue;
                const srcStart = skipWS(fullText, afterKw);
                const [source] = readIdent(fullText, srcStart, true);
                if (!source) continue;
                messages.push({
                    name: `accept_${occurrence}`,
                    from: source,
                    to: symbol.name,
                    payload: signal,
                    occurrence: occurrence++,
                    range: this.rangeToDTO(symbol.range),
                });
            }

            // Also check child action usages for send/accept in their text
            for (const child of children) {
                if (child.kind === SysMLElementKind.ActionUsage) {
                    const childText = this.getFullElementText(child, lines);
                    for (const { afterPos } of findWordPositionsCI(childText, 'send')) {
                        const sigStart = skipWS(childText, afterPos);
                        const [signal, afterSig] = readIdent(childText, sigStart, true);
                        if (!signal) continue;
                        const kwStart = skipWS(childText, afterSig);
                        const [kw, afterKw] = readIdent(childText, kwStart);
                        if (kw !== 'via' && kw !== 'to') continue;
                        const tgtStart = skipWS(childText, afterKw);
                        const [target] = readIdent(childText, tgtStart, true);
                        if (!target) continue;
                        messages.push({
                            name: child.name,
                            from: target ?? symbol.name,
                            to: signal ?? '',
                            payload: signal ?? '',
                            occurrence: occurrence++,
                            range: this.rangeToDTO(child.range),
                        });
                    }
                    for (const { afterPos } of findWordPositionsCI(childText, 'accept')) {
                        const sigStart = skipWS(childText, afterPos);
                        const [signal, afterSig] = readIdent(childText, sigStart, true);
                        if (!signal) continue;
                        const kwStart = skipWS(childText, afterSig);
                        const [kw, afterKw] = readIdent(childText, kwStart);
                        if (kw !== 'via' && kw !== 'from') continue;
                        const srcStart = skipWS(childText, afterKw);
                        const [source] = readIdent(childText, srcStart, true);
                        if (!source) continue;
                        messages.push({
                            name: child.name,
                            from: source ?? '',
                            to: symbol.name,
                            payload: signal ?? '',
                            occurrence: occurrence++,
                            range: this.rangeToDTO(child.range),
                        });
                    }
                }
            }

            // Only include as explicit sequence diagram if it has participants or messages
            if (participants.length > 0 || messages.length > 0) {
                diagrams.push({
                    name: symbol.name,
                    participants,
                    messages,
                    range: this.rangeToDTO(symbol.range),
                });
                // Only mark as fully handled if it has real messages;
                // items-only diagrams (0 messages) can be enriched by D3 synthesis
                if (messages.length > 0) {
                    seen.add(symbol.qualifiedName);
                }
            }
        }

        // ── D3: Flow-to-sequence synthesis ──
        // For action defs with first/then flows, synthesise a sequence diagram
        // using action children as participants and flow edges as messages.
        for (const symbol of symbols) {
            if (seen.has(symbol.qualifiedName)) continue;
            if (symbol.kind !== SysMLElementKind.ActionDef &&
                symbol.kind !== SysMLElementKind.ActionUsage) {
                continue;
            }

            const children = this.getChildSymbols(symbol, symbolTable);
            const hasChildActions = children.some(c =>
                c.kind === SysMLElementKind.ActionUsage || c.kind === SysMLElementKind.ActionDef,
            );
            if (!hasChildActions) continue;

            // Extract flows to check if this action has succession patterns
            const flows = this.extractSuccessions(symbol, lines);
            if (flows.length === 0) continue;

            // Build participants from child actions (excluding synthetic nodes)
            const participants: ParticipantDTO[] = children
                .filter(c => c.kind === SysMLElementKind.ActionUsage || c.kind === SysMLElementKind.ActionDef)
                .map(c => ({
                    name: c.name,
                    type: c.typeNames.join(', ') || 'action',
                    range: this.rangeToDTO(c.range),
                }));

            // Build messages from flow edges (skip synthetic start/done)
            const messages: MessageDTO[] = [];
            let occ = 1;
            for (const flow of flows) {
                if (flow.from === 'start' || flow.to === 'done') continue;
                // Use the guard as the message label if present,
                // otherwise use the target action name (more meaningful
                // on a sequence diagram than a generic "flow_N" label).
                const label = flow.guard ?? flow.to;
                messages.push({
                    name: label,
                    from: flow.from,
                    to: flow.to,
                    payload: flow.guard ?? '',
                    occurrence: occ++,
                    range: flow.range,
                });
            }

            if (participants.length > 0 || messages.length > 0) {
                // Remove any items-only entry from the first pass for this symbol
                const existingIdx = diagrams.findIndex(d => d.name === symbol.name);
                if (existingIdx >= 0) {
                    diagrams.splice(existingIdx, 1);
                }
                diagrams.push({
                    name: symbol.name,
                    participants,
                    messages,
                    range: this.rangeToDTO(symbol.range),
                });
            }
        }

        return diagrams;
    }

    // -----------------------------------------------------------------------
    // Activity Diagram Extraction
    // -----------------------------------------------------------------------

    /**
     * Extract activity diagram data from action definitions and usages.
     *
     * D2: Now also includes ActionUsage elements that have child actions
     * (not just ActionDef), to capture perform actions and inline activities.
     */
    private extractActivityDiagrams(
        symbolTable: SymbolTable,
        uri: string,
        lines: string[],
    ): ActivityDiagramDTO[] {
        const symbols = symbolTable.getSymbolsForUri(uri);
        const diagrams: ActivityDiagramDTO[] = [];

        for (const symbol of symbols) {
            // D2: Include both ActionDef and ActionUsage with child actions
            if (symbol.kind !== SysMLElementKind.ActionDef &&
                symbol.kind !== SysMLElementKind.ActionUsage) {
                continue;
            }

            const children = this.getChildSymbols(symbol, symbolTable);
            const hasChildActions = children.some(c =>
                c.kind === SysMLElementKind.ActionUsage || c.kind === SysMLElementKind.ActionDef,
            );

            // For action usages, only include if they have child actions
            // (simple leaf actions like `action mount;` are not diagrams)
            if (symbol.kind === SysMLElementKind.ActionUsage && !hasChildActions) {
                continue;
            }

            const actions: ActivityActionDTO[] = [];
            const decisions: DecisionNodeDTO[] = [];
            const flows: ControlFlowDTO[] = [];
            const states: ActivityStateDTO[] = [];

            for (const child of children) {
                const childText = this.getElementText(child, lines);

                if (child.kind === SysMLElementKind.ActionUsage ||
                    child.kind === SysMLElementKind.ActionDef) {
                    // Determine action node type
                    let actionType = 'action';
                    const lowerText = childText.toLowerCase();
                    if (lowerText.includes('fork')) actionType = 'fork';
                    else if (lowerText.includes('join')) actionType = 'join';
                    else if (lowerText.includes('merge')) actionType = 'merge';
                    else if (lowerText.includes('decide')) actionType = 'decision';

                    const subActions = this.getChildSymbols(child, symbolTable)
                        .filter(c => c.kind === SysMLElementKind.ActionUsage || c.kind === SysMLElementKind.ActionDef)
                        .map(c => this.symbolToActionDTO(c, symbolTable, lines));

                    actions.push({
                        name: child.name,
                        type: actionType,
                        isDefinition: child.kind === SysMLElementKind.ActionDef,
                        range: this.rangeToDTO(child.range),
                        parent: symbol.name,
                        children: subActions.map(a => a.name),
                        subActions: subActions.length > 0 ? subActions : undefined,
                    });

                    // Decision nodes
                    if (actionType === 'decision') {
                        const branches = this.extractDecisionBranches(child, lines);
                        decisions.push({
                            name: child.name,
                            condition: '',
                            branches,
                            range: this.rangeToDTO(child.range),
                        });
                    }
                }

                if (child.kind === SysMLElementKind.StateUsage ||
                    child.kind === SysMLElementKind.StateDef) {
                    const stateType = childText.toLowerCase().includes('initial')
                        ? 'initial'
                        : childText.toLowerCase().includes('final')
                            ? 'final'
                            : 'intermediate';
                    states.push({
                        name: child.name,
                        type: stateType,
                        range: this.rangeToDTO(child.range),
                    });
                }
            }

            // D1: Extract flows from succession relationships in text
            const successionFlows = this.extractSuccessions(symbol, lines);
            flows.push(...successionFlows);

            // D1: Extract decide/if/merge patterns for decisions
            const fullText = this.getFullElementText(symbol, lines);
            // Check for `decide;` using word-boundary search
            const decideHits = findWordPositions(fullText, 'decide');
            const hasDecideStmt = decideHits.some(({ afterPos }) => {
                const p = skipWS(fullText, afterPos);
                return p < fullText.length && fullText[p] === ';';
            });
            if (hasDecideStmt) {
                const branches: { condition: string; target: string }[] = [];
                for (const { afterPos: ifAfter } of findWordPositions(fullText, 'if')) {
                    const thenIdx = fullText.indexOf('then', ifAfter);
                    if (thenIdx < 0) continue;
                    const bBefore = thenIdx > 0 ? fullText.charCodeAt(thenIdx - 1) : 32;
                    const bAfter = thenIdx + 4 < fullText.length ? fullText.charCodeAt(thenIdx + 4) : 32;
                    if (isWordChar(bBefore) || isWordChar(bAfter)) continue;
                    const condition = fullText.substring(ifAfter, thenIdx).trim();
                    const [target] = readWordAfterKeyword(fullText, thenIdx + 4);
                    if (target) {
                        branches.push({ condition, target });
                    }
                }
                if (branches.length > 0) {
                    decisions.push({
                        name: 'decide',
                        condition: '',
                        branches,
                        range: this.rangeToDTO(symbol.range),
                    });
                }
            }

            // D1: Add synthetic start/done control nodes when flows exist
            if (flows.length > 0) {
                const hasStartFlow = flows.some(f => f.from === 'start');
                const hasDoneFlow = flows.some(f => f.to === 'done');

                if (hasStartFlow) {
                    actions.unshift({
                        name: 'start',
                        type: 'initial',
                        isDefinition: false,
                        range: this.rangeToDTO(symbol.range),
                    });
                }
                if (hasDoneFlow) {
                    actions.push({
                        name: 'done',
                        type: 'final',
                        isDefinition: false,
                        range: this.rangeToDTO(symbol.range),
                    });
                }

                // Also add decide node as a special action if present
                if (flows.some(f => f.from === 'decide')) {
                    actions.push({
                        name: 'decide',
                        type: 'decision',
                        isDefinition: false,
                        range: this.rangeToDTO(symbol.range),
                    });
                }
            }

            if (actions.length > 0 || flows.length > 0 || states.length > 0) {
                diagrams.push({
                    name: symbol.name,
                    actions,
                    decisions,
                    flows,
                    states,
                    range: this.rangeToDTO(symbol.range),
                });
            }
        }

        return diagrams;
    }

    // -----------------------------------------------------------------------
    // Resolved Types Extraction
    // -----------------------------------------------------------------------

    /**
     * Extract resolved type information from the symbol table.
     *
     * This provides specialization chains and feature lists for definitions.
     * Because the LSP server doesn't yet have a full type resolver or library
     * index, we provide what's available from the parse tree.
     */
    private extractResolvedTypes(
        symbolTable: SymbolTable,
        uri: string,
        lines: string[],
    ): Record<string, ResolvedTypeDTO> {
        const symbols = symbolTable.getSymbolsForUri(uri);
        const result: Record<string, ResolvedTypeDTO> = {};

        for (const symbol of symbols) {
            // Only include definitions and typed usages
            if (!isDefinition(symbol.kind) && symbol.typeNames.length === 0) {
                continue;
            }

            const specializes: string[] = [];
            const specList = this.extractSpecializations(symbol, lines);
            for (const s of specList) {
                if (!specializes.includes(s)) { specializes.push(s); }
            }
            for (const tn of symbol.typeNames) {
                if (!specializes.includes(tn)) { specializes.push(tn); }
            }

            // Build specialization chain (currently single-level without library)
            const specializationChain = [...specializes];

            // Collect features (child attributes, ports, etc.)
            const children = this.getChildSymbols(symbol, symbolTable);
            const features: ResolvedFeatureDTO[] = children
                .filter(c => isUsage(c.kind))
                .map(c => ({
                    name: c.name,
                    kind: this.featureKindFromElementKind(c.kind),
                    type: c.typeNames.join(', ') || undefined,
                    isDerived: false,
                    isReadonly: false,
                }));

            result[symbol.qualifiedName] = {
                qualifiedName: symbol.qualifiedName,
                simpleName: symbol.name,
                kind: symbol.kind,
                isLibraryType: false,
                specializationChain,
                specializes,
                features,
            };
        }

        return result;
    }

    // -----------------------------------------------------------------------
    // Semantic Diagnostics
    // -----------------------------------------------------------------------

    /**
     * Extract semantic diagnostics beyond syntax errors.
     * Includes type resolution warnings, enum keyword validation, etc.
     */
    private extractSemanticDiagnostics(
        symbolTable: SymbolTable,
        uri: string,
    ): SemanticDiagnosticDTO[] {
        const symbols = symbolTable.getSymbolsForUri(uri);
        const diagnostics: SemanticDiagnosticDTO[] = [];
        const allSymbolNames = new Set(symbolTable.getAllSymbols().map(s => s.name));

        for (const symbol of symbols) {
            // Check for unresolved type references (check all typeNames)
            for (const tn of symbol.typeNames) {
                if (!allSymbolNames.has(tn)) {
                    diagnostics.push({
                        code: 'unresolved-type',
                        message: `Type '${tn}' could not be resolved in the current scope`,
                        severity: 'warning',
                        range: this.rangeToDTO(symbol.selectionRange),
                        elementName: symbol.name,
                    });
                }
            }

            // Enum definitions without any enum values
            if (symbol.kind === SysMLElementKind.EnumDef) {
                const children = this.getChildSymbols(symbol, symbolTable);
                const hasEnumValues = children.some(c =>
                    c.kind === SysMLElementKind.EnumUsage ||
                    c.kind === SysMLElementKind.AttributeUsage,
                );
                if (!hasEnumValues) {
                    diagnostics.push({
                        code: 'empty-enum',
                        message: `Enumeration '${symbol.name}' has no enum values defined`,
                        severity: 'info',
                        range: this.rangeToDTO(symbol.range),
                        elementName: symbol.name,
                    });
                }
            }
        }

        return diagnostics;
    }

    // -----------------------------------------------------------------------
    // Helper Methods
    // -----------------------------------------------------------------------

    /** Convert LSP Range → RangeDTO. */
    private rangeToDTO(range: Range): RangeDTO {
        return {
            start: { line: range.start.line, character: range.start.character },
            end: { line: range.end.line, character: range.end.character },
        };
    }

    /** Get child symbols for a given parent symbol. */
    private getChildSymbols(parent: SysMLSymbol, symbolTable: SymbolTable): SysMLSymbol[] {
        // The symbol table's children array may not be populated; use the
        // symbolsByUri list and filter by parentQualifiedName instead.
        const allSymbols = symbolTable.getSymbolsForUri(parent.uri);
        return allSymbols.filter(s => s.parentQualifiedName === parent.qualifiedName);
    }

    /**
     * Get the source text for an element's declaration line only
     * (not children's text).  This avoids over-matching on parent elements
     * whose range spans child elements.
     */
    private getElementText(symbol: SysMLSymbol, lines: string[]): string {
        const startLine = symbol.range.start.line;
        // Use only the first few lines of the element to capture its
        // declaration without including nested children's bodies.
        const endLine = Math.min(startLine + 2, symbol.range.end.line, lines.length - 1);
        return lines.slice(startLine, endLine + 1).join('\n');
    }

    /**
     * Get the full source text for an element's entire range.
     * Used when we need to scan the whole body (e.g., succession flows).
     */
    private getFullElementText(symbol: SysMLSymbol, lines: string[]): string {
        const startLine = symbol.range.start.line;
        const endLine = Math.min(symbol.range.end.line, lines.length - 1);
        return lines.slice(startLine, endLine + 1).join('\n');
    }

    /** Extract port direction (in | out | inout) from source text. */
    private extractDirection(symbol: SysMLSymbol, lines: string[]): string | undefined {
        if (symbol.kind !== SysMLElementKind.PortUsage && symbol.kind !== SysMLElementKind.PortDef) {
            return undefined;
        }
        const elementText = this.getElementText(symbol, lines);
        // Check 'inout' first — it contains 'in' and 'out' as substrings
        if (containsWord(elementText, 'inout')) return 'inout';
        if (containsWord(elementText, 'in')) return 'in';
        if (containsWord(elementText, 'out')) return 'out';
        return undefined;
    }

    /** Extract multiplicity (e.g., [4], [0..*]) from source text. */
    private extractMultiplicity(symbol: SysMLSymbol, lines: string[]): string | undefined {
        const elementText = this.getElementText(symbol, lines);
        const open = elementText.indexOf('[');
        if (open < 0) return undefined;
        const close = elementText.indexOf(']', open + 1);
        if (close < 0) return undefined;
        return elementText.substring(open + 1, close);
    }

    /** Extract modifiers (abstract, readonly, derived, etc.) from source text. */
    private extractModifier(symbol: SysMLSymbol, lines: string[]): string | undefined {
        const elementText = this.getElementText(symbol, lines);
        const modifiers: string[] = [];
        if (containsWord(elementText, 'abstract')) modifiers.push('abstract');
        if (containsWord(elementText, 'readonly')) modifiers.push('readonly');
        if (containsWord(elementText, 'derived')) modifiers.push('derived');
        if (containsWord(elementText, 'variation')) modifiers.push('variation');
        if (containsWord(elementText, 'individual')) modifiers.push('individual');
        return modifiers.length > 0 ? modifiers.join(', ') : undefined;
    }

    /** Extract visibility (public | private | protected) from source text. */
    private extractVisibility(symbol: SysMLSymbol, lines: string[]): string | undefined {
        const elementText = this.getElementText(symbol, lines);
        if (containsWord(elementText, 'private')) return 'private';
        if (containsWord(elementText, 'protected')) return 'protected';
        if (containsWord(elementText, 'public')) return 'public';
        return undefined;
    }

    /** Extract default/assigned value from source text. */
    private extractValue(symbol: SysMLSymbol, lines: string[]): string | undefined {
        if (symbol.kind !== SysMLElementKind.AttributeUsage) {
            return undefined;
        }
        const elementText = this.getElementText(symbol, lines);
        // Find the first `=` (optionally preceded by `:` for `:=`)
        const eqIdx = elementText.indexOf('=');
        if (eqIdx < 0) return undefined;
        // Skip the `=` and any following whitespace
        let start = eqIdx + 1;
        // Handle `:=` — the `:` comes before `=` but we've already found `=`
        // Handle `==` — skip double-equals (comparison, not assignment)
        if (start < elementText.length && elementText[start] === '=') return undefined;
        start = skipWS(elementText, start);
        // Read until `;`, `{`, `}`, or newline
        let end = start;
        while (end < elementText.length) {
            const ch = elementText[end];
            if (ch === ';' || ch === '{' || ch === '}' || ch === '\n') break;
            end++;
        }
        const val = elementText.substring(start, end).trim();
        if (val && !val.includes('def') && val.length < 100) {
            return val;
        }
        return undefined;
    }

    /** Extract all specialization targets from `:>` or `specializes` syntax. */
    private extractSpecializations(symbol: SysMLSymbol, lines: string[]): string[] {
        const elementText = this.getElementText(symbol, lines);

        // Match `:>` syntax — find ':>' then read comma-separated identifiers
        const colonGtIdx = elementText.indexOf(':>');
        if (colonGtIdx >= 0) {
            // Make sure it's not `:>>` (redefinition)
            if (colonGtIdx + 2 < elementText.length && elementText[colonGtIdx + 2] === '>') {
                // skip :>> — fall through to specializes check
            } else {
                return readCommaSeparatedIdents(elementText, colonGtIdx + 2);
            }
        }

        // Match `specializes` keyword then read comma-separated identifiers
        const specPositions = findWordPositions(elementText, 'specializes');
        if (specPositions.length > 0) {
            return readCommaSeparatedIdents(elementText, specPositions[0].afterPos);
        }

        return [];
    }

    /** Extract connection endpoints from `connect` syntax. */
    private extractConnectionEndpoints(symbol: SysMLSymbol, lines: string[]): string[] {
        const elementText = this.getElementText(symbol, lines);
        const endpoints: string[] = [];

        // Pattern: connect X to Y
        const connectPositions = findWordPositions(elementText, 'connect');
        for (const { afterPos } of connectPositions) {
            const [name1, end1] = readWordAfterKeyword(elementText, afterPos, true);
            if (!name1) continue;
            const toPos = skipWS(elementText, end1);
            if (elementText.substring(toPos, toPos + 2) === 'to') {
                const afterTo = toPos + 2;
                const [name2] = readWordAfterKeyword(elementText, afterTo, true);
                if (name2) {
                    endpoints.push(name1, name2);
                    return endpoints;
                }
            }
        }

        // Pattern: end X; end Y (connection end features)
        const endPositions = findWordPositions(elementText, 'end');
        for (const { afterPos } of endPositions) {
            const [name] = readWordAfterKeyword(elementText, afterPos, true);
            if (name) endpoints.push(name);
        }

        return endpoints;
    }

    /**
     * Scan full source text for standalone `satisfy X by Y` and `verify X by Y`
     * statements that aren't nested inside another symbol's declaration.
     */
    private extractStandaloneSatisfyVerify(text: string): RelationshipDTO[] {
        const rels: RelationshipDTO[] = [];
        const keywords = ['satisfy', 'verify'] as const;

        for (const kw of keywords) {
            const positions = findWordPositions(text, kw);
            for (const { afterPos } of positions) {
                let pos = skipWS(text, afterPos);
                // Skip optional 'requirement' keyword
                const [nextWord, afterWord] = readNameOrQuoted(text, pos);
                if (nextWord === 'requirement') {
                    pos = skipWS(text, afterWord);
                } else {
                    pos = skipWS(text, afterPos);
                }
                const [reqName, afterReq] = readNameOrQuoted(text, pos);
                if (!reqName || reqName === 'requirement') continue;

                // Look for 'by <satisfier>' clause
                const byPos = skipWS(text, afterReq);
                const [byWord, afterBy] = readIdent(text, byPos);
                if (byWord !== 'by') continue;  // standalone satisfy/verify must have 'by'
                const [satisfier] = readNameOrQuoted(text, skipWS(text, afterBy));
                if (!satisfier) continue;

                rels.push({ type: kw, source: satisfier, target: reqName });
            }
        }
        return rels;
    }

    /** Extract relationship keywords from element text. */
    private extractKeywordRelationships(elementName: string, elementText: string): RelationshipDTO[] {
        const rels: RelationshipDTO[] = [];

        // subsetting: `subsets X`
        const subsetsPositions = findWordPositions(elementText, 'subsets');
        if (subsetsPositions.length > 0) {
            const [target] = readWordAfterKeyword(elementText, subsetsPositions[0].afterPos);
            if (target) rels.push({ type: 'subsetting', source: elementName, target });
        }

        // redefinition: `redefines X`
        const redefPositions = findWordPositions(elementText, 'redefines');
        if (redefPositions.length > 0) {
            const [target] = readWordAfterKeyword(elementText, redefPositions[0].afterPos);
            if (target) rels.push({ type: 'redefinition', source: elementName, target });
        }

        // satisfy: `satisfy [requirement] X [by Y]`
        const satisfyPositions = findWordPositions(elementText, 'satisfy');
        if (satisfyPositions.length > 0) {
            let pos = skipWS(elementText, satisfyPositions[0].afterPos);
            // Skip optional 'requirement' keyword
            const [nextWord, afterWord] = readNameOrQuoted(elementText, pos);
            if (nextWord === 'requirement') {
                pos = skipWS(elementText, afterWord);
            }
            const [reqName, afterReq] = readNameOrQuoted(elementText, pos);
            if (reqName && reqName !== 'requirement') {
                // Check for 'by <satisfier>' clause
                let satisfier = elementName;
                const byPos = skipWS(elementText, afterReq);
                const [byWord, afterBy] = readIdent(elementText, byPos);
                if (byWord === 'by') {
                    const [byTarget] = readNameOrQuoted(elementText, skipWS(elementText, afterBy));
                    if (byTarget) satisfier = byTarget;
                }
                rels.push({ type: 'satisfy', source: satisfier, target: reqName });
            }
        }

        // verify: `verify [requirement] X [by Y]`
        const verifyPositions = findWordPositions(elementText, 'verify');
        if (verifyPositions.length > 0) {
            let pos = skipWS(elementText, verifyPositions[0].afterPos);
            // Skip optional 'requirement' keyword
            const [nextWord, afterWord] = readNameOrQuoted(elementText, pos);
            if (nextWord === 'requirement') {
                pos = skipWS(elementText, afterWord);
            }
            const [reqName, afterReq] = readNameOrQuoted(elementText, pos);
            if (reqName && reqName !== 'requirement') {
                // Check for 'by <verifier>' clause
                let verifier = elementName;
                const byPos = skipWS(elementText, afterReq);
                const [byWord, afterBy] = readIdent(elementText, byPos);
                if (byWord === 'by') {
                    const [byTarget] = readNameOrQuoted(elementText, skipWS(elementText, afterBy));
                    if (byTarget) verifier = byTarget;
                }
                rels.push({ type: 'verify', source: verifier, target: reqName });
            }
        }

        return rels;
    }

    /** Extract decision branches from decision node text. */
    private extractDecisionBranches(
        symbol: SysMLSymbol,
        lines: string[],
    ): { condition: string; target: string }[] {
        const elementText = this.getElementText(symbol, lines);
        const branches: { condition: string; target: string }[] = [];

        // Find all 'if' keywords and extract condition + target
        const ifPositions = findWordPositions(elementText, 'if');
        for (const { afterPos } of ifPositions) {
            // Read condition: everything from after 'if' until 'then'
            const thenIdx = elementText.indexOf('then', afterPos);
            if (thenIdx < 0) continue;
            // Ensure 'then' is a word boundary
            const beforeThen = thenIdx > 0 ? elementText.charCodeAt(thenIdx - 1) : 32;
            const afterThen = thenIdx + 4 < elementText.length ? elementText.charCodeAt(thenIdx + 4) : 32;
            if (isWordChar(beforeThen) || isWordChar(afterThen)) continue;

            const condition = elementText.substring(afterPos, thenIdx).trim();
            const [target] = readWordAfterKeyword(elementText, thenIdx + 4);
            if (target) {
                branches.push({ condition, target });
            }
        }

        // Pattern: else <target>
        const elsePositions = findWordPositions(elementText, 'else');
        if (elsePositions.length > 0) {
            const [target] = readWordAfterKeyword(elementText, elsePositions[0].afterPos);
            if (target) {
                branches.push({ condition: 'else', target });
            }
        }

        return branches;
    }

    /**
     * Extract succession (control flow) relationships from action body text.
     *
     * Handles multi-line succession chains, inline patterns, and
     * decision/merge control flow patterns:
     *   - Multi-line: `first X;` / `then Y;` / `then Z;`
     *   - Inline:     `first X then Y;`
     *   - Explicit:   `succession first X then Y;`
     *   - Decision:   `decide; if <cond> then X; merge Y;`
     *   - Quoted:     `then 'My Action';`
     */
    private extractSuccessions(
        parent: SysMLSymbol,
        lines: string[],
    ): ControlFlowDTO[] {
        const elementText = this.getFullElementText(parent, lines);
        const flows: ControlFlowDTO[] = [];
        const seen = new Set<string>();
        const range = this.rangeToDTO(parent.range);

        const addFlow = (from: string, to: string, guard?: string): void => {
            // Prevent self-referencing flows (e.g. start→start, done→done)
            if (from === to) return;
            const key = `${from}->${to}`;
            if (seen.has(key)) return;
            seen.add(key);
            const f: ControlFlowDTO = { from, to, range };
            if (guard) f.guard = guard;
            flows.push(f);
        };

        // Helper: compute brace nesting depth at a given text position.
        function braceDepthAt(text: string, pos: number): number {
            let depth = 0;
            for (let i = 0; i < pos && i < text.length; i++) {
                if (text[i] === '{') depth++;
                else if (text[i] === '}') depth--;
            }
            return depth;
        }

        // Top-level depth is 1 (inside the parent element's opening brace).
        const firstBrace = elementText.indexOf('{');
        const topDepth = firstBrace >= 0
            ? braceDepthAt(elementText, firstBrace + 1)
            : 1;

        // Helper: strip qualified name prefix (e.g. "Pkg::name" → "name")
        const stripQualifier = (name: string): string => {
            const idx = name.lastIndexOf('::');
            return idx >= 0 ? name.substring(idx + 2) : name;
        };

        // ── Step 1: Collect first/then tokens in text order ──
        // Only collects tokens at the top-level brace depth to avoid
        // picking up nested `then` keywords inside if/else blocks.
        interface FlowToken { type: 'first' | 'then'; name: string; index: number }
        const tokens: FlowToken[] = [];

        // Find `first <name>` or `first '<quoted name>'`
        // Supports qualified names: `first Pkg::element`
        for (const { pos, afterPos } of findWordPositions(elementText, 'first')) {
            if (braceDepthAt(elementText, pos) !== topDepth) continue;
            const nameStart = skipWS(elementText, afterPos);
            const [name] = readNameOrQuoted(elementText, nameStart);
            if (name) {
                tokens.push({ type: 'first', name: stripQualifier(name), index: pos });
            }
        }

        // Find `then [action] <name>` — skips the optional `action` keyword
        // so that `then action startBatmobile` captures "startBatmobile".
        // Also supports quoted names and qualified names.
        for (const { pos, afterPos } of findWordPositions(elementText, 'then')) {
            // Only process tokens at the top-level brace depth
            if (braceDepthAt(elementText, pos) !== topDepth) continue;
            // Skip `then` that is part of `if <condition> then <target>`
            // Look back up to 100 chars for an `if` keyword without an intervening `;`
            const lookbackStart = Math.max(0, pos - 100);
            const preceding = elementText.substring(lookbackStart, pos);
            if (containsWord(preceding, 'if') && !preceding.includes(';')) continue;

            let nameStart = skipWS(elementText, afterPos);
            // Skip optional `action` keyword
            const [maybeAction, afterAction] = readIdent(elementText, nameStart);
            if (maybeAction === 'action') {
                nameStart = skipWS(elementText, afterAction);
            }
            const [name] = readNameOrQuoted(elementText, nameStart);
            // Skip `then if` — decision points handled in Step 4
            if (!name || name === 'if') continue;
            tokens.push({ type: 'then', name: stripQualifier(name), index: pos });
        }

        tokens.sort((a, b) => a.index - b.index);

        // ── Step 2: Build succession chains from ordered tokens ──
        const coveredIndices = new Set<number>();

        for (let i = 0; i < tokens.length; i++) {
            if (tokens[i].type === 'first') {
                const chain: string[] = [tokens[i].name];
                coveredIndices.add(i);
                for (let j = i + 1; j < tokens.length; j++) {
                    if (tokens[j].type === 'then') {
                        chain.push(tokens[j].name);
                        coveredIndices.add(j);
                    } else {
                        break;
                    }
                }
                for (let k = 0; k < chain.length - 1; k++) {
                    addFlow(chain[k], chain[k + 1]);
                }
            }
        }

        // Handle orphan `then` tokens not covered by a `first` chain.
        const uncoveredThens = tokens.filter(
            (t, i) => !coveredIndices.has(i) && t.type === 'then',
        );
        if (uncoveredThens.length > 0) {
            for (let i = 0; i < uncoveredThens.length - 1; i++) {
                addFlow(uncoveredThens[i].name, uncoveredThens[i + 1].name);
            }
        }

        // ── Synthesise start→first and last→done edges ──
        if (flows.length > 0) {
            const allTargets = new Set(flows.map(f => f.to));
            const allSources = new Set(flows.map(f => f.from));
            const entryActions = flows
                .map(f => f.from)
                .filter(name => name !== 'start' && name !== 'done' && !allTargets.has(name));
            const exitActions = flows
                .map(f => f.to)
                .filter(name => name !== 'start' && name !== 'done' && !allSources.has(name));

            if (entryActions.length > 0) {
                addFlow('start', entryActions[0]);
            }
            if (exitActions.length > 0) {
                addFlow(exitActions[exitActions.length - 1], 'done');
            }
        }

        // ── Step 3: Explicit `succession` keyword ──
        //   succession [first] X then Y;
        //   succession flow from X[.port] to Y[.port];
        for (const { afterPos } of findWordPositions(elementText, 'succession')) {
            let p = skipWS(elementText, afterPos);
            const [word1, afterWord1] = readIdent(elementText, p);

            // Check for `succession flow from X to Y`
            if (word1 === 'flow') {
                p = skipWS(elementText, afterWord1);
                const [fromKw, afterFrom] = readIdent(elementText, p);
                if (fromKw === 'from') {
                    p = skipWS(elementText, afterFrom);
                    const [srcFull, afterSrc] = readIdent(elementText, p, true);
                    // Strip `.port` suffix — take only the part before first dot
                    const src = srcFull.includes('.') ? srcFull.substring(0, srcFull.indexOf('.')) : srcFull;
                    p = skipWS(elementText, afterSrc);
                    const [toKw, afterTo] = readIdent(elementText, p);
                    if (toKw === 'to') {
                        p = skipWS(elementText, afterTo);
                        const [dstFull] = readIdent(elementText, p, true);
                        const dst = dstFull.includes('.') ? dstFull.substring(0, dstFull.indexOf('.')) : dstFull;
                        if (src && dst) addFlow(src, dst);
                    }
                }
                continue;
            }

            // Check for `succession [first] X then Y`
            let nameStart = p;
            if (word1 === 'first') {
                nameStart = skipWS(elementText, afterWord1);
            }
            const [name1] = readNameOrQuoted(elementText, nameStart);
            if (!name1) continue;
            // Find 'then' after name1
            const afterName1 = nameStart + name1.length + (elementText[nameStart] === "'" ? 2 : 0);
            const thenCheck = skipWS(elementText, afterName1);
            const [thenKw, afterThen] = readIdent(elementText, thenCheck);
            if (thenKw === 'then') {
                const name2Start = skipWS(elementText, afterThen);
                const [name2] = readNameOrQuoted(elementText, name2Start);
                if (name2) addFlow(stripQualifier(name1), stripQualifier(name2));
            }
        }

        // ── Step 4: Decision / merge patterns ──
        // Check for `decide;` as a whole word followed by `;`
        const decidePositions = findWordPositions(elementText, 'decide');
        const hasDecide = decidePositions.some(({ afterPos }) => {
            const p = skipWS(elementText, afterPos);
            return p < elementText.length && elementText[p] === ';';
        });

        if (hasDecide) {
            // Remove all auto-generated flows FROM 'decide'
            for (let fi = flows.length - 1; fi >= 0; fi--) {
                if (flows[fi].from === 'decide') {
                    seen.delete(`decide->${flows[fi].to}`);
                    flows.splice(fi, 1);
                }
            }

            // Extract decision branches: `if <cond> then <target>;`
            const branchTargets: string[] = [];
            for (const { afterPos: ifAfter } of findWordPositions(elementText, 'if')) {
                // Read condition: everything until 'then'
                const thenIdx = elementText.indexOf('then', ifAfter);
                if (thenIdx < 0) continue;
                // Ensure 'then' is a word boundary
                const bBefore = thenIdx > 0 ? elementText.charCodeAt(thenIdx - 1) : 32;
                const bAfter = thenIdx + 4 < elementText.length ? elementText.charCodeAt(thenIdx + 4) : 32;
                if (isWordChar(bBefore) || isWordChar(bAfter)) continue;

                const condition = elementText.substring(ifAfter, thenIdx).trim();
                const targetStart = skipWS(elementText, thenIdx + 4);
                const [target] = readNameOrQuoted(elementText, targetStart);
                if (target) {
                    // Check that a `;` follows the target
                    const afterTarget = targetStart + target.length + (elementText[targetStart] === "'" ? 2 : 0);
                    const semi = skipWS(elementText, afterTarget);
                    if (semi < elementText.length && elementText[semi] === ';') {
                        addFlow('decide', target, condition);
                        branchTargets.push(target);
                    }
                }
            }

            // Extract merge target: `merge <target>;`
            for (const { pos: mergePos, afterPos: mergeAfter } of findWordPositions(elementText, 'merge')) {
                const mStart = skipWS(elementText, mergeAfter);
                const [mergeTarget] = readNameOrQuoted(elementText, mStart);
                if (!mergeTarget) continue;
                // Check for trailing `;`
                const afterMT = mStart + mergeTarget.length + (elementText[mStart] === "'" ? 2 : 0);
                const semiP = skipWS(elementText, afterMT);
                if (semiP >= elementText.length || elementText[semiP] !== ';') continue;

                for (const branch of branchTargets) {
                    addFlow(branch, mergeTarget);
                }
                // Connect merge target to next `then` in the chain
                const afterMerge = tokens.filter(
                    t => t.type === 'then' && t.index > mergePos,
                );
                if (afterMerge.length > 0) {
                    addFlow(mergeTarget, afterMerge[0].name);
                } else if (mergeTarget !== 'done') {
                    addFlow(mergeTarget, 'done');
                }
            }
        }

        return flows;
    }

    /** Convert element kind to feature kind string. */
    private featureKindFromElementKind(kind: SysMLElementKind): string {
        switch (kind) {
            case SysMLElementKind.AttributeUsage:
            case SysMLElementKind.AttributeDef:
                return 'attribute';
            case SysMLElementKind.PortUsage:
            case SysMLElementKind.PortDef:
                return 'port';
            case SysMLElementKind.ActionUsage:
            case SysMLElementKind.ActionDef:
                return 'action';
            case SysMLElementKind.StateUsage:
            case SysMLElementKind.StateDef:
                return 'state';
            default:
                return 'reference';
        }
    }

    /** Convert an action symbol to an ActivityActionDTO. */
    private symbolToActionDTO(
        symbol: SysMLSymbol,
        symbolTable: SymbolTable,
        lines: string[],
    ): ActivityActionDTO {
        const childText = this.getElementText(symbol, lines);
        let actionType = 'action';
        const lowerText = childText.toLowerCase();
        if (lowerText.includes('fork')) actionType = 'fork';
        else if (lowerText.includes('join')) actionType = 'join';
        else if (lowerText.includes('merge')) actionType = 'merge';
        else if (lowerText.includes('decide')) actionType = 'decision';

        return {
            name: symbol.name,
            type: actionType,
            isDefinition: symbol.kind === SysMLElementKind.ActionDef,
            range: this.rangeToDTO(symbol.range),
        };
    }
}
