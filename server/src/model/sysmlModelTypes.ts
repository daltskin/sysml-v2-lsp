/**
 * DTO types for the `sysml/model` custom LSP request.
 *
 * These types define the protocol between the LSP server and clients
 * (e.g., the VS Code extension) for exposing the full semantic model.
 * All shapes use LSP-style positions (0-based line/character).
 */
import type { TextDocumentIdentifier } from 'vscode-languageserver/node';

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

    /** Resolved type information keyed by qualified name, as KerML 8.3.2.1.2 represents it (when scope includes 'resolvedTypes'). */
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
                /** null for a definition without a qualified name (inside an anonymous element). */
                qualifiedName: string | null;
                symbolId: string;
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
     *   'flow', 'flow def',
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

    /** Element name; empty for an anonymous element, flagged by `attributes.isAnonymous`. */
    name: string;

    /**
     * The element's declared short name (`<shortName>`), unquoted like `name`;
     * omitted when it has none (KerML 8.3.2.1 `Element::shortName`).
     */
    shortName?: string;

    /**
     * Text to show for the element, as in the outline: its name; for an
     * anonymous element its declaration without a name (`: Engine`), else what
     * it connects (`a.p→b.p`), else its declaration as written (`decide`).
     */
    displayName: string;

    /**
     * The element's symbol ID: a version 5 UUID derived from the project ID and
     * its name, or, without one, its declaration. The same after a reload, but
     * not the KerML `elementId`: a rename gives a new one.
     */
    symbolId: string;

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
     *   flowType      – Declared type of a flow usage
     *   itemType      – Payload type for a flow usage
     *   flowSource    – Source feature path for a flow usage
     *   flowTarget    – Target feature path for a flow usage
     *   isMessage     – true for a flow usage declared as a message (`message`,
     *                   SysML 8.2.2.16 `Message`); a flow's `type` is 'flow' either way
     *   direction     – Feature direction: 'in' | 'out' | 'inout'
     *   isReturn      – true for a result parameter (`return`, SysML 8.2.2.19
     *                   `ReturnParameterMember`); its direction is 'out'
     *   multiplicity  – Multiplicity string (e.g., "0..1", "1..*")
     *   ordered       – true when declared `ordered`
     *   nonunique     – true when declared `nonunique`
     *   documentation – Doc comment text
     *   doc           – Alternative doc field
     *   modifier      – Prefix keywords other than the direction, as written
     *                   (e.g., "abstract", "derived", "constant", "ref", "end")
     *   value         – Expression of the element's own feature value, as written
     *                   (whitespace and comments between its parts as one space)
     *   isDefault     – true for a default feature value (`default`, `default =`, `default :=`)
     *   isInitial     – true for an initial feature value (`:=`, `default :=`)
     *   visibility    – 'public' | 'private' | 'protected'
     *   isAnonymous   – true for an element without a name (its `name` is empty)
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
     *   'referenceSubsetting', 'crossSubsetting',
     *   'conjugation', 'disjoining', 'differencing', 'intersecting', 'unioning',
     *   'connection', 'binding', 'succession', 'allocation',
     *   'dependency', 'satisfy', 'verify',
     *   'features', 'flow', 'transition'
     */
    type: string;

    /** Source element name, else its short name (absent for shorthand satisfy/verify without `by`); see `sourceId`. */
    source?: string;

    /** `symbolId` of the source element, when the source is the element declaring the relationship. */
    sourceId?: string;

    /**
     * `symbolId` of the element that is the relationship itself (a connection,
     * allocation, transition or flow usage); its name and short name are read
     * from that element.
     */
    symbolId?: string;

    /**
     * Target element name. For a specialization, the reference as in the textual notation, each
     * name as KerML `escapedName()` writes it (KerML 8.3.2.1.2).
     */
    target: string;

    /**
     * Optional label for the relationship: a flow's payload type, else its
     * name; a transition's trigger; a connection's or allocation's name.
     */
    name?: string;

    /**
     * The operator or keyword a specialization is written with (`:>`, `subsets`,
     * `::>`, `references`, `=>`, `crosses`, `:>>`, `redefines`, `specializes`).
     */
    notation?: string;
}

// ---------------------------------------------------------------------------
// 2.3 Sequence Diagrams
// ---------------------------------------------------------------------------

export interface SequenceDiagramDTO {
    name: string;
    /** Its declared short name, if any; `name` is empty when it has only a short name. */
    shortName?: string;
    participants: ParticipantDTO[];
    messages: MessageDTO[];
    range: RangeDTO;
}

export interface ParticipantDTO {
    name: string;
    /** Its declared short name, if any; `name` is empty when it has only a short name. */
    shortName?: string;
    type: string;
    range: RangeDTO;
}

export interface MessageDTO {
    name: string;
    /** Its declared short name, if any; `name` is empty when it has only a short name. */
    shortName?: string;
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
    /** Its declared short name, if any; `name` is empty when it has only a short name. */
    shortName?: string;
    actions: ActivityActionDTO[];
    decisions: DecisionNodeDTO[];
    flows: ControlFlowDTO[];
    states: ActivityStateDTO[];
    range: RangeDTO;
}

export interface ActivityActionDTO {
    name: string;
    /** Its declared short name, if any; `name` is empty when it has only a short name. */
    shortName?: string;
    type: string;
    kind?: string;
    inputs?: string[];
    outputs?: string[];
    condition?: string;
    subActions?: ActivityActionDTO[];
    isDefinition?: boolean;
    range?: RangeDTO;
    /** The owning element's name, else its short name; text only, see `parentId`. */
    parent?: string;
    /** The `symbolId` of the element owning this action; read its names from that element. */
    parentId?: string;
    /**
     * Each sub-action's name, else its short name, in the order of `subActions`.
     * Deprecated: it can't tell a short name from a name; use `subActions`.
     */
    children?: string[];
}

export interface DecisionNodeDTO {
    name: string;
    /** Its declared short name, if any; `name` is empty when it has only a short name. */
    shortName?: string;
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
    /** Its declared short name, if any; `name` is empty when it has only a short name. */
    shortName?: string;
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
    /** As KerML `qualifiedName` represents it (8.3.2.1.2): each segment name as `escapedName()` writes it. */
    qualifiedName: string;
    simpleName: string;
    /** Its short name, if it has one; `simpleName` is empty when it has only a short name. */
    shortName?: string;
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
    /** True for a result parameter (`return`, SysML 8.2.2.19); its direction is 'out'. */
    isReturn?: boolean;
    visibility?: 'public' | 'private' | 'protected';
    isDerived: boolean;
    isConstant: boolean;
    /** @deprecated The pre-KERML_-57 name of `isConstant`, always equal to it; will be removed in a future release. */
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
    /** The element's name, else its short name; text only, see `id`. */
    elementName: string;
    /** The `symbolId` of the element the diagnostic is about. */
    id?: string;
    relatedInfo?: {
        message: string;
        location?: RangeDTO;
    }[];
}
