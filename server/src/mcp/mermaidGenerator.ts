/**
 * SysML → Mermaid Diagram Generator
 *
 * Converts SysML symbol data into Mermaid diagram markup for visual preview.
 * Supports multiple diagram types, auto-detecting the best fit based
 * on the element kinds present in the model.
 */

import type { SysMLSymbol } from '../symbols/sysmlElements.js';
import { SysMLElementKind, isDefinition } from '../symbols/sysmlElements.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DiagramType = 'general' | 'activity' | 'state' | 'sequence' | 'interconnection' | 'usecase';

export interface MermaidResult {
    /** The Mermaid markup string */
    diagram: string;
    /** The detected or requested diagram type */
    diagramType: DiagramType;
    /** Human-readable description of what the diagram shows */
    description: string;
    /** Number of elements rendered in the diagram */
    elementCount: number;
}

// ---------------------------------------------------------------------------
// Sanitisation — Mermaid is picky about node IDs and labels
// ---------------------------------------------------------------------------

/** Create a safe Mermaid node ID from a qualified name (no regex). */
function safeId(name: string): string {
    let result = '';
    for (let i = 0; i < name.length; i++) {
        const c = name.charCodeAt(i);
        if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122) ||
            (c >= 48 && c <= 57) || c === 95) {
            result += name[i];
        } else {
            result += '_';
        }
    }
    // Trim leading/trailing underscores
    let start = 0;
    while (start < result.length && result[start] === '_') start++;
    let end = result.length;
    while (end > start && result[end - 1] === '_') end--;
    return result.substring(start, end) || 'node';
}

/** Escape label text for Mermaid (quotes and angle brackets, no regex). */
function escapeLabel(text: string): string {
    let result = '';
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"') {
            result += '#quot;';
        } else if (ch !== '<' && ch !== '>') {
            result += ch;
        }
    }
    return result;
}

// ---------------------------------------------------------------------------
// Children index — SysMLSymbol.children[] is not populated by the parser,
// so we build a parent→children lookup from parentQualifiedName instead.
// ---------------------------------------------------------------------------

function buildChildrenIndex(allSymbols: SysMLSymbol[]): Map<string, SysMLSymbol[]> {
    const index = new Map<string, SysMLSymbol[]>();
    const seen = new Set<string>();
    for (const s of allSymbols) {
        // Deduplicate — the symbol table may contain the same symbol
        // under both its qualified name and simple name keys.
        if (seen.has(s.qualifiedName)) continue;
        seen.add(s.qualifiedName);

        if (s.parentQualifiedName) {
            const list = index.get(s.parentQualifiedName) ?? [];
            list.push(s);
            index.set(s.parentQualifiedName, list);
        }
    }
    return index;
}

// ---------------------------------------------------------------------------
// Styling — Mermaid classDef / cssClass directives
// ---------------------------------------------------------------------------

/** Colour palette keyed by camelCase kind label (e.g. PartDef, Package). */
const STYLE_PALETTE: Record<string, { fill: string; stroke: string; color: string }> = {
    Package: { fill: '#e8f4f8', stroke: '#2196F3', color: '#1565C0' },
    PartDef: { fill: '#e8f5e9', stroke: '#4CAF50', color: '#2E7D32' },
    PortDef: { fill: '#fff3e0', stroke: '#FF9800', color: '#E65100' },
    Part: { fill: '#f1f8e9', stroke: '#8BC34A', color: '#33691E' },
    Port: { fill: '#fff8e1', stroke: '#FFC107', color: '#F57F17' },
    AttributeDef: { fill: '#fce4ec', stroke: '#E91E63', color: '#880E4F' },
    InterfaceDef: { fill: '#ede7f6', stroke: '#673AB7', color: '#311B92' },
    InterfaceUsage: { fill: '#f3e5f5', stroke: '#9C27B0', color: '#4A148C' },
    ConnectionDef: { fill: '#e0f2f1', stroke: '#009688', color: '#004D40' },
    ConnectionUsage: { fill: '#e0f7fa', stroke: '#00BCD4', color: '#006064' },
    ActionDef: { fill: '#e8eaf6', stroke: '#3F51B5', color: '#1A237E' },
    ActionUsage: { fill: '#e3f2fd', stroke: '#2196F3', color: '#0D47A1' },
    PerformActionUsage: { fill: '#e3f2fd', stroke: '#2196F3', color: '#0D47A1' },
    StateDef: { fill: '#f3e5f5', stroke: '#9C27B0', color: '#4A148C' },
    StateUsage: { fill: '#fce4ec', stroke: '#E91E63', color: '#880E4F' },
    ExhibitStateUsage: { fill: '#fce4ec', stroke: '#E91E63', color: '#880E4F' },
    ItemDef: { fill: '#efebe9', stroke: '#795548', color: '#3E2723' },
    ItemUsage: { fill: '#efebe9', stroke: '#795548', color: '#3E2723' },
    EnumerationDef: { fill: '#eceff1', stroke: '#607D8B', color: '#263238' },
    RequirementDef: { fill: '#fff9c4', stroke: '#F9A825', color: '#F57F17' },
    RequirementUsage: { fill: '#fffde7', stroke: '#FBC02D', color: '#F57F17' },
    UseCaseDef: { fill: '#e1f5fe', stroke: '#0288D1', color: '#01579B' },
    UseCaseUsage: { fill: '#e1f5fe', stroke: '#0288D1', color: '#01579B' },
    IncludeUseCaseUsage: { fill: '#e1f5fe', stroke: '#0288D1', color: '#01579B' },
    ActorUsage: { fill: '#fbe9e7', stroke: '#FF5722', color: '#BF360C' },
    SubjectUsage: { fill: '#e8eaf6', stroke: '#3F51B5', color: '#1A237E' },
    StakeholderUsage: { fill: '#f3e5f5', stroke: '#9C27B0', color: '#4A148C' },
    OccurrenceDef: { fill: '#e0f7fa', stroke: '#00ACC1', color: '#006064' },
    OccurrenceUsage: { fill: '#e0f7fa', stroke: '#00ACC1', color: '#006064' },
};

/** Default style for kinds not explicitly listed. */
const DEFAULT_STYLE = { fill: '#f5f5f5', stroke: '#9E9E9E', color: '#212121' };

/**
 * Emit classDef lines + style application for the given id→kindLabel map.
 * Works for classDiagram (`cssClass "id" cls`), flowchart (`style id ...`),
 * and stateDiagram-v2 (`classDef` + `class`).
 *
 * @param format  'cssClass' for classDiagram, 'style' for flowchart, 'class' for state
 */
function emitStyleDirectives(
    lines: string[],
    nodeStyles: Map<string, string>,   // nodeId → kindLabel
    format: 'cssClass' | 'style' | 'class',
): void {
    if (format === 'style') {
        // flowchart: direct per-node style directives (most reliable)
        for (const [nodeId, kindLabel] of nodeStyles) {
            const p = STYLE_PALETTE[kindLabel] ?? DEFAULT_STYLE;
            lines.push(
                `    style ${nodeId} fill:${p.fill},stroke:${p.stroke},stroke-width:2px,color:${p.color}`,
            );
        }
        return;
    }

    // Collect which style class names are actually used
    const usedClasses = new Map<string, { fill: string; stroke: string; color: string }>();
    for (const kindLabel of nodeStyles.values()) {
        if (!usedClasses.has(kindLabel)) {
            usedClasses.set(kindLabel, STYLE_PALETTE[kindLabel] ?? DEFAULT_STYLE);
        }
    }

    // Emit classDef lines (style name = kindLabel + "Style" to avoid clashes)
    for (const [kindLabel, palette] of usedClasses) {
        const cls = kindLabel + 'Style';
        lines.push(
            `    classDef ${cls} fill:${palette.fill},stroke:${palette.stroke},stroke-width:2px,color:${palette.color}`,
        );
    }

    // Apply to nodes
    if (format === 'cssClass') {
        // classDiagram syntax: cssClass "nodeId" styleName
        for (const [nodeId, kindLabel] of nodeStyles) {
            lines.push(`    cssClass "${nodeId}" ${kindLabel}Style`);
        }
    } else {
        // stateDiagram syntax: class id1,id2 styleName
        const grouped = new Map<string, string[]>();
        for (const [nodeId, kindLabel] of nodeStyles) {
            const cls = kindLabel + 'Style';
            const arr = grouped.get(cls) ?? [];
            arr.push(nodeId);
            grouped.set(cls, arr);
        }
        for (const [cls, ids] of grouped) {
            lines.push(`    class ${ids.join(',')} ${cls}`);
        }
    }
}

// ---------------------------------------------------------------------------
// Diagram Type Auto-Detection
// ---------------------------------------------------------------------------

/**
 * Infer the best diagram type from the symbols present.
 * Priority: if actions dominate → activity; if states dominate → state;
 * otherwise → general view.
 */
export function inferDiagramType(symbols: SysMLSymbol[]): DiagramType {
    const kinds = new Map<string, number>();
    for (const s of symbols) {
        kinds.set(s.kind, (kinds.get(s.kind) ?? 0) + 1);
    }

    const actionCount = (kinds.get(SysMLElementKind.ActionDef) ?? 0)
        + (kinds.get(SysMLElementKind.ActionUsage) ?? 0)
        + (kinds.get(SysMLElementKind.PerformActionUsage) ?? 0);

    const stateCount = (kinds.get(SysMLElementKind.StateDef) ?? 0)
        + (kinds.get(SysMLElementKind.StateUsage) ?? 0)
        + (kinds.get(SysMLElementKind.TransitionUsage) ?? 0)
        + (kinds.get(SysMLElementKind.ExhibitStateUsage) ?? 0);

    const structuralCount = (kinds.get(SysMLElementKind.PartDef) ?? 0)
        + (kinds.get(SysMLElementKind.PartUsage) ?? 0)
        + (kinds.get(SysMLElementKind.PortDef) ?? 0)
        + (kinds.get(SysMLElementKind.PortUsage) ?? 0)
        + (kinds.get(SysMLElementKind.InterfaceDef) ?? 0)
        + (kinds.get(SysMLElementKind.InterfaceUsage) ?? 0)
        + (kinds.get(SysMLElementKind.ConnectionDef) ?? 0)
        + (kinds.get(SysMLElementKind.ConnectionUsage) ?? 0);

    const useCaseCount = (kinds.get(SysMLElementKind.UseCaseDef) ?? 0)
        + (kinds.get(SysMLElementKind.UseCaseUsage) ?? 0)
        + (kinds.get(SysMLElementKind.IncludeUseCaseUsage) ?? 0)
        + (kinds.get(SysMLElementKind.ActorUsage) ?? 0)
        + (kinds.get(SysMLElementKind.SubjectUsage) ?? 0)
        + (kinds.get(SysMLElementKind.StakeholderUsage) ?? 0);

    const sequenceCount = (kinds.get(SysMLElementKind.OccurrenceDef) ?? 0)
        + (kinds.get(SysMLElementKind.OccurrenceUsage) ?? 0);

    // Sequence-specific: multiple participant types + action def with child actions
    const partDefCount = kinds.get(SysMLElementKind.PartDef) ?? 0;
    const actionDefCount = kinds.get(SysMLElementKind.ActionDef) ?? 0;
    const connectionCount = (kinds.get(SysMLElementKind.ConnectionUsage) ?? 0)
        + (kinds.get(SysMLElementKind.InterfaceUsage) ?? 0);

    const total = symbols.length;
    if (total === 0) return 'general';

    // If use case elements dominate → use case diagram
    if (useCaseCount > 0 && useCaseCount / total > 0.3) return 'usecase';
    // Sequence: ≥3 participant types + action def(s) + no connections → message-passing pattern
    if (partDefCount >= 3 && actionDefCount > 0 && actionCount > 0 && connectionCount === 0) {
        return 'sequence';
    }
    // Also detect sequence from occurrence defs
    if (sequenceCount > 0 && sequenceCount / total > 0.3) return 'sequence';
    // If >40% are actions, use activity diagram
    if (actionCount > 0 && actionCount / total > 0.4) return 'activity';
    // If >40% are states, use state diagram
    if (stateCount > 0 && stateCount / total > 0.4) return 'state';
    // If ports/connections dominate, use interconnection (rendered as flowchart)
    if (structuralCount > 0 && (kinds.get(SysMLElementKind.ConnectionUsage) ?? 0) > 0
        && (kinds.get(SysMLElementKind.InterfaceUsage) ?? 0) + (kinds.get(SysMLElementKind.ConnectionUsage) ?? 0) > 2) {
        return 'interconnection';
    }

    return 'general';
}

// ---------------------------------------------------------------------------
// General View → Mermaid classDiagram
// ---------------------------------------------------------------------------

/**
 * Build a map from qualified name → short display ID.
 * Uses simple names where unambiguous, otherwise disambiguates with parent prefix.
 */
function buildDisplayIds(symbols: SysMLSymbol[]): Map<string, string> {
    const nameCount = new Map<string, number>();
    for (const s of symbols) {
        nameCount.set(s.name, (nameCount.get(s.name) ?? 0) + 1);
    }

    const ids = new Map<string, string>();
    for (const s of symbols) {
        let displayId: string;
        if (nameCount.get(s.name)! > 1 && s.parentQualifiedName) {
            // Disambiguate with parent name
            const parentName = s.parentQualifiedName.split('::').pop() ?? s.parentQualifiedName;
            displayId = safeId(`${parentName}_${s.name}`);
        } else {
            displayId = safeId(s.name);
        }
        ids.set(s.qualifiedName, displayId);
    }
    return ids;
}

function generateGeneralView(symbols: SysMLSymbol[], symbolTable: Map<string, SysMLSymbol>): MermaidResult {
    const lines: string[] = [
        '%%{init: {"theme": "base", "themeVariables": {"primaryColor": "#e8f5e9", "lineColor": "#546E7A"}}}%%',
        'classDiagram',
    ];
    const rendered = new Set<string>();
    const nodeStyles = new Map<string, string>();  // nodeId → kindLabel for styling
    let elementCount = 0;

    // Build parent→children index (sym.children is not populated by the parser)
    const childrenOf = buildChildrenIndex([...symbolTable.values()]);

    // Only render definitions and structural usages (skip attributes, docs, etc.)
    const meaningful = symbols.filter(s =>
        s.kind !== SysMLElementKind.Comment
        && s.kind !== SysMLElementKind.Doc
        && s.kind !== SysMLElementKind.Import
        && s.kind !== SysMLElementKind.Alias
        && s.kind !== SysMLElementKind.Unknown
        && s.kind !== SysMLElementKind.AttributeUsage
        && s.kind !== SysMLElementKind.AttributeDef
        && s.kind !== SysMLElementKind.PortUsage
    );

    const displayIds = buildDisplayIds(meaningful);

    for (const sym of meaningful) {
        const id = displayIds.get(sym.qualifiedName) ?? safeId(sym.qualifiedName);
        if (rendered.has(id)) continue;
        rendered.add(id);
        elementCount++;

        // Collect members: attributes, ports, nested parts
        const childSymbols = (childrenOf.get(sym.qualifiedName) ?? [])
            .filter(c =>
                c.kind === SysMLElementKind.AttributeUsage
                || c.kind === SysMLElementKind.PortUsage
                || c.kind === SysMLElementKind.PartUsage
            );

        // Convert kind to camelCase for Mermaid annotation (hyphens break rendering)
        // e.g. "part def" → "PartDef", "port" → "Port", "package" → "Package"
        const kindLabel = sym.kind
            .split(/\s+/)
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join('');

        // Track for styling
        nodeStyles.set(id, kindLabel);

        if (childSymbols.length > 0) {
            lines.push(`    class ${id} {`);
            lines.push(`        <<${kindLabel}>>`)
            for (const child of childSymbols) {
                const typeStr = child.typeNames.length > 0 ? ` : ${child.typeNames[0]}` : '';
                const mult = child.multiplicity ? `[${child.multiplicity}]` : '';
                lines.push(`        +${escapeLabel(child.name)}${typeStr}${mult}`);
            }
            lines.push('    }');
        } else {
            lines.push(`    class ${id}`);
            lines.push(`    <<${kindLabel}>> ${id}`);
        }
    }

    // Relationships: specialisation and containment
    for (const sym of meaningful) {
        const id = displayIds.get(sym.qualifiedName) ?? safeId(sym.qualifiedName);

        for (const typeName of sym.typeNames) {
            const target = symbolTable.get(typeName)
                ?? [...symbolTable.values()].find(s => s.name === typeName);
            if (target) {
                const targetId = displayIds.get(target.qualifiedName) ?? safeId(target.qualifiedName);
                if (rendered.has(targetId)) {
                    lines.push(`    ${targetId} <|-- ${id} : specializes`);
                }
            }
        }

        if (sym.parentQualifiedName) {
            const parentId = displayIds.get(sym.parentQualifiedName) ?? safeId(sym.parentQualifiedName);
            if (rendered.has(parentId) && rendered.has(id)
                && (isDefinition(sym.kind) || sym.kind === SysMLElementKind.PartUsage)) {
                lines.push(`    ${parentId} *-- ${id} : contains`);
            }
        }
    }

    // Styling — emitted at the end so it never breaks node declarations
    emitStyleDirectives(lines, nodeStyles, 'cssClass');

    return {
        diagram: lines.join('\n'),
        diagramType: 'general',
        description: `General View showing ${elementCount} elements with specialisation and containment relationships`,
        elementCount,
    };
}

// ---------------------------------------------------------------------------
// Activity → Mermaid flowchart
// ---------------------------------------------------------------------------

function generateActivityView(symbols: SysMLSymbol[], symbolTable: Map<string, SysMLSymbol>): MermaidResult {
    const lines: string[] = [
        '%%{init: {"theme": "base", "themeVariables": {"primaryColor": "#e3f2fd", "lineColor": "#546E7A"}}}%%',
        'flowchart TD',
    ];
    const nodeStyles = new Map<string, string>();  // nodeId → kindLabel for styling
    let elementCount = 0;

    // Find action defs and their child actions
    const actionDefs = symbols.filter(s =>
        s.kind === SysMLElementKind.ActionDef
    );
    const actions = symbols.filter(s =>
        s.kind === SysMLElementKind.ActionUsage
        || s.kind === SysMLElementKind.PerformActionUsage
    );

    // Build parent→children index (sym.children is not populated by the parser)
    const childrenOf = buildChildrenIndex([...symbolTable.values()]);

    // Render action definitions as subgraphs with their child actions
    for (const def of actionDefs) {
        const defId = safeId(def.qualifiedName);
        lines.push(`    subgraph ${defId}["${escapeLabel(def.name)}"]`);
        elementCount++;

        const childActions = (childrenOf.get(def.qualifiedName) ?? [])
            .filter(c =>
                c.kind === SysMLElementKind.ActionUsage
                || c.kind === SysMLElementKind.PerformActionUsage
            );

        let prevId: string | undefined;
        for (const action of childActions) {
            const actionId = safeId(action.qualifiedName);
            const label = escapeLabel(action.name);
            lines.push(`        ${actionId}["▶ ${label}"]`);
            nodeStyles.set(actionId, 'ActionUsage');
            elementCount++;

            if (prevId) {
                lines.push(`        ${prevId} --> ${actionId}`);
            }
            prevId = actionId;
        }

        lines.push('    end');
    }

    // Standalone actions (not part of a def)
    for (const action of actions) {
        if (action.parentQualifiedName && actionDefs.some(d => d.qualifiedName === action.parentQualifiedName)) {
            continue; // Already rendered inside a subgraph
        }
        const actionId = safeId(action.qualifiedName);
        const label = escapeLabel(action.name);
        const typeStr = action.typeNames.length > 0 ? `\\n: ${action.typeNames[0]}` : '';
        lines.push(`    ${actionId}["▶ ${label}${typeStr}"]`);
        nodeStyles.set(actionId, 'ActionUsage');
        elementCount++;
    }

    if (elementCount === 0) {
        return generateGeneralView(symbols, symbolTable);
    }

    // Styling
    emitStyleDirectives(lines, nodeStyles, 'style');

    return {
        diagram: lines.join('\n'),
        diagramType: 'activity',
        description: `Activity View showing ${elementCount} actions and their sequential flow`,
        elementCount,
    };
}

// ---------------------------------------------------------------------------
// State → Mermaid stateDiagram-v2
// ---------------------------------------------------------------------------

function generateStateView(symbols: SysMLSymbol[], symbolTable: Map<string, SysMLSymbol>): MermaidResult {
    const lines: string[] = [
        '%%{init: {"theme": "base", "themeVariables": {"primaryColor": "#f3e5f5", "lineColor": "#546E7A"}}}%%',
        'stateDiagram-v2',
    ];
    const nodeStyles = new Map<string, string>();  // nodeId → kindLabel for styling
    let elementCount = 0;

    const stateDefs = symbols.filter(s => s.kind === SysMLElementKind.StateDef);
    const states = symbols.filter(s =>
        s.kind === SysMLElementKind.StateUsage
        || s.kind === SysMLElementKind.ExhibitStateUsage
    );
    const transitions = symbols.filter(s => s.kind === SysMLElementKind.TransitionUsage);

    // Build parent→children index (sym.children is not populated by the parser)
    const childrenOf = buildChildrenIndex([...symbolTable.values()]);

    // State definitions as composite states
    for (const def of stateDefs) {
        const defId = safeId(def.qualifiedName);
        lines.push(`    state "${escapeLabel(def.name)}" as ${defId} {`);
        nodeStyles.set(defId, 'StateDef');
        elementCount++;

        const childStates = (childrenOf.get(def.qualifiedName) ?? [])
            .filter(c => c.kind === SysMLElementKind.StateUsage || c.kind === SysMLElementKind.ExhibitStateUsage);

        for (const child of childStates) {
            const childId = safeId(child.qualifiedName);
            lines.push(`        ${childId} : ${escapeLabel(child.name)}`);
            nodeStyles.set(childId, 'StateUsage');
            elementCount++;
        }

        lines.push('    }');
    }

    // Standalone states
    for (const state of states) {
        if (state.parentQualifiedName && stateDefs.some(d => d.qualifiedName === state.parentQualifiedName)) {
            continue;
        }
        const stateId = safeId(state.qualifiedName);
        lines.push(`    ${stateId} : ${escapeLabel(state.name)}`);
        nodeStyles.set(stateId, 'StateUsage');
        elementCount++;
    }

    // Transitions
    for (const trans of transitions) {
        // Transition children typically reference source/target via typeNames
        if (trans.typeNames.length >= 2) {
            const srcId = safeId(trans.typeNames[0]);
            const tgtId = safeId(trans.typeNames[1]);
            lines.push(`    ${srcId} --> ${tgtId}`);
        }
    }

    if (elementCount === 0) {
        return generateGeneralView(symbols, symbolTable);
    }

    // Styling
    emitStyleDirectives(lines, nodeStyles, 'class');

    return {
        diagram: lines.join('\n'),
        diagramType: 'state',
        description: `State View showing ${elementCount} states and transitions`,
        elementCount,
    };
}

// ---------------------------------------------------------------------------
// Interconnection → Mermaid flowchart (parts + ports + connections)
// ---------------------------------------------------------------------------

function generateInterconnectionView(symbols: SysMLSymbol[], symbolTable: Map<string, SysMLSymbol>): MermaidResult {
    const lines: string[] = [
        '%%{init: {"theme": "base", "themeVariables": {"primaryColor": "#f1f8e9", "lineColor": "#546E7A"}}}%%',
        'flowchart LR',
    ];
    const nodeStyles = new Map<string, string>();  // nodeId → kindLabel for styling
    let elementCount = 0;

    const parts = symbols.filter(s =>
        s.kind === SysMLElementKind.PartDef || s.kind === SysMLElementKind.PartUsage
    );
    const connections = symbols.filter(s =>
        s.kind === SysMLElementKind.ConnectionUsage
        || s.kind === SysMLElementKind.InterfaceUsage
    );

    // Build parent→children index (sym.children is not populated by the parser)
    const childrenOf = buildChildrenIndex([...symbolTable.values()]);

    for (const part of parts) {
        const id = safeId(part.qualifiedName);
        const label = escapeLabel(part.name);
        const typeStr = part.typeNames.length > 0 ? `\\n: ${part.typeNames[0]}` : '';

        // Parts with ports get rendered as subgraphs
        const ports = (childrenOf.get(part.qualifiedName) ?? [])
            .filter(c => c.kind === SysMLElementKind.PortUsage);

        if (ports.length > 0) {
            lines.push(`    subgraph ${id}["■ ${label}${typeStr}"]`);
            for (const port of ports) {
                const portId = safeId(port.qualifiedName);
                const portLabel = escapeLabel(port.name);
                const portType = port.typeNames.length > 0 ? ` : ${port.typeNames[0]}` : '';
                lines.push(`        ${portId}(("${portLabel}${portType}"))`);
                nodeStyles.set(portId, 'Port');
                elementCount++;
            }
            lines.push('    end');
        } else {
            lines.push(`    ${id}["■ ${label}${typeStr}"]`);
        }
        nodeStyles.set(id, isDefinition(part.kind) ? 'PartDef' : 'Part');
        elementCount++;
    }

    // Connections as edges
    for (const conn of connections) {
        if (conn.typeNames.length >= 2) {
            const srcId = safeId(conn.typeNames[0]);
            const tgtId = safeId(conn.typeNames[1]);
            const label = conn.name ? ` |${escapeLabel(conn.name)}|` : '';
            lines.push(`    ${srcId} <-->${label} ${tgtId}`);
        }
    }

    if (elementCount === 0) {
        return generateGeneralView(symbols, symbolTable);
    }

    // Styling
    emitStyleDirectives(lines, nodeStyles, 'style');

    return {
        diagram: lines.join('\n'),
        diagramType: 'interconnection',
        description: `Interconnection View showing ${elementCount} parts, ports, and connections`,
        elementCount,
    };
}

// ---------------------------------------------------------------------------
// Sequence → Mermaid sequenceDiagram
// ---------------------------------------------------------------------------

function generateSequenceView(symbols: SysMLSymbol[], symbolTable: Map<string, SysMLSymbol>): MermaidResult {
    const lines: string[] = [
        '%%{init: {"theme": "base", "themeVariables": {"actorBkg": "#e0f7fa", "actorTextColor": "#006064", "signalColor": "#546E7A", "labelBoxBkgColor": "#e8f5e9"}}}%%',
        'sequenceDiagram',
    ];
    let elementCount = 0;

    // Collect candidate participants.
    // Prefer part usages (instances) over part defs (types) — usages represent
    // the actual swim-lane participants; defs are just their types.
    const partUsages = symbols.filter(s =>
        s.kind === SysMLElementKind.PartUsage
        || s.kind === SysMLElementKind.OccurrenceUsage
        || s.kind === SysMLElementKind.ActorUsage
    );
    const partDefs = symbols.filter(s =>
        s.kind === SysMLElementKind.PartDef
        || s.kind === SysMLElementKind.OccurrenceDef
    );
    const participants = partUsages.length >= 2 ? partUsages
        : partDefs.length >= 2 ? partDefs
            : [...partUsages, ...partDefs];

    // Collect messages: action usages that represent interactions
    const messages = symbols.filter(s =>
        s.kind === SysMLElementKind.ActionUsage
        || s.kind === SysMLElementKind.PerformActionUsage
    );

    // Declare participants
    for (const p of participants) {
        const label = escapeLabel(p.name);
        if (p.kind === SysMLElementKind.ActorUsage) {
            lines.push(`    actor ${safeId(p.name)} as ${label}`);
        } else {
            lines.push(`    participant ${safeId(p.name)} as ${label}`);
        }
        elementCount++;
    }

    // Generate messages from action usages.
    // Routing strategy:
    //   1. If the action has ≥2 typeNames, use them as source→target.
    //   2. Otherwise use a "cascade forward, then return" pattern:
    //      first half of messages flow P0→P1→P2→…→Pn,
    //      second half return Pn→…→P1→P0.
    //      This models a natural request-response chain.
    if (messages.length > 0 && participants.length >= 2) {
        const pIds = participants.map(p => safeId(p.name));
        const n = pIds.length;

        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            const label = escapeLabel(msg.name);

            let srcIdx: number;
            let tgtIdx: number;

            if (msg.typeNames.length >= 2) {
                // Explicit source/target from type annotations
                srcIdx = pIds.indexOf(safeId(msg.typeNames[0]));
                tgtIdx = pIds.indexOf(safeId(msg.typeNames[1]));
                if (srcIdx < 0) srcIdx = 0;
                if (tgtIdx < 0) tgtIdx = Math.min(1, n - 1);
            } else {
                // Cascade: forward through participants, then return
                const forwardSteps = n - 1; // P0→P1→…→P(n-1)
                if (i < forwardSteps) {
                    srcIdx = i;
                    tgtIdx = i + 1;
                } else {
                    // Return leg: mirror back
                    const returnStep = i - forwardSteps;
                    srcIdx = Math.max(0, n - 1 - returnStep);
                    tgtIdx = Math.max(0, n - 2 - returnStep);
                }
            }

            lines.push(`    ${pIds[srcIdx]}->>+${pIds[tgtIdx]}: ${label}`);
            lines.push(`    ${pIds[tgtIdx]}-->>-${pIds[srcIdx]}: done`);
            elementCount++;
        }
    } else if (messages.length > 0) {
        // Not enough participants — render as notes
        for (const msg of messages) {
            lines.push(`    Note over ${participants.length > 0 ? safeId(participants[0].name) : 'System'}: ${escapeLabel(msg.name)}`);
            elementCount++;
        }
    }

    if (elementCount === 0) {
        return generateGeneralView(symbols, symbolTable);
    }

    return {
        diagram: lines.join('\n'),
        diagramType: 'sequence',
        description: `Sequence View showing ${participants.length} participants and ${messages.length} interactions`,
        elementCount,
    };
}

// ---------------------------------------------------------------------------
// Use Case → Mermaid flowchart (actors + use cases + relationships)
// ---------------------------------------------------------------------------

function generateUseCaseView(symbols: SysMLSymbol[], symbolTable: Map<string, SysMLSymbol>): MermaidResult {
    const lines: string[] = [
        '%%{init: {"theme": "base", "themeVariables": {"primaryColor": "#e1f5fe", "lineColor": "#546E7A"}}}%%',
        'flowchart LR',
    ];
    const nodeStyles = new Map<string, string>();  // nodeId → kindLabel for styling
    let elementCount = 0;

    // ── Collect by kind ──────────────────────────────────────────────────
    const actors = symbols.filter(s => s.kind === SysMLElementKind.ActorUsage);
    const subjects = symbols.filter(s => s.kind === SysMLElementKind.SubjectUsage);
    const stakeholders = symbols.filter(s => s.kind === SysMLElementKind.StakeholderUsage);
    const allUseCaseDefs = symbols.filter(s => s.kind === SysMLElementKind.UseCaseDef);
    const allUseCaseUsages = symbols.filter(s => s.kind === SysMLElementKind.UseCaseUsage);
    const includes = symbols.filter(s => s.kind === SysMLElementKind.IncludeUseCaseUsage);

    // ── De-duplicate: keep defs; drop usages whose type matches a def ───
    const untypedUsages = allUseCaseUsages.filter(u =>
        !u.typeNames.some(t => {
            const resolved = symbolTable.get(t)
                ?? [...symbolTable.values()].find(s => s.name === t);
            return resolved && resolved.kind === SysMLElementKind.UseCaseDef;
        }),
    );
    const canonicalUseCases = [...allUseCaseDefs, ...untypedUsages];

    // ── Actors — rendered OUTSIDE the system-boundary subgraph ──────────
    // In SysML v2, actor usages live inside use case def bodies (not at
    // package level).  The same actor name may appear in multiple use case
    // defs, so we de-duplicate by name for node rendering and keep every
    // occurrence for association arrows.
    const uniqueActorNames = new Map<string, SysMLSymbol>(); // name → first occurrence
    for (const a of actors) {
        if (!uniqueActorNames.has(a.name)) uniqueActorNames.set(a.name, a);
    }

    lines.push('    %% Actors');
    for (const [name] of uniqueActorNames) {
        const id = `actor_${safeId(name)}`;
        lines.push(`    ${id}{{"🧑 ${escapeLabel(name)}"}}`);
        nodeStyles.set(id, 'ActorUsage');
        elementCount++;
    }

    // ── System-boundary subgraphs (one per package) ─────────────────────
    const packages = symbols.filter(s => s.kind === SysMLElementKind.Package);
    const renderedUCs = new Set<string>();

    for (const pkg of packages) {
        const pkgId = safeId(pkg.qualifiedName);
        // Gather canonical use cases that are direct or nested children of
        // this package (but NOT actors — they live outside the boundary).
        const childUCs = canonicalUseCases.filter(uc =>
            uc.parentQualifiedName === pkg.qualifiedName
            || uc.parentQualifiedName?.startsWith(pkg.qualifiedName + '::'),
        );

        if (childUCs.length > 0) {
            lines.push(`    subgraph ${pkgId}["📦 ${escapeLabel(pkg.name)}"]`);
            nodeStyles.set(pkgId, 'Package');

            for (const uc of childUCs) {
                const ucId = safeId(uc.qualifiedName);
                lines.push(`        ${ucId}(["${escapeLabel(uc.name)}"])`);
                nodeStyles.set(ucId, 'UseCaseDef');
                renderedUCs.add(uc.qualifiedName);
                elementCount++;
            }

            lines.push('    end');
            elementCount++;
        }
    }

    // Render use cases not inside any package
    for (const uc of canonicalUseCases) {
        if (renderedUCs.has(uc.qualifiedName)) continue;
        const ucId = safeId(uc.qualifiedName);
        lines.push(`    ${ucId}(["${escapeLabel(uc.name)}"])`);
        nodeStyles.set(ucId, 'UseCaseDef');
        renderedUCs.add(uc.qualifiedName);
        elementCount++;
    }

    // ── Actor → Use-Case associations ───────────────────────────────────
    // Track emitted edges to avoid duplicates when the same actor name
    // appears in multiple use case defs pointing to the same target.
    const emittedEdges = new Set<string>();
    lines.push('    %% Associations');
    for (const actor of actors) {
        const actorId = `actor_${safeId(actor.name)}`;

        // Case A: Actor is nested inside a UseCaseDef → explicit participation
        const parentSym = actor.parentQualifiedName
            ? symbolTable.get(actor.parentQualifiedName)
            : undefined;
        if (parentSym && parentSym.kind === SysMLElementKind.UseCaseDef) {
            const ucId = safeId(parentSym.qualifiedName);
            const edgeKey = `${actorId}-->${ucId}`;
            if (!emittedEdges.has(edgeKey)) {
                lines.push(`    ${actorId} --> ${ucId}`);
                emittedEdges.add(edgeKey);
            }
            continue;
        }

        // Case B: Actor at package/root level → connect to all sibling
        // canonical use cases (standard UML heuristic).
        const siblings = canonicalUseCases.filter(uc =>
            uc.parentQualifiedName === actor.parentQualifiedName,
        );
        for (const uc of siblings) {
            const ucId = safeId(uc.qualifiedName);
            const edgeKey = `${actorId}-->${ucId}`;
            if (!emittedEdges.has(edgeKey)) {
                lines.push(`    ${actorId} --> ${ucId}`);
                emittedEdges.add(edgeKey);
            }
        }
    }

    // ── «include» relationships (dashed arrows) ─────────────────────────
    for (const inc of includes) {
        if (inc.typeNames.length === 0) continue;
        const targetName = inc.typeNames[0];
        const target = symbolTable.get(targetName)
            ?? [...symbolTable.values()].find(s => s.name === targetName);
        if (!target) continue;

        // Source is the parent element (ideally a UseCaseDef).
        const srcQName = inc.parentQualifiedName;
        const src = srcQName ? symbolTable.get(srcQName) : undefined;
        if (src && (src.kind === SysMLElementKind.UseCaseDef
            || src.kind === SysMLElementKind.UseCaseUsage)) {
            lines.push(`    ${safeId(src.qualifiedName)} -.->|"«include»"| ${safeId(target.qualifiedName)}`);
        }
        // If the include lives at package level we can't determine a source
        // use case, so we omit the arrow rather than draw a misleading one.
    }

    // ── Subject nodes ───────────────────────────────────────────────────
    for (const subj of subjects) {
        const subjId = safeId(subj.qualifiedName);
        lines.push(`    ${subjId}["📋 ${escapeLabel(subj.name)}"]`);
        nodeStyles.set(subjId, 'SubjectUsage');
        elementCount++;
    }

    // ── Stakeholder nodes ───────────────────────────────────────────────
    for (const sh of stakeholders) {
        const shId = safeId(sh.qualifiedName);
        lines.push(`    ${shId}{{"👤 ${escapeLabel(sh.name)}"}}`);
        nodeStyles.set(shId, 'StakeholderUsage');
        elementCount++;

        // Connect stakeholder to its parent requirement
        const parentSym = sh.parentQualifiedName
            ? symbolTable.get(sh.parentQualifiedName)
            : undefined;
        if (parentSym && (parentSym.kind === SysMLElementKind.RequirementDef
            || parentSym.kind === SysMLElementKind.RequirementUsage)) {
            const reqId = safeId(parentSym.qualifiedName);
            lines.push(`    ${shId} -.->|"«stakeholder»"| ${reqId}`);
        }
    }

    if (elementCount === 0) {
        return generateGeneralView(symbols, symbolTable);
    }

    // Styling
    emitStyleDirectives(lines, nodeStyles, 'style');

    return {
        diagram: lines.join('\n'),
        diagramType: 'usecase',
        description: `Use Case View showing ${actors.length} actors and ${canonicalUseCases.length} use cases`,
        elementCount,
    };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a Mermaid diagram from SysML symbols.
 *
 * @param symbols    The symbols to visualise
 * @param allSymbols All symbols in the symbol table (for cross-reference lookup)
 * @param diagramType  Optional override; auto-detected if omitted
 */
export function generateMermaidDiagram(
    symbols: SysMLSymbol[],
    allSymbols: SysMLSymbol[],
    diagramType?: DiagramType,
): MermaidResult {
    // Build a lookup map for cross-references
    const symbolTable = new Map<string, SysMLSymbol>();
    for (const s of allSymbols) {
        symbolTable.set(s.qualifiedName, s);
        // Also index by simple name for type lookups
        if (!symbolTable.has(s.name)) {
            symbolTable.set(s.name, s);
        }
    }

    const type = diagramType ?? inferDiagramType(symbols);

    switch (type) {
        case 'activity':
            return generateActivityView(symbols, symbolTable);
        case 'state':
            return generateStateView(symbols, symbolTable);
        case 'sequence':
            return generateSequenceView(symbols, symbolTable);
        case 'usecase':
            return generateUseCaseView(symbols, symbolTable);
        case 'interconnection':
            return generateInterconnectionView(symbols, symbolTable);
        case 'general':
        default:
            return generateGeneralView(symbols, symbolTable);
    }
}

/**
 * Diff two sets of symbols and return only those that are new or changed.
 */
export function diffSymbols(
    originalSymbols: SysMLSymbol[],
    modifiedSymbols: SysMLSymbol[],
): { added: SysMLSymbol[]; changed: SysMLSymbol[]; removed: string[]; unchanged: SysMLSymbol[] } {
    const origMap = new Map(originalSymbols.map(s => [s.qualifiedName, s]));
    const modMap = new Map(modifiedSymbols.map(s => [s.qualifiedName, s]));

    const added: SysMLSymbol[] = [];
    const changed: SysMLSymbol[] = [];
    const unchanged: SysMLSymbol[] = [];
    const removed: string[] = [];

    for (const [qn, sym] of modMap) {
        const orig = origMap.get(qn);
        if (!orig) {
            added.push(sym);
        } else if (
            orig.kind !== sym.kind
            || orig.typeNames.join(',') !== sym.typeNames.join(',')
            || orig.children.length !== sym.children.length
            || orig.multiplicity !== sym.multiplicity
            || orig.documentation !== sym.documentation
        ) {
            changed.push(sym);
        } else {
            unchanged.push(sym);
        }
    }

    for (const [qn] of origMap) {
        if (!modMap.has(qn)) {
            removed.push(qn);
        }
    }

    return { added, changed, removed, unchanged };
}
