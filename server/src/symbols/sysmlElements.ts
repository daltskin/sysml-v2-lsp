import { Range } from 'vscode-languageserver/node.js';

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
    VerificationCaseDef = 'verification case def',
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
    /** Documentation string if available */
    documentation?: string;
    /** Parent symbol's qualified name */
    parentQualifiedName?: string;
    /** Child symbol qualified names */
    children: string[];
    /** Multiplicity as a string (e.g., "1", "0..*", "2..5") */
    multiplicity?: string;
    /** Parsed multiplicity bounds */
    multiplicityRange?: { lower: number; upper: number | '*' };
}

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
