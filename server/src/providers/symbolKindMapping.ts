import { SymbolKind } from 'vscode-languageserver/node.js';
import { SysMLElementKind } from '../symbols/sysmlElements.js';

/**
 * Map a SysMLElementKind to the best-fit LSP SymbolKind.
 *
 * LSP defines a fixed set of ~26 symbol kinds; SysML v2 has far more
 * metaclasses. This mapping chooses the most semantically appropriate
 * LSP kind for each SysML element, so editors display meaningful icons.
 */
export function toSysMLSymbolKind(kind: SysMLElementKind): SymbolKind {
    switch (kind) {
        // Structural definitions → Class (they *are* types)
        case SysMLElementKind.PartDef:
        case SysMLElementKind.OccurrenceDef:
            return SymbolKind.Class;

        // Structural usages → Field (instances / typed features)
        case SysMLElementKind.PartUsage:
        case SysMLElementKind.OccurrenceUsage:
        case SysMLElementKind.RefUsage:
            return SymbolKind.Field;

        // Attributes
        case SysMLElementKind.AttributeDef:
        case SysMLElementKind.AttributeUsage:
            return SymbolKind.Property;

        // Ports & Interfaces → Interface
        case SysMLElementKind.PortDef:
        case SysMLElementKind.PortUsage:
        case SysMLElementKind.InterfaceDef:
        case SysMLElementKind.InterfaceUsage:
            return SymbolKind.Interface;

        // Connections
        case SysMLElementKind.ConnectionDef:
        case SysMLElementKind.ConnectionUsage:
            return SymbolKind.Interface;

        // Behavioral: actions → Method
        case SysMLElementKind.ActionDef:
        case SysMLElementKind.ActionUsage:
        case SysMLElementKind.PerformActionUsage:
            return SymbolKind.Method;

        // Behavioral: states → Event (better semantic fit than Enum)
        case SysMLElementKind.StateDef:
        case SysMLElementKind.StateUsage:
        case SysMLElementKind.ExhibitStateUsage:
            return SymbolKind.Event;

        // Transitions → Event
        case SysMLElementKind.TransitionUsage:
            return SymbolKind.Event;

        // Requirements → Object
        case SysMLElementKind.RequirementDef:
        case SysMLElementKind.RequirementUsage:
        case SysMLElementKind.ActorUsage:
        case SysMLElementKind.SubjectUsage:
        case SysMLElementKind.StakeholderUsage:
            return SymbolKind.Object;

        // Constraints → Constant (boolean-valued)
        case SysMLElementKind.ConstraintDef:
        case SysMLElementKind.ConstraintUsage:
            return SymbolKind.Constant;

        // Items → Struct (physical things, data)
        case SysMLElementKind.ItemDef:
        case SysMLElementKind.ItemUsage:
            return SymbolKind.Struct;

        // Allocations → TypeParameter (cross-concern mapping)
        case SysMLElementKind.AllocationDef:
        case SysMLElementKind.AllocationUsage:
            return SymbolKind.TypeParameter;

        // Enumerations
        case SysMLElementKind.EnumDef:
            return SymbolKind.Enum;
        case SysMLElementKind.EnumUsage:
            return SymbolKind.EnumMember;

        // Calculations → Function
        case SysMLElementKind.CalcDef:
        case SysMLElementKind.CalcUsage:
        case SysMLElementKind.AnalysisCaseDef:
        case SysMLElementKind.VerificationCaseDef:
            return SymbolKind.Function;

        // Use cases → Event
        case SysMLElementKind.UseCaseDef:
        case SysMLElementKind.UseCaseUsage:
        case SysMLElementKind.IncludeUseCaseUsage:
            return SymbolKind.Event;

        // Views → Namespace
        case SysMLElementKind.ViewDef:
        case SysMLElementKind.ViewUsage:
        case SysMLElementKind.ViewpointDef:
        case SysMLElementKind.ViewpointUsage:
        case SysMLElementKind.RenderingDef:
            return SymbolKind.Namespace;

        // Metadata → TypeParameter
        case SysMLElementKind.MetadataDef:
            return SymbolKind.TypeParameter;

        // Package
        case SysMLElementKind.Package:
            return SymbolKind.Package;

        // Comments / docs
        case SysMLElementKind.Comment:
        case SysMLElementKind.Doc:
            return SymbolKind.String;

        // Import / Alias
        case SysMLElementKind.Import:
        case SysMLElementKind.Alias:
            return SymbolKind.Module;

        default:
            return SymbolKind.Variable;
    }
}
