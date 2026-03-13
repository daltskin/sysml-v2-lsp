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
    'and', 'or', 'not', 'if', 'then', 'else', 'true', 'false',
    'require', 'constraint', 'subject', 'return', 'doc', 'comment',
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

        // Resolve the root segment for qualified names (e.g., "ISQ::MassValue" → "ISQ")
        const rootSegment = symbol.typeName.split('::')[0];

        // Skip if the type is defined in the document, standard library, or indexed library packages
        if (
            allSymbolNames.has(symbol.typeName) ||
            allSymbolNames.has(rootSegment) ||
            STANDARD_LIBRARY_TYPES.has(symbol.typeName) ||
            STANDARD_LIBRARY_TYPES.has(rootSegment) ||
            libraryNames.has(rootSegment) ||
            // Pattern match for ISQ quantity value types (e.g., LengthValue, TorqueValue)
            isISQValueType(symbol.typeName) ||
            // Check the scanned library type index (covers all ISQ/SI types including
            // those with digits like CartesianSpatial3dCoordinateFrame)
            resolveLibraryType(symbol.typeName) !== undefined ||
            resolveLibraryType(rootSegment) !== undefined ||
            // Names starting with lowercase are feature references (subsettings
            // via :>), not type references — don't flag them as unresolved types.
            // e.g. "attribute x :> distancePerVolume" references a feature, not a type.
            (symbol.typeName.charCodeAt(0) >= 97 && symbol.typeName.charCodeAt(0) <= 122)
        ) {
            return [];
        }

        const isMandatory = symbol.multiplicityRange &&
            symbol.multiplicityRange.lower >= 1;

        const severity = isMandatory
            ? DiagnosticSeverity.Error
            : DiagnosticSeverity.Warning;

        let message = `Type '${symbol.typeName}' is not defined in the current document or standard library`;
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
            data: { typeName: symbol.typeName },
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

        if (opts?.text && opts.uri) {
            diagnostics.push(...instance.checkPortCompatibility(opts.text, opts.uri, indexes));
            diagnostics.push(...instance.checkConstraintBodyReferences(opts.text, opts.uri, symbolsInUri, indexes));
        }

        return instance.dedupeDiagnostics(diagnostics);
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
