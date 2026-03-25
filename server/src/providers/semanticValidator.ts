import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node.js';
import { DocumentManager } from '../documentManager.js';
import { getLibraryPackageNames, resolveLibraryType } from '../library/libraryIndex.js';
import { SysMLElementKind, SysMLSymbol, isDefinition } from '../symbols/sysmlElements.js';

/**
 * Standard library types that are always available (from Kernel libraries).
 * These should not trigger "unresolved type" warnings.
 */
const STANDARD_LIBRARY_TYPES = new Set([
    // Kernel Data Types
    'Boolean', 'String', 'Integer', 'Real', 'Natural', 'Positive',
    'Complex', 'Number', 'Rational',
    'ScalarValues', 'DataFunctions',
    // Kernel Semantic Library
    'Anything', 'Nothing', 'Object', 'Occurrence',
    'Base', 'Objects', 'Occurrences', 'Items', 'Parts', 'Ports',
    'Actions', 'States', 'Connections', 'Interfaces', 'Allocations',
    'Requirements', 'Constraints', 'Calculations', 'Cases', 'Flows',
    'Transfers', 'Performances', 'TransitionPerformances',
    // Common library packages
    'ISQ', 'SI', 'USCustomaryUnits',
    'Quantities', 'MeasurementReferences', 'ScalarValues',
    // ISQ Base quantities (ISO 80000)
    'LengthValue', 'MassValue', 'DurationValue', 'TimeValue',
    'ElectricCurrentValue', 'ThermodynamicTemperatureValue', 'TemperatureValue',
    'AmountOfSubstanceValue', 'LuminousIntensityValue',
    // ISQ Derived quantities (commonly used)
    'AreaValue', 'VolumeValue', 'SpeedValue', 'VelocityValue', 'AccelerationValue',
    'ForceValue', 'EnergyValue', 'PowerValue', 'PressureValue',
    'TorqueValue', 'MomentOfForceValue', 'AngularVelocityValue', 'FrequencyValue',
    'DensityValue', 'MassFlowRateValue', 'VolumeFlowRateValue',
    // ISQ units
    'LengthUnit', 'MassUnit', 'DurationUnit', 'TimeUnit',
]);

const CONSTRAINT_KEYWORDS = new Set([
    'and', 'or', 'not', 'xor', 'implies', 'if', 'then', 'else', 'true', 'false', 'null',
    'require', 'constraint', 'subject', 'return', 'doc', 'comment', 'assert', 'assume',
]);

interface SymbolIndexes {
    byName: Map<string, SysMLSymbol[]>;
    byParent: Map<string, SysMLSymbol[]>;
    byQualifiedName: Map<string, SysMLSymbol>;
    definitionsByName: Map<string, SysMLSymbol[]>;
    portsByName: Map<string, SysMLSymbol[]>;
}

/**
 * Check for ISQ quantity value types (e.g., LengthValue, TorqueValue).
 * These start with an uppercase letter, contain only letters, and end in "Value".
 */
function isISQValueType(name: string): boolean {
    if (!name.endsWith('Value') || name.length < 6) return false;
    const ch0 = name.charCodeAt(0);
    if (ch0 < 65 || ch0 > 90) return false; // must start uppercase
    for (let i = 1; i < name.length; i++) {
        const c = name.charCodeAt(i);
        if (!((c >= 65 && c <= 90) || (c >= 97 && c <= 122))) return false;
    }
    return true;
}

/**
 * Semantic validator for SysML v2 documents.
 *
 * Runs validation rules on the symbol table that go beyond syntax checking:
 * - Unresolved type references
 * - Invalid multiplicity bounds
 * - Empty enumerations
 * - Duplicate definition names
 * - Mandatory features with unresolved types
 */
export class SemanticValidator {
    /** Cached workspace-wide satisfy data, invalidated when any document version changes. */
    private satisfyCache?: {
        versionKey: string;
        satisfiedNames: Set<string>;
        satisfyBlockRanges: Map<string, Array<{ startLine: number; endLine: number }>>;
    };

    /** Cached workspace-wide verify data, invalidated when any document version changes. */
    private verifyCache?: {
        versionKey: string;
        verifiedNames: Set<string>;
    };

    constructor(private readonly documentManager: DocumentManager) { }

    /**
     * Run all semantic validation rules and return LSP Diagnostic objects.
     */
    validate(uri: string): Diagnostic[] {
        const symbolTable = this.documentManager.getWorkspaceSymbolTable();
        const symbols = symbolTable.getSymbolsForUri(uri);
        if (symbols.length === 0) return [];

        const allSymbols = symbolTable.getAllSymbols();
        const allSymbolNames = new Set(allSymbols.map(s => s.name));
        const libraryNames = new Set(getLibraryPackageNames());
        const text = this.documentManager.getText(uri) ?? '';
        const indexes = this.buildSymbolIndexes(allSymbols);

        const diagnostics: Diagnostic[] = [];

        for (const symbol of symbols) {
            diagnostics.push(
                ...this.checkUnresolvedType(symbol, allSymbolNames, libraryNames),
                ...this.checkInvalidMultiplicity(symbol),
                ...this.checkEmptyEnum(symbol, symbols),
                ...this.checkNamingConvention(symbol),
                ...this.checkMissingDocumentation(symbol),
            );
        }

        diagnostics.push(...this.checkDuplicateDefinitions(symbols));
        diagnostics.push(...this.checkUnusedDefinitions(allSymbols, uri));
        diagnostics.push(...this.checkRedefinitionMultiplicity(symbols, indexes));
        diagnostics.push(...this.checkPortCompatibility(text, uri, indexes));
        diagnostics.push(...this.checkConstraintBodyReferences(text, uri, symbols, indexes));
        diagnostics.push(...this.checkCircularSpecialization(symbols, indexes));
        diagnostics.push(...this.checkCircularContainment(symbols, indexes));
        diagnostics.push(...this.checkUnsatisfiedRequirements(symbols, indexes));
        diagnostics.push(...this.checkUnverifiedRequirements(symbols, indexes));

        return this.dedupeDiagnostics(diagnostics);
    }

    /**
     * Rule: Unresolved type reference.
     *
     * When a feature (part, attribute, port, etc.) references a type name
     * that doesn't exist in the document's symbol table or the standard
     * library, flag it as a warning. If the feature has a mandatory
     * multiplicity (lower >= 1), escalate to error with extra context.
     */
    private checkUnresolvedType(
        symbol: SysMLSymbol,
        allSymbolNames: Set<string>,
        libraryNames: Set<string>,
    ): Diagnostic[] {
        if (!symbol.typeName) return [];

        // Safety net: strip concatenated keywords that leak through when
        // getText() merges "Type redefines foo" → "TyperedefinesFoo".
        let typeName = symbol.typeName;
        const kwMatch = typeName.match(/^([A-Z][A-Za-z_0-9]*?)(redefines|subsets|references|connect|bind|default|via|accept|send|flow|allocate|assign|decide|merge|join|fork)\w/i);
        if (kwMatch) {
            typeName = kwMatch[1];
        }

        // Resolve the root segment for qualified names (e.g., "ISQ::MassValue" → "ISQ")
        const rootSegment = typeName.split('::')[0];

        // Skip if the type is defined in the document, standard library, or indexed library packages
        if (
            allSymbolNames.has(typeName) ||
            allSymbolNames.has(rootSegment) ||
            STANDARD_LIBRARY_TYPES.has(typeName) ||
            STANDARD_LIBRARY_TYPES.has(rootSegment) ||
            libraryNames.has(rootSegment) ||
            // Pattern match for ISQ quantity value types (e.g., LengthValue, TorqueValue)
            isISQValueType(typeName) ||
            // Check the scanned library type index (covers all ISQ/SI types including
            // those with digits like CartesianSpatial3dCoordinateFrame)
            resolveLibraryType(typeName) !== undefined ||
            resolveLibraryType(rootSegment) !== undefined ||
            // Names starting with lowercase are feature references (subsettings
            // via :>), not type references — don't flag them as unresolved types.
            // e.g. "attribute x :> distancePerVolume" references a feature, not a type.
            (typeName.charCodeAt(0) >= 97 && typeName.charCodeAt(0) <= 122)
        ) {
            return [];
        }

        const isMandatory = symbol.multiplicityRange &&
            symbol.multiplicityRange.lower >= 1;

        const severity = isMandatory
            ? DiagnosticSeverity.Error
            : DiagnosticSeverity.Warning;

        let message = `Type '${typeName}' is not defined in the current document or standard library`;
        if (isMandatory) {
            const multStr = symbol.multiplicity ?? '1';
            message += ` (feature '${symbol.name}' requires multiplicity [${multStr}])`;
        }

        return [{
            severity,
            range: symbol.selectionRange,
            message,
            source: 'sysml',
            code: 'unresolved-type',
            data: { typeName },
        }];
    }

    /**
     * Rule: Invalid multiplicity bounds.
     *
     * Checks that lower bound ≤ upper bound when both are numeric.
     * Examples of invalid: [5..2], [10..1]
     */
    private checkInvalidMultiplicity(symbol: SysMLSymbol): Diagnostic[] {
        if (!symbol.multiplicityRange || !symbol.multiplicity) return [];

        const { lower, upper } = symbol.multiplicityRange;
        if (typeof upper === 'number' && lower > upper) {
            return [{
                severity: DiagnosticSeverity.Error,
                range: symbol.selectionRange,
                message: `Invalid multiplicity [${symbol.multiplicity}]: lower bound (${lower}) exceeds upper bound (${upper})`,
                source: 'sysml',
                code: 'invalid-multiplicity',
            }];
        }

        if (lower < 0) {
            return [{
                severity: DiagnosticSeverity.Error,
                range: symbol.selectionRange,
                message: `Invalid multiplicity [${symbol.multiplicity}]: lower bound cannot be negative`,
                source: 'sysml',
                code: 'invalid-multiplicity',
            }];
        }

        return [];
    }

    /**
     * Rule: Empty enumeration definition.
     *
     * An enum def with no enum values is likely incomplete.
     */
    private checkEmptyEnum(symbol: SysMLSymbol, allSymbols: SysMLSymbol[]): Diagnostic[] {
        if (symbol.kind !== SysMLElementKind.EnumDef) return [];

        const children = allSymbols.filter(s =>
            s.parentQualifiedName === symbol.qualifiedName
        );
        const hasEnumValues = children.some(c =>
            c.kind === SysMLElementKind.EnumUsage ||
            c.kind === SysMLElementKind.AttributeUsage
        );

        if (!hasEnumValues) {
            return [{
                severity: DiagnosticSeverity.Information,
                range: symbol.selectionRange,
                message: `Enumeration '${symbol.name}' has no enum values defined`,
                source: 'sysml',
                code: 'empty-enum',
            }];
        }

        return [];
    }

    /**
     * Rule: Naming convention.
     * Definitions should use PascalCase, usages should use camelCase.
     */
    private checkNamingConvention(symbol: SysMLSymbol): Diagnostic[] {
        if (!symbol.name) return [];
        // Skip non-identifiable kinds
        if (
            symbol.kind === SysMLElementKind.Package ||
            symbol.kind === SysMLElementKind.Import ||
            symbol.kind === SysMLElementKind.Comment ||
            symbol.kind === SysMLElementKind.Doc ||
            symbol.kind === SysMLElementKind.Alias ||
            symbol.kind === SysMLElementKind.Unknown
        ) return [];

        if (isDefinition(symbol.kind)) {
            // Definitions should be PascalCase (first letter uppercase)
            const ch = symbol.name[0];
            if (ch === ch.toLowerCase() && ch !== ch.toUpperCase()) {
                return [{
                    severity: DiagnosticSeverity.Hint,
                    range: symbol.selectionRange,
                    message: `Definition '${symbol.name}' should use PascalCase`,
                    source: 'sysml',
                    code: 'naming-convention',
                    data: { name: symbol.name, convention: 'PascalCase' },
                }];
            }
        } else {
            // Usages should be camelCase (first letter lowercase)
            const ch = symbol.name[0];
            if (ch === ch.toUpperCase() && ch !== ch.toLowerCase()) {
                return [{
                    severity: DiagnosticSeverity.Hint,
                    range: symbol.selectionRange,
                    message: `Usage '${symbol.name}' should use camelCase`,
                    source: 'sysml',
                    code: 'naming-convention',
                    data: { name: symbol.name, convention: 'camelCase' },
                }];
            }
        }
        return [];
    }

    /**
     * Rule: Missing documentation.
     * Definitions without a doc comment get a hint.
     */
    private checkMissingDocumentation(symbol: SysMLSymbol): Diagnostic[] {
        if (!isDefinition(symbol.kind)) return [];
        if (symbol.documentation) return [];

        return [{
            severity: DiagnosticSeverity.Information,
            range: symbol.selectionRange,
            message: `Definition '${symbol.name}' has no documentation`,
            source: 'sysml',
            code: 'missing-doc',
            data: { name: symbol.name },
        }];
    }

    /**
     * Rule: Unused definitions.
     * Definitions not referenced by any symbol typeNames and that do not
     * themselves specialize/redefine another type.
     */
    private checkUnusedDefinitions(symbols: SysMLSymbol[], targetUri?: string): Diagnostic[] {
        const defs = symbols.filter(s =>
            s.kind === SysMLElementKind.PartDef || s.kind === SysMLElementKind.ActionDef,
        );
        const defsInScope = targetUri
            ? defs.filter(def => def.uri === targetUri)
            : defs;
        const referencedTypes = new Set(
            symbols
                .filter(s => s.kind !== SysMLElementKind.Package)
                .flatMap(s => s.typeNames),
        );

        const diagnostics: Diagnostic[] = [];
        for (const def of defsInScope) {
            const isReferenced = referencedTypes.has(def.name);
            const hasBaseType = (def.typeNames?.length ?? 0) > 0;

            if (!isReferenced && !hasBaseType) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: def.selectionRange,
                    message: `Definition '${def.name}' is not referenced by any usage in the workspace`,
                    source: 'sysml',
                    code: 'unused-definition',
                    data: { name: def.name },
                });
            }
        }
        return diagnostics;
    }

    /**
     * Rule: Duplicate definition names in the same scope.
     *
     * Two definitions (part def, port def, etc.) with the same name
     * in the same parent scope indicate a conflict.
     */
    /**
     * Static helper: run semantic validation rules without a DocumentManager.
     * Used by the MCP layer which works directly with SysMLSymbol arrays.
     */
    static validateSymbols(
        symbolsInUri: SysMLSymbol[],
        allNames: Set<string>,
        opts?: {
            allSymbols?: SysMLSymbol[];
            text?: string;
            uri?: string;
            includeStyleRules?: boolean;
        },
    ): Diagnostic[] {
        const diagnostics: Diagnostic[] = [];
        const instance = Object.create(SemanticValidator.prototype) as SemanticValidator;
        const allSymbols = opts?.allSymbols ?? symbolsInUri;
        const includeStyleRules = opts?.includeStyleRules ?? true;
        const indexes = instance.buildSymbolIndexes(allSymbols);

        for (const symbol of symbolsInUri) {
            diagnostics.push(
                ...instance.checkUnresolvedType(symbol, allNames, new Set()),
                ...instance.checkInvalidMultiplicity(symbol),
                ...instance.checkEmptyEnum(symbol, symbolsInUri),
            );

            if (includeStyleRules) {
                diagnostics.push(
                    ...instance.checkNamingConvention(symbol),
                    ...instance.checkMissingDocumentation(symbol),
                );
            }
        }

        diagnostics.push(...instance.checkDuplicateDefinitions(symbolsInUri));
        diagnostics.push(...instance.checkUnusedDefinitions(allSymbols));
        diagnostics.push(...instance.checkRedefinitionMultiplicity(symbolsInUri, indexes));
        diagnostics.push(...instance.checkCircularSpecialization(symbolsInUri, indexes));
        diagnostics.push(...instance.checkCircularContainment(symbolsInUri, indexes));
        diagnostics.push(...instance.checkUnsatisfiedRequirements(
            allSymbols, indexes, opts?.text ? [opts.text] : [],
        ));
        diagnostics.push(...instance.checkUnverifiedRequirements(
            allSymbols, indexes, opts?.text ? [opts.text] : [],
        ));

        if (opts?.text && opts.uri) {
            diagnostics.push(...instance.checkPortCompatibility(opts.text, opts.uri, indexes));
            diagnostics.push(...instance.checkConstraintBodyReferences(opts.text, opts.uri, symbolsInUri, indexes));
        }

        return instance.dedupeDiagnostics(diagnostics);
    }

    /**
     * Rule: Circular specialization chain.
     *
     * Detects cycles in definition specialization hierarchies.
     * For example: A :> B, B :> C, C :> A forms a cycle.
     */
    private checkCircularSpecialization(symbolsInUri: SysMLSymbol[], indexes: SymbolIndexes): Diagnostic[] {
        const diagnostics: Diagnostic[] = [];
        const defsInFile = symbolsInUri.filter(s => isDefinition(s.kind) && s.typeNames.length > 0);

        for (const def of defsInFile) {
            const visited = new Set<string>();
            visited.add(def.name);
            const cycle = this.followSpecializationChain(def.name, def.typeNames, visited, indexes);
            if (cycle) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: def.selectionRange,
                    message: `Circular specialization: ${cycle.join(' :> ')} :> ${cycle[0]}`,
                    source: 'sysml',
                    code: 'circular-specialization',
                });
            }
        }
        return diagnostics;
    }

    /**
     * Walk the specialization chain from a set of type names and detect if any
     * path leads back to a name already in the visited set.
     */
    private followSpecializationChain(
        originName: string,
        typeNames: string[],
        visited: Set<string>,
        indexes: SymbolIndexes,
    ): string[] | undefined {
        for (const tn of typeNames) {
            if (visited.has(tn)) {
                // Found a cycle — reconstruct the path for the message
                return [...visited];
            }
            // Look up the definition for this type name
            const candidates = indexes.definitionsByName.get(tn);
            if (!candidates || candidates.length === 0) continue;

            const target = candidates[0];
            if (target.typeNames.length === 0) continue;

            visited.add(tn);
            const cycle = this.followSpecializationChain(originName, target.typeNames, visited, indexes);
            if (cycle) return cycle;
            visited.delete(tn);
        }
        return undefined;
    }

    /**
     * Rule: Circular containment.
     *
     * Detects cycles where definition A contains a feature typed by B and
     * definition B contains a feature typed by A (or longer transitive chains).
     */
    private checkCircularContainment(symbolsInUri: SysMLSymbol[], indexes: SymbolIndexes): Diagnostic[] {
        const diagnostics: Diagnostic[] = [];
        const defsInFile = symbolsInUri.filter(s => isDefinition(s.kind));

        for (const def of defsInFile) {
            const children = indexes.byParent.get(def.qualifiedName) ?? [];
            // Get all type names referenced by children (features of this definition)
            const childTypeNames = children.flatMap(c => c.typeNames).filter(t => t.length > 0);
            if (childTypeNames.length === 0) continue;

            for (const childTypeName of childTypeNames) {
                // Skip self-references: a definition containing a feature
                // typed by itself (e.g. `action subfunctions[*] : Function`)
                // is valid recursive decomposition, not circular containment.
                if (childTypeName === def.name) continue;

                const visited = new Set<string>();
                visited.add(def.name);
                const cycle = this.followContainmentChain(childTypeName, visited, indexes);
                if (cycle) {
                    // Find the child that references the type for better positioning
                    const offendingChild = children.find(c => c.typeNames.includes(childTypeName));
                    const range = offendingChild?.selectionRange ?? def.selectionRange;
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range,
                        message: `Circular containment: ${cycle.join(' -> ')} -> ${cycle[0]}`,
                        source: 'sysml',
                        code: 'circular-containment',
                    });
                    break; // One diagnostic per definition is enough
                }
            }
        }
        return diagnostics;
    }

    /**
     * Walk the containment chain: for a type name, find its definition,
     * check its children's types, and see if any loops back.
     */
    private followContainmentChain(
        typeName: string,
        visited: Set<string>,
        indexes: SymbolIndexes,
    ): string[] | undefined {
        if (visited.has(typeName)) {
            return [...visited];
        }

        const candidates = indexes.definitionsByName.get(typeName);
        if (!candidates || candidates.length === 0) return undefined;

        const target = candidates[0];
        const children = indexes.byParent.get(target.qualifiedName) ?? [];
        const childTypeNames = children.flatMap(c => c.typeNames).filter(t => t.length > 0);
        if (childTypeNames.length === 0) return undefined;

        visited.add(typeName);
        for (const tn of childTypeNames) {
            const cycle = this.followContainmentChain(tn, visited, indexes);
            if (cycle) return cycle;
        }
        visited.delete(typeName);
        return undefined;
    }

    /**
     * Rule: unsatisfied requirements.
     *
     * Requirement usages that are not referenced by any `satisfy` statement
     * anywhere in the workspace receive a warning. Only top-level requirement
     * usages are checked — nested requirements inside a satisfy block or
     * requirement definitions are skipped.
     */
    private checkUnsatisfiedRequirements(
        allSymbols: SysMLSymbol[],
        indexes: SymbolIndexes,
        workspaceTexts?: string[],
    ): Diagnostic[] {
        const diagnostics: Diagnostic[] = [];

        // Collect all satisfied requirement names and satisfy block line ranges.
        // Use a cache keyed by workspace version to avoid rescanning on every keystroke.
        let satisfiedNames: Set<string>;
        let satisfyBlockRanges: Map<string, Array<{ startLine: number; endLine: number }>>;

        if (workspaceTexts) {
            // Static/MCP path — no caching.
            satisfiedNames = new Set<string>();
            satisfyBlockRanges = new Map();
            for (const text of workspaceTexts) {
                this.extractSatisfyReferences(text, satisfiedNames);
                satisfyBlockRanges.set('__static__', this.extractSatisfyBlockRanges(text));
            }
        } else if (this.documentManager) {
            // Build a version fingerprint from all cached document versions.
            const uris = this.documentManager.getUris();
            const versionKey = uris.map(u => u + ':' + this.documentManager.getVersion(u)).join('|');

            if (this.satisfyCache && this.satisfyCache.versionKey === versionKey) {
                satisfiedNames = this.satisfyCache.satisfiedNames;
                satisfyBlockRanges = this.satisfyCache.satisfyBlockRanges;
            } else {
                satisfiedNames = new Set<string>();
                satisfyBlockRanges = new Map();
                for (const uri of uris) {
                    const text = this.documentManager.getText(uri);
                    if (text) {
                        this.extractSatisfyReferences(text, satisfiedNames);
                        satisfyBlockRanges.set(uri, this.extractSatisfyBlockRanges(text));
                    }
                }
                this.satisfyCache = { versionKey, satisfiedNames, satisfyBlockRanges };
            }
        } else {
            satisfiedNames = new Set<string>();
            satisfyBlockRanges = new Map();
        }

        // Find all top-level requirement usages (not defs, not nested inside satisfy blocks).
        const requirementUsages = allSymbols.filter(s =>
            s.kind === SysMLElementKind.RequirementUsage,
        );

        for (const req of requirementUsages) {
            // Skip requirements whose parent is also a requirement usage —
            // they are nested sub-requirements, not independently satisfiable.
            if (req.parentQualifiedName) {
                const parent = indexes.byQualifiedName.get(req.parentQualifiedName);
                if (parent?.kind === SysMLElementKind.RequirementUsage) continue;
            }

            // Skip requirements that appear inside a satisfy block — they are
            // redefinitions of sub-requirements, not independent requirements.
            const uriRanges = satisfyBlockRanges.get(req.uri) ?? satisfyBlockRanges.get('__static__') ?? [];
            const reqLine = req.selectionRange.start.line;
            if (uriRanges.some(r => reqLine >= r.startLine && reqLine <= r.endLine)) continue;

            // Check if this requirement is satisfied by name (simple or qualified).
            const isSatisfied =
                satisfiedNames.has(req.name) ||
                satisfiedNames.has(req.qualifiedName);

            if (!isSatisfied) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: req.selectionRange,
                    message: `Requirement '${req.name}' is not satisfied by any element`,
                    source: 'sysml',
                    code: 'unsatisfied-requirement',
                    data: { name: req.name, qualifiedName: req.qualifiedName },
                });
            }
        }

        return diagnostics;
    }

    /**
     * Extract requirement references from `satisfy` statements in a text.
     * Adds both the full qualified name and the simple (last segment) name.
     *
     * Patterns matched:
     *   satisfy QualifiedName by ...
     *   satisfy QualifiedName;
     */
    private extractSatisfyReferences(text: string, out: Set<string>): void {
        // Match: satisfy QualifiedName by ...
        //        satisfy QualifiedName;
        //        satisfy requirement X : Y;
        const stripped = this.stripComments(text);
        const re = /\bsatisfy\s+(?:requirement\s+)?([\w]+(?:::[\w]+)*)\s+(?:by\b|;|:)/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(stripped)) !== null) {
            const ref = m[1];
            out.add(ref);
            // Also add the simple (last-segment) name for matching
            const lastSeg = ref.includes('::') ? ref.split('::').pop()! : ref;
            out.add(lastSeg);
        }
    }

    /**
     * Extract the line ranges of satisfy block bodies from text.
     * Returns an array of { startLine, endLine } for each satisfy { ... } block.
     */
    private extractSatisfyBlockRanges(text: string): Array<{ startLine: number; endLine: number }> {
        const ranges: Array<{ startLine: number; endLine: number }> = [];
        const stripped = this.stripComments(text);
        const re = /\bsatisfy\b[^;{]*\{/g;
        let m: RegExpExecArray | null;

        // Pre-build a line-offset table so offset→line lookups are O(log n)
        // instead of the previous O(n) slice+split per match.
        let lineOffsets: number[] | undefined;

        while ((m = re.exec(stripped)) !== null) {
            const open = m.index + m[0].length - 1;
            let depth = 1;
            let i = open + 1;
            while (i < stripped.length && depth > 0) {
                if (stripped[i] === '{') depth++;
                if (stripped[i] === '}') depth--;
                i++;
            }
            if (depth !== 0) continue;

            // Lazily build the line-offset table on the first real match.
            if (!lineOffsets) {
                lineOffsets = [0];
                for (let j = 0; j < text.length; j++) {
                    if (text[j] === '\n') lineOffsets.push(j + 1);
                }
            }

            ranges.push({
                startLine: this.offsetToLine(lineOffsets, open),
                endLine: this.offsetToLine(lineOffsets, i - 1),
            });
        }
        return ranges;
    }

    /**
     * Rule: unverified requirements.
     *
     * In SysML v2, `satisfy` declares that a design element fulfills a
     * requirement, while `verify` declares that a verification case (test)
     * checks whether a requirement is met.  Good practice requires both.
     *
     * This rule warns when a requirement usage has no `verify` statement
     * anywhere in the workspace, regardless of satisfaction status.
     *
     * SysML v2 verify patterns detected:
     *   verify <requirement> by <verificationCase>;
     *   verify <qualifiedName>;
     *   verification case def X { verify <requirement>; }
     */
    private checkUnverifiedRequirements(
        allSymbols: SysMLSymbol[],
        indexes: SymbolIndexes,
        workspaceTexts?: string[],
    ): Diagnostic[] {
        const diagnostics: Diagnostic[] = [];

        // Collect all satisfied and verified requirement names across workspace.
        let satisfiedNames: Set<string>;
        let verifiedNames: Set<string>;
        let satisfyBlockRanges: Map<string, Array<{ startLine: number; endLine: number }>>;

        if (workspaceTexts) {
            // Static/MCP path — no caching.
            satisfiedNames = new Set<string>();
            verifiedNames = new Set<string>();
            satisfyBlockRanges = new Map();
            for (const text of workspaceTexts) {
                this.extractSatisfyReferences(text, satisfiedNames);
                this.extractVerifyReferences(text, verifiedNames);
                satisfyBlockRanges.set('__static__', this.extractSatisfyBlockRanges(text));
            }
        } else if (this.documentManager) {
            const uris = this.documentManager.getUris();
            const versionKey = uris.map(u => u + ':' + this.documentManager.getVersion(u)).join('|');

            // Reuse satisfy cache (already built by checkUnsatisfiedRequirements).
            if (this.satisfyCache && this.satisfyCache.versionKey === versionKey) {
                satisfiedNames = this.satisfyCache.satisfiedNames;
                satisfyBlockRanges = this.satisfyCache.satisfyBlockRanges;
            } else {
                satisfiedNames = new Set<string>();
                satisfyBlockRanges = new Map();
                for (const uri of uris) {
                    const text = this.documentManager.getText(uri);
                    if (text) {
                        this.extractSatisfyReferences(text, satisfiedNames);
                        satisfyBlockRanges.set(uri, this.extractSatisfyBlockRanges(text));
                    }
                }
                this.satisfyCache = { versionKey, satisfiedNames, satisfyBlockRanges };
            }

            // Build or reuse verify cache.
            if (this.verifyCache && this.verifyCache.versionKey === versionKey) {
                verifiedNames = this.verifyCache.verifiedNames;
            } else {
                verifiedNames = new Set<string>();
                for (const uri of uris) {
                    const text = this.documentManager.getText(uri);
                    if (text) {
                        this.extractVerifyReferences(text, verifiedNames);
                    }
                }
                this.verifyCache = { versionKey, verifiedNames };
            }
        } else {
            satisfiedNames = new Set<string>();
            verifiedNames = new Set<string>();
            satisfyBlockRanges = new Map();
        }

        // Check top-level requirement usages that ARE satisfied but NOT verified.
        const requirementUsages = allSymbols.filter(s =>
            s.kind === SysMLElementKind.RequirementUsage,
        );

        for (const req of requirementUsages) {
            // Skip nested sub-requirements.
            if (req.parentQualifiedName) {
                const parent = indexes.byQualifiedName.get(req.parentQualifiedName);
                if (parent?.kind === SysMLElementKind.RequirementUsage) continue;
            }

            // Skip requirements inside satisfy blocks.
            const uriRanges = satisfyBlockRanges.get(req.uri) ?? satisfyBlockRanges.get('__static__') ?? [];
            const reqLine = req.selectionRange.start.line;
            if (uriRanges.some(r => reqLine >= r.startLine && reqLine <= r.endLine)) continue;

            const isSatisfied =
                satisfiedNames.has(req.name) ||
                satisfiedNames.has(req.qualifiedName);

            const isVerified =
                verifiedNames.has(req.name) ||
                verifiedNames.has(req.qualifiedName);

            if (!isVerified) {
                const message = isSatisfied
                    ? `Requirement '${req.name}' is satisfied but has no verification case — ` +
                      `consider adding: verify ${req.name} by <VerificationCase>;`
                    : `Requirement '${req.name}' has no verification case — ` +
                      `consider adding: verify ${req.name} by <VerificationCase>;`;
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: req.selectionRange,
                    message,
                    source: 'sysml',
                    code: 'unverified-requirement',
                    data: { name: req.name, qualifiedName: req.qualifiedName },
                });
            }
        }

        return diagnostics;
    }

    /**
     * Extract requirement references from `verify` statements in text.
     * Adds both the full qualified name and the simple (last segment) name.
     *
     * Patterns matched:
     *   verify QualifiedName by ...
     *   verify QualifiedName;
     *   verify requirement QualifiedName by ...
     */
    private extractVerifyReferences(text: string, out: Set<string>): void {
        const stripped = this.stripComments(text);
        const re = /\bverify\s+(?:requirement\s+)?([\w]+(?:::[\w]+)*)\s*(?:by\b|;|:|\{)/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(stripped)) !== null) {
            const ref = m[1];
            out.add(ref);
            const lastSeg = ref.includes('::') ? ref.split('::').pop()! : ref;
            out.add(lastSeg);
        }
    }

    /**
     * Replace all SysML comments (line and block) with spaces,
     * preserving string length and newline positions so that character offsets
     * and line numbers remain valid.
     */
    private stripComments(text: string): string {
        // Replace block comments (preserve newlines), then line comments
        return text
            .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
            .replace(/\/\/[^\n]*/g, m => ' '.repeat(m.length));
    }

    /** Binary-search a sorted line-offset table to find the 0-based line for a character offset. */
    private offsetToLine(lineOffsets: number[], offset: number): number {
        let lo = 0;
        let hi = lineOffsets.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >>> 1;
            if (lineOffsets[mid] <= offset) lo = mid;
            else hi = mid - 1;
        }
        return lo;
    }

    /**
     * Rule: redefinition multiplicity must conform to base feature multiplicity.
     *
     * For `:>>` / `redefines`, this checks only the lower/upper numeric relation:
     *   base.lower <= redefined.lower <= redefined.upper <= base.upper (if bounded)
     */
    private checkRedefinitionMultiplicity(symbolsInUri: SysMLSymbol[], indexes: SymbolIndexes): Diagnostic[] {
        const diagnostics: Diagnostic[] = [];
        for (const s of symbolsInUri) {
            if (!s.typeName || !s.multiplicityRange) continue;

            // In this parser path, lowercase typeName is a strong signal for `:>> baseFeature`
            const c0 = s.typeName.charCodeAt(0);
            const isLikelyRedef = c0 >= 97 && c0 <= 122;
            if (!isLikelyRedef) continue;

            const candidates = indexes.byName.get(s.typeName) ?? [];
            const base = candidates.find(c => !!c.multiplicityRange);
            if (!base?.multiplicityRange) continue;

            const baseLower = base.multiplicityRange.lower;
            const baseUpper = base.multiplicityRange.upper;
            const curLower = s.multiplicityRange.lower;
            const curUpper = s.multiplicityRange.upper;

            const lowerOk = curLower >= baseLower;
            const upperOk = (baseUpper === '*') || (curUpper !== '*' && curUpper <= baseUpper);
            if (lowerOk && upperOk) continue;

            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: s.selectionRange,
                message:
                    `Redefinition multiplicity [${s.multiplicity ?? '?'}] is incompatible with base ` +
                    `'${base.name}' multiplicity [${base.multiplicity ?? '?'}]`,
                source: 'sysml',
                code: 'invalid-redefinition-multiplicity',
            });
        }

        return diagnostics;
    }

    /**
     * Rule: both ends of a `connect a to b` relation should resolve to ports with compatible types.
     */
    private checkPortCompatibility(text: string, uri: string, indexes: SymbolIndexes): Diagnostic[] {
        if (!text) return [];
        const diagnostics: Diagnostic[] = [];

        const re = /\bconnect\s+([A-Za-z_][\w.]*)\s+to\s+([A-Za-z_][\w.]*)/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
            const left = m[1].split('.').pop()!;
            const right = m[2].split('.').pop()!;

            const lSym = (indexes.portsByName.get(left) ?? [])[0];
            const rSym = (indexes.portsByName.get(right) ?? [])[0];
            if (!lSym || !rSym) continue;

            const lType = lSym.typeNames[0] ?? lSym.typeName;
            const rType = rSym.typeNames[0] ?? rSym.typeName;
            if (!lType || !rType || lType === rType) continue;

            const range = this.indexToRange(text, m.index, m[0].length);
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range,
                message: `Port compatibility issue: '${left}' (${lType}) is connected to '${right}' (${rType})`,
                source: 'sysml',
                code: 'incompatible-port-types',
                data: { uri },
            });
        }

        return diagnostics;
    }

    /**
     * Rule: identifiers used in constraint bodies must resolve from parent-feature scope.
     */
    private checkConstraintBodyReferences(
        text: string,
        uri: string,
        symbolsInUri: SysMLSymbol[],
        indexes: SymbolIndexes,
    ): Diagnostic[] {
        if (!text) return [];
        const diagnostics: Diagnostic[] = [];
        const blocks = this.extractConstraintBlocks(text);

        for (const b of blocks) {
            if (this.hasDocumentationOnlyConstraintBody(b.body)) {
                const trimStart = b.body.search(/\S/);
                const startInBody = trimStart >= 0 ? trimStart : 0;
                const trimmedLen = Math.max(1, b.body.trim().length);
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: this.indexToRange(text, b.bodyOffset + startInBody, trimmedLen),
                    message: 'Invalid constraint body: expected expression, found documentation text',
                    source: 'sysml',
                    code: 'invalid-constraint-body',
                    data: { uri },
                });
                continue;
            }

            const parent = this.findConstraintScopeSymbol(symbolsInUri, indexes, b.startLine);
            if (!parent) continue;

            const parentMembers = indexes.byParent.get(parent.qualifiedName) ?? [];
            if (parentMembers.length === 0) continue;

            const ignoredRanges = this.getIgnoredBodyRanges(b.body);

            const idRe = /\b([A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*)\b/g;
            let im: RegExpExecArray | null;
            while ((im = idRe.exec(b.body)) !== null) {
                if (this.isIndexInRanges(im.index, ignoredRanges)) continue;

                const expr = im[1];
                if (this.isConstraintKeyword(expr)) continue;
                if (/^\d/.test(expr)) continue;

                const path = expr.split('.');
                const ok = this.resolvePathFromParent(path, parentMembers, indexes);
                if (ok) continue;

                // For single-segment identifiers (no dots), check if the name
                // resolves in the broader scope: workspace symbols (covers
                // imports) or standard library types (covers wildcard imports
                // like `import USCustomaryUnits::*`).
                if (path.length === 1) {
                    const root = path[0];
                    if (indexes.byName.has(root) ||
                        resolveLibraryType(root) !== undefined) {
                        continue;
                    }
                }

                const absoluteStart = b.bodyOffset + im.index;
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: this.indexToRange(text, absoluteStart, expr.length),
                    message: `Unresolved constraint reference '${expr}' in scope '${parent.name}'`,
                    source: 'sysml',
                    code: 'unresolved-constraint-reference',
                    data: { uri },
                });
            }
        }

        return diagnostics;
    }

    private extractConstraintBlocks(text: string): Array<{ body: string; bodyOffset: number; startLine: number }> {
        const out: Array<{ body: string; bodyOffset: number; startLine: number }> = [];
        const re = /\b(?:require\s+)?constraint\s*\{/g;
        let m: RegExpExecArray | null;

        while ((m = re.exec(text)) !== null) {
            const open = m.index + m[0].length - 1;
            let depth = 1;
            let i = open + 1;
            while (i < text.length && depth > 0) {
                const ch = text[i];
                if (ch === '{') depth++;
                if (ch === '}') depth--;
                i++;
            }
            if (depth !== 0) continue;
            const bodyStart = open + 1;
            const bodyEnd = i - 1;
            const body = text.slice(bodyStart, bodyEnd);
            const startLine = text.slice(0, bodyStart).split('\n').length - 1;
            out.push({ body, bodyOffset: bodyStart, startLine });
        }

        return out;
    }

    private resolvePathFromParent(path: string[], parentMembers: SysMLSymbol[], indexes: SymbolIndexes): boolean {
        const root = parentMembers.find(s => s.name === path[0]);
        if (!root) return false;
        if (path.length === 1) return true;

        let typeName = root.typeNames[0] ?? root.typeName;
        for (let i = 1; i < path.length; i++) {
            if (!typeName) return false;
            const typeDefs = indexes.definitionsByName.get(typeName) ?? [];
            const typeDef = typeDefs[0];
            if (!typeDef) return false;

            const member = (indexes.byParent.get(typeDef.qualifiedName) ?? [])
                .find(s => s.name === path[i]);
            if (!member) return false;
            typeName = member.typeNames[0] ?? member.typeName;
        }

        return true;
    }

    private findContainingSymbolByLine(symbols: SysMLSymbol[], line: number): SysMLSymbol | undefined {
        return symbols
            .filter(s => s.range.start.line <= line && s.range.end.line >= line)
            .sort((a, b) => {
                const ar = (a.range.end.line - a.range.start.line) * 1000 + (a.range.end.character - a.range.start.character);
                const br = (b.range.end.line - b.range.start.line) * 1000 + (b.range.end.character - b.range.start.character);
                return ar - br;
            })[0];
    }

    private findConstraintScopeSymbol(
        symbolsInUri: SysMLSymbol[],
        indexes: SymbolIndexes,
        line: number,
    ): SysMLSymbol | undefined {
        let scope = this.findContainingSymbolByLine(symbolsInUri, line);
        while (scope) {
            const members = indexes.byParent.get(scope.qualifiedName) ?? [];
            if (members.length > 0) return scope;
            if (!scope.parentQualifiedName) return scope;
            scope = indexes.byQualifiedName.get(scope.parentQualifiedName);
        }
        return undefined;
    }

    private buildSymbolIndexes(allSymbols: SysMLSymbol[]): SymbolIndexes {
        const byName = new Map<string, SysMLSymbol[]>();
        const byParent = new Map<string, SysMLSymbol[]>();
        const byQualifiedName = new Map<string, SysMLSymbol>();
        const definitionsByName = new Map<string, SysMLSymbol[]>();
        const portsByName = new Map<string, SysMLSymbol[]>();

        for (const s of allSymbols) {
            const nameList = byName.get(s.name) ?? [];
            nameList.push(s);
            byName.set(s.name, nameList);

            byQualifiedName.set(s.qualifiedName, s);

            if (s.parentQualifiedName) {
                const children = byParent.get(s.parentQualifiedName) ?? [];
                children.push(s);
                byParent.set(s.parentQualifiedName, children);
            }

            if (isDefinition(s.kind)) {
                const defs = definitionsByName.get(s.name) ?? [];
                defs.push(s);
                definitionsByName.set(s.name, defs);
            }

            if (s.kind === SysMLElementKind.PortUsage || s.kind === SysMLElementKind.PortDef) {
                const ports = portsByName.get(s.name) ?? [];
                ports.push(s);
                portsByName.set(s.name, ports);
            }
        }

        return { byName, byParent, byQualifiedName, definitionsByName, portsByName };
    }

    private isConstraintKeyword(value: string): boolean {
        return CONSTRAINT_KEYWORDS.has(value);
    }

    private getIgnoredBodyRanges(body: string): Array<{ start: number; end: number }> {
        const ranges: Array<{ start: number; end: number }> = [];

        // Block comments: /* ... */
        const blockRe = /\/\*[\s\S]*?\*\//g;
        let m: RegExpExecArray | null;
        while ((m = blockRe.exec(body)) !== null) {
            ranges.push({ start: m.index, end: m.index + m[0].length });
        }

        // Line comments: // ...
        const lineRe = /\/\/[^\n\r]*/g;
        while ((m = lineRe.exec(body)) !== null) {
            ranges.push({ start: m.index, end: m.index + m[0].length });
        }

        return ranges;
    }

    private isIndexInRanges(index: number, ranges: Array<{ start: number; end: number }>): boolean {
        for (const r of ranges) {
            if (index >= r.start && index < r.end) return true;
        }
        return false;
    }

    private hasDocumentationOnlyConstraintBody(body: string): boolean {
        const trimmed = body.trim();
        if (!trimmed) return false;

        // Remove comments to inspect non-comment content.
        const withoutComments = trimmed
            .replace(/\/\*[\s\S]*?\*\//g, ' ')
            .replace(/\/\/[^\n\r]*/g, ' ')
            .trim();

        // Documentation marker with no expression-like operators/tokens.
        if (withoutComments === 'doc' || withoutComments === 'comment') {
            return true;
        }

        // If only prose-like tokens remain and there are no expression operators,
        // treat it as misplaced documentation text.
        const hasExprSignal = /[<>=!+\-*/%()[\].,:]|\b(and|or|not)\b/.test(withoutComments);
        const proseOnly = /^[A-Za-z_\s]+$/.test(withoutComments);
        return proseOnly && !hasExprSignal;
    }

    private indexToRange(text: string, start: number, length: number) {
        const prefix = text.slice(0, start);
        const startLine = prefix.split('\n').length - 1;
        const startChar = start - (prefix.lastIndexOf('\n') + 1);
        return {
            start: { line: startLine, character: startChar },
            end: { line: startLine, character: startChar + length },
        };
    }

    private dedupeDiagnostics(diags: Diagnostic[]): Diagnostic[] {
        const seen = new Set<string>();
        const out: Diagnostic[] = [];
        for (const d of diags) {
            const key = [
                d.code ?? 'no-code',
                d.range.start.line,
                d.range.start.character,
                d.range.end.line,
                d.range.end.character,
                d.message,
            ].join('|');
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(d);
        }
        return out;
    }

    private checkDuplicateDefinitions(symbols: SysMLSymbol[]): Diagnostic[] {
        const diagnostics: Diagnostic[] = [];
        const definitionsByScope = new Map<string, Map<string, SysMLSymbol[]>>();

        for (const symbol of symbols) {
            if (!isDefinition(symbol.kind)) continue;

            const scope = symbol.parentQualifiedName ?? '__root__';
            let scopeMap = definitionsByScope.get(scope);
            if (!scopeMap) {
                scopeMap = new Map();
                definitionsByScope.set(scope, scopeMap);
            }

            let defs = scopeMap.get(symbol.name);
            if (!defs) {
                defs = [];
                scopeMap.set(symbol.name, defs);
            }
            defs.push(symbol);
        }

        for (const scopeMap of definitionsByScope.values()) {
            for (const [name, defs] of scopeMap) {
                if (defs.length > 1) {
                    for (const def of defs) {
                        diagnostics.push({
                            severity: DiagnosticSeverity.Warning,
                            range: def.selectionRange,
                            message: `Duplicate definition: '${name}' is defined ${defs.length} times in the same scope`,
                            source: 'sysml',
                            code: 'duplicate-definition',
                        });
                    }
                }
            }
        }

        return diagnostics;
    }
}
