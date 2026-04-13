/**
 * DTO types for the `sysml/model` custom LSP request.
 *
 * These types define the protocol between the LSP server and clients
 * (e.g., the VS Code extension) for exposing the full semantic model.
 * All shapes use LSP-style positions (0-based line/character).
 */
import type { TextDocumentIdentifier } from 'vscode-languageserver/node.js';

// ---------------------------------------------------------------------------
// Status Notification
// ---------------------------------------------------------------------------

/**
 * Parameters for the `sysml/status` custom notification.
 *
 * Replaces WorkDoneProgress for lightweight status updates. The client
 * can render this however it chooses (status bar, toast, or ignore).
 *
 * Contract: every `state: 'begin'` is guaranteed to be followed by
 * a corresponding `state: 'end'` for the same `uri`, even on error
 * or cancellation.
 */
export interface SysMLStatusParams {
    /** The state of the operation. */
    state: 'begin' | 'progress' | 'end';

    /** Human-readable message (e.g., "Parsing vehicle.sysml…"). */
    message: string;

    /** Document URI this status relates to. */
    uri: string;

    /** Optional filename extracted from the URI for display. */
    fileName?: string;
}

// ---------------------------------------------------------------------------
// Request / Response
// ---------------------------------------------------------------------------

/**
 * Subset of the model to include in the response.
 */
export type SysMLModelScope =
    | 'elements'
    | 'relationships'
    | 'sequenceDiagrams'
    | 'activityDiagrams'
    | 'resolvedTypes'
    | 'diagnostics';

/**
 * Parameters for the `sysml/model` request.
 */
export interface SysMLModelParams {
    /** The document to retrieve the model for. */
    textDocument: TextDocumentIdentifier;

    /**
     * Which sections of the model to include in the response.
     * Omit or pass an empty array for ALL sections.
     */
    scope?: SysMLModelScope[];
}

/**
 * Response from the `sysml/model` request.
 */
export interface SysMLModelResult {
    /** Document version this model corresponds to (for staleness detection). */
    version: number;

    /** Root element tree (when scope includes 'elements'). */
    elements?: SysMLElementDTO[];

    /** Flat relationship list (when scope includes 'relationships'). */
    relationships?: RelationshipDTO[];

    /** Pre-extracted sequence diagrams (when scope includes 'sequenceDiagrams'). */
    sequenceDiagrams?: SequenceDiagramDTO[];

    /** Pre-extracted activity diagrams (when scope includes 'activityDiagrams'). */
    activityDiagrams?: ActivityDiagramDTO[];

    /** Resolved type information keyed by element path (when scope includes 'resolvedTypes'). */
    resolvedTypes?: Record<string, ResolvedTypeDTO>;

    /** Semantic diagnostics (when scope includes 'diagnostics'). */
    diagnostics?: SemanticDiagnosticDTO[];

    /** Statistics. */
    stats?: {
        totalElements: number;
        resolvedElements: number;
        unresolvedElements: number;
        /** Actual ANTLR parse time (worker or lazy main-thread). */
        parseTimeMs: number;
        /** ANTLR lexer time in milliseconds. */
        lexTimeMs?: number;
        /** ANTLR parser-only time in milliseconds (excludes lexing). */
        parseOnlyTimeMs?: number;
        /** Time to build symbol table + extract DTOs for the requested scopes. */
        modelBuildTimeMs: number;
        /** Model Complexity Index report. */
        complexity?: {
            complexityIndex: number;
            rating: string;
            definitions: number;
            usages: number;
            maxDepth: number;
            avgChildrenPerDef: number;
            couplingCount: number;
            unusedDefinitions: number;
            documentationCoverage: number;
            hotspots: {
                qualifiedName: string;
                kind: string;
                childCount: number;
                depth: number;
                typeRefs: number;
                hasDoc: boolean;
                score: number;
            }[];
        };
    };
}

// ---------------------------------------------------------------------------
// 2.1 Core Element Tree
// ---------------------------------------------------------------------------

export interface PositionDTO {
    /** 0-based line number. */
    line: number;
    /** 0-based character offset. */
    character: number;
}

export interface RangeDTO {
    start: PositionDTO;
    end: PositionDTO;
}

/**
 * A single SysML v2 model element — the primary data structure.
 *
 * The element tree is the foundation for all diagram views in the
 * downstream VS Code extension.
 */
export interface SysMLElementDTO {
    /**
     * SysML-specific element type.
     *
     * Known values (25+):
     *   'package', 'part', 'part def', 'port', 'port def',
     *   'action', 'action def', 'state', 'state def',
     *   'requirement', 'requirement def',
     *   'constraint', 'constraint def',
     *   'use case', 'use case def',
     *   'attribute', 'attribute def',
     *   'connection', 'connection def',
     *   'interface', 'interface def',
     *   'item', 'item def',
     *   'enum', 'enum def',
     *   'allocation', 'allocation def',
     *   'calc', 'calc def',
     *   'view', 'view def',
     *   'viewpoint', 'viewpoint def',
     *   'comment', 'doc', 'import', 'alias',
     *   'metadata def', 'rendering def',
     *   'analysis case def', 'verification case def',
     *   'unknown'
     */
    type: string;

    /** Element name. Use 'unnamed' for anonymous elements. */
    name: string;

    /** Source location. */
    range: RangeDTO;

    /** Nested child elements (recursive tree). */
    children: SysMLElementDTO[];

    /**
     * Key-value attribute metadata.
     *
     * The extension reads these specific keys:
     *   partType      – Type name for parts/items
     *   portType      – Type name for ports
     *   direction     – Port direction: 'in' | 'out' | 'inout'
     *   multiplicity  – Multiplicity string (e.g., "0..1", "1..*")
     *   documentation – Doc comment text
     *   doc           – Alternative doc field
     *   modifier      – Element modifiers (abstract, etc.)
     *   value         – Default/assigned value
     *   visibility    – 'public' | 'private' | 'protected'
     */
    attributes: Record<string, string | number | boolean>;

    /** Relationships originating from this element. */
    relationships: RelationshipDTO[];

    /** Parse errors for this element (optional). */
    errors?: string[];
}

// ---------------------------------------------------------------------------
// 2.2 Relationships
// ---------------------------------------------------------------------------

/**
 * A typed edge between two named elements.
 */
export interface RelationshipDTO {
    /**
     * Relationship kind. Known values:
     *   'specializes', 'typing', 'redefinition', 'subsetting',
     *   'conjugation', 'disjoining', 'differencing', 'intersecting', 'unioning',
     *   'connection', 'binding', 'succession', 'allocation',
     *   'dependency', 'satisfy', 'verify',
     *   'features', 'flow', 'transition'
     */
    type: string;

    /** Source element name (absent for shorthand satisfy/verify without `by`). */
    source?: string;

    /** Target element name. */
    target: string;

    /** Optional label/name for the relationship. */
    name?: string;
}

// ---------------------------------------------------------------------------
// 2.3 Sequence Diagrams
// ---------------------------------------------------------------------------

export interface SequenceDiagramDTO {
    name: string;
    participants: ParticipantDTO[];
    messages: MessageDTO[];
    range: RangeDTO;
}

export interface ParticipantDTO {
    name: string;
    type: string;
    range: RangeDTO;
}

export interface MessageDTO {
    name: string;
    from: string;
    to: string;
    payload: string;
    occurrence: number;
    range: RangeDTO;
}

// ---------------------------------------------------------------------------
// 2.4 Activity Diagrams
// ---------------------------------------------------------------------------

export interface ActivityDiagramDTO {
    name: string;
    actions: ActivityActionDTO[];
    decisions: DecisionNodeDTO[];
    flows: ControlFlowDTO[];
    states: ActivityStateDTO[];
    range: RangeDTO;
}

export interface ActivityActionDTO {
    name: string;
    type: string;
    kind?: string;
    inputs?: string[];
    outputs?: string[];
    condition?: string;
    subActions?: ActivityActionDTO[];
    isDefinition?: boolean;
    range?: RangeDTO;
    parent?: string;
    children?: string[];
}

export interface DecisionNodeDTO {
    name: string;
    condition: string;
    branches: {
        condition: string;
        target: string;
    }[];
    range: RangeDTO;
}

export interface ControlFlowDTO {
    from: string;
    to: string;
    condition?: string;
    guard?: string;
    range: RangeDTO;
}

export interface ActivityStateDTO {
    name: string;
    type: 'initial' | 'final' | 'intermediate';
    entryActions?: string[];
    exitActions?: string[];
    doActivity?: string;
    range: RangeDTO;
}

// ---------------------------------------------------------------------------
// 2.5 Resolved Types
// ---------------------------------------------------------------------------

export interface ResolvedTypeDTO {
    qualifiedName: string;
    simpleName: string;
    kind: string;
    isLibraryType: boolean;
    specializationChain: string[];
    specializes: string[];
    features: ResolvedFeatureDTO[];
}

export interface ResolvedFeatureDTO {
    name: string;
    kind: string;
    type?: string;
    multiplicity?: string;
    direction?: 'in' | 'out' | 'inout';
    visibility?: 'public' | 'private' | 'protected';
    isDerived: boolean;
    isReadonly: boolean;
}

// ---------------------------------------------------------------------------
// 2.6 Semantic Diagnostics
// ---------------------------------------------------------------------------

export interface SemanticDiagnosticDTO {
    code: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
    range: RangeDTO;
    elementName: string;
    relatedInfo?: {
        message: string;
        location?: RangeDTO;
    }[];
}
