import { ErrorNode, ParserRuleContext, ParseTree, TerminalNode, Token } from 'antlr4ng';
import { Range } from 'vscode-languageserver/node';
import { SysMLv2Lexer } from '../generated/SysMLv2Lexer.js';
import { FeatureValueContext, MultiplicityBoundsContext, OwnedExpressionContext, SysMLv2Parser } from '../generated/SysMLv2Parser.js';
import { ParseResult } from '../parser/parseDocument.js';
import { contextToRange, tokenToRange } from '../parser/positionUtils.js';
import { SYSML_KEYWORDS } from '../utils/sysmlKeywords.js';
import { joinQualifiedName, scanFeaturePaths, scanQualifiedNames, splitQualifiedName, unquoteName as decodeName } from '../utils/identUtils.js';
import { IdRegistry } from './ids.js';
import { buildSymbolIndexes, NamespaceResolver, SymbolIndexes } from './namespaceResolver.js';
import { Scope } from './scope.js';
import { FilterExpr, ImportTarget, SysMLElementKind, SysMLSymbol, displayName, isAnonymous, isDefinition, isFlowUsage, isUsage as isUsageKind } from './sysmlElements.js';

// ── ruleIndex-based lookup tables ───────────────────────────────────
// These replace the toLowerCase() + string-comparison chains with O(1)
// numeric lookups, eliminating hundreds of thousands of short-lived
// string allocations during multi-file symbol table construction.

/** Map ruleIndex → SysMLElementKind for inferKind() */
const RULE_INDEX_TO_KIND = new Map<number, SysMLElementKind>([
    [SysMLv2Parser.RULE_package, SysMLElementKind.Package],                       // 178
    [SysMLv2Parser.RULE_libraryPackage, SysMLElementKind.Package],                // 179
    [SysMLv2Parser.RULE_partDefinition, SysMLElementKind.PartDef],                // 246
    [SysMLv2Parser.RULE_attributeDefinition, SysMLElementKind.AttributeDef],      // 223
    [SysMLv2Parser.RULE_portDefinition, SysMLElementKind.PortDef],                // 248
    [SysMLv2Parser.RULE_connectionDefinition, SysMLElementKind.ConnectionDef],    // 253
    [SysMLv2Parser.RULE_interfaceDefinition, SysMLElementKind.InterfaceDef],      // 260
    [SysMLv2Parser.RULE_actionDefinition, SysMLElementKind.ActionDef],            // 287
    [SysMLv2Parser.RULE_stateDefinition, SysMLElementKind.StateDef],              // 343
    [SysMLv2Parser.RULE_requirementDefinition, SysMLElementKind.RequirementDef],  // 384
    [SysMLv2Parser.RULE_concernDefinition, SysMLElementKind.ConcernDef],          // 405
    [SysMLv2Parser.RULE_concernUsage, SysMLElementKind.ConcernUsage],             // 406
    [SysMLv2Parser.RULE_framedConcernUsage, SysMLElementKind.ConcernUsage],       // 394
    [SysMLv2Parser.RULE_constraintDefinition, SysMLElementKind.ConstraintDef],    // 380
    [SysMLv2Parser.RULE_itemDefinition, SysMLElementKind.ItemDef],                // 244
    [SysMLv2Parser.RULE_allocationDefinition, SysMLElementKind.AllocationDef],    // 275
    [SysMLv2Parser.RULE_useCaseDefinition, SysMLElementKind.UseCaseDef],          // 418
    [SysMLv2Parser.RULE_enumerationDefinition, SysMLElementKind.EnumDef],         // 225
    [SysMLv2Parser.RULE_enumeratedValue, SysMLElementKind.EnumUsage],             // 228
    [SysMLv2Parser.RULE_enumerationUsage, SysMLElementKind.EnumUsage],            // 229
    [SysMLv2Parser.RULE_calculationDefinition, SysMLElementKind.CalcDef],         // 374
    [SysMLv2Parser.RULE_viewDefinition, SysMLElementKind.ViewDef],                // 421
    [SysMLv2Parser.RULE_viewpointDefinition, SysMLElementKind.ViewpointDef],      // 432
    [SysMLv2Parser.RULE_metadataDefinition, SysMLElementKind.MetadataDef],        // 436
    [SysMLv2Parser.RULE_partUsage, SysMLElementKind.PartUsage],                   // 247
    [SysMLv2Parser.RULE_attributeUsage, SysMLElementKind.AttributeUsage],         // 224
    [SysMLv2Parser.RULE_portUsage, SysMLElementKind.PortUsage],                   // 251
    [SysMLv2Parser.RULE_connectionUsage, SysMLElementKind.ConnectionUsage],       // 254
    [SysMLv2Parser.RULE_flowDefinition, SysMLElementKind.FlowDef],                // 279
    [SysMLv2Parser.RULE_flow, SysMLElementKind.FlowUsage],                         // 152
    [SysMLv2Parser.RULE_message, SysMLElementKind.FlowUsage],                      // 280
    [SysMLv2Parser.RULE_flowUsage, SysMLElementKind.FlowUsage],                    // 284
    [SysMLv2Parser.RULE_successionFlowUsage, SysMLElementKind.SuccessionFlowUsage], // 285
    [SysMLv2Parser.RULE_actionUsage, SysMLElementKind.ActionUsage],               // 296
    [SysMLv2Parser.RULE_mergeNode, SysMLElementKind.MergeNode],                   // 305
    [SysMLv2Parser.RULE_decisionNode, SysMLElementKind.DecisionNode],             // 306
    [SysMLv2Parser.RULE_joinNode, SysMLElementKind.JoinNode],                     // 307
    [SysMLv2Parser.RULE_forkNode, SysMLElementKind.ForkNode],                     // 308
    [SysMLv2Parser.RULE_stateUsage, SysMLElementKind.StateUsage],                 // 357
    [SysMLv2Parser.RULE_requirementUsage, SysMLElementKind.RequirementUsage],     // 398
    [SysMLv2Parser.RULE_constraintUsage, SysMLElementKind.ConstraintUsage],       // 381
    [SysMLv2Parser.RULE_itemUsage, SysMLElementKind.ItemUsage],                   // 245
    [SysMLv2Parser.RULE_allocationUsage, SysMLElementKind.AllocationUsage],       // 276
    [SysMLv2Parser.RULE_useCaseUsage, SysMLElementKind.UseCaseUsage],             // 419
    [SysMLv2Parser.RULE_includeUseCaseUsage, SysMLElementKind.IncludeUseCaseUsage], // 420
    [SysMLv2Parser.RULE_actorUsage, SysMLElementKind.ActorUsage],                 // 395
    [SysMLv2Parser.RULE_subjectUsage, SysMLElementKind.SubjectUsage],             // 388
    [SysMLv2Parser.RULE_stakeholderUsage, SysMLElementKind.StakeholderUsage],     // 397
    [SysMLv2Parser.RULE_referenceUsage, SysMLElementKind.RefUsage],               // 213
    // A usage without a kind keyword (`x : A;`, `in p : A;`, `:>> x = 1;`) is a
    // reference usage, `ref` being optional (7.6.4, 8.2.2.6.3 DefaultReferenceUsage).
    [SysMLv2Parser.RULE_defaultReferenceUsage, SysMLElementKind.RefUsage],
    // A variant naming a separately declared usage (`variant part1;`) is a
    // reference usage too (7.6.7, 8.2.2.6.3 VariantReference).
    [SysMLv2Parser.RULE_variantReference, SysMLElementKind.RefUsage],
    [SysMLv2Parser.RULE_interfaceUsage, SysMLElementKind.InterfaceUsage],         // 268
    [SysMLv2Parser.RULE_performActionUsage, SysMLElementKind.PerformActionUsage], // 298
    // A state's `entry`/`do`/`exit` action (`exit action a : A;`, `exit a;`): the
    // StatePerformActionUsage production, a PerformActionUsage without `perform`.
    [SysMLv2Parser.RULE_statePerformActionUsage, SysMLElementKind.PerformActionUsage], // 352
    [SysMLv2Parser.RULE_exhibitStateUsage, SysMLElementKind.ExhibitStateUsage],   // 359
    [SysMLv2Parser.RULE_transitionUsage, SysMLElementKind.TransitionUsage],       // 360
    [SysMLv2Parser.RULE_occurrenceDefinition, SysMLElementKind.OccurrenceDef],    // 231
    [SysMLv2Parser.RULE_occurrenceUsage, SysMLElementKind.OccurrenceUsage],       // 235
    [SysMLv2Parser.RULE_renderingDefinition, SysMLElementKind.RenderingDef],      // 434
    [SysMLv2Parser.RULE_viewUsage, SysMLElementKind.ViewUsage],                   // 426
    [SysMLv2Parser.RULE_viewpointUsage, SysMLElementKind.ViewpointUsage],         // 433
    [SysMLv2Parser.RULE_verificationCaseDefinition, SysMLElementKind.VerificationCaseDef], // 414
    [SysMLv2Parser.RULE_verificationCaseUsage, SysMLElementKind.VerificationCaseUsage],   // 415
    [SysMLv2Parser.RULE_analysisCaseDefinition, SysMLElementKind.AnalysisCaseDef],        // 412
    [SysMLv2Parser.RULE_analysisCaseUsage, SysMLElementKind.AnalysisCaseUsage],           // 413
    [SysMLv2Parser.RULE_aliasMember, SysMLElementKind.Alias],                     // 43
]);

/** Rules that are an element's body (`...Body`), where its declaration ends */
const BODY_RULE_INDICES: ReadonlySet<number> = new Set(
    SysMLv2Parser.ruleNames.flatMap((ruleName, index) => ruleName.endsWith('Body') ? [index] : []),
);

/**
 * The declaration rules through which a usage's own `ValuePart` is reached
 * from its element rule (SysML v2 8.2.2.6.2 `UsageCompletion`, 8.2.2.14.2
 * `InterfaceUsageDeclaration`, 8.2.2.16 `FlowDeclaration`/`MessageDeclaration`,
 * 8.2.2.17.2 `ActionUsageDeclaration`/`PerformActionUsageDeclaration`, 8.2.2.20
 * `ConstraintUsageDeclaration`). Any other rule owns its own elements or values.
 */
const VALUE_DECLARATION_RULE_INDICES: ReadonlySet<number> = new Set([
    SysMLv2Parser.RULE_usage,
    SysMLv2Parser.RULE_usageCompletion,
    SysMLv2Parser.RULE_actionUsageDeclaration,
    SysMLv2Parser.RULE_performActionUsageDeclaration,
    SysMLv2Parser.RULE_constraintUsageDeclaration,
    SysMLv2Parser.RULE_interfaceUsageDeclaration,
    SysMLv2Parser.RULE_flowDeclaration,
    SysMLv2Parser.RULE_messageDeclaration,
]);

/**
 * A flow's payload and ends, and a message's events: they declare names and
 * types of their own, never the flow's.
 */
const FLOW_PART_RULE_INDICES: ReadonlySet<number> = new Set([
    SysMLv2Parser.RULE_payloadFeatureMember,
    SysMLv2Parser.RULE_flowPayloadFeatureMember,
    SysMLv2Parser.RULE_flowEndMember,
    SysMLv2Parser.RULE_messageEventMember,
]);

/** A flow usage's declaration: a flow's, or a message's (8.2.2.16 `MessageDeclaration`). */
const FLOW_DECLARATION_RULE_INDICES: readonly number[] = [
    SysMLv2Parser.RULE_flowDeclaration,
    SysMLv2Parser.RULE_messageDeclaration,
];

/**
 * Usages named after the element they refer to when they declare no name of
 * their own (`perform a;`, `exhibit s;`, `include uc;`, 8.3.17.14).
 */
const PERFORMING_USAGE_KINDS: ReadonlySet<SysMLElementKind> = new Set([
    SysMLElementKind.PerformActionUsage,
    SysMLElementKind.ExhibitStateUsage,
    SysMLElementKind.IncludeUseCaseUsage,
]);

/** A usage's effective name and short name, those of the feature it is named after. */
interface EffectiveName {
    readonly name: string;
    readonly shortName?: string;
}

/**
 * Why a usage named after a feature it references (`namingReference`) has no
 * settled effective name (`SymbolTable.getNamingIssues`).
 */
export type NamingIssue =
    /** Its naming feature is, through usages named after features they reference, named after it; it keeps the names it has. */
    | { readonly reason: 'cycle'; readonly symbol: SysMLSymbol; readonly cycle: readonly SysMLSymbol[] }
    /** Its names change again to ones it already had, without ever settling. */
    | { readonly reason: 'unstable'; readonly symbol: SysMLSymbol }
    /** Its names still changed after the budget of rounds (`refreshNamingFeatures`) ran out. */
    | { readonly reason: 'limit'; readonly symbol: SysMLSymbol; readonly rounds: number };

/** The diagnostic code and message reporting `issue`. */
export function describeNamingIssue(issue: NamingIssue): { code: string; message: string } {
    const name = `'${displayName(issue.symbol)}'`;
    switch (issue.reason) {
        case 'cycle':
            return {
                code: 'circular-naming',
                message: `Circular naming: ${name} is named after itself through ${issue.cycle.map(s => `'${s.qualifiedName ?? displayName(s)}'`).join(' -> ')}.`,
            };
        case 'unstable':
            return { code: 'circular-naming', message: `Circular naming: the names of ${name} keep changing without settling.` };
        case 'limit':
            return {
                code: 'naming-resolution-limit',
                message: `The names of ${name} did not settle within ${issue.rounds} rounds of name resolution; it is named '${issue.symbol.name}' for now.`,
            };
    }
}

/** By document, its effective names keyed by `rangeKey`. */
type EffectiveNamesByUri = Map<string, Map<string, EffectiveName>>;

/** A declaration's key within its document: where its range starts. */
function rangeKey(range: Range): string {
    return `${range.start.line}:${range.start.character}`;
}

/** The effective names of all documents as one string, the same for the same names. */
function effectiveNamesState(effectiveNames: ReadonlyMap<string, ReadonlyMap<string, EffectiveName>>): string {
    const entries = [...effectiveNames]
        .flatMap(([uri, names]) => [...names].map(([key, { name, shortName }]) => [uri, key, name, shortName ?? null]))
        .sort((a, b) => `${a[0]}\0${a[1]}`.localeCompare(`${b[0]}\0${b[1]}`));
    return JSON.stringify(entries);
}

/** Whether two documents' effective names, either missing when it has none, are the same. */
function sameEffectiveNames(a: ReadonlyMap<string, EffectiveName> | undefined, b: ReadonlyMap<string, EffectiveName> | undefined): boolean {
    if ((a?.size ?? 0) !== (b?.size ?? 0)) return false;
    for (const [key, names] of a ?? []) {
        const other = b?.get(key);
        if (other?.name !== names.name || other.shortName !== names.shortName) return false;
    }
    return true;
}

/** The name of the last segment of a reference: the name of the feature it ends at. */
function lastSegmentName(reference: string): string | undefined {
    return [...scanQualifiedNames(reference)].at(-1)?.segments.at(-1)?.name;
}

/**
 * `symbol`'s effective names, named after `feature`: those of `feature`, or
 * undefined when they are the reference as written or `feature` is anonymous.
 */
function namedAfter(symbol: SysMLSymbol, feature: SysMLSymbol): EffectiveName | undefined {
    if (isAnonymous(feature)) return undefined;
    if (feature.name === lastSegmentName(symbol.namingReference!) && feature.shortName === undefined) return undefined;
    return { name: feature.name, shortName: feature.shortName };
}

/**
 * Each usage on a cycle of usages named after one another, with that cycle
 * starting at it; `features` maps each usage to its naming feature.
 */
function namingCycles(features: ReadonlyMap<SysMLSymbol, SysMLSymbol>): Map<SysMLSymbol, SysMLSymbol[]> {
    const cycles = new Map<SysMLSymbol, SysMLSymbol[]>();
    const visited = new Set<SysMLSymbol>();
    for (const start of features.keys()) {
        const path: SysMLSymbol[] = [];
        let symbol: SysMLSymbol | undefined = start;
        while (symbol && !visited.has(symbol)) {
            visited.add(symbol);
            path.push(symbol);
            symbol = features.get(symbol);
        }
        const at = symbol ? path.indexOf(symbol) : -1;
        if (at < 0) continue;
        const cycle = path.slice(at);
        cycle.forEach((member, i) => cycles.set(member, [...cycle.slice(i), ...cycle.slice(0, i)]));
    }
    return cycles;
}

/** Rules whose children contain a name (identification, name, qualifiedName) */
const NAME_RULE_INDICES: ReadonlySet<number> = new Set([
    SysMLv2Parser.RULE_identification,  // 22
    SysMLv2Parser.RULE_name,            // 20
    SysMLv2Parser.RULE_qualifiedName,   // 44
]);

/** Rules that are prefix/extension contexts — should be skipped in name extraction */
const PREFIX_EXTENSION_RULE_INDICES: ReadonlySet<number> = new Set([
    SysMLv2Parser.RULE_prefixMetadataAnnotation,   // 169
    SysMLv2Parser.RULE_prefixMetadataMember,        // 170
    SysMLv2Parser.RULE_prefixMetadataFeature,       // 171
    SysMLv2Parser.RULE_prefixMetadataUsage,         // 437
    SysMLv2Parser.RULE_definitionExtensionKeyword,  // 190
    SysMLv2Parser.RULE_usageExtensionKeyword,       // 205
    SysMLv2Parser.RULE_occurrenceDefinitionPrefix,  // 230
    SysMLv2Parser.RULE_occurrenceUsagePrefix,       // 234
    SysMLv2Parser.RULE_definitionPrefix,            // 191
    SysMLv2Parser.RULE_basicDefinitionPrefix,       // 189
    SysMLv2Parser.RULE_typePrefix,                  // 55
    SysMLv2Parser.RULE_featurePrefix,               // 88
    SysMLv2Parser.RULE_basicFeaturePrefix,          // 87
    SysMLv2Parser.RULE_endFeaturePrefix,            // 86
]);

/**
 * Keywords of an element's own prefix and multiplicity part (SysML 8.2.2.6.1
 * `BasicDefinitionPrefix`, 8.2.2.6.2 `RefPrefix`/`BasicUsagePrefix`/`EndUsagePrefix`,
 * 8.2.2.6.3 `ReferenceUsage`, 8.2.2.6.6 `MultiplicityPart`, 8.2.2.9 `isIndividual`).
 */
const PREFIX_KEYWORD_TOKENS: ReadonlySet<number> = new Set([
    SysMLv2Lexer.IN, SysMLv2Lexer.OUT, SysMLv2Lexer.INOUT,
    SysMLv2Lexer.ABSTRACT, SysMLv2Lexer.VARIATION, SysMLv2Lexer.INDIVIDUAL,
    SysMLv2Lexer.DERIVED, SysMLv2Lexer.CONSTANT,
    SysMLv2Lexer.REF, SysMLv2Lexer.END,
    SysMLv2Lexer.ORDERED, SysMLv2Lexer.NONUNIQUE,
]);

/**
 * The rules entered from an element's own rule to read its prefix keywords:
 * its prefix, declaration and multiplicity productions. Names, references,
 * values, bodies and owned members are never among them, and none of these
 * rules has a `PREFIX_KEYWORD_TOKENS` token in a role other than a prefix keyword.
 */
const PREFIX_PATH_RULE_INDICES: ReadonlySet<number> = new Set([
    SysMLv2Parser.RULE_usagePrefix,
    SysMLv2Parser.RULE_unextendedUsagePrefix,
    SysMLv2Parser.RULE_basicUsagePrefix,
    SysMLv2Parser.RULE_endUsagePrefix,
    SysMLv2Parser.RULE_refPrefix,
    SysMLv2Parser.RULE_featureDirection,
    SysMLv2Parser.RULE_occurrenceUsagePrefix,
    SysMLv2Parser.RULE_controlNodePrefix,
    SysMLv2Parser.RULE_definitionPrefix,
    SysMLv2Parser.RULE_basicDefinitionPrefix,
    SysMLv2Parser.RULE_occurrenceDefinitionPrefix,
    SysMLv2Parser.RULE_usage,
    SysMLv2Parser.RULE_usageDeclaration,
    SysMLv2Parser.RULE_featureDeclaration,
    SysMLv2Parser.RULE_featureSpecializationPart,
    SysMLv2Parser.RULE_multiplicityPart,
    SysMLv2Parser.RULE_actionUsageDeclaration,
    SysMLv2Parser.RULE_performActionUsageDeclaration,
    SysMLv2Parser.RULE_constraintUsageDeclaration,
    SysMLv2Parser.RULE_interfaceUsageDeclaration,
    SysMLv2Parser.RULE_allocationUsageDeclaration,
    SysMLv2Parser.RULE_flowDeclaration,
    SysMLv2Parser.RULE_messageDeclaration,
]);

/**
 * The rules between an `endOccurrenceUsageElement`, whose `end` is its
 * occurrence usage's own `EndUsagePrefix` (8.2.2.6.2), and that usage's rule.
 */
const OCCURRENCE_USAGE_ELEMENT_RULE_INDICES: ReadonlySet<number> = new Set([
    SysMLv2Parser.RULE_occurrenceUsageElement,
    SysMLv2Parser.RULE_structureUsageElement,
    SysMLv2Parser.RULE_behaviorUsageElement,
]);

/** Rules that represent :> subsetting / specializes / subclassification */
const TYPE_SPECIALIZATION_RULE_INDICES: ReadonlySet<number> = new Set([
    SysMLv2Parser.RULE_specialization,          // 66
    SysMLv2Parser.RULE_ownedSpecialization,      // 67
    SysMLv2Parser.RULE_subclassification,        // 83
    SysMLv2Parser.RULE_ownedSubclassification,   // 84
    SysMLv2Parser.RULE_subsetting,               // 111
    SysMLv2Parser.RULE_ownedSubsetting,          // 112
    SysMLv2Parser.RULE_specializationPart,       // 57
]);

/**
 * Rules that represent : typing (feature typing).
 *
 * NOTE: `conjugation` and `disjoining` (rules 70-73) are not strictly typing
 * relationships in SysML semantics — they are kept in the typing bucket by
 * exclusion (i.e. "everything name-bearing that is not a specialization")
 * so that existing `extractTypeNames` / `typeNames` behaviour is preserved
 * via the combined `TYPE_EXTRACTION_RULE_INDICES` set.
 */
const TYPE_TYPING_RULE_INDICES: ReadonlySet<number> = new Set([
    SysMLv2Parser.RULE_typings,                  // 101
    SysMLv2Parser.RULE_featureTyping,            // 109
    SysMLv2Parser.RULE_ownedFeatureTyping,       // 110
    SysMLv2Parser.RULE_conjugation,              // 70  (see NOTE above)
    SysMLv2Parser.RULE_ownedConjugation,         // 71  (see NOTE above)
    SysMLv2Parser.RULE_disjoining,               // 72  (see NOTE above)
    SysMLv2Parser.RULE_ownedDisjoining,          // 73  (see NOTE above)
]);

/** Combined set — all rules containing typing / specialization info */
const TYPE_EXTRACTION_RULE_INDICES: ReadonlySet<number> = new Set([
    ...TYPE_SPECIALIZATION_RULE_INDICES,
    ...TYPE_TYPING_RULE_INDICES,
]);

/** Rules to recurse into when looking for type names */
const TYPE_RECURSE_RULE_INDICES: ReadonlySet<number> = new Set([
    SysMLv2Parser.RULE_featureSpecialization,     // 100
    SysMLv2Parser.RULE_featureSpecializationPart, // 98
    SysMLv2Parser.RULE_featureDeclaration,        // 92
    SysMLv2Parser.RULE_usageCompletion,           // 210
    SysMLv2Parser.RULE_definition,                // 192
    SysMLv2Parser.RULE_usage,                     // 208
    SysMLv2Parser.RULE_payloadFeatureSpecializationPart, // 157
]);

/** Rules containing documentation */
const DOC_RULE_INDICES: ReadonlySet<number> = new Set([
    SysMLv2Parser.RULE_comment,          // 30
    SysMLv2Parser.RULE_documentation,    // 31
]);

/** Rules for prefix metadata in collectPrefixMetadata() */
const PREFIX_METADATA_RULE_INDICES: ReadonlySet<number> = new Set([
    SysMLv2Parser.RULE_prefixMetadataMember,      // 170
    SysMLv2Parser.RULE_prefixMetadataAnnotation,  // 169
]);

/** Rules to recurse into for prefix metadata collection */
const PREFIX_METADATA_RECURSE_RULE_INDICES: ReadonlySet<number> = new Set([
    SysMLv2Parser.RULE_prefixMetadataFeature,      // 171
    SysMLv2Parser.RULE_prefixMetadataUsage,         // 437
    SysMLv2Parser.RULE_definitionExtensionKeyword,  // 190
    SysMLv2Parser.RULE_usageExtensionKeyword,       // 205
    SysMLv2Parser.RULE_definitionPrefix,            // 191
    SysMLv2Parser.RULE_basicDefinitionPrefix,       // 189
    SysMLv2Parser.RULE_definition,                  // 192
    SysMLv2Parser.RULE_usage,                       // 208
    SysMLv2Parser.RULE_occurrenceDefinitionPrefix,  // 230
    SysMLv2Parser.RULE_occurrenceUsagePrefix,       // 234
    SysMLv2Parser.RULE_usagePrefix,                 // 207
    SysMLv2Parser.RULE_unextendedUsagePrefix,       // 206
    SysMLv2Parser.RULE_basicUsagePrefix,            // 203
]);

// Pre-compiled regex patterns for extractTypeNames() — compiled once at import time
// Negative lookbehind (?<![A-Za-z_]) ensures keywords don't match mid-identifier
// (e.g. "connect" should not match inside "InterconnectionView")
const RE_KEYWORD_TRUNCATE = /(?<![A-Za-z_])(redefines|subsets|references|connect|bind|first|then|flow|allocate|assign|accept|send|decide|merge|join|fork|via|default)\b.*/i;
// Variant used by the specialization regex fallback: keeps `subsets` so that
// it can be matched as a specialization keyword (it is otherwise stripped by
// RE_KEYWORD_TRUNCATE because the typing regex must not greedily absorb it).
const RE_KEYWORD_TRUNCATE_SPEC = /(?<![A-Za-z_])(redefines|references|connect|bind|first|then|flow|allocate|assign|accept|send|decide|merge|join|fork|via|default)\b.*/i;
const RE_SPEC = /(?:specializes|:>|:>>)\s*('[^']+'|[A-Za-z_]\w*(?:::\w+)*)(?:\s*,\s*(?:'[^']+'|[A-Za-z_]\w*(?:::\w+)*))*/;
// Specialization fallback regex extended to cover the `subsets` keyword used
// by feature subsetting relationships.
const RE_SPEC_WITH_SUBSETS = /(?:specializes|subsets|:>|:>>)\s*('[^']+'|[A-Za-z_]\w*(?:::\w+)*)(?:\s*,\s*(?:'[^']+'|[A-Za-z_]\w*(?:::\w+)*))*/;
const RE_DEFINED_BY = /definedby\s*([A-Za-z_]\w*(?:::\w+)*(?:\s*,\s*[A-Za-z_]\w*(?:::\w+)*)*)/;

/**
 * Recursion-depth cap for `findOwnBodyRule`/`findRule`'s parse-tree search --
 * a safety net against an unexpectedly deep parse tree, consistent with the
 * same "don't go too deep" cap already used elsewhere in this file.
 */
const MAX_RULE_SEARCH_DEPTH = 6;

const RE_TYPING = /:(?![:>])\s*('[^']+'|[A-Za-z_]\w*(?:::\w+)*)/;
/**
 * A masked quoted name (`'0'`) ending the qualified name a part of a masked
 * declaration starts with (`'0'`, `SI::'0'`, `$::SI::'0'`), so a quoted name
 * in a feature value (`referenceUnit = '0'`) is never taken for a type. The
 * other segments are basic names (KerML 8.2.2.3): any other name is quoted,
 * so masked as well.
 */
const RE_QUOTED_NAME = /^\s*(?:\$::)?(?:(?:[A-Za-z_]\w*|'\d+')::)*'(\d+)'/;
const RE_IDENT_START = /^([A-Za-z_]\w*(?:::\w+)*)/;

/**
 * Builds a symbol table from a parsed SysML document.
 *
 * Walks the ANTLR parse tree to extract declarations, building
 * a hierarchical scope structure that mirrors the SysML namespace.
 */
export class SymbolTable {
    /** All symbols indexed by qualified name */
    private symbols = new Map<string, SysMLSymbol>();
    /** Symbols without a qualified name (anonymous elements and their members) -- never in `symbols` */
    private unqualifiedSymbols = new Set<SysMLSymbol>();
    /** Each symbol's owner, as declared in the parse tree; `parentId` is derived from it */
    private owners = new WeakMap<SysMLSymbol, SysMLSymbol>();
    /** Each symbol's own members, the reverse of `owners` */
    private members = new WeakMap<SysMLSymbol, SysMLSymbol[]>();
    /** Assigns and finds `symbolId`s, one document at a time */
    private ids = new IdRegistry(this.owners, this.members);
    /** All symbols indexed by URI for cross-file lookup */
    private symbolsByUri = new Map<string, SysMLSymbol[]>();
    /** All symbols indexed by simple name for O(1) lookup */
    private symbolsByName = new Map<string, SysMLSymbol[]>();
    /** Symbols sorted by (line, character) per URI for O(log n) positional lookup */
    private symbolsByPosition = new Map<string, SysMLSymbol[]>();
    /** Reverse index: type name → symbols that reference it in typeNames */
    private typeNameRefs = new Map<string, SysMLSymbol[]>();
    /** Packages indexed by qualified name */
    private packageFragmentsByQualifiedName = new Map<string, Map<string, SysMLSymbol>>();
    /** Symbols sharing a qualifiedName with a non-package sibling of a different kind (e.g. `package A` vs. `part def A`) -- tracked so `getAllSymbols()` doesn't lose one to `symbols`' one-entry-per-qualifiedName limit, regardless of whether the collision is a real naming conflict (see `findConflictedQualifiedNames` in namespaceResolver.ts for that narrower, spec-driven question). */
    private conflictedSymbolsByQualifiedName = new Map<string, Set<SysMLSymbol>>();
    /** Cached array from getAllSymbols(), invalidated on any mutation */
    private allSymbolsCache: SysMLSymbol[] | undefined;
    /** The global scope */
    private globalScope: Scope;
    /** Each document's parse tree, to build it again with other effective names (`refreshNamingFeatures`) */
    private trees = new Map<string, ParserRuleContext>();
    /** Each document's effective names it was last built with (`resolveNamingFeatures`) */
    private effectiveNamesByUri = new Map<string, Map<string, EffectiveName>>();
    /** While a document is built: its effective names */
    private effectiveNames: Map<string, EffectiveName> | undefined;
    /** The usages whose effective names did not settle when last refreshed (`refreshNamingFeatures`) */
    private namingIssues: NamingIssue[] = [];

    /**
     * @param namingRounds the budget of rounds of `refreshNamingFeatures`,
     * instead of the one it derives from the usages it names
     */
    constructor(private readonly namingRounds?: number) {
        this.globalScope = new Scope('__global__');
    }

    /**
     * Build the symbol table from a parse result.
     */
    build(uri: string, parseResult: ParseResult): void {
        this.buildDocument(uri, parseResult);
        this.refreshNamingFeatures();
    }

    /** Build the symbol table from the parse results of several documents. */
    buildAll(documents: Iterable<[uri: string, parseResult: ParseResult]>): void {
        for (const [uri, parseResult] of documents) this.buildDocument(uri, parseResult);
        this.refreshNamingFeatures();
    }

    /** Build `uri`'s symbols, each named as written (`refreshNamingFeatures`). */
    private buildDocument(uri: string, parseResult: ParseResult): void {
        // Clear previous entries for this URI
        this.clearUri(uri);
        this.trees.delete(uri);
        this.effectiveNamesByUri.delete(uri);

        if (!parseResult.tree) {
            return;
        }

        this.trees.set(uri, parseResult.tree);
        this.collect(uri, parseResult.tree);
    }

    /** Walk `tree` for `uri`'s symbols, and give them their symbol IDs. */
    private collect(uri: string, tree: ParserRuleContext): void {
        this.effectiveNames = this.effectiveNamesByUri.get(uri);
        try {
            this.walkTree(tree, uri, this.globalScope, undefined);
        } finally {
            this.effectiveNames = undefined;
        }

        // Post-process: resolve view specialization chains to inherit
        // filters, rendering, and expose targets from parent view defs
        this.resolveViewInheritance(uri);
        const declarations = this.symbolsByUri.get(uri) ?? [];
        this.ids.add(declarations);
        this.refreshMergedPackages(declarations);
    }

    /**
     * Build again each document whose usages named after a feature they
     * reference (`namingReference`) now have other effective names
     * (`resolveNamingFeatures`), until none does: a document's names may
     * depend on another's. A round settles at least one more usage of an
     * acyclic chain of such usages, so the budget is a round per such usage,
     * and one more. It stops early when the names come back to ones it
     * already built with; either way, it records the usages left unsettled
     * (`getNamingIssues`).
     */
    private refreshNamingFeatures(): void {
        const budget = this.namingRounds
            ?? this.getAllSymbolsIncludingDuplicates().filter(s => s.namingReference !== undefined).length + 1;
        const built = new Set([effectiveNamesState(this.effectiveNamesByUri)]);
        for (let rounds = 0; ; rounds++) {
            const { effectiveNames, cycles } = this.resolveNamingFeatures();
            const state = effectiveNamesState(effectiveNames);
            const settled = state === effectiveNamesState(this.effectiveNamesByUri);
            if (settled || built.has(state) || rounds === budget) {
                const unsettled = settled ? [] : this.unsettledNamingUsages(effectiveNames);
                this.namingIssues = [
                    ...cycles,
                    ...unsettled.map((symbol): NamingIssue => built.has(state)
                        ? { reason: 'unstable', symbol }
                        : { reason: 'limit', symbol, rounds }),
                ];
                return;
            }
            built.add(state);
            for (const [uri, tree] of this.trees) {
                const names = effectiveNames.get(uri);
                if (sameEffectiveNames(names, this.effectiveNamesByUri.get(uri))) continue;
                this.clearUri(uri);
                if (names) this.effectiveNamesByUri.set(uri, names);
                else this.effectiveNamesByUri.delete(uri);
                this.collect(uri, tree);
            }
        }
    }

    /** The usages whose effective names in `effectiveNames` differ from the ones they were built with. */
    private unsettledNamingUsages(effectiveNames: EffectiveNamesByUri): SysMLSymbol[] {
        return [...this.trees.keys()].flatMap(uri => {
            const names = effectiveNames.get(uri);
            const builtNames = this.effectiveNamesByUri.get(uri);
            return this.getSymbolsForUri(uri).filter(symbol => {
                if (symbol.namingReference === undefined) return false;
                const key = rangeKey(symbol.range);
                const [a, b] = [names?.get(key), builtNames?.get(key)];
                return a?.name !== b?.name || a?.shortName !== b?.shortName;
            });
        });
    }

    /**
     * By document, the effective name and short name of each usage named after
     * a feature it references (`namingReference`) whose names differ from the
     * reference as written: those of that feature (7.6.5, 8.3.6.4, 8.3.17.14),
     * whichever of its names the reference uses. Keyed by `rangeKey`. A
     * reference to no feature in this table keeps its names as written; a
     * usage on a cycle of usages named after one another keeps the names it
     * was built with, and is reported in `cycles`.
     */
    private resolveNamingFeatures(): { effectiveNames: EffectiveNamesByUri; cycles: NamingIssue[] } {
        const effectiveNames: EffectiveNamesByUri = new Map();
        const named = this.getAllSymbolsIncludingDuplicates().filter(s => s.namingReference !== undefined);
        if (named.length === 0) return { effectiveNames, cycles: [] };
        const indexes = buildSymbolIndexes(this.getAllSymbols());
        const resolver = new NamespaceResolver();
        const features = new Map<SysMLSymbol, SysMLSymbol>();
        for (const symbol of named) {
            const feature = this.resolveNamingFeature(symbol, resolver, indexes);
            if (feature) features.set(symbol, feature);
        }
        const cycles = namingCycles(features);
        for (const [symbol, feature] of features) {
            const key = rangeKey(symbol.range);
            const effectiveName = cycles.has(symbol)
                ? this.effectiveNamesByUri.get(symbol.uri)?.get(key)
                : namedAfter(symbol, feature);
            if (!effectiveName) continue;
            const names = effectiveNames.get(symbol.uri) ?? new Map<string, EffectiveName>();
            names.set(key, effectiveName);
            effectiveNames.set(symbol.uri, names);
        }
        return {
            effectiveNames,
            cycles: [...cycles].map(([symbol, cycle]): NamingIssue => ({ reason: 'cycle', symbol, cycle })),
        };
    }

    /** The usages of `uri` whose effective names did not settle when last built, and why. */
    getNamingIssues(uri: string): NamingIssue[] {
        return this.namingIssues.filter(issue => issue.symbol.uri === uri);
    }

    /**
     * The feature `symbol`'s `namingReference` resolves to, in its owner's
     * namespace and never to `symbol` itself; through a feature chain, each
     * feature after the first is a feature of the one before it.
     */
    private resolveNamingFeature(symbol: SysMLSymbol, resolver: NamespaceResolver, indexes: SymbolIndexes): SysMLSymbol | undefined {
        const [path] = scanFeaturePaths(symbol.namingReference!);
        if (!path) return undefined;
        const [first, ...chain] = path.qualifiedNames;
        let feature = resolver.resolveReferenceIn(this.getOwner(symbol), first.name, indexes, symbol).symbol;
        for (const qualified of chain) {
            const [member, ...rest] = qualified.segments;
            feature = feature && resolver.resolveFeatureReference(feature, member.name, indexes).symbol;
            for (const segment of rest) feature = feature && resolver.resolveMemberReference(feature, segment.name, indexes).symbol;
        }
        return feature;
    }

    /**
     * Get a symbol by its qualified name.
     */
    getSymbol(qualifiedName: string): SysMLSymbol | undefined {
        return this.symbols.get(qualifiedName);
    }

    /** Get a symbol by its `symbolId`; for a package, its merged view across documents. */
    getSymbolById(id: string): SysMLSymbol | undefined {
        const symbol = this.ids.get(id);
        if (symbol?.kind !== SysMLElementKind.Package || symbol.qualifiedName === undefined) return symbol;
        const merged = this.symbols.get(symbol.qualifiedName);
        return merged?.kind === SysMLElementKind.Package ? merged : symbol;
    }

    /** Get `symbol`'s owner, by its `parentId`. */
    getOwner(symbol: SysMLSymbol): SysMLSymbol | undefined {
        return symbol.parentId ? this.getSymbolById(symbol.parentId) : undefined;
    }

    /**
     * Find a symbol by name (simple name, not qualified).
     */
    findByName(name: string): SysMLSymbol[] {
        const exact = this.symbolsByName.get(name);
        if (exact) return exact;
        const segments = splitQualifiedName(name);
        if (segments.length === 1) return this.symbolsByName.get(segments[0]) ?? [];
        const qualified = this.getSymbol(joinQualifiedName(segments));
        return qualified ? [qualified] : [];
    }

    /**
     * Find all symbols in a given URI.
     */
    getSymbolsForUri(uri: string): SysMLSymbol[] {
        return this.symbolsByUri.get(uri) ?? [];
    }

    /**
     * Get all symbols in the table.
     * Returns a cached array — invalidated on symbol add/remove.
     */
    getAllSymbols(): SysMLSymbol[] {
        if (!this.allSymbolsCache) {
            const all = [...this.symbols.values(), ...this.unqualifiedSymbols];
            // `symbols` holds only one entry per qualifiedName; a genuine
            // naming conflict (see `conflictedSymbolsByQualifiedName`'s doc
            // comment) needs every conflicting declaration surfaced here, not
            // just whichever currently occupies that one entry.
            if (this.conflictedSymbolsByQualifiedName.size > 0) {
                const included = new Set(all);
                for (const conflictSet of this.conflictedSymbolsByQualifiedName.values()) {
                    for (const sym of conflictSet) {
                        if (!included.has(sym)) {
                            all.push(sym);
                            included.add(sym);
                        }
                    }
                }
            }
            this.allSymbolsCache = all;
        }
        return this.allSymbolsCache;
    }

    /**
     * Give each package's merged view (`mergePackageFragments`), built before
     * its declarations got their symbol IDs, the symbol IDs of its
     * declarations in `declarations`.
     */
    private refreshMergedPackages(declarations: readonly SysMLSymbol[]): void {
        for (const declaration of declarations) {
            if (declaration.kind !== SysMLElementKind.Package || declaration.qualifiedName === undefined) continue;
            const merged = this.symbols.get(declaration.qualifiedName);
            if (merged && merged !== declaration && merged.kind === SysMLElementKind.Package) {
                merged.symbolId = declaration.symbolId;
                merged.parentId = declaration.parentId;
            }
        }
    }

    /**
     * Get every registered symbol, one entry per declaration site — unlike
     * `getAllSymbols()`, two symbols sharing a `qualifiedName` (e.g. the same
     * name declared in two different files) both appear here. Backed by
     * `symbolsByUri`, which is never collapsed by qualified name.
     */
    getAllSymbolsIncludingDuplicates(): SysMLSymbol[] {
        return Array.from(this.symbolsByUri.values()).flat();
    }

    /**
     * Get the global scope for resolution.
     */
    getGlobalScope(): Scope {
        return this.globalScope;
    }

    /**
     * Find the symbol at a given position in a document.
     * Uses a position-sorted index with binary search for O(log n) lookup.
     */
    findSymbolAtPosition(uri: string, line: number, character: number): SysMLSymbol | undefined {
        const sorted = this.symbolsByPosition.get(uri);
        if (!sorted || sorted.length === 0) return undefined;

        // Binary search: find the rightmost symbol whose start is <= (line, character)
        let lo = 0;
        let hi = sorted.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >>> 1;
            const r = sorted[mid].selectionRange.start;
            if (r.line < line || (r.line === line && r.character <= character)) {
                lo = mid;
            } else {
                hi = mid - 1;
            }
        }

        // Scan backwards from lo to find the best (smallest) containing symbol.
        // Symbols are sorted by start position; we only need to check symbols
        // whose start line is <= our target line.
        let best: SysMLSymbol | undefined;
        let bestSize = Infinity;

        for (let i = lo; i >= 0; i--) {
            const sym = sorted[i];
            const r = sym.selectionRange;
            // Early exit: if symbol starts on a line well before target,
            // no earlier symbol can contain the position (single-line selections).
            if (r.start.line < line - 1 && r.end.line < line) break;
            if (r.start.line < line && r.end.line < line) continue;

            if (
                line >= r.start.line &&
                line <= r.end.line &&
                (line > r.start.line || character >= r.start.character) &&
                (line < r.end.line || character <= r.end.character)
            ) {
                const size =
                    (r.end.line - r.start.line) * 10000 +
                    (r.end.character - r.start.character);
                if (size < bestSize) {
                    best = sym;
                    bestSize = size;
                }
            }
        }
        return best;
    }

    /**
     * Find all references to a symbol name across all documents.
     * Matches symbols whose name equals the target OR whose typeNames include it.
     * Uses a reverse index for O(1) typeName lookup.
     */
    findReferences(name: string): SysMLSymbol[] {
        const results: SysMLSymbol[] = [];
        // Start with symbols that share the name (O(1) lookup)
        const byName = this.symbolsByName.get(name);
        if (byName) results.push(...byName);
        // Also find symbols whose typeNames reference this name (O(1) lookup)
        const refs = this.typeNameRefs.get(name);
        if (refs) {
            for (const sym of refs) {
                if (sym.name !== name) {
                    results.push(sym);
                }
            }
        }
        return results;
    }

    /**
     * Count references to a symbol name without allocating a result array.
     */
    countReferences(name: string): number {
        let count = 0;
        const byName = this.symbolsByName.get(name);
        if (byName) count += byName.length;
        const refs = this.typeNameRefs.get(name);
        if (refs) {
            for (const sym of refs) {
                if (sym.name !== name) count++;
            }
        }
        return count;
    }

    // --------------------------------------------------------------------------
    // Private tree-walking
    // --------------------------------------------------------------------------

    /**
     * Remove all symbols for a given URI (public API for document close/eviction).
     */
    removeUri(uri: string): void {
        this.clearUri(uri);
        this.symbolsByUri.delete(uri);
        this.trees.delete(uri);
        this.effectiveNamesByUri.delete(uri);
        this.refreshNamingFeatures();
    }

    private clearUri(uri: string): void {
        const existing = this.symbolsByUri.get(uri);
        if (existing && existing.length > 0) {
            this.ids.remove(existing);
            // Collect names and type names that need index updates
            const affectedNames = new Set<string>();
            const affectedTypeNames = new Set<string>();
            for (const sym of existing) {
                // Order matters: re-point `symbols`' entry (which may fall
                // back to a remaining conflicting symbol) *before* pruning
                // `sym` out of conflict tracking, so that fallback still sees
                // the full picture, `sym` included -- see
                // `unregisterPlainSymbol`'s own doc comment.
                if (sym.qualifiedName === undefined) {
                    this.unqualifiedSymbols.delete(sym);
                } else {
                    if (sym.kind === SysMLElementKind.Package) {
                        this.unregisterPackageFragment(sym.qualifiedName, uri);
                    } else {
                        this.unregisterPlainSymbol(sym, sym.qualifiedName);
                    }
                    this.removeFromConflictTracking(sym, sym.qualifiedName);
                }
                affectedNames.add(sym.name);
                for (const tn of sym.typeNames) {
                    affectedTypeNames.add(tn);
                }
            }
            // Rebuild affected name index entries by filtering out symbols from this URI
            for (const name of affectedNames) {
                const list = this.symbolsByName.get(name);
                if (list) {
                    const filtered = list.filter(s => s.uri !== uri);
                    if (filtered.length === 0) this.symbolsByName.delete(name);
                    else this.symbolsByName.set(name, filtered);
                }
            }
            // Rebuild affected type-name reference entries
            for (const tn of affectedTypeNames) {
                const list = this.typeNameRefs.get(tn);
                if (list) {
                    const filtered = list.filter(s => s.uri !== uri);
                    if (filtered.length === 0) this.typeNameRefs.delete(tn);
                    else this.typeNameRefs.set(tn, filtered);
                }
            }
            // Invalidate cached array
            this.allSymbolsCache = undefined;
        }
        this.symbolsByUri.set(uri, []);
        this.symbolsByPosition.set(uri, []);
    }

    /**
     * Resolve view specialization chains to inherit filters, rendering,
     * and expose targets from parent view definitions.
     *
     * For example, if `view x : PartsTreeView` and `PartsTreeView :> TreeView`,
     * and TreeView has `render asTreeDiagram`, then x inherits that rendering.
     */
    private resolveViewInheritance(uri: string): void {
        const symbols = this.symbolsByUri.get(uri) ?? [];
        const viewSymbols = symbols.filter(
            s => s.kind === SysMLElementKind.ViewUsage || s.kind === SysMLElementKind.ViewDef,
        );
        if (viewSymbols.length === 0) return;

        // Build a lookup of all view defs by name (for chain resolution)
        const viewDefsByName = new Map<string, SysMLSymbol>();
        for (const s of this.getAllSymbols()) {
            if (s.kind === SysMLElementKind.ViewDef) {
                viewDefsByName.set(s.name, s);
            }
        }

        for (const view of viewSymbols) {
            // Walk the specialization chain (max depth 5 to prevent cycles)
            const visited = new Set<string>();
            let current: SysMLSymbol | undefined = view;
            for (let depth = 0; depth < 5 && current; depth++) {
                if (visited.has(current.name)) break;
                visited.add(current.name);

                // Follow the type reference to the parent view def
                const parentName = current.typeNames[0] ?? current.typeName;
                if (!parentName) break;

                const parent = viewDefsByName.get(parentName);
                if (!parent) break;

                // Inherit viewFilters from parent if not already set
                if (parent.viewFilters && parent.viewFilters.length > 0) {
                    if (!view.viewFilters) {
                        view.viewFilters = [...parent.viewFilters];
                    } else {
                        // Merge: add parent filters that aren't already present
                        for (const f of parent.viewFilters) {
                            if (!view.viewFilters.includes(f)) {
                                view.viewFilters.push(f);
                            }
                        }
                    }
                }

                // Inherit viewRendering from parent if not already set
                if (parent.viewRendering && !view.viewRendering) {
                    view.viewRendering = parent.viewRendering;
                }

                // Inherit exposeTargets from parent if not already set
                if (parent.exposeTargets && parent.exposeTargets.length > 0 && (!view.exposeTargets || view.exposeTargets.length === 0)) {
                    view.exposeTargets = [...parent.exposeTargets];
                }

                // Continue up the chain
                current = parent;
            }
        }
    }

    /**
     * Recursively walk the parse tree, extracting SysML element declarations.
     *
     * This is a generic tree walker that inspects rule names to identify
     * SysML elements. It works by pattern-matching on the ANTLR rule
     * context class names from the generated parser.
     */
    private walkTree(
        ctx: ParserRuleContext,
        uri: string,
        currentScope: Scope,
        owner: SysMLSymbol | undefined,
    ): void {
        const ruleName = this.getRuleName(ctx);

        // Try to extract a symbol from this context
        const symbol = this.tryExtractSymbol(ctx, uri, ruleName, owner);

        let childScope = currentScope;

        if (symbol) {
            if (owner) {
                this.owners.set(symbol, owner);
                const ownMembers = this.members.get(owner) ?? [];
                ownMembers.push(symbol);
                this.members.set(owner, ownMembers);
            }
            this.registerSymbol(symbol, uri, currentScope);
            // Create a child scope for definitions and packages
            childScope = new Scope(symbol.qualifiedName ?? symbol.name, currentScope);
        }

        // Walk children
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (child instanceof ParserRuleContext) {
                this.walkTree(
                    child,
                    uri,
                    childScope,
                    symbol ?? owner,
                );
            }
        }
    }

    /**
     * Recompute the `symbols` entry for `qualifiedName` from every known fragment's
     * importTargets/filterConditions/metadataAnnotations/viewFilters/documentation,
     * so anything declared in any one file of a multi-file package is visible
     * regardless of which fragment happens to be canonical -- a reopened package is
     * one semantic namespace, so a `doc`, `#annotation`, or view `filter` on one
     * fragment's own `package P { ... }` declaration belongs to the same element as
     * another fragment's, not to a competing one that only the "canonical" fragment
     * gets credit for. Builds a fresh merged *copy* rather than writing the merge
     * back into one fragment's own symbol object -- mutating a fragment in place
     * would corrupt its own (otherwise pristine) data, so a later re-merge after
     * another fragment is edited or removed would keep including data that no
     * longer exists anywhere (it'd have leaked into whichever fragment got mutated
     * last, and stayed there even after the fragment that actually declared it was
     * gone).
     */
    private mergePackageFragments(qualifiedName: string): void {
        const fragments = this.packageFragmentsByQualifiedName.get(qualifiedName);
        if (!fragments || fragments.size === 0) return;

        const importTargets: ImportTarget[] = [];
        const filterConditions: FilterExpr[] = [];
        const metadataAnnotations: string[] = [];
        const viewFilters: string[] = [];
        let documentation: string | undefined;
        for (const fragment of fragments.values()) {
            if (fragment.importTargets) importTargets.push(...fragment.importTargets);
            if (fragment.filterConditions) filterConditions.push(...fragment.filterConditions);
            if (fragment.metadataAnnotations) metadataAnnotations.push(...fragment.metadataAnnotations);
            if (fragment.viewFilters) viewFilters.push(...fragment.viewFilters);
            // A package's own `documentation` is a single string field (matching
            // `extractDocumentation`'s existing "first doc block found" semantics
            // within one file); across fragments, keep the first one found rather
            // than concatenating, for the same reason -- just don't let a fragment
            // with no doc of its own silently blank out one an earlier fragment did have.
            if (!documentation && fragment.documentation) documentation = fragment.documentation;
        }

        // Identity/location fields (range, uri, ...) come from whichever fragment is
        // last in the map's insertion order -- matches the previous "most recently
        // registered fragment is canonical" behavior; re-registering an already-known
        // uri does not change its position, so an edit doesn't shuffle this.
        const template = [...fragments.values()].at(-1)!;
        const merged: SysMLSymbol = {
            ...template,
            importTargets: importTargets.length > 0 ? importTargets : undefined,
            filterConditions: filterConditions.length > 0 ? filterConditions : undefined,
            metadataAnnotations: metadataAnnotations.length > 0 ? metadataAnnotations : undefined,
            viewFilters: viewFilters.length > 0 ? viewFilters : undefined,
            documentation,
        };
        this.symbols.set(qualifiedName, merged);

        // If this qualifiedName is also in conflict with an incompatible-kind
        // sibling, any package-kind entry already in that conflict set is a
        // stale pre-merge snapshot (registerSymbol records `existing`/`symbol`
        // as they were *before* this merge runs) -- replace it with `merged`,
        // or getAllSymbols() would surface both as if they were two separate
        // declarations of the same package.
        const conflictSet = this.conflictedSymbolsByQualifiedName.get(qualifiedName);
        if (conflictSet) {
            for (const sym of [...conflictSet]) {
                if (sym.kind === SysMLElementKind.Package) conflictSet.delete(sym);
            }
            conflictSet.add(merged);
        }
    }

    /**
     * Drop `uri`'s own fragment of package `qualifiedName` (on document edit/close)
     * and recompute the merged `symbols` entry from whatever fragments remain;
     * if none remain, drop the package entirely -- unless a conflicting
     * non-package symbol (see `conflictedSymbolsByQualifiedName`) is still
     * registered under the same qualifiedName, in which case that symbol is
     * the correct entry to leave behind, the mirror image of
     * `unregisterPlainSymbol`'s own fallback to a remaining package.
     * Call this *before* `removeFromConflictTracking` -- the fallback below
     * reads `conflictedSymbolsByQualifiedName` and needs to see the full
     * remaining set (the package fragment just removed here is excluded
     * explicitly, since conflict-tracking hasn't pruned it out yet).
     */
    private unregisterPackageFragment(qualifiedName: string, uri: string): void {
        const fragments = this.packageFragmentsByQualifiedName.get(qualifiedName);
        const removedFragment = fragments?.get(uri);
        fragments?.delete(uri);
        if (fragments && fragments.size > 0) {
            this.mergePackageFragments(qualifiedName);
        } else {
            this.packageFragmentsByQualifiedName.delete(qualifiedName);
            if (this.symbols.get(qualifiedName)?.kind === SysMLElementKind.Package) {
                const remainingConflicts = [...(this.conflictedSymbolsByQualifiedName.get(qualifiedName) ?? [])]
                    .filter(s => s !== removedFragment);
                if (remainingConflicts.length > 0) {
                    this.symbols.set(qualifiedName, remainingConflicts.at(-1)!);
                } else {
                    this.symbols.delete(qualifiedName);
                }
            }
        }
    }

    /**
     * Remove `sym` from `conflictedSymbolsByQualifiedName` (on document
     * edit/close), and drop the whole conflict entry once fewer than two
     * same-kind symbols remain under that qualifiedName -- an edit that
     * resolves a naming conflict (e.g. renaming one of the clashing
     * declarations) must stop being reported as one. Call this *after*
     * `unregisterPlainSymbol`/`unregisterPackageFragment`, whose own
     * `symbols`-re-pointing fallback needs `sym` still present in the set
     * to correctly exclude just itself, not the whole bookkeeping entry.
     */
    private removeFromConflictTracking(sym: SysMLSymbol, qualifiedName: string): void {
        const conflictSet = this.conflictedSymbolsByQualifiedName.get(qualifiedName);
        if (!conflictSet) return;
        if (sym.kind === SysMLElementKind.Package) {
            // The conflict set tracks the package side by its *merged*
            // representative object (see `mergePackageFragments`), never the
            // same object identity as any raw per-uri fragment (`sym` here)
            // -- `conflictSet.delete(sym)` would silently no-op, leaving a
            // permanently stale merged object behind once the package's
            // last fragment is gone. Only clean it up once no fragments
            // remain at all: if some still do, `mergePackageFragments`
            // (called by `unregisterPackageFragment` just before this) has
            // already refreshed the conflict set with the current merged
            // view, which removing by kind here would wrongly undo.
            if (!this.packageFragmentsByQualifiedName.has(qualifiedName)) {
                for (const s of [...conflictSet]) {
                    if (s.kind === SysMLElementKind.Package) conflictSet.delete(s);
                }
            }
        } else {
            conflictSet.delete(sym);
        }
        const remaining = [...conflictSet];
        if (remaining.length <= 1 || remaining.every(s => s.kind === SysMLElementKind.Package)) {
            this.conflictedSymbolsByQualifiedName.delete(qualifiedName);
        }
    }

    /**
     * Remove a non-package symbol (on document edit/close). Only touches
     * `symbols`' entry for its qualifiedName if `sym` is actually the symbol
     * currently stored there -- during a naming conflict (see
     * `conflictedSymbolsByQualifiedName`), `sym` may be the one that lost an
     * earlier last-write-wins race, in which case `symbols` already holds a
     * different, still-valid symbol that removing `sym` must not disturb.
     *
     * When `sym` *is* the current entry, don't just delete it: the conflict
     * can resolve back down to "just a legitimately-reopened package" (this
     * removal was the non-package side of it) or to one remaining same-kind
     * symbol, either of which is the correct entry to leave behind, the same
     * way it would be if the conflict had never existed. Call this *before*
     * `removeFromConflictTracking(sym)` -- the fallback below reads
     * `conflictedSymbolsByQualifiedName` and excludes `sym` itself
     * explicitly, since conflict-tracking hasn't pruned it out yet.
     */
    private unregisterPlainSymbol(sym: SysMLSymbol, qualifiedName: string): void {
        if (this.symbols.get(qualifiedName) !== sym) return;

        const packageFragments = this.packageFragmentsByQualifiedName.get(qualifiedName);
        if (packageFragments && packageFragments.size > 0) {
            this.mergePackageFragments(qualifiedName);
            return;
        }
        const remainingConflicts = [...(this.conflictedSymbolsByQualifiedName.get(qualifiedName) ?? [])]
            .filter(s => s !== sym);
        if (remainingConflicts.length > 0) {
            this.symbols.set(qualifiedName, remainingConflicts.at(-1)!);
            return;
        }
        this.symbols.delete(qualifiedName);
    }

    private registerSymbol(symbol: SysMLSymbol, uri: string, scope: Scope): void {
        // A symbol without a qualified name is found by its symbol ID only, so a
        // declared name, however it is quoted, never collides with it.
        if (symbol.qualifiedName === undefined) {
            this.unqualifiedSymbols.add(symbol);
        } else {
            this.registerNamedSymbol(symbol, symbol.qualifiedName, uri);
        }
        this.indexSymbol(symbol, uri, scope);
    }

    /** Register a declared symbol in `symbols`, tracking conflicts and package fragments. */
    private registerNamedSymbol(symbol: SysMLSymbol, qualifiedName: string, uri: string): void {
        const existing = this.symbols.get(qualifiedName);
        const bothPackages = symbol.kind === SysMLElementKind.Package && existing?.kind === SysMLElementKind.Package;
        if (existing && existing !== symbol && !bothPackages) {
            let conflictSet = this.conflictedSymbolsByQualifiedName.get(qualifiedName);
            if (!conflictSet) {
                conflictSet = new Set();
                this.conflictedSymbolsByQualifiedName.set(qualifiedName, conflictSet);
            }
            conflictSet.add(existing);
            conflictSet.add(symbol);
        }
        this.symbols.set(qualifiedName, symbol);
        if (symbol.kind === SysMLElementKind.Package) {
            let fragments = this.packageFragmentsByQualifiedName.get(qualifiedName);
            if (!fragments) {
                fragments = new Map();
                this.packageFragmentsByQualifiedName.set(qualifiedName, fragments);
            }
            fragments.set(uri, symbol);
            this.mergePackageFragments(qualifiedName);
        }
    }

    /** Add a symbol to the per-URI, name, position and type-name indexes and to `scope`. */
    private indexSymbol(symbol: SysMLSymbol, uri: string, scope: Scope): void {
        // Invalidate cached array
        this.allSymbolsCache = undefined;
        const uriSymbols = this.symbolsByUri.get(uri) ?? [];
        uriSymbols.push(symbol);
        this.symbolsByUri.set(uri, uriSymbols);
        // Maintain name index -- an anonymous element's declaration is not a name to look up
        if (!isAnonymous(symbol)) {
            const nameList = this.symbolsByName.get(symbol.name) ?? [];
            nameList.push(symbol);
            this.symbolsByName.set(symbol.name, nameList);
        }
        // Maintain position-sorted index (insertion sort — symbols arrive
        // in document order so this is nearly always an append → O(1) amortized)
        const posList = this.symbolsByPosition.get(uri) ?? [];
        const startLine = symbol.selectionRange.start.line;
        const startChar = symbol.selectionRange.start.character;
        // Fast path: append if new symbol is after the last one
        if (
            posList.length === 0 ||
            startLine > posList[posList.length - 1].selectionRange.start.line ||
            (startLine === posList[posList.length - 1].selectionRange.start.line &&
                startChar >= posList[posList.length - 1].selectionRange.start.character)
        ) {
            posList.push(symbol);
        } else {
            // Binary search for insertion point
            let lo = 0, hi = posList.length;
            while (lo < hi) {
                const mid = (lo + hi) >>> 1;
                const mr = posList[mid].selectionRange.start;
                if (mr.line < startLine || (mr.line === startLine && mr.character < startChar)) {
                    lo = mid + 1;
                } else {
                    hi = mid;
                }
            }
            posList.splice(lo, 0, symbol);
        }
        this.symbolsByPosition.set(uri, posList);
        // Maintain reverse type-name reference index
        for (const tn of symbol.typeNames) {
            const refList = this.typeNameRefs.get(tn) ?? [];
            refList.push(symbol);
            this.typeNameRefs.set(tn, refList);
        }
        if (!isAnonymous(symbol)) scope.define(symbol);
    }


    /**
     * Get the parser rule name from a context (e.g., "packageDeclaration").
     */
    private getRuleName(ctx: ParserRuleContext): string {
        const idx = ctx.ruleIndex;
        if (idx >= 0 && idx < SysMLv2Parser.ruleNames.length) {
            return SysMLv2Parser.ruleNames[idx];
        }
        // Fallback (should never happen)
        const ctorName = ctx.constructor.name;
        if (ctorName.endsWith('Context')) {
            return ctorName.slice(0, -'Context'.length);
        }
        return ctorName;
    }
    /**
     * Try to extract a SysMLSymbol from a parse tree context. Returns undefined
     * if it isn't a declaration, or is an anonymous one with no declaration to identify it by.
     */
    private tryExtractSymbol(
        ctx: ParserRuleContext,
        uri: string,
        ruleName: string,
        owner: SysMLSymbol | undefined,
    ): SysMLSymbol | undefined {
        // Map rule names to SysML element kinds
        const kind = this.inferKind(ruleName, ctx);
        if (kind === undefined) {
            return undefined;
        }
        // `verify r;` outside a requirement body: the parser drops `verify` and
        // reads `r;` as a usage without a kind keyword, which was never declared.
        if (ctx.ruleIndex === SysMLv2Parser.RULE_defaultReferenceUsage && this.followsSkippedTokens(ctx)) {
            return undefined;
        }

        const range = contextToRange(ctx);
        const transition = kind === SysMLElementKind.TransitionUsage
            ? this.extractTransitionDetails(ctx)
            : undefined;
        const flowDetails = isFlowUsage(kind)
            ? this.extractFlowDetails(ctx)
            : undefined;

        const effectiveName = this.effectiveNames?.get(rangeKey(range));
        const declaredName = effectiveName ? effectiveName.name
            : transition ? transition.declaredName : this.extractName(ctx);
        // An anonymous transition, flow, connection, interface or allocation usage still gets a
        // symbol, with an empty name and its declaration (`anonymousDeclaration`); without a
        // declared name, only an element with a declaration to identify it by gets one.
        const declaration = declaredName ? undefined : this.anonymousDeclaration(ctx, kind, transition);
        const specializationPart = declaration === undefined ? undefined
            : this.findOwnHeaderRule(ctx, SysMLv2Parser.RULE_featureSpecializationPart)
                ?? this.findOwnHeaderRule(ctx, SysMLv2Parser.RULE_subclassificationPart);
        if (!declaredName && declaration === undefined) {
            return undefined;
        }
        const anonymous = !declaredName;
        const name = declaredName ?? '';
        // Transitions never carry a declared <shortName> alias.
        const shortName = effectiveName ? effectiveName.shortName
            : transition || (isFlowUsage(kind) && !declaredName)
                ? undefined
                : this.extractShortName(ctx);

        // KerML: only an element that is named, like all its owners, has a qualified name.
        const qualifiedName = anonymous || (owner && owner.qualifiedName === undefined)
            ? undefined
            : owner ? `${owner.qualifiedName}::${joinQualifiedName([name])}` : joinQualifiedName([name]);

        // An anonymous element has no name to select: its first token (`connect`, `transition`, ...)
        // stands for it, never a name in its declaration that refers to another element.
        const selectionRange = anonymous
            ? (ctx.start ? tokenToRange(ctx.start) : range)
            : this.extractNameRange(ctx) ?? range;
        // Extract type names for both usages (typing) and definitions (specialization)
        const typeNames = isFlowUsage(kind)
            ? this.extractFlowTypeNames(ctx)
            : transition
                ? this.extractTransitionTypeNames(ctx)
                : this.extractTypeNames(ctx);
        const specializationNames = this.extractSpecializationNames(ctx);
        const redefinitions = this.findRedefinitions(ctx);
        const namingReference = anonymous ? undefined : this.namingReference(ctx, kind)?.getText();
        const typeName = typeNames[0];
        const documentation = this.extractDocumentation(ctx);
        const visibility = this.extractVisibility(ctx);
        const featureValue = this.extractFeatureValue(ctx);
        const prefixKeywords = this.extractPrefixKeywords(ctx);
        // Only extract multiplicity for usages
        const { multiplicity, multiplicityRange } = isUsageKind(kind) ? this.extractMultiplicity(ctx) : {};
        // Extract prefix metadata annotations (#name)
        const metadataAnnotations = this.extractPrefixMetadataAnnotations(ctx);
        // Extract expose targets, filters, and rendering for view usages/definitions
        const isView = kind === SysMLElementKind.ViewUsage || kind === SysMLElementKind.ViewDef;
        const isPackage = kind === SysMLElementKind.Package;
        const isAction = kind === SysMLElementKind.ActionDef || kind === SysMLElementKind.ActionUsage;
        const exposeTargets = isView ? this.extractExposeTargets(ctx) : undefined;
        const viewFilters = (isView || isPackage) ? this.extractViewFilters(ctx) : undefined;
        const viewRendering = isView ? this.extractViewRendering(ctx) : undefined;
        const controlFlows = isAction ? this.extractControlFlows(ctx) : undefined;
        // §7.5.1: definitions and usages are namespaces too, so their own
        // body can contain `import` statements, not just a package's --
        // `filter` (§7.5.4), by contrast, is grammar-restricted to package
        // bodies only (`elementFilterMember` is a `packageBodyElement`
        // alternative, with no equivalent in `definitionBodyItem`).
        const importTargets = (isPackage || isDefinition(kind) || isUsageKind(kind)) ? this.extractImportTargets(ctx, kind) : undefined;
        const filterConditions = isPackage ? this.extractPackageFilterConditions(ctx) : undefined;

        return {
            name,
            declaration,
            specialization: specializationPart && this.declarationText(specializationPart),
            ends: this.extractConnectorEnds(ctx, kind),
            // A placeholder: the document's symbol IDs are assigned at the end of `build` (`IdRegistry`).
            symbolId: '',
            shortName,
            kind,
            qualifiedName,
            range,
            selectionRange,
            uri,
            typeName,
            typeNames,
            specializationNames,
            redefinedFeatureTargets: redefinitions.length > 0 ? redefinitions.map(target => target.getText()) : undefined,
            redefinedFeatureTargetRanges: redefinitions.length > 0 ? redefinitions.map(contextToRange) : undefined,
            namingReference,
            documentation,
            visibility,
            featureValue,
            prefixKeywords: prefixKeywords.length > 0 ? prefixKeywords : undefined,
            source: transition?.source,
            target: transition?.target,
            flowDetails,
            transitionTrigger: transition?.trigger,
            controlFlows: controlFlows && controlFlows.length > 0 ? controlFlows : undefined,
            children: [],
            multiplicity,
            multiplicityRange,
            metadataAnnotations: metadataAnnotations.length > 0 ? metadataAnnotations : undefined,
            exposeTargets: exposeTargets && exposeTargets.length > 0 ? exposeTargets : undefined,
            viewFilters: viewFilters && viewFilters.length > 0 ? viewFilters : undefined,
            viewRendering: viewRendering || undefined,
            importTargets: importTargets && importTargets.length > 0 ? importTargets : undefined,
            filterConditions: filterConditions && filterConditions.length > 0 ? filterConditions : undefined,
        };
    }

    /**
     * Whether the token right before `ctx` was skipped by the parser to
     * recover from a syntax error (an error node), so that `ctx` is the rest
     * of an invalid statement rather than a declaration of its own.
     */
    private followsSkippedTokens(ctx: ParserRuleContext): boolean {
        for (let node: ParserRuleContext = ctx; node.parent; node = node.parent) {
            const siblings = node.parent.children;
            for (let i = siblings.indexOf(node) - 1; i >= 0; i--) {
                const last = this.lastLeaf(siblings[i]);
                if (last) return last instanceof ErrorNode;
            }
        }
        return false;
    }

    /** The last token node of `tree`, if it has any. */
    private lastLeaf(tree: ParseTree): TerminalNode | undefined {
        if (tree instanceof TerminalNode) return tree;
        if (!(tree instanceof ParserRuleContext)) return undefined;
        for (let i = tree.children.length - 1; i >= 0; i--) {
            const leaf = this.lastLeaf(tree.children[i]);
            if (leaf) return leaf;
        }
        return undefined;
    }

    /**
     * Infer the SysML element kind from the ANTLR rule index.
     * Uses a pre-built Map for O(1) lookup — no string allocation.
     */
    private inferKind(
        _ruleName: string,
        ctx: ParserRuleContext,
    ): SysMLElementKind | undefined {
        return RULE_INDEX_TO_KIND.get(ctx.ruleIndex);
    }

    /** Extract a transition's declaration name, source, target, and accepter. */
    private extractTransitionDetails(ctx: ParserRuleContext): {
        declaredName?: string;
        source?: string;
        target?: string;
        trigger?: string;
    } {
        let declaredName: string | undefined;
        let source: string | undefined;
        let target: string | undefined;
        let trigger: string | undefined;

        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (!(child instanceof ParserRuleContext)) continue;

            if (child.ruleIndex === SysMLv2Parser.RULE_usageDeclaration) {
                declaredName = this.findRuleText(
                    child,
                    SysMLv2Parser.RULE_identification,
                );
            } else if (child.ruleIndex === SysMLv2Parser.RULE_featureChainMember) {
                source = this.cleanTransitionText(child.getText());
            } else if (child.ruleIndex === SysMLv2Parser.RULE_transitionSuccessionMember) {
                target = this.findRuleText(
                    child,
                    SysMLv2Parser.RULE_ownedReferenceSubsetting,
                );
            } else if (child.ruleIndex === SysMLv2Parser.RULE_triggerActionMember) {
                trigger = this.findRuleText(
                    child,
                    SysMLv2Parser.RULE_payloadParameterMember,
                );
            }
        }

        return { declaredName, source, target, trigger };
    }

    /** Extract the payload type and both endpoint paths from a flow declaration. */
    private extractFlowDetails(ctx: ParserRuleContext): SysMLSymbol['flowDetails'] {
        const declaration = this.flowDeclarationOf(ctx);
        if (!declaration) return undefined;

        // A flow's ends, or a message's source and target events.
        const flowEnds: ParserRuleContext[] = [];
        this.collectDescendantRules(declaration, SysMLv2Parser.RULE_flowEndMember, flowEnds);
        this.collectDescendantRules(declaration, SysMLv2Parser.RULE_messageEventMember, flowEnds);
        const endpoints = flowEnds.map((end) => {
            const flowEnd = this.findOwnHeaderRule(end, SysMLv2Parser.RULE_flowEnd)
                ?? this.findOwnHeaderRule(end, SysMLv2Parser.RULE_messageEvent);
            return flowEnd ? this.cleanTransitionText(flowEnd.getText()) : undefined;
        });

        const payload = this.findOwnHeaderRule(declaration, SysMLv2Parser.RULE_payloadFeatureMember)
            ?? this.findOwnHeaderRule(declaration, SysMLv2Parser.RULE_flowPayloadFeatureMember);
        const payloadTypes = payload ? this.extractPayloadTypeNames(payload) : [];
        const identification = payload
            ? this.findRuleContext(payload, SysMLv2Parser.RULE_identification)
            : undefined;
        const qualifiedName = payload
            ? this.findRuleContext(payload, SysMLv2Parser.RULE_qualifiedName)
            : undefined;
        const itemType = payloadTypes[0]
            ?? (!identification && qualifiedName ? this.cleanTransitionText(qualifiedName.getText()) : undefined);

        return {
            itemType,
            payloadDeclared: payload !== undefined,
            source: endpoints[0],
            target: endpoints[1],
        };
    }

    /**
     * A flow payload's own types (8.2.2.16 `PayloadFeature`), as written: its typings only, never a
     * feature it subsets or redefines.
     */
    private extractPayloadTypeNames(payload: ParserRuleContext): string[] {
        const typings: ParserRuleContext[] = [];
        this.collectDescendantRules(payload, SysMLv2Parser.RULE_ownedFeatureTyping, typings);
        const names: string[] = [];
        for (const typing of typings) this.collectQualifiedTypeNames(typing, names);
        return names;
    }

    /** A flow usage's own declaration: a flow's `flowDeclaration` or a message's `messageDeclaration`. */
    private flowDeclarationOf(ctx: ParserRuleContext): ParserRuleContext | undefined {
        for (const ruleIndex of FLOW_DECLARATION_RULE_INDICES) {
            const declaration = this.findOwnHeaderRule(ctx, ruleIndex);
            if (declaration) return declaration;
        }
        return undefined;
    }

    /** Extract the flow feature's own declared type without including its payload type. */
    private extractFlowTypeNames(ctx: ParserRuleContext): string[] {
        const declaration = this.flowDeclarationOf(ctx);
        const typeDeclaration = declaration && (
            this.findOwnHeaderRule(declaration, SysMLv2Parser.RULE_featureDeclaration)
            ?? this.findOwnHeaderRule(declaration, SysMLv2Parser.RULE_usageDeclaration)
        );
        return typeDeclaration ? this.extractTypeNames(typeDeclaration) : [];
    }

    /**
     * A transition's own typing, then the types of the payload its trigger
     * accepts (`accept cmd : Command`, `accept Command`; TriggerAction ->
     * AcceptParameterPart -> PayloadParameter). Read from the parse tree only:
     * the regex fallback of `extractTypeNames` runs on whitespace-free text, where
     * the payload type runs into the guard, effect or target that follows it
     * (`Commandifcmd`, `Commandthenbusy`).
     */
    private extractTransitionTypeNames(ctx: ParserRuleContext): string[] {
        const names: string[] = [];
        this.collectTypeNamesFromTree(ctx, names, 0);
        const trigger = this.findOwnHeaderRule(ctx, SysMLv2Parser.RULE_triggerActionMember);
        const parameter = trigger && this.findRuleContext(trigger, SysMLv2Parser.RULE_payloadParameter);
        if (parameter) {
            const payload = this.findRuleContext(parameter, SysMLv2Parser.RULE_payloadFeature) ?? parameter;
            this.collectTypeNamesFromTree(payload, names, 0);
        }
        return names;
    }

    /** Find the first descendant of `ctx` with rule `ruleIndex`, in source order. */
    private findRuleContext(ctx: ParserRuleContext, ruleIndex: number): ParserRuleContext | undefined {
        const matches: ParserRuleContext[] = [];
        this.collectDescendantRules(ctx, ruleIndex, matches);
        return matches[0];
    }

    /** Find and clean the text of the first descendant with a given rule. */
    private findRuleText(ctx: ParserRuleContext, ruleIndex: number): string | undefined {
        if (ctx.ruleIndex === ruleIndex) {
            return this.cleanTransitionText(ctx.getText());
        }
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (child instanceof ParserRuleContext) {
                const text = this.findRuleText(child, ruleIndex);
                if (text) return text;
            }
        }
        return undefined;
    }

    /** Remove SysML quoting while retaining qualified and dotted references. */
    private cleanTransitionText(text: string): string | undefined {
        const cleaned = text.replace(/'(?:\\.|[^'\\])*'/g,
            name => joinQualifiedName([decodeName(name)])).trim();
        return cleaned || undefined;
    }

    /** Extract explicit first/then successions owned by an action body. */
    private extractControlFlows(
        ctx: ParserRuleContext,
    ): { source: string; target: string; guard?: string }[] {
        const flows: { source: string; target: string; guard?: string }[] = [];
        const seen = new Set<string>();

        const addFlow = (source?: string, target?: string, guard?: string): void => {
            if (!source || !target || source === target) return;
            const key = `${source}->${target}:${guard ?? ''}`;
            if (seen.has(key)) return;
            seen.add(key);
            flows.push({ source, target, ...(guard ? { guard } : {}) });
        };

        const visit = (node: ParserRuleContext, isRoot = false): void => {
            // A nested action owns its own successions.
            if (!isRoot && (
                node.ruleIndex === SysMLv2Parser.RULE_actionDefinition ||
                node.ruleIndex === SysMLv2Parser.RULE_actionUsage
            )) return;

            if (node.ruleIndex === SysMLv2Parser.RULE_successionAsUsage) {
                const endpoints: string[] = [];
                this.collectRuleTexts(
                    node,
                    SysMLv2Parser.RULE_ownedReferenceSubsetting,
                    endpoints,
                );
                addFlow(endpoints[0], endpoints[1]);
                return;
            }

            if (node.ruleIndex === SysMLv2Parser.RULE_guardedSuccession) {
                const source = this.findRuleText(node, SysMLv2Parser.RULE_featureChainMember);
                const target = this.findRuleText(
                    node,
                    SysMLv2Parser.RULE_ownedReferenceSubsetting,
                );
                const guard = this.findRuleText(node, SysMLv2Parser.RULE_guardExpressionMember);
                addFlow(source, target, guard?.replace(/^if/, ''));
                return;
            }

            for (let i = 0; i < node.getChildCount(); i++) {
                const child = node.getChild(i);
                if (child instanceof ParserRuleContext) visit(child);
            }
        };

        visit(ctx, true);
        return flows;
    }

    /** Collect cleaned text from every descendant matching a grammar rule. */
    private collectRuleTexts(
        ctx: ParserRuleContext,
        ruleIndex: number,
        result: string[],
    ): void {
        if (ctx.ruleIndex === ruleIndex) {
            const text = this.cleanTransitionText(ctx.getText());
            if (text) result.push(text);
            return;
        }
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (child instanceof ParserRuleContext) {
                this.collectRuleTexts(child, ruleIndex, result);
            }
        }
    }

    /**
     * Extract the declared name from a parse tree context.
     * Looks for an IDENT token or a name/identification sub-rule.
     */
    private extractName(ctx: ParserRuleContext): string | undefined {
        // A definition or usage may be anonymous (`part : P;`, `connect a.p to
        // b.p;`), where the first identifier below it names its type, a feature
        // it subsets or an end, not the element itself. Its name comes from its
        // own declaration only; without one, it is anonymous, and the symbol
        // builder keeps its declaration instead (`anonymousDeclaration`).
        const kind = RULE_INDEX_TO_KIND.get(ctx.ruleIndex);
        if (kind !== undefined && (isDefinition(kind) || isUsageKind(kind))) {
            return this.extractOwnName(ctx, kind);
        }

        // Walk children looking for a name-producing rule or IDENT token
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);

            // Direct terminal (identifier token or quoted name)
            if (child instanceof TerminalNode) {
                const token = child.symbol;
                // Skip keywords — we want identifier tokens only
                if (this.isNameTerminal(child)) {
                    return this.unquoteName(token.text ?? '');
                }
            }

            // Check child rules named 'identification', 'declarationUsageName', etc.
            if (child instanceof ParserRuleContext) {
                if (child.ruleIndex === SysMLv2Parser.RULE_identification) {
                    // `identification: LT name GT name | LT name GT | name` — the
                    // declared name is the long name when present, else the
                    // <shortName> alias itself; never their concatenation.
                    const name = this.parseIdentification(child).name;
                    if (name) return name;
                } else if (NAME_RULE_INDICES.has(child.ruleIndex)) {
                    const name = this.extractTextFromSubtree(child);
                    if (name) return name;
                }
            }
        }

        // Fallback: look deeper for any identifier in the first few children.
        // Skip prefix/extension contexts — they contain metadata annotation
        // identifiers (e.g. #product) which are not the element's own name.
        for (let i = 0; i < Math.min(ctx.getChildCount(), 5); i++) {
            const child = ctx.getChild(i);
            if (child instanceof ParserRuleContext) {
                if (this.isPrefixOrExtensionContext(child)) continue;
                const name = this.extractName(child);
                if (name) return name;
            }
        }

        return undefined;
    }

    /**
     * The declaration (`SysMLSymbol.declaration`) of a definition or usage
     * without a declared name, as written; its name is empty and it is
     * identified by its `symbolId`. Undefined, so no symbol, for any other
     * element and for an untyped transition without a source and target
     * state. A reference usage's may be empty, `{ ... }` or a lone `;`
     * (8.2.2.2, 8.2.2.6.2-8.2.2.6.3), and still gives it a symbol.
     */
    private anonymousDeclaration(
        ctx: ParserRuleContext,
        kind: SysMLElementKind,
        transition: { source?: string; target?: string } | undefined,
    ): string | undefined {
        if (!isDefinition(kind) && !isUsageKind(kind)) return undefined;
        if (transition && !(transition.source && transition.target) && this.extractTransitionTypeNames(ctx).length === 0) return undefined;
        const declaration = this.declarationText(ctx);
        return kind === SysMLElementKind.RefUsage ? declaration ?? '' : declaration;
    }

    /**
     * A definition's or usage's name: the one it declares itself, else the
     * name of its naming feature (KerML/SysML effective name, 7.6.5) -- the
     * element it performs, exhibits or includes (8.3.17.14), the usage a
     * variant reference names (8.3.6.4), or the feature it redefines.
     * Undefined when it has neither, i.e. when it is anonymous.
     */
    private extractOwnName(ctx: ParserRuleContext, kind: SysMLElementKind): string | undefined {
        // A flow in the feature form (`flow f : F of ...`) names itself in a featureIdentification.
        const identification = this.findOwnHeaderRule(ctx, SysMLv2Parser.RULE_identification)
            ?? this.findOwnHeaderRule(ctx, SysMLv2Parser.RULE_featureIdentification);
        const declaredName = identification && this.parseIdentification(identification).name;
        if (declaredName) return declaredName;

        const namingFeature = this.namingReference(ctx, kind) ?? this.findOwnHeaderRule(ctx, SysMLv2Parser.RULE_ownedRedefinition);
        return namingFeature ? this.lastNameSegment(namingFeature) : undefined;
    }

    /**
     * The reference a usage without a declared name is named after: the element
     * it performs, exhibits or includes (8.3.17.14), or the usage a variant
     * reference names (8.3.6.4). Undefined for any other usage.
     */
    private namingReference(ctx: ParserRuleContext, kind: SysMLElementKind): ParserRuleContext | undefined {
        if (!PERFORMING_USAGE_KINDS.has(kind) && ctx.ruleIndex !== SysMLv2Parser.RULE_variantReference) return undefined;
        const identification = this.findOwnHeaderRule(ctx, SysMLv2Parser.RULE_identification);
        if (identification && this.parseIdentification(identification).name) return undefined;
        return this.findOwnHeaderRule(ctx, SysMLv2Parser.RULE_ownedReferenceSubsetting);
    }

    /**
     * The first node of rule `ruleIndex` in `ctx`'s own declaration: never
     * inside a nested element, its body, its value, a flow's payload or ends,
     * a connector end's own multiplicity (`connect [2] a to b`), or a prefix
     * such as `#metadata`.
     */
    private findOwnHeaderRule(ctx: ParserRuleContext, ruleIndex: number): ParserRuleContext | undefined {
        const matches: ParserRuleContext[] = [];
        this.findOwnHeaderRules(ctx, ruleIndex, matches, true);
        return matches[0];
    }

    private findOwnHeaderRules(
        ctx: ParserRuleContext,
        ruleIndex: number,
        matches: ParserRuleContext[],
        firstOnly = false,
    ): void {
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (!(child instanceof ParserRuleContext)) continue;
            if (child.ruleIndex === ruleIndex) {
                matches.push(child);
                if (firstOnly) return;
                continue;
            }
            if (RULE_INDEX_TO_KIND.has(child.ruleIndex) || BODY_RULE_INDICES.has(child.ruleIndex)
                || child.ruleIndex === SysMLv2Parser.RULE_valuePart || FLOW_PART_RULE_INDICES.has(child.ruleIndex)
                || child.ruleIndex === SysMLv2Parser.RULE_ownedCrossMultiplicityMember
                || this.isPrefixOrExtensionContext(child)) continue;
            this.findOwnHeaderRules(child, ruleIndex, matches, firstOnly);
            if (firstOnly && matches.length > 0) return;
        }
    }

    private findRedefinitions(ctx: ParserRuleContext): ParserRuleContext[] {
        const targets: ParserRuleContext[] = [];
        this.findOwnHeaderRules(ctx, SysMLv2Parser.RULE_ownedRedefinition, targets);
        return targets;
    }

    /**
     * A connection, interface or allocation usage's end reference paths, in
     * declaration order, read from its own end part. Undefined for any other
     * element, or one without ends.
     */
    private extractConnectorEnds(ctx: ParserRuleContext, kind: SysMLElementKind): string[] | undefined {
        const endPart = kind === SysMLElementKind.ConnectionUsage || kind === SysMLElementKind.AllocationUsage
            ? this.findOwnHeaderRule(ctx, SysMLv2Parser.RULE_connectorPart)
            : kind === SysMLElementKind.InterfaceUsage
                ? this.findOwnHeaderRule(ctx, SysMLv2Parser.RULE_interfacePart)
                : undefined;
        if (!endPart) return undefined;
        const references: ParserRuleContext[] = [];
        this.collectDescendantRules(endPart, SysMLv2Parser.RULE_ownedReferenceSubsetting, references);
        return references.length > 0 ? references.map((reference) => reference.getText()) : undefined;
    }

    /** Every outermost node of rule `ruleIndex` below `ctx`, in source order, into `out`. */
    private collectDescendantRules(ctx: ParserRuleContext, ruleIndex: number, out: ParserRuleContext[]): void {
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (!(child instanceof ParserRuleContext)) continue;
            if (child.ruleIndex === ruleIndex) out.push(child);
            else this.collectDescendantRules(child, ruleIndex, out);
        }
    }

    /** The name of the feature a reference such as `a.b` or `P::a` ends at (`b`, `a`). */
    private lastNameSegment(reference: ParserRuleContext): string | undefined {
        return lastSegmentName(reference.getText());
    }

    private declarationTokens(ctx: ParserRuleContext): Token[] {
        const tokens: Token[] = [];
        const visit = (node: ParserRuleContext): boolean => {
            for (let i = 0; i < node.getChildCount(); i++) {
                const child = node.getChild(i);
                if (child instanceof TerminalNode) {
                    if (child.symbol.type === SysMLv2Lexer.SEMI) return true;
                    tokens.push(child.symbol);
                } else if (child instanceof ParserRuleContext) {
                    if (BODY_RULE_INDICES.has(child.ruleIndex) || visit(child)) return true;
                }
            }
            return false;
        };
        visit(ctx);
        return tokens;
    }

    /**
     * An element's declaration as written, without its body: its tokens up to
     * its body or closing `;`, each exactly as written (a quoted name keeps its
     * spaces), with one space wherever the source has whitespace or a comment
     * between two of them (`connect a.p to b.p`, `connection : Conn`).
     */
    private declarationText(ctx: ParserRuleContext): string | undefined {
        return this.tokensText(this.declarationTokens(ctx));
    }

    /** Every token of `ctx`, in source order: a whole expression, bodies and `;` included. */
    private subtreeTokens(ctx: ParserRuleContext, tokens: Token[] = []): Token[] {
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (child instanceof TerminalNode) {
                if (child.symbol.tokenIndex >= 0) tokens.push(child.symbol);
            } else if (child instanceof ParserRuleContext) this.subtreeTokens(child, tokens);
        }
        return tokens;
    }

    /**
     * Tokens joined as written, with one space wherever the source has
     * whitespace or a comment between two of them.
     */
    private tokensText(tokens: Token[]): string | undefined {
        let text = '';
        tokens.forEach((token, i) => {
            if (i > 0 && token.start > tokens[i - 1].stop + 1) text += ' ';
            text += token.text ?? '';
        });
        return text || undefined;
    }

    /**
     * Splits an `identification` node (`LT name GT name | LT name GT | name`)
     * into its optional `<shortName>` alias and its primary declared name.
     * Without angle brackets the single `name` is the declared name only;
     * with a lone `<shortName>` and no long name, the short name doubles as
     * the declared name (SysML v2 §identification allows referencing either).
     */
    private parseIdentification(ctx: ParserRuleContext): { shortName?: string; name?: string } {
        let hasAngleBrackets = false;
        const nameCtxs: ParserRuleContext[] = [];
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (child instanceof TerminalNode && child.symbol.type === SysMLv2Lexer.LT) {
                hasAngleBrackets = true;
            } else if (child instanceof ParserRuleContext && child.ruleIndex === SysMLv2Parser.RULE_name) {
                nameCtxs.push(child);
            }
        }
        if (!hasAngleBrackets) {
            return { name: nameCtxs[0] ? this.extractTextFromSubtree(nameCtxs[0]) : undefined };
        }
        if (nameCtxs.length >= 2) {
            return {
                shortName: this.extractTextFromSubtree(nameCtxs[0]),
                name: this.extractTextFromSubtree(nameCtxs[1]),
            };
        }
        const shortName = nameCtxs[0] ? this.extractTextFromSubtree(nameCtxs[0]) : undefined;
        return { shortName, name: shortName };
    }

    /**
     * Extract the declared `<shortName>` alias, if any. Mirrors extractName()'s
     * traversal but only cares about an `identification` node's short-name
     * production — reaching a bare `name`/`qualifiedName` rule (no
     * `identification` wrapper) means there is no short name at this level.
     */
    private extractShortName(ctx: ParserRuleContext): string | undefined {
        if (ctx.ruleIndex === SysMLv2Parser.RULE_connectionUsage) {
            for (let i = 0; i < ctx.getChildCount(); i++) {
                const child = ctx.getChild(i);
                if (!(child instanceof ParserRuleContext) ||
                    child.ruleIndex !== SysMLv2Parser.RULE_usageDeclaration) {
                    continue;
                }
                for (let j = 0; j < child.getChildCount(); j++) {
                    const declarationChild = child.getChild(j);
                    if (declarationChild instanceof ParserRuleContext &&
                        declarationChild.ruleIndex === SysMLv2Parser.RULE_identification) {
                        return this.parseIdentification(declarationChild).shortName;
                    }
                }
                return undefined;
            }
            return undefined;
        }

        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (child instanceof ParserRuleContext) {
                if (child.ruleIndex === SysMLv2Parser.RULE_identification) {
                    return this.parseIdentification(child).shortName;
                }
                if (NAME_RULE_INDICES.has(child.ruleIndex)) {
                    return undefined;
                }
            }
        }

        for (let i = 0; i < Math.min(ctx.getChildCount(), 5); i++) {
            const child = ctx.getChild(i);
            if (child instanceof ParserRuleContext) {
                if (this.isPrefixOrExtensionContext(child)) continue;
                if (RULE_INDEX_TO_KIND.has(child.ruleIndex)) continue;
                const shortName = this.extractShortName(child);
                if (shortName) return shortName;
            }
        }

        return undefined;
    }

    /**
     * Extract visibility from the nearest owning membership's MemberPrefix.
     * Visibility is a property of the membership surrounding an element, not
     * a word that may occur anywhere in the element body or documentation.
     */
    private extractVisibility(
        ctx: ParserRuleContext,
    ): 'public' | 'private' | 'protected' | undefined {
        let current: ParserRuleContext | undefined = ctx;

        while (current instanceof ParserRuleContext) {
            for (let i = 0; i < current.getChildCount(); i++) {
                const child = current.getChild(i);
                if (!(child instanceof ParserRuleContext) ||
                    child.ruleIndex !== SysMLv2Parser.RULE_memberPrefix) {
                    continue;
                }

                const visibility = child.getText();
                if (visibility === 'public' ||
                    visibility === 'private' ||
                    visibility === 'protected') {
                    return visibility;
                }
                return undefined;
            }
            current = current.parent instanceof ParserRuleContext
                ? current.parent
                : undefined;
        }

        return undefined;
    }

    /**
     * `ctx`'s own feature value (SysML 7.13.4, 8.2.2.6.2 `ValuePart`, `FeatureValue`):
     * its expression as written, and whether it is a default (`default`) and an
     * initial (`:=`) value. Never a nested element's value; a cross subsetting
     * (`=> x`) is not a value. The expression is the whole `OwnedExpression`,
     * expression bodies included, with whitespace and comments as one space.
     */
    private extractFeatureValue(ctx: ParserRuleContext): SysMLSymbol['featureValue'] {
        const featureValueCtx = this.findOwnValuePart(ctx)?.getRuleContext(0, FeatureValueContext);
        const expression = featureValueCtx?.ownedExpression();
        const text = expression && this.tokensText(this.subtreeTokens(expression));
        if (!featureValueCtx || !text) return undefined;
        return {
            expression: text,
            isDefault: featureValueCtx.DEFAULT() !== null,
            isInitial: featureValueCtx.COLON_EQ() !== null,
        };
    }

    /**
     * `ctx`'s own `ValuePart`: a direct child of its element rule, or of one of
     * its declaration rules (`VALUE_DECLARATION_RULE_INDICES`). Never one of an
     * inline-owned element, e.g. a transition's accept payload or effect action.
     */
    private findOwnValuePart(ctx: ParserRuleContext): ParserRuleContext | undefined {
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (!(child instanceof ParserRuleContext)) continue;
            if (child.ruleIndex === SysMLv2Parser.RULE_valuePart) return child;
            if (!VALUE_DECLARATION_RULE_INDICES.has(child.ruleIndex)) continue;
            const valuePart = this.findOwnValuePart(child);
            if (valuePart) return valuePart;
        }
        return undefined;
    }

    /**
     * The keywords of `ctx`'s own prefix and multiplicity part, in written
     * order (`in`, `abstract`, `constant`, `ref`, `end`, `ordered`, ...),
     * read only from the rules in `PREFIX_PATH_RULE_INDICES`.
     */
    private extractPrefixKeywords(ctx: ParserRuleContext): string[] {
        const keywords: string[] = [];
        const visit = (node: ParserRuleContext): void => {
            for (let i = 0; i < node.getChildCount(); i++) {
                const child = node.getChild(i);
                if (child instanceof TerminalNode) {
                    if (PREFIX_KEYWORD_TOKENS.has(child.symbol.type)) keywords.push(child.getText());
                    continue;
                }
                if (child instanceof ParserRuleContext && PREFIX_PATH_RULE_INDICES.has(child.ruleIndex)) visit(child);
            }
        };
        visit(ctx);
        return this.isEndOccurrence(ctx) ? ['end', ...keywords] : keywords;
    }

    /**
     * Whether `ctx` is the occurrence usage of an `endOccurrenceUsageElement`
     * (`end part a`), whose `end` precedes the usage's own rule.
     */
    private isEndOccurrence(ctx: ParserRuleContext): boolean {
        let current = ctx.parent;
        while (current instanceof ParserRuleContext && OCCURRENCE_USAGE_ELEMENT_RULE_INDICES.has(current.ruleIndex)) {
            current = current.parent;
        }
        return current !== ctx.parent && current instanceof ParserRuleContext
            && current.ruleIndex === SysMLv2Parser.RULE_endOccurrenceUsageElement;
    }

    /**
     * Extract the range of just the name token.
     */
    private extractNameRange(ctx: ParserRuleContext): Range | undefined {
        if (ctx.ruleIndex === SysMLv2Parser.RULE_identification ||
            ctx.ruleIndex === SysMLv2Parser.RULE_featureIdentification) {
            let name: ParserRuleContext | undefined;
            for (let i = 0; i < ctx.getChildCount(); i++) {
                const child = ctx.getChild(i);
                if (child instanceof ParserRuleContext && child.ruleIndex === SysMLv2Parser.RULE_name) {
                    name = child;
                }
            }
            if (name) return contextToRange(name);
        }
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (child instanceof TerminalNode && this.isNameTerminal(child)) {
                return tokenToRange(child.symbol);
            }
            if (child instanceof ParserRuleContext) {
                // Skip prefix/extension contexts that contain annotation
                // identifiers rather than the element's own name.
                if (this.isPrefixOrExtensionContext(child)) continue;
                const result = this.extractNameRange(child);
                if (result) return result;
            }
        }
        return undefined;
    }

    /**
     * Extract a type name from specialization syntax (": TypeName" or ":> TypeName").
     */
    /**
     * Extract all type names from a context.
     * Handles both usage typing (`:` / `defined by`) and definition
     * specialization (`specializes` / `:>`).
     *
     * Examples:
     *   part x : A, B          → ['A', 'B']
     *   part x defined by A, B → ['A', 'B']
     *   part def X specializes A, B → ['A', 'B']
     *   part def X :> A, B     → ['A', 'B']
     */
    private extractTypeNames(ctx: ParserRuleContext): string[] {
        const names: string[] = [];

        // Try structured extraction from the parse tree first.
        // Walk children (recursing into declaration wrappers) looking for
        // specialization / typing rules whose names typically contain
        // "specialization", "typing", "conjugation", "subclassification", etc.
        this.collectTypeNamesFromTree(ctx, names, 0);

        if (names.length > 0) return names;

        // Fallback: regex on the declaration portion only (before '{').
        // This avoids matching types from nested body content.
        const { text: declarationText, quotedName } = this.maskedDeclaration(ctx);
        let text = declarationText;

        // Truncate at SysML keywords that follow a usage declaration but appear
        // concatenated (getText() strips whitespace).  This prevents the regex
        // from greedily matching into connect/bind/first/then/flow/… clauses.
        // e.g. ":BrakeCableconnectfrontLever…" should stop at "connect".
        // Also truncate at redefines/subsets/references which follow a typing
        // and would otherwise be concatenated (e.g. "FuelCmdredefinespwrCmd").
        text = text.replace(RE_KEYWORD_TRUNCATE, '');

        // 1. "specializes A, B" or ":> A, B" (including quoted names)
        const specMatch = text.match(RE_SPEC);
        if (specMatch) {
            const specStr = text.substring(text.indexOf(specMatch[0]) + specMatch[0].indexOf(specMatch[1]));
            for (const part of specStr.split(',')) {
                const quoted = quotedName(part);
                if (quoted !== undefined) { names.push(joinQualifiedName([quoted])); continue; }
                const m = part.trim().match(RE_IDENT_START);
                if (m) names.push(m[1]);
            }
            return names;
        }

        // 2. "definedby A, B" — note getText() strips spaces
        const defByMatch = text.match(RE_DEFINED_BY);
        if (defByMatch) {
            for (const part of defByMatch[1].split(',')) {
                const m = part.trim().match(RE_IDENT_START);
                if (m) names.push(m[1]);
            }
            return names;
        }

        // 3. ": A, B" (typing shorthand, including quoted names)
        const typingMatch = text.match(RE_TYPING);
        if (typingMatch) {
            // Extract from after the colon
            const fullMatchIdx = text.indexOf(typingMatch[0]);
            const afterColon = text.substring(fullMatchIdx + 1).trim();
            for (const part of afterColon.split(',')) {
                const quoted = quotedName(part);
                if (quoted !== undefined) { names.push(joinQualifiedName([quoted])); continue; }
                const m = part.trim().match(RE_IDENT_START);
                if (m) names.push(m[1]);
            }
            return names;
        }

        return names;
    }

    /**
     * The declaration tokens before the value or body, with each lexer STRING token
     * replaced by a numbered placeholder (`'0'`, `'1'`, ...), and
     * `quotedName`, which turns a placeholder in a part of that text back into
     * the name, when it ends the qualified name the part starts with. SysML
     * 2.0 section 7.2.2 permits punctuation in unrestricted names (the STRING
     * lexer production), so fallback regexes must never see their `:`, `:>`,
     * `{` or keywords. Documentation is not a name token.
     */
    private maskedDeclaration(ctx: ParserRuleContext): { text: string; quotedName: (part: string) => string | undefined } {
        const quoted: string[] = [];
        // ValuePart follows FeatureSpecializationPart; its expressions are not type names.
        const valueStart = this.findOwnHeaderRule(ctx, SysMLv2Parser.RULE_valuePart)?.start?.tokenIndex;
        const masked = this.declarationTokens(ctx)
            .filter(token => valueStart === undefined || token.tokenIndex < valueStart)
            .map(token => {
                const text = token.text ?? '';
                return token.type === SysMLv2Lexer.STRING ? `'${quoted.push(decodeName(text)) - 1}'` : text;
            }).join('');
        return {
            text: masked,
            quotedName: (part) => {
                const qm = part.match(RE_QUOTED_NAME);
                return qm ? quoted[Number(qm[1])] : undefined;
            },
        };
    }

    /**
     * Extract only the specialization names (:> / specializes / subsets) from a context.
     * Uses the same tree-walk as extractTypeNames but restricted to
     * TYPE_SPECIALIZATION_RULE_INDICES so that : typing names are excluded.
     * Falls back to a regex path that covers :> / :>> / specializes / subsets.
     */
    private extractSpecializationNames(ctx: ParserRuleContext): string[] {
        const names: string[] = [];
        this.collectNamesFromTree(ctx, names, 0, TYPE_SPECIALIZATION_RULE_INDICES);
        if (names.length > 0) return names;

        // Regex fallback: look for :> / specializes / :>> / subsets.
        // Use the spec-aware truncate variant so that `subsets <name>` is not
        // stripped before we have a chance to match it.
        const { text: declarationText, quotedName } = this.maskedDeclaration(ctx);
        const text = declarationText.replace(RE_KEYWORD_TRUNCATE_SPEC, '');

        const specMatch = text.match(RE_SPEC_WITH_SUBSETS);
        if (specMatch) {
            const specStr = text.substring(text.indexOf(specMatch[0]) + specMatch[0].indexOf(specMatch[1]));
            for (const part of specStr.split(',')) {
                const quoted = quotedName(part);
                if (quoted !== undefined) { names.push(joinQualifiedName([quoted])); continue; }
                const m = part.trim().match(RE_IDENT_START);
                if (m) names.push(m[1]);
            }
        }
        return names;
    }

    /**
     * Recursively walk the parse tree to find typing / specialization rules.
     * Recurses into declaration wrappers (up to maxDepth) so that
     * `interfaceUsage → interfaceUsageDeclaration → usageDeclaration →
     *  featureSpecializationPart → featureSpecialization → typings` is found.
     */
    private collectTypeNamesFromTree(
        ctx: ParserRuleContext,
        names: string[],
        depth: number,
    ): void {
        this.collectNamesFromTree(ctx, names, depth, TYPE_EXTRACTION_RULE_INDICES);
    }

    /**
     * Core recursive tree walker used by both collectTypeNamesFromTree and
     * extractSpecializationNames — parameterised on which extraction rule set to use.
     */
    private collectNamesFromTree(
        ctx: ParserRuleContext,
        names: string[],
        depth: number,
        extractionRules: ReadonlySet<number>,
    ): void {
        if (depth > 6) return; // don't go too deep
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (!(child instanceof ParserRuleContext)) continue;
            const ri = child.ruleIndex;
            if (extractionRules.has(ri)) {
                this.collectQualifiedTypeNames(child, names);
            } else if (
                // Recurse into declaration / part / body wrappers that may
                // contain nested typing rules (but NOT into body rules that
                // contain children — to avoid collecting types from members).
                TYPE_RECURSE_RULE_INDICES.has(ri) ||
                // Also recurse into any rule whose name contains 'declaration'
                // (covers e.g. interfaceUsageDeclaration, usageDeclaration, etc.)
                SysMLv2Parser.ruleNames[ri]?.includes('eclaration')
            ) {
                this.collectNamesFromTree(child, names, depth + 1, extractionRules);
            }
        }
    }

    private collectQualifiedTypeNames(ctx: ParserRuleContext, names: string[]): void {
        if (ctx.ruleIndex === SysMLv2Parser.RULE_qualifiedName) {
            const name = this.extractTextFromSubtree(ctx);
            if (name) names.push(name);
            return;
        }
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (child instanceof ParserRuleContext) this.collectQualifiedTypeNames(child, names);
        }
    }

    /**
     * Extract documentation owned by this element.
     *
     * Descend through structural wrappers, but stop at nested SysML elements
     * so their documentation cannot be attributed to an ancestor.
     */
    private extractDocumentation(ctx: ParserRuleContext): string | undefined {
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (child instanceof ParserRuleContext) {
                if (DOC_RULE_INDICES.has(child.ruleIndex)) {
                    const raw = child.getText();
                    return raw ? this.cleanDocumentationText(raw) : undefined;
                }

                // A mapped child starts a contained element with independent
                // documentation ownership. Do not cross that boundary.
                if (RULE_INDEX_TO_KIND.has(child.ruleIndex)) continue;

                const nested = this.extractDocumentation(child);
                if (nested) return nested;
            }
        }
        return undefined;
    }

    /** Apply the REGULAR_COMMENT processing rules from KerML 8.2.3.3.2. */
    private cleanDocumentationText(raw: string): string {
        const commentStart = raw.indexOf('/*');
        const commentEnd = raw.lastIndexOf('*/');
        if (commentStart < 0 || commentEnd < commentStart + 2) {
            return raw.replace(/^(?:doc|comment)\s*/, '').replace(/^\/\/\s?/, '').trim();
        }

        const body = raw.substring(commentStart + 2, commentEnd);
        const lines = body.split(/\r?\n/);

        // Strip whitespace immediately following the opening delimiter.
        if (lines.length > 0) {
            lines[0] = lines[0].replace(/^\s+/, '');
        }

        // On each subsequent line: strip indentation, then one optional '*',
        // then one optional space, exactly as prescribed by the specification.
        for (let i = 1; i < lines.length; i++) {
            lines[i] = lines[i].replace(/^[^\S\r\n]*/, '');
            if (lines[i].startsWith('*')) lines[i] = lines[i].slice(1);
            if (lines[i].startsWith(' ')) lines[i] = lines[i].slice(1);
        }

        return lines.join('\n').trim();
    }

    /**
     * Extract multiplicity from a context's own declaration, never from a
     * nested element or its body.
     * Returns { multiplicity: "1..5", multiplicityRange: { lower: 1, upper: 5 } }
     */
    private extractMultiplicity(ctx: ParserRuleContext): { multiplicity?: string; multiplicityRange?: { lower: number; upper: number | '*' } } {
        const multCtx = this.findOwnHeaderRule(ctx, SysMLv2Parser.RULE_multiplicityBounds) as MultiplicityBoundsContext | undefined;
        if (!multCtx) {
            return {};
        }

        const members = multCtx.multiplicityExpressionMember();
        if (!members || members.length === 0) {
            return {};
        }

        // Extract values from the expression members
        // Note: We use getText() directly since multiplicity values are numeric literals,
        // not identifiers, so extractTextFromSubtree won't work here.
        const values: string[] = [];
        for (const member of members) {
            // Get raw text and clean it (remove whitespace)
            const rawText = member.getText()?.trim();
            if (rawText) {
                values.push(rawText);
            }
        }

        if (values.length === 0) {
            return {};
        }

        let lower: number;
        let upper: number | '*';
        let multiplicity: string;

        if (values.length === 1) {
            // Single value like [1] or [*]
            multiplicity = values[0];
            if (values[0] === '*') {
                lower = 0;
                upper = '*';
            } else {
                const num = parseInt(values[0], 10);
                if (isNaN(num)) {
                    return { multiplicity };
                }
                lower = num;
                upper = num;
            }
        } else {
            // Range like [1..*] or [2..5]
            multiplicity = `${values[0]}..${values[1]}`;
            lower = parseInt(values[0], 10);
            if (isNaN(lower)) {
                return { multiplicity };
            }
            if (values[1] === '*') {
                upper = '*';
            } else {
                upper = parseInt(values[1], 10);
                if (isNaN(upper)) {
                    return { multiplicity };
                }
            }
        }

        return {
            multiplicity,
            multiplicityRange: { lower, upper },
        };
    }

    /**
     * Whether a context is a prefix metadata or definition/usage prefix rule.
     * These contain annotation identifiers (e.g. from `#product`) that should
     * not be mistaken for the element's own declared name.
     */
    private isPrefixOrExtensionContext(ctx: ParserRuleContext): boolean {
        return PREFIX_EXTENSION_RULE_INDICES.has(ctx.ruleIndex);
    }

    /**
     * Extract prefix metadata annotation names from a context.
     * Looks for `#name` patterns in prefixMetadataMember / prefixMetadataAnnotation children.
     */
    private extractPrefixMetadataAnnotations(ctx: ParserRuleContext): string[] {
        const annotations: string[] = [];
        this.collectPrefixMetadata(ctx, annotations, 0);
        return annotations;
    }

    private collectPrefixMetadata(ctx: ParserRuleContext, annotations: string[], depth: number): void {
        if (depth > 4) return;
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (!(child instanceof ParserRuleContext)) continue;
            const ri = child.ruleIndex;
            if (PREFIX_METADATA_RULE_INDICES.has(ri)) {
                const name = this.extractTextFromSubtree(child);
                if (name) annotations.push(name);
            } else if (PREFIX_METADATA_RECURSE_RULE_INDICES.has(ri)) {
                // Recurse into prefix/wrapper rules that may contain nested annotations
                this.collectPrefixMetadata(child, annotations, depth + 1);
            }
            // Stop recursing once we hit body/declaration rules
        }
    }

    /**
     * Check if a token is an identifier (not a keyword or punctuation).
     * Also accepts SysML quoted names ('single quoted strings').
     */
    private isIdentifierToken(token: Token): boolean {
        const text = token.text;
        if (!text) return false;
        // SysML quoted names: 'Activate rocket booster'
        if (this.isQuotedName(text)) return true;
        // Identifiers start with a letter or underscore
        return /^[a-zA-Z_]/.test(text) && !this.isKeyword(text);
    }

    /**
     * Whether a terminal is (part of) a name: an identifier, a quoted name, or
     * a KerML keyword such as `step` or `function` that the grammar parsed as a
     * name (`name : IDENTIFIER | STRING | unreservedKeyword`).
     */
    private isNameTerminal(node: TerminalNode): boolean {
        return this.isIdentifierToken(node.symbol)
            || (node.parent as ParserRuleContext | null)?.ruleIndex === SysMLv2Parser.RULE_unreservedKeyword;
    }

    /**
     * Check if text is a SysML quoted name (single-quoted string).
     */
    private isQuotedName(text: string): boolean {
        return text.length >= 3 && text.startsWith("'") && text.endsWith("'");
    }

    /**
     * Strip quotes from a SysML quoted name, returning the inner text.
     * Returns the text unchanged if not quoted.
     */
    private unquoteName(text: string): string {
        return decodeName(text);
    }

    /**
     * Check if a text is a SysML keyword.
     * Uses the shared keyword set derived from the generated lexer.
     */
    private isKeyword(text: string): boolean {
        return SYSML_KEYWORDS.has(text);
    }

    /**
     * Extract `import` statements owned directly by a namespace's body --
     * a package's `packageBody`, or a definition/usage's `definitionBody`
     * (usages reuse the same rule via `usageBody: definitionBody;`). Per
     * §7.5.1, "all kinds of SysML definitions and usages are also
     * namespaces... all rules discussed generically for namespaces...
     * apply generically to packages, definitions and usages" -- an
     * `import` inside e.g. `part def Vehicle { import Lib::Engine; ... }`
     * is a real import of that definition's own namespace, not a no-op.
     *
     * Only searches the ONE body rule that matches `ownKind` (never tries
     * `packageBody` for a definition/usage or vice versa), and the search
     * itself never crosses into a nested named declaration's own body
     * (`findOwnBodyRule`, not the unbounded `findRule`) -- without both of
     * those, a definition containing a nested `package Sub { import ...; }`
     * would have that nested package's *own* `packageBody` found first by
     * an unbounded search (reachable via `definitionBody` →
     * `definitionBodyItem` → ... → `package` → `packageBody`), wrongly
     * attributing `Sub`'s own imports to the outer definition in place of
     * the definition's own (the search stops at the first match).
     */
    private extractImportTargets(ctx: ParserRuleContext, ownKind: SysMLElementKind): ImportTarget[] {
        if (ownKind === SysMLElementKind.Package) {
            const packageBody = this.findOwnBodyRule(ctx, SysMLv2Parser.RULE_packageBody);
            return packageBody ? this.extractImportsFromBody(packageBody, SysMLv2Parser.RULE_packageBodyElement) : [];
        }

        const definitionBody = this.findOwnBodyRule(ctx, SysMLv2Parser.RULE_definitionBody);
        return definitionBody ? this.extractImportsFromBody(definitionBody, SysMLv2Parser.RULE_definitionBodyItem) : [];
    }

    /**
     * As `findRule`, but never descends into a child that starts its own
     * named declaration (any rule mapped in `RULE_INDEX_TO_KIND`, e.g. a
     * nested `package`/definition/usage) -- the same boundary
     * `extractDocumentation` already enforces for the same reason ("a
     * mapped child starts a contained element with independent [...]
     * ownership"). Used to find a body rule that belongs to `ctx` itself,
     * never one nested inside it.
     */
    private findOwnBodyRule(ctx: ParserRuleContext, ruleIndex: number, depth = 0): ParserRuleContext | undefined {
        if (ctx.ruleIndex === ruleIndex) return ctx;
        if (depth > MAX_RULE_SEARCH_DEPTH) return undefined;
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (!(child instanceof ParserRuleContext)) continue;
            if (child.ruleIndex === ruleIndex) return child;
            if (RULE_INDEX_TO_KIND.has(child.ruleIndex)) continue;
            const found = this.findOwnBodyRule(child, ruleIndex, depth + 1);
            if (found) return found;
        }
        return undefined;
    }

    /** Scan a body rule's direct `bodyItem`-kind children for an `importRule`, per `extractImportTargets`. */
    private extractImportsFromBody(body: ParserRuleContext, bodyItemRuleIndex: number): ImportTarget[] {
        const results: ImportTarget[] = [];
        for (let j = 0; j < body.getChildCount(); j++) {
            const bodyItem = body.getChild(j);
            if (!(bodyItem instanceof ParserRuleContext) || bodyItem.ruleIndex !== bodyItemRuleIndex) continue;
            for (let k = 0; k < bodyItem.getChildCount(); k++) {
                const maybeImportRule = bodyItem.getChild(k);
                if (maybeImportRule instanceof ParserRuleContext && maybeImportRule.ruleIndex === SysMLv2Parser.RULE_importRule) {
                    const parsed = this.parseImportRule(maybeImportRule);
                    if (parsed) results.push(parsed);
                }
            }
        }
        return results;
    }

    /**
     * Parse a single importRule context into an ImportTarget, distinguishing
     * membership vs. namespace imports and shallow vs. `::**` deep imports.
     */
    private parseImportRule(importRuleCtx: ParserRuleContext): ImportTarget | undefined {
        let declarationCtx: ParserRuleContext | undefined;
        for (let i = 0; i < importRuleCtx.getChildCount(); i++) {
            const child = importRuleCtx.getChild(i);
            if (child instanceof ParserRuleContext && child.ruleIndex === SysMLv2Parser.RULE_importDeclaration) {
                declarationCtx = child;
                break;
            }
        }
        if (!declarationCtx) return undefined;

        const visibility = this.extractImportVisibility(importRuleCtx);

        // Filtered import: `import Owner::Target[filterExpr];` (§7.5.4) -- namespaceImport's
        // filterPackage alternative. Handled separately so its qualifiedName target and its
        // [filterExpr] brackets aren't squashed together by generic text extraction below.
        const filterPackageCtx = this.findRule(declarationCtx, SysMLv2Parser.RULE_filterPackage);
        if (filterPackageCtx) return this.parseFilteredImport(filterPackageCtx, visibility);

        const isNamespaceImport = this.containsRule(declarationCtx, SysMLv2Parser.RULE_namespaceImport);
        let text = this.extractFullExposeText(declarationCtx);
        if (!text) return undefined;

        const deep = text.endsWith('::**');
        if (deep) text = text.slice(0, -'::**'.length);

        if (isNamespaceImport) {
            // namespaceImport text is "Owner::*" (shallow) before the optional "::**" suffix.
            const owner = text.endsWith('::*') ? text.slice(0, -'::*'.length) : text;
            return { kind: deep ? 'namespace-deep' : 'namespace-shallow', target: owner, visibility };
        }
        return { kind: deep ? 'membership-deep' : 'membership', target: text, visibility };
    }

    /**
     * Visibility keyword on an importRule (`public`/`private`/`protected import ...`).
     * Defaults to 'private', the standard's default for imports (§7.5.3) -- unlike
     * plain member declarations, which default to 'public'.
     */
    private extractImportVisibility(importRuleCtx: ParserRuleContext): 'public' | 'private' | 'protected' {
        for (let i = 0; i < importRuleCtx.getChildCount(); i++) {
            const child = importRuleCtx.getChild(i);
            if (child instanceof ParserRuleContext && child.ruleIndex === SysMLv2Parser.RULE_visibilityIndicator) {
                const text = child.getText();
                if (text === 'public' || text === 'private' || text === 'protected') return text;
            }
        }
        return 'private';
    }

    /**
     * Whether `ctx` or any descendant (depth-limited) is of the given rule index.
     */
    private containsRule(ctx: ParserRuleContext, ruleIndex: number, depth = 0): boolean {
        return this.findRule(ctx, ruleIndex, depth) !== undefined;
    }

    /**
     * First descendant of `ctx` (or `ctx` itself) of the given rule index, depth-limited.
     */
    private findRule(ctx: ParserRuleContext, ruleIndex: number, depth = 0): ParserRuleContext | undefined {
        if (ctx.ruleIndex === ruleIndex) return ctx;
        if (depth > MAX_RULE_SEARCH_DEPTH) return undefined;
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (child instanceof ParserRuleContext) {
                const found = this.findRule(child, ruleIndex, depth + 1);
                if (found) return found;
            }
        }
        return undefined;
    }

    /**
     * Parse a filtered import (§7.5.4: `import Owner::Target[filterExpr];`),
     * the grammar's `filterPackage` alternative of `namespaceImport`. Its
     * target/kind come from the same membership/namespace-shallow logic as a
     * plain import; one or more `[filterExpr]` brackets are AND'd together
     * into a single `ImportTarget.filter`.
     */
    private parseFilteredImport(
        filterPackageCtx: ParserRuleContext,
        visibility: 'public' | 'private' | 'protected',
    ): ImportTarget | undefined {
        let importDeclCtx: ParserRuleContext | undefined;
        const filterExprs: FilterExpr[] = [];
        for (let i = 0; i < filterPackageCtx.getChildCount(); i++) {
            const child = filterPackageCtx.getChild(i);
            if (!(child instanceof ParserRuleContext)) continue;
            if (child.ruleIndex === SysMLv2Parser.RULE_filterPackageImportDeclaration) {
                importDeclCtx = child;
            } else if (child.ruleIndex === SysMLv2Parser.RULE_filterPackageMember) {
                const exprCtx = this.findRule(child, SysMLv2Parser.RULE_ownedExpression);
                if (exprCtx) filterExprs.push(this.parseFilterExpression(exprCtx));
            }
        }
        if (!importDeclCtx) return undefined;

        const isNamespaceImport = this.containsRule(importDeclCtx, SysMLv2Parser.RULE_namespaceImportDirect);
        let text = this.extractFullExposeText(importDeclCtx);
        if (!text) return undefined;

        const deep = text.endsWith('::**');
        if (deep) text = text.slice(0, -'::**'.length);

        const filter = filterExprs.length === 0
            ? undefined
            : filterExprs.reduce((left, right) => ({ kind: 'and', left, right }));

        if (isNamespaceImport) {
            const owner = text.endsWith('::*') ? text.slice(0, -'::*'.length) : text;
            return { kind: deep ? 'namespace-deep' : 'namespace-shallow', target: owner, visibility, filter };
        }
        return { kind: deep ? 'membership-deep' : 'membership', target: text, visibility, filter };
    }

    /**
     * Parse a `filter`/filtered-import boolean expression (§7.5.4) into a
     * FilterExpr, from an `ownedExpression` parse tree. Only the metadata
     * classification-test subset (`@Name`, `and`/`or`/`not`, simple
     * parenthesization) is modeled -- anything else (attribute-value
     * comparisons, etc.) parses to 'unsupported', which evaluates as passing.
     */
    private parseFilterExpression(ctx: ParserRuleContext): FilterExpr {
        if (ctx.ruleIndex !== SysMLv2Parser.RULE_ownedExpression) return { kind: 'unsupported' };
        const expr = ctx as OwnedExpressionContext;
        const children = expr.ownedExpression();

        if (expr.AND() && children.length === 2) {
            return { kind: 'and', left: this.parseFilterExpression(children[0]), right: this.parseFilterExpression(children[1]) };
        }
        if (expr.OR() && children.length === 2) {
            return { kind: 'or', left: this.parseFilterExpression(children[0]), right: this.parseFilterExpression(children[1]) };
        }
        if (expr.NOT() && children.length === 1) {
            return { kind: 'not', expr: this.parseFilterExpression(children[0]) };
        }
        if (expr.AT_SIGN() && expr.typeReference() && children.length === 0) {
            const qualifiedName = this.extractFullExposeText(expr.typeReference()!);
            if (qualifiedName) {
                const simpleName = qualifiedName.includes('::') ? qualifiedName.split('::').pop()! : qualifiedName;
                return { kind: 'metadata', name: simpleName };
            }
        }
        // Parenthesized grouping: baseExpression -> LPAREN sequenceExpressionList RPAREN
        // with exactly one element, e.g. "(@Approval and @Deprecated)".
        const base = expr.primaryExpression()?.baseExpression();
        if (base) {
            const seqList = this.findRule(base, SysMLv2Parser.RULE_sequenceExpressionList, 1);
            if (seqList && seqList.getChildCount() === 1) {
                const inner = seqList.getChild(0);
                if (inner instanceof ParserRuleContext) return this.parseFilterExpression(inner);
            }
        }
        return { kind: 'unsupported' };
    }

    /**
     * Package-level `filter <expr>;` conditions (§7.5.4), applying to every
     * import of the package. Like imports, these are direct children of
     * packageBody, not nested arbitrarily.
     */
    private extractPackageFilterConditions(ctx: ParserRuleContext): FilterExpr[] {
        const results: FilterExpr[] = [];
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (!(child instanceof ParserRuleContext) || child.ruleIndex !== SysMLv2Parser.RULE_packageBody) continue;
            for (let j = 0; j < child.getChildCount(); j++) {
                const bodyItem = child.getChild(j);
                if (!(bodyItem instanceof ParserRuleContext) || bodyItem.ruleIndex !== SysMLv2Parser.RULE_packageBodyElement) continue;
                for (let k = 0; k < bodyItem.getChildCount(); k++) {
                    const maybeFilterMember = bodyItem.getChild(k);
                    if (maybeFilterMember instanceof ParserRuleContext && maybeFilterMember.ruleIndex === SysMLv2Parser.RULE_elementFilterMember) {
                        const exprCtx = this.findRule(maybeFilterMember, SysMLv2Parser.RULE_ownedExpression);
                        if (exprCtx) results.push(this.parseFilterExpression(exprCtx));
                    }
                }
            }
        }
        return results;
    }

    /**
     * Extract expose target qualified names from a view body.
     * Walks viewBody/viewDefinitionBody children to find expose rules,
     * then extracts the qualified name from membershipExpose or namespaceExpose.
     */
    private extractExposeTargets(ctx: ParserRuleContext): string[] {
        const targets: string[] = [];
        this.collectExposeTargets(ctx, targets, 0);
        return targets;
    }

    private collectExposeTargets(ctx: ParserRuleContext, targets: string[], depth: number): void {
        if (depth > 6) return;
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (!(child instanceof ParserRuleContext)) continue;
            const ri = child.ruleIndex;
            if (ri === SysMLv2Parser.RULE_expose) {
                // Extract the qualified name(s) from the expose's child
                // expose → EXPOSE (membershipExpose | namespaceExpose) relationshipBody
                const target = this.extractExposeQualifiedName(child);
                if (target) targets.push(target);
            } else if (
                ri === SysMLv2Parser.RULE_viewBody ||
                ri === SysMLv2Parser.RULE_viewBodyItem ||
                ri === SysMLv2Parser.RULE_viewDefinitionBody ||
                ri === SysMLv2Parser.RULE_viewDefinitionBodyItem
            ) {
                this.collectExposeTargets(child, targets, depth + 1);
            }
        }
    }

    /**
     * Extract the qualified name from an expose rule.
     * Handles both membershipExpose (single name, optionally ::**)
     * and namespaceExpose (name::* or name::**).
     */
    private extractExposeQualifiedName(exposeCtx: ParserRuleContext): string | undefined {
        for (let i = 0; i < exposeCtx.getChildCount(); i++) {
            const child = exposeCtx.getChild(i);
            if (!(child instanceof ParserRuleContext)) continue;
            const ri = child.ruleIndex;
            if (ri === SysMLv2Parser.RULE_membershipExpose ||
                ri === SysMLv2Parser.RULE_namespaceExpose) {
                // Both wrap membershipImport/namespaceImport which contain qualifiedName
                // Collect all terminal text to preserve ::, *, ** tokens
                return this.extractFullExposeText(child);
            }
        }
        return undefined;
    }

    /**
     * Extract the full text of an expose target including :: and wildcard tokens.
     * Returns e.g. "Vehicle::engine", "Pkg::*", "Pkg::**"
     */
    private extractFullExposeText(ctx: ParserRuleContext): string | undefined {
        const parts: string[] = [];
        this.collectExposeText(ctx, parts);
        return parts.length > 0 ? parts.join('') : undefined;
    }

    private collectExposeText(ctx: ParserRuleContext, parts: string[]): void {
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (child instanceof TerminalNode) {
                const text = child.symbol.text;
                if (text) parts.push(child.symbol.type === SysMLv2Lexer.STRING
                    ? joinQualifiedName([decodeName(text)]) : text);
            } else if (child instanceof ParserRuleContext) {
                this.collectExposeText(child, parts);
            }
        }
    }

    /**
     * Extract element filter expressions from a view body.
     * Looks for elementFilterMember rules containing `filter @ QualifiedName`.
     */
    private extractViewFilters(ctx: ParserRuleContext): string[] {
        const filters: string[] = [];
        this.collectViewFilters(ctx, filters, 0);
        return filters;
    }

    private collectViewFilters(ctx: ParserRuleContext, filters: string[], depth: number): void {
        if (depth > 6) return;
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (!(child instanceof ParserRuleContext)) continue;
            const ri = child.ruleIndex;
            if (ri === SysMLv2Parser.RULE_elementFilterMember) {
                // elementFilterMember → memberPrefix FILTER ownedExpression SEMI
                // Extract the expression text (e.g., "@ SysML::PartUsage")
                const text = this.extractFullExposeText(child);
                if (text) {
                    // Clean up: remove 'filter' keyword prefix and semicolons
                    const cleaned = text.replace(/^filter/i, '').replace(/;$/g, '').trim();
                    if (cleaned) filters.push(cleaned);
                }
            } else if (
                ri === SysMLv2Parser.RULE_viewBody ||
                ri === SysMLv2Parser.RULE_viewBodyItem ||
                ri === SysMLv2Parser.RULE_viewDefinitionBody ||
                ri === SysMLv2Parser.RULE_viewDefinitionBodyItem ||
                ri === SysMLv2Parser.RULE_packageBody ||
                ri === SysMLv2Parser.RULE_packageBodyElement
            ) {
                this.collectViewFilters(child, filters, depth + 1);
            }
        }
    }

    /**
     * Extract the view rendering reference from a view body.
     * Looks for viewRenderingMember rules containing `render QualifiedName`.
     */
    private extractViewRendering(ctx: ParserRuleContext): string | undefined {
        return this.findViewRendering(ctx, 0);
    }

    private findViewRendering(ctx: ParserRuleContext, depth: number): string | undefined {
        if (depth > 6) return undefined;
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (!(child instanceof ParserRuleContext)) continue;
            const ri = child.ruleIndex;
            if (ri === SysMLv2Parser.RULE_viewRenderingMember) {
                // viewRenderingMember → memberPrefix RENDER viewRenderingUsage
                // Extract the rendering reference text
                const text = this.extractFullExposeText(child);
                if (text) {
                    // Clean up: remove 'render' keyword prefix, semicolons, braces
                    const cleaned = text.replace(/^render/i, '').replace(/[;{}]/g, '').trim();
                    if (cleaned) return cleaned;
                }
            } else if (
                ri === SysMLv2Parser.RULE_viewBody ||
                ri === SysMLv2Parser.RULE_viewBodyItem ||
                ri === SysMLv2Parser.RULE_viewDefinitionBody ||
                ri === SysMLv2Parser.RULE_viewDefinitionBodyItem
            ) {
                const found = this.findViewRendering(child, depth + 1);
                if (found) return found;
            }
        }
        return undefined;
    }

    /**
     * Extract all text content from a subtree (concatenate terminal nodes).
     */
    private extractTextFromSubtree(ctx: ParserRuleContext): string | undefined {
        if (ctx.ruleIndex === SysMLv2Parser.RULE_name) return decodeName(ctx.getText());
        const parts: string[] = [];
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (child instanceof TerminalNode) {
                const text = child.symbol.text;
                if (text && this.isNameTerminal(child)) {
                    parts.push(joinQualifiedName([this.unquoteName(text)]));
                }
            } else if (child instanceof ParserRuleContext) {
                const sub = this.extractTextFromSubtree(child);
                if (sub) parts.push(child.ruleIndex === SysMLv2Parser.RULE_name
                    ? joinQualifiedName([sub]) : sub);
            }
        }
        return parts.length > 0 ? parts.join('::') : undefined;
    }
}
