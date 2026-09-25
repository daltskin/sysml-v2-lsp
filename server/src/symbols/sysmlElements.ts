import { Range } from 'vscode-languageserver/node';

/**
 * Kinds of SysML elements tracked in the symbol table.
 */
export enum SysMLElementKind {
    Package = 'package',
    PartDef = 'part def',
    PartUsage = 'part',
    AttributeDef = 'attribute def',
    AttributeUsage = 'attribute',
    PortDef = 'port def',
    PortUsage = 'port',
    ConnectionDef = 'connection def',
    ConnectionUsage = 'connection',
    InterfaceDef = 'interface def',
    InterfaceUsage = 'interface',
    ActionDef = 'action def',
    ActionUsage = 'action',
    PerformActionUsage = 'perform action',
    ForkNode = 'fork',
    JoinNode = 'join',
    MergeNode = 'merge',
    DecisionNode = 'decide',
    StateDef = 'state def',
    StateUsage = 'state',
    ExhibitStateUsage = 'exhibit state',
    TransitionUsage = 'transition',
    RequirementDef = 'requirement def',
    RequirementUsage = 'requirement',
    ConstraintDef = 'constraint def',
    ConstraintUsage = 'constraint',
    ItemDef = 'item def',
    ItemUsage = 'item',
    AllocationDef = 'allocation def',
    AllocationUsage = 'allocation',
    UseCaseDef = 'use case def',
    UseCaseUsage = 'use case',
    IncludeUseCaseUsage = 'include use case',
    ActorUsage = 'actor',
    SubjectUsage = 'subject',
    StakeholderUsage = 'stakeholder',
    EnumDef = 'enum def',
    EnumUsage = 'enum',
    CalcDef = 'calc def',
    CalcUsage = 'calc',
    ViewDef = 'view def',
    ViewUsage = 'view',
    ViewpointDef = 'viewpoint def',
    ViewpointUsage = 'viewpoint',
    OccurrenceDef = 'occurrence def',
    OccurrenceUsage = 'occurrence',
    RefUsage = 'ref',
    MetadataDef = 'metadata def',
    RenderingDef = 'rendering def',
    AnalysisCaseDef = 'analysis case def',
    AnalysisCaseUsage = 'analysis case',
    VerificationCaseDef = 'verification case def',
    VerificationCaseUsage = 'verification case',
    Comment = 'comment',
    Doc = 'doc',
    Alias = 'alias',
    Import = 'import',
    Unknown = 'unknown',
}

/**
 * A symbol entry in the symbol table.
 */
export interface SysMLSymbol {
    /** The symbol's name */
    name: string;
    /** Declared `<shortName>` alias (`identification: LT name GT name | LT name GT`), if any. */
    shortName?: string;
    /** The kind of SysML element */
    kind: SysMLElementKind;
    /** The fully qualified name (e.g., "VehicleModel::Chassis::wheel") */
    qualifiedName: string;
    /** The range where the symbol is defined */
    range: Range;
    /** The range of just the symbol's name (for rename, hover) */
    selectionRange: Range;
    /** The URI of the document containing this symbol */
    uri: string;
    /** The type this symbol specializes (e.g., "Vehicle" in "part car : Vehicle") */
    typeName?: string;
    /** Type names as an array (populated from typeName for multi-type support). */
    typeNames: string[];
    /** Names referenced via :> / specializes / subsets (distinct from : typing). */
    specializationNames: string[];
    /** Documentation string if available */
    documentation?: string;
    /** Visibility declared on the owning membership; omitted for default public visibility. */
    visibility?: 'public' | 'private' | 'protected';
    /** Source reference for a transition usage. */
    source?: string;
    /** Target reference for a transition usage. */
    target?: string;
    /** Accepter text used to trigger a transition usage. */
    transitionTrigger?: string;
    /** Explicit succession edges owned by an action definition or usage. */
    controlFlows?: { source: string; target: string; guard?: string }[];
    /** Parent symbol's qualified name */
    parentQualifiedName?: string;
    /** Child symbol qualified names */
    children: string[];
    /** Multiplicity as a string (e.g., "1", "0..*", "2..5") */
    multiplicity?: string;
    /** Parsed multiplicity bounds */
    multiplicityRange?: { lower: number; upper: number | '*' };
    /** Prefix metadata annotation names (e.g., ["product"] from `#product part def ...`) */
    metadataAnnotations?: string[];
    /** Expose target qualified names for view usages (e.g., ["Vehicle", "Vehicle::engine"]) */
    exposeTargets?: string[];
    /** Element filter expressions for view defs/usages (e.g., ["SysML::PartUsage"]) */
    viewFilters?: string[];
    /** View rendering reference (e.g., "Views::asElementTable") */
    viewRendering?: string;
    /** `import` statements owned directly by a package's body (see ImportTarget). */
    importTargets?: ImportTarget[];
    /**
     * Package-level `filter <expr>;` conditions (§7.5.4), applying to every
     * import of this package -- AND'd together with each other and with any
     * per-import `ImportTarget.filter`.
     */
    filterConditions?: FilterExpr[];
}

/**
 * A parsed `import` statement, resolved relative to the owning namespace.
 * Mirrors the grammar's membershipImport/namespaceImport distinction:
 * - 'membership': `import Owner::Name;` — makes exactly `Name` visible.
 * - 'membership-deep': `import Owner::Name::**;` — `Name` and everything nested under it.
 * - 'namespace-shallow': `import Owner::*;` — direct public members of `Owner`.
 * - 'namespace-deep': `import Owner::*::**;` — all members of `Owner`, at any nesting depth.
 */
export interface ImportTarget {
    kind: 'membership' | 'membership-deep' | 'namespace-shallow' | 'namespace-deep';
    /** Qualified name of the imported element (membership kinds) or namespace (namespace kinds). */
    target: string;
    /**
     * Visibility keyword on the import itself (private by default per the standard,
     * §7.5.3) — governs whether a *further* importer of this namespace also sees the
     * imported membership, independent of the source element's own visibility.
     */
    visibility: 'public' | 'private' | 'protected';
    /**
     * Inline filter condition(s) from a filtered import, §7.5.4:
     * `import Owner::Target[@Metadata and ...];`. Multiple `[...]` brackets on
     * one import are combined with AND ("if and only if they satisfy all the
     * given filter conditions").
     */
    filter?: FilterExpr;
}

/**
 * A boolean filter-condition expression (§7.5.4), supporting the metadata
 * classification-test subset (`@Name`, `and`/`or`/`not`) evaluated against a
 * candidate's `metadataAnnotations`. Only the prefix `#Name` annotation form
 * is currently modeled as `metadataAnnotations` -- the body-member `@Name {
 * ... }` metadata *usage* form (as in the standard's own §7.5.4 examples) and
 * attribute-value comparisons inside filters (e.g. `level > 1`) are not
 * evaluable with the data currently in the symbol table, and parse into
 * 'unsupported', which `evaluateFilter` treats as passing (fail-open, so an
 * unrecognized condition never silently hides an otherwise-valid import).
 */
export type FilterExpr =
    | { kind: 'metadata'; name: string }
    | { kind: 'and'; left: FilterExpr; right: FilterExpr }
    | { kind: 'or'; left: FilterExpr; right: FilterExpr }
    | { kind: 'not'; expr: FilterExpr }
    | { kind: 'unsupported' };

/**
 * Whether an element kind is a definition (type) or usage (instance).
 */
export function isDefinition(kind: SysMLElementKind): boolean {
    return kind.endsWith(' def');
}

/**
 * Whether an element kind is a usage (instance).
 */
export function isUsage(kind: SysMLElementKind): boolean {
    return !isDefinition(kind) && kind !== SysMLElementKind.Package
        && kind !== SysMLElementKind.Import && kind !== SysMLElementKind.Comment
        && kind !== SysMLElementKind.Doc && kind !== SysMLElementKind.Alias
        && kind !== SysMLElementKind.Unknown;
}

/**
 * Map a SysMLElementKind to its official SysML v2 metaclass name.
 *
 * These names match the OMG SysML v2 metamodel (e.g. "PartDefinition",
 * "PartUsage", "StateUsage") rather than the abbreviated keyword form
 * ("part def", "part", "state").
 */
export function toMetaclassName(kind: SysMLElementKind): string {
    switch (kind) {
        case SysMLElementKind.Package: return 'Package';
        case SysMLElementKind.PartDef: return 'PartDefinition';
        case SysMLElementKind.PartUsage: return 'PartUsage';
        case SysMLElementKind.AttributeDef: return 'AttributeDefinition';
        case SysMLElementKind.AttributeUsage: return 'AttributeUsage';
        case SysMLElementKind.PortDef: return 'PortDefinition';
        case SysMLElementKind.PortUsage: return 'PortUsage';
        case SysMLElementKind.ConnectionDef: return 'ConnectionDefinition';
        case SysMLElementKind.ConnectionUsage: return 'ConnectionUsage';
        case SysMLElementKind.InterfaceDef: return 'InterfaceDefinition';
        case SysMLElementKind.InterfaceUsage: return 'InterfaceUsage';
        case SysMLElementKind.ActionDef: return 'ActionDefinition';
        case SysMLElementKind.ActionUsage: return 'ActionUsage';
        case SysMLElementKind.PerformActionUsage: return 'PerformActionUsage';
        case SysMLElementKind.ForkNode: return 'ForkNode';
        case SysMLElementKind.JoinNode: return 'JoinNode';
        case SysMLElementKind.MergeNode: return 'MergeNode';
        case SysMLElementKind.DecisionNode: return 'DecisionNode';
        case SysMLElementKind.StateDef: return 'StateDefinition';
        case SysMLElementKind.StateUsage: return 'StateUsage';
        case SysMLElementKind.ExhibitStateUsage: return 'ExhibitStateUsage';
        case SysMLElementKind.TransitionUsage: return 'TransitionUsage';
        case SysMLElementKind.RequirementDef: return 'RequirementDefinition';
        case SysMLElementKind.RequirementUsage: return 'RequirementUsage';
        case SysMLElementKind.ConstraintDef: return 'ConstraintDefinition';
        case SysMLElementKind.ConstraintUsage: return 'ConstraintUsage';
        case SysMLElementKind.ItemDef: return 'ItemDefinition';
        case SysMLElementKind.ItemUsage: return 'ItemUsage';
        case SysMLElementKind.AllocationDef: return 'AllocationDefinition';
        case SysMLElementKind.AllocationUsage: return 'AllocationUsage';
        case SysMLElementKind.UseCaseDef: return 'UseCaseDefinition';
        case SysMLElementKind.UseCaseUsage: return 'UseCaseUsage';
        case SysMLElementKind.IncludeUseCaseUsage: return 'IncludeUseCaseUsage';
        case SysMLElementKind.ActorUsage: return 'ActorUsage';  // SysML v2 doesn't have a dedicated ActorUsage metaclass, but this is conventional
        case SysMLElementKind.SubjectUsage: return 'SubjectUsage';
        case SysMLElementKind.StakeholderUsage: return 'StakeholderUsage';
        case SysMLElementKind.EnumDef: return 'EnumerationDefinition';
        case SysMLElementKind.EnumUsage: return 'EnumerationUsage';
        case SysMLElementKind.CalcDef: return 'CalculationDefinition';
        case SysMLElementKind.CalcUsage: return 'CalculationUsage';
        case SysMLElementKind.ViewDef: return 'ViewDefinition';
        case SysMLElementKind.ViewUsage: return 'ViewUsage';
        case SysMLElementKind.ViewpointDef: return 'ViewpointDefinition';
        case SysMLElementKind.ViewpointUsage: return 'ViewpointUsage';
        case SysMLElementKind.OccurrenceDef: return 'OccurrenceDefinition';
        case SysMLElementKind.OccurrenceUsage: return 'OccurrenceUsage';
        case SysMLElementKind.RefUsage: return 'ReferenceUsage';
        case SysMLElementKind.MetadataDef: return 'MetadataDefinition';
        case SysMLElementKind.RenderingDef: return 'RenderingDefinition';
        case SysMLElementKind.AnalysisCaseDef: return 'AnalysisCaseDefinition';
        case SysMLElementKind.VerificationCaseDef: return 'VerificationCaseDefinition';
        case SysMLElementKind.Comment: return 'Comment';
        case SysMLElementKind.Doc: return 'Documentation';
        case SysMLElementKind.Alias: return 'Alias';
        case SysMLElementKind.Import: return 'Import';
        default: return 'Element';
    }
}
