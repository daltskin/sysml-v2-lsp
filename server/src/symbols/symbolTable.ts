import { ParserRuleContext, TerminalNode, Token } from 'antlr4ng';
import { Range } from 'vscode-languageserver/node.js';
import { MultiplicityBoundsContext, SysMLv2Parser } from '../generated/SysMLv2Parser.js';
import { ParseResult } from '../parser/parseDocument.js';
import { contextToRange, tokenToRange } from '../parser/positionUtils.js';
import { SYSML_KEYWORDS } from '../utils/sysmlKeywords.js';
import { Scope } from './scope.js';
import { SysMLElementKind, SysMLSymbol, isUsage as isUsageKind } from './sysmlElements.js';

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
    [SysMLv2Parser.RULE_actionUsage, SysMLElementKind.ActionUsage],               // 296
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
    [SysMLv2Parser.RULE_interfaceUsage, SysMLElementKind.InterfaceUsage],         // 268
    [SysMLv2Parser.RULE_performActionUsage, SysMLElementKind.PerformActionUsage], // 298
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

/** Rules containing typing / specialization info for collectTypeNamesFromTree() */
const TYPE_EXTRACTION_RULE_INDICES: ReadonlySet<number> = new Set([
    SysMLv2Parser.RULE_specialization,          // 66
    SysMLv2Parser.RULE_ownedSpecialization,      // 67
    SysMLv2Parser.RULE_subclassification,        // 83
    SysMLv2Parser.RULE_ownedSubclassification,   // 84
    SysMLv2Parser.RULE_typings,                  // 101
    SysMLv2Parser.RULE_featureTyping,            // 109
    SysMLv2Parser.RULE_ownedFeatureTyping,       // 110
    SysMLv2Parser.RULE_conjugation,              // 70
    SysMLv2Parser.RULE_ownedConjugation,         // 71
    SysMLv2Parser.RULE_disjoining,               // 72
    SysMLv2Parser.RULE_ownedDisjoining,          // 73
    SysMLv2Parser.RULE_subsetting,               // 111
    SysMLv2Parser.RULE_ownedSubsetting,          // 112
    SysMLv2Parser.RULE_specializationPart,       // 57
]);

/** Rules to recurse into when looking for type names */
const TYPE_RECURSE_RULE_INDICES: ReadonlySet<number> = new Set([
    SysMLv2Parser.RULE_featureSpecialization,     // 100
    SysMLv2Parser.RULE_featureSpecializationPart, // 98
    SysMLv2Parser.RULE_featureDeclaration,        // 92
    SysMLv2Parser.RULE_usageCompletion,           // 210
    SysMLv2Parser.RULE_definition,                // 192
    SysMLv2Parser.RULE_usage,                     // 208
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
const RE_SPEC = /(?:specializes|:>|:>>)\s*('[^']+'|[A-Za-z_]\w*(?:::\w+)*)(?:\s*,\s*(?:'[^']+'|[A-Za-z_]\w*(?:::\w+)*))*/;
const RE_DEFINED_BY = /definedby\s*([A-Za-z_]\w*(?:::\w+)*(?:\s*,\s*[A-Za-z_]\w*(?:::\w+)*)*)/;
const RE_TYPING = /:(?![:>])\s*('[^']+'|[A-Za-z_]\w*(?:::\w+)*)/;
const RE_QUOTED_NAME = /'([^']+)'/;
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
    /** All symbols indexed by URI for cross-file lookup */
    private symbolsByUri = new Map<string, SysMLSymbol[]>();
    /** All symbols indexed by simple name for O(1) lookup */
    private symbolsByName = new Map<string, SysMLSymbol[]>();
    /** Symbols sorted by (line, character) per URI for O(log n) positional lookup */
    private symbolsByPosition = new Map<string, SysMLSymbol[]>();
    /** Reverse index: type name → symbols that reference it in typeNames */
    private typeNameRefs = new Map<string, SysMLSymbol[]>();
    /** Cached array from getAllSymbols(), invalidated on any mutation */
    private allSymbolsCache: SysMLSymbol[] | undefined;
    /** The global scope */
    private globalScope: Scope;

    constructor() {
        this.globalScope = new Scope('__global__');
    }

    /**
     * Build the symbol table from a parse result.
     */
    build(uri: string, parseResult: ParseResult): void {
        // Clear previous entries for this URI
        this.clearUri(uri);

        if (!parseResult.tree) {
            return;
        }

        // Walk the tree and collect symbols
        this.walkTree(parseResult.tree, uri, this.globalScope, '');

        // Post-process: resolve view specialization chains to inherit
        // filters, rendering, and expose targets from parent view defs
        this.resolveViewInheritance(uri);
    }

    /**
     * Get a symbol by its qualified name.
     */
    getSymbol(qualifiedName: string): SysMLSymbol | undefined {
        return this.symbols.get(qualifiedName);
    }

    /**
     * Find a symbol by name (simple name, not qualified).
     */
    findByName(name: string): SysMLSymbol[] {
        return this.symbolsByName.get(name) ?? [];
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
            this.allSymbolsCache = Array.from(this.symbols.values());
        }
        return this.allSymbolsCache;
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
    }

    private clearUri(uri: string): void {
        const existing = this.symbolsByUri.get(uri);
        if (existing && existing.length > 0) {
            // Collect names and type names that need index updates
            const affectedNames = new Set<string>();
            const affectedTypeNames = new Set<string>();
            for (const sym of existing) {
                this.symbols.delete(sym.qualifiedName);
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
        parentQualifiedName: string,
    ): void {
        const ruleName = this.getRuleName(ctx);

        // Try to extract a symbol from this context
        const symbol = this.tryExtractSymbol(ctx, uri, ruleName, parentQualifiedName);

        let childScope = currentScope;

        if (symbol) {
            this.registerSymbol(symbol, uri, currentScope);
            // Create a child scope for definitions and packages
            childScope = new Scope(symbol.qualifiedName, currentScope);
        }

        // Walk children
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (child instanceof ParserRuleContext) {
                this.walkTree(
                    child,
                    uri,
                    childScope,
                    symbol?.qualifiedName ?? parentQualifiedName,
                );
            }
        }
    }

    private registerSymbol(symbol: SysMLSymbol, uri: string, scope: Scope): void {
        this.symbols.set(symbol.qualifiedName, symbol);
        // Invalidate cached array
        this.allSymbolsCache = undefined;
        const uriSymbols = this.symbolsByUri.get(uri) ?? [];
        uriSymbols.push(symbol);
        this.symbolsByUri.set(uri, uriSymbols);
        // Maintain name index
        const nameList = this.symbolsByName.get(symbol.name) ?? [];
        nameList.push(symbol);
        this.symbolsByName.set(symbol.name, nameList);
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
        scope.define(symbol);
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
     * Try to extract a SysMLSymbol from a parse tree context.
     * Returns undefined if this context doesn't represent a named declaration.
     */
    private tryExtractSymbol(
        ctx: ParserRuleContext,
        uri: string,
        ruleName: string,
        parentQualifiedName: string,
    ): SysMLSymbol | undefined {
        // Map rule names to SysML element kinds
        const kind = this.inferKind(ruleName, ctx);
        if (kind === undefined) {
            return undefined;
        }

        // Extract the name from the context
        const name = this.extractName(ctx);
        if (!name) {
            return undefined;
        }

        const qualifiedName = parentQualifiedName
            ? `${parentQualifiedName}::${name}`
            : name;

        const range = contextToRange(ctx);
        const selectionRange = this.extractNameRange(ctx) ?? range;
        // Extract type names for both usages (typing) and definitions (specialization)
        const typeNames = this.extractTypeNames(ctx);
        const typeName = typeNames[0];
        const documentation = this.extractDocumentation(ctx);
        // Only extract multiplicity for usages
        const { multiplicity, multiplicityRange } = isUsageKind(kind) ? this.extractMultiplicity(ctx) : {};
        // Extract prefix metadata annotations (#name)
        const metadataAnnotations = this.extractPrefixMetadataAnnotations(ctx);
        // Extract expose targets, filters, and rendering for view usages/definitions
        const isView = kind === SysMLElementKind.ViewUsage || kind === SysMLElementKind.ViewDef;
        const isPackage = kind === SysMLElementKind.Package;
        const exposeTargets = isView ? this.extractExposeTargets(ctx) : undefined;
        const viewFilters = (isView || isPackage) ? this.extractViewFilters(ctx) : undefined;
        const viewRendering = isView ? this.extractViewRendering(ctx) : undefined;

        return {
            name,
            kind,
            qualifiedName,
            range,
            selectionRange,
            uri,
            typeName,
            typeNames,
            documentation,
            parentQualifiedName: parentQualifiedName || undefined,
            children: [],
            multiplicity,
            multiplicityRange,
            metadataAnnotations: metadataAnnotations.length > 0 ? metadataAnnotations : undefined,
            exposeTargets: exposeTargets && exposeTargets.length > 0 ? exposeTargets : undefined,
            viewFilters: viewFilters && viewFilters.length > 0 ? viewFilters : undefined,
            viewRendering: viewRendering || undefined,
        };
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

    /**
     * Extract the declared name from a parse tree context.
     * Looks for an IDENT token or a name/identification sub-rule.
     */
    private extractName(ctx: ParserRuleContext): string | undefined {
        // Walk children looking for a name-producing rule or IDENT token
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);

            // Direct terminal (identifier token or quoted name)
            if (child instanceof TerminalNode) {
                const token = child.symbol;
                // Skip keywords — we want identifier tokens only
                if (this.isIdentifierToken(token)) {
                    return this.unquoteName(token.text ?? '');
                }
            }

            // Check child rules named 'identification', 'declarationUsageName', etc.
            if (child instanceof ParserRuleContext) {
                if (NAME_RULE_INDICES.has(child.ruleIndex)) {
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
     * Extract the range of just the name token.
     */
    private extractNameRange(ctx: ParserRuleContext): Range | undefined {
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (child instanceof TerminalNode && this.isIdentifierToken(child.symbol)) {
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
        const fullText = ctx.getText();
        const braceIdx = fullText.indexOf('{');
        let text = braceIdx >= 0 ? fullText.substring(0, braceIdx) : fullText;

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
                const qm = part.match(RE_QUOTED_NAME);
                if (qm) { names.push(qm[1]); continue; }
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
                const qm = part.match(RE_QUOTED_NAME);
                if (qm) { names.push(qm[1]); continue; }
                const m = part.trim().match(RE_IDENT_START);
                if (m) names.push(m[1]);
            }
            return names;
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
        if (depth > 6) return; // don't go too deep
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (!(child instanceof ParserRuleContext)) continue;
            const ri = child.ruleIndex;
            if (TYPE_EXTRACTION_RULE_INDICES.has(ri)) {
                // These rules contain qualified-name children;
                // extract all identifier-like tokens.
                const childText = child.getText();
                // Strip leading keywords / operators
                // Note: getText() strips whitespace, so `:` may be directly followed by the type name
                const stripped = childText
                    .replace(/^(specializes|:>>|:>|:|definedby|subsets|redefines|references|conjugates|disjoints)/i, '');
                for (const part of stripped.split(',')) {
                    // Match quoted names ('...') or plain identifiers
                    const qm = part.match(/'([^']+)'/);
                    if (qm) {
                        names.push(qm[1]);
                    } else {
                        const m = part.match(/([A-Za-z_]\w*(?:::\w+)*)/);
                        if (m) names.push(m[1]);
                    }
                }
            } else if (
                // Recurse into declaration / part / body wrappers that may
                // contain nested typing rules (but NOT into body rules that
                // contain children — to avoid collecting types from members).
                TYPE_RECURSE_RULE_INDICES.has(ri) ||
                // Also recurse into any rule whose name contains 'declaration'
                // (covers e.g. interfaceUsageDeclaration, usageDeclaration, etc.)
                SysMLv2Parser.ruleNames[ri]?.includes('eclaration')
            ) {
                this.collectTypeNamesFromTree(child, names, depth + 1);
            }
        }
    }

    /**
     * Extract documentation from a comment or doc child.
     */
    private extractDocumentation(ctx: ParserRuleContext): string | undefined {
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (child instanceof ParserRuleContext) {
                if (DOC_RULE_INDICES.has(child.ruleIndex)) {
                    // Get the raw text and strip the comment delimiters
                    const raw = child.getText();
                    if (raw) {
                        // Remove leading 'doc' keyword, then strip /* */ or //
                        let text = raw;
                        if (text.startsWith('doc')) text = text.slice(3);
                        if (text.startsWith('comment')) text = text.slice(7);
                        text = text.replace(/^\/\*\s*/, '').replace(/\s*\*\/$/, '');
                        text = text.replace(/^\/\/\s*/, '');
                        return text.trim() || raw;
                    }
                    return raw ?? undefined;
                }
                // Recurse into body/members to find nested doc
                const nested = this.extractDocumentation(child);
                if (nested) return nested;
            }
        }
        return undefined;
    }

    /**
     * Extract multiplicity from a context.
     * Looks for MultiplicityBoundsContext in the subtree.
     * Returns { multiplicity: "1..5", multiplicityRange: { lower: 1, upper: 5 } }
     */
    private extractMultiplicity(ctx: ParserRuleContext): { multiplicity?: string; multiplicityRange?: { lower: number; upper: number | '*' } } {
        const multCtx = this.findMultiplicityBounds(ctx);
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
     * Recursively search for a MultiplicityBoundsContext in the subtree.
     */
    private findMultiplicityBounds(ctx: ParserRuleContext): MultiplicityBoundsContext | undefined {
        // Use ruleIndex instead of constructor.name to survive esbuild minification
        if (ctx.ruleIndex === SysMLv2Parser.RULE_multiplicityBounds) {
            return ctx as MultiplicityBoundsContext;
        }
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (child instanceof ParserRuleContext) {
                const result = this.findMultiplicityBounds(child);
                if (result) {
                    return result;
                }
            }
        }
        return undefined;
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
        if (this.isQuotedName(text)) {
            return text.slice(1, -1);
        }
        return text;
    }

    /**
     * Check if a text is a SysML keyword.
     * Uses the shared keyword set derived from the generated lexer.
     */
    private isKeyword(text: string): boolean {
        return SYSML_KEYWORDS.has(text);
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
                if (text) parts.push(text);
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
        const parts: string[] = [];
        for (let i = 0; i < ctx.getChildCount(); i++) {
            const child = ctx.getChild(i);
            if (child instanceof TerminalNode) {
                const text = child.symbol.text;
                if (text && this.isIdentifierToken(child.symbol)) {
                    parts.push(this.unquoteName(text));
                }
            } else if (child instanceof ParserRuleContext) {
                const sub = this.extractTextFromSubtree(child);
                if (sub) parts.push(sub);
            }
        }
        return parts.length > 0 ? parts.join('::') : undefined;
    }
}
