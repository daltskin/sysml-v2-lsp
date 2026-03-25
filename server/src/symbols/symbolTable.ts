import { ParserRuleContext, TerminalNode, Token } from 'antlr4ng';
import { Range } from 'vscode-languageserver/node.js';
import { MultiplicityBoundsContext, SysMLv2Parser } from '../generated/SysMLv2Parser.js';
import { ParseResult } from '../parser/parseDocument.js';
import { contextToRange, tokenToRange } from '../parser/positionUtils.js';
import { Scope } from './scope.js';
import { SysMLElementKind, SysMLSymbol, isUsage as isUsageKind } from './sysmlElements.js';

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
        const results: SysMLSymbol[] = [];
        for (const symbol of this.symbols.values()) {
            if (symbol.name === name) {
                results.push(symbol);
            }
        }
        return results;
    }

    /**
     * Find all symbols in a given URI.
     */
    getSymbolsForUri(uri: string): SysMLSymbol[] {
        return this.symbolsByUri.get(uri) ?? [];
    }

    /**
     * Get all symbols in the table.
     */
    getAllSymbols(): SysMLSymbol[] {
        return Array.from(this.symbols.values());
    }

    /**
     * Get the global scope for resolution.
     */
    getGlobalScope(): Scope {
        return this.globalScope;
    }

    /**
     * Find the symbol at a given position in a document.
     */
    findSymbolAtPosition(uri: string, line: number, character: number): SysMLSymbol | undefined {
        const symbols = this.getSymbolsForUri(uri);
        // Find the most specific (smallest range) symbol containing the position
        let best: SysMLSymbol | undefined;
        let bestSize = Infinity;

        for (const symbol of symbols) {
            const r = symbol.selectionRange;
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
                    best = symbol;
                    bestSize = size;
                }
            }
        }
        return best;
    }

    /**
     * Find all references to a symbol name across all documents.
     * Matches symbols whose name equals the target OR whose typeNames include it.
     */
    findReferences(name: string): SysMLSymbol[] {
        const results: SysMLSymbol[] = [];
        for (const symbol of this.symbols.values()) {
            if (symbol.name === name || symbol.typeNames.includes(name)) {
                results.push(symbol);
            }
        }
        return results;
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
        if (existing) {
            for (const sym of existing) {
                this.symbols.delete(sym.qualifiedName);
            }
        }
        this.symbolsByUri.set(uri, []);
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
        const uriSymbols = this.symbolsByUri.get(uri) ?? [];
        uriSymbols.push(symbol);
        this.symbolsByUri.set(uri, uriSymbols);
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
        };
    }

    /**
     * Infer the SysML element kind from the ANTLR rule name.
     */
    private inferKind(
        ruleName: string,
        _ctx: ParserRuleContext,
    ): SysMLElementKind | undefined {
        const lower = ruleName.toLowerCase();

        // Package - match at the Package level (not PackageDeclaration) so that
        // the sibling PackageBody inherits the package's qualified name.
        if (lower === 'package' || lower === 'librarypackage') {
            return SysMLElementKind.Package;
        }

        // Definitions - use exact match or prefix match to avoid false positives
        if (lower === 'partdefinition') return SysMLElementKind.PartDef;
        if (lower === 'attributedefinition') return SysMLElementKind.AttributeDef;
        if (lower === 'portdefinition') return SysMLElementKind.PortDef;
        if (lower === 'connectiondefinition') return SysMLElementKind.ConnectionDef;
        if (lower === 'interfacedefinition') return SysMLElementKind.InterfaceDef;
        if (lower === 'actiondefinition') return SysMLElementKind.ActionDef;
        if (lower === 'statedefinition') return SysMLElementKind.StateDef;
        if (lower === 'requirementdefinition') return SysMLElementKind.RequirementDef;
        if (lower === 'constraintdefinition') return SysMLElementKind.ConstraintDef;
        if (lower === 'itemdefinition') return SysMLElementKind.ItemDef;
        if (lower === 'allocationdefinition') return SysMLElementKind.AllocationDef;
        if (lower === 'usecasedefinition') return SysMLElementKind.UseCaseDef;
        if (lower === 'enumerationdefinition') return SysMLElementKind.EnumDef;
        if (lower === 'calculationdefinition' || lower === 'calcdefinition') return SysMLElementKind.CalcDef;
        if (lower === 'viewdefinition') return SysMLElementKind.ViewDef;
        if (lower === 'viewpointdefinition') return SysMLElementKind.ViewpointDef;
        if (lower === 'metadatadefinition') return SysMLElementKind.MetadataDef;

        // Usages - use exact match
        if (lower === 'partusage') return SysMLElementKind.PartUsage;
        if (lower === 'attributeusage') return SysMLElementKind.AttributeUsage;
        if (lower === 'portusage') return SysMLElementKind.PortUsage;
        if (lower === 'connectionusage') return SysMLElementKind.ConnectionUsage;
        if (lower === 'actionusage') return SysMLElementKind.ActionUsage;
        if (lower === 'stateusage') return SysMLElementKind.StateUsage;
        if (lower === 'requirementusage') return SysMLElementKind.RequirementUsage;
        if (lower === 'constraintusage') return SysMLElementKind.ConstraintUsage;
        if (lower === 'itemusage') return SysMLElementKind.ItemUsage;
        if (lower === 'allocationusage') return SysMLElementKind.AllocationUsage;
        if (lower === 'usecaseusage') return SysMLElementKind.UseCaseUsage;
        if (lower === 'includeusecaseusage') return SysMLElementKind.IncludeUseCaseUsage;
        if (lower === 'actorusage') return SysMLElementKind.ActorUsage;
        if (lower === 'subjectusage') return SysMLElementKind.SubjectUsage;
        if (lower === 'stakeholderusage') return SysMLElementKind.StakeholderUsage;
        if (lower === 'referenceusage') return SysMLElementKind.RefUsage;
        if (lower === 'interfaceusage') return SysMLElementKind.InterfaceUsage;
        if (lower === 'performactionusage') return SysMLElementKind.PerformActionUsage;
        if (lower === 'exhibitstateusage') return SysMLElementKind.ExhibitStateUsage;
        if (lower === 'transitionusage') return SysMLElementKind.TransitionUsage;
        if (lower === 'occurrencedefinition') return SysMLElementKind.OccurrenceDef;
        if (lower === 'occurrenceusage') return SysMLElementKind.OccurrenceUsage;
        if (lower === 'renderingdefinition') return SysMLElementKind.RenderingDef;
        if (lower === 'viewusage') return SysMLElementKind.ViewUsage;
        if (lower === 'viewpointusage') return SysMLElementKind.ViewpointUsage;
        if (lower === 'verificationcasedefinition') return SysMLElementKind.VerificationCaseDef;
        if (lower === 'verificationcaseusage') return SysMLElementKind.VerificationCaseUsage;
        if (lower === 'analysiscasedefinition') return SysMLElementKind.AnalysisCaseDef;
        if (lower === 'analysiscaseusage') return SysMLElementKind.AnalysisCaseUsage;

        // Alias member
        if (lower === 'aliasmember') return SysMLElementKind.Alias;

        return undefined;
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
                const childRule = this.getRuleName(child);
                if (
                    childRule.toLowerCase().includes('identification') ||
                    childRule.toLowerCase().includes('declarationname') ||
                    childRule.toLowerCase().includes('qualifiedname') ||
                    childRule.toLowerCase() === 'name'
                ) {
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
        text = text.replace(
            /(redefines|subsets|references|connect|bind|first|then|flow|allocate|assign|accept|send|decide|merge|join|fork|via|default)\b.*/i,
            '',
        );

        // 1. "specializes A, B" or ":> A, B" (including quoted names)
        const specMatch = text.match(/(?:specializes|:>|:>>)\s*('[^']+'|[A-Za-z_]\w*(?:::\w+)*)(?:\s*,\s*(?:'[^']+'|[A-Za-z_]\w*(?:::\w+)*))*/);
        if (specMatch) {
            const specStr = text.substring(text.indexOf(specMatch[0]) + specMatch[0].indexOf(specMatch[1]));
            for (const part of specStr.split(',')) {
                const qm = part.match(/'([^']+)'/);
                if (qm) { names.push(qm[1]); continue; }
                const m = part.trim().match(/^([A-Za-z_]\w*(?:::\w+)*)/);
                if (m) names.push(m[1]);
            }
            return names;
        }

        // 2. "definedby A, B" — note getText() strips spaces
        const defByMatch = text.match(/definedby\s*([A-Za-z_]\w*(?:::\w+)*(?:\s*,\s*[A-Za-z_]\w*(?:::\w+)*)*)/);
        if (defByMatch) {
            for (const part of defByMatch[1].split(',')) {
                const m = part.trim().match(/^([A-Za-z_]\w*(?:::\w+)*)/);
                if (m) names.push(m[1]);
            }
            return names;
        }

        // 3. ": A, B" (typing shorthand, including quoted names)
        const typingMatch = text.match(/:(?![:>])\s*('[^']+'|[A-Za-z_]\w*(?:::\w+)*)/);
        if (typingMatch) {
            // Extract from after the colon
            const fullMatchIdx = text.indexOf(typingMatch[0]);
            const afterColon = text.substring(fullMatchIdx + 1).trim();
            for (const part of afterColon.split(',')) {
                const qm = part.match(/'([^']+)'/);
                if (qm) { names.push(qm[1]); continue; }
                const m = part.trim().match(/^([A-Za-z_]\w*(?:::\w+)*)/);
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
            const rn = this.getRuleName(child).toLowerCase();
            if (
                rn.includes('specialization') ||
                rn.includes('subclassification') ||
                rn.includes('typing') ||
                rn.includes('conjugation') ||
                rn.includes('disjoining')
            ) {
                // These rules contain qualified-name children;
                // extract all identifier-like tokens.
                const childText = child.getText();
                // Strip leading keywords / operators
                const stripped = childText
                    .replace(/^(specializes|:>|:>>|:\s|definedby|subsets|redefines|references|conjugates|disjoints)/i, '');
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
                // Do NOT recurse into redefinitions/subsettings — those
                // reference existing features, not this symbol's type.
                rn.includes('declaration') ||
                rn.includes('featurespecialization') ||
                rn.includes('typings') ||
                rn.includes('usagecompletion') ||
                rn === 'usage' ||
                rn === 'definition'
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
                const ruleName = this.getRuleName(child).toLowerCase();
                if (ruleName.includes('comment') || ruleName.includes('doc') || ruleName.includes('documentation')) {
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
        const rule = this.getRuleName(ctx).toLowerCase();
        return (
            rule.includes('prefixmetadata') ||
            rule.includes('extensionkeyword') ||
            rule === 'occurrencedefinitionprefix' ||
            rule === 'occurrenceusageprefix' ||
            rule === 'definitionprefix' ||
            rule === 'basicdefinitionprefix' ||
            rule === 'typeprefix' ||
            rule === 'featureprefix' ||
            rule === 'basicfeatureprefix' ||
            rule === 'endfeatureprefix'
        );
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
            const rule = this.getRuleName(child).toLowerCase();
            if (rule === 'prefixmetadatamember' || rule === 'prefixmetadataannotation') {
                const name = this.extractTextFromSubtree(child);
                if (name) annotations.push(name);
            } else if (
                rule.includes('prefix') ||
                rule.includes('extensionkeyword') ||
                rule === 'definition' ||
                rule === 'usage'
            ) {
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
     */
    private isKeyword(text: string): boolean {
        const keywords = new Set([
            'about', 'abstract', 'accept', 'action', 'actor', 'after', 'alias',
            'all', 'allocate', 'allocation', 'analysis', 'and', 'as', 'assert',
            'assign', 'assume', 'attribute', 'bind', 'binding', 'bool', 'by',
            'calc', 'case', 'comment', 'concern', 'connect', 'connection',
            'constraint', 'decide', 'def', 'default', 'defined', 'dependency',
            'derived', 'do', 'doc', 'else', 'end', 'entry', 'enum', 'event',
            'exhibit', 'exit', 'expose', 'false', 'feature', 'filter', 'first',
            'flow', 'for', 'fork', 'frame', 'from', 'hastype', 'if', 'implies',
            'import', 'in', 'include', 'individual', 'inout', 'interface',
            'istype', 'item', 'join', 'language', 'library', 'locale', 'merge',
            'message', 'meta', 'metadata', 'multiplicity', 'namespace', 'nonunique',
            'not', 'null', 'objective', 'occurrence', 'of', 'or', 'ordered', 'out',
            'package', 'parallel', 'part', 'perform', 'port', 'private',
            'protected', 'public', 'readonly', 'redefines', 'ref', 'references',
            'render', 'rendering', 'rep', 'require', 'requirement', 'return',
            'satisfy', 'send', 'snapshot', 'specializes', 'stakeholder', 'state',
            'subject', 'subsets', 'succession', 'then', 'timeslice', 'to', 'transition',
            'true', 'type', 'use', 'variant', 'variation', 'verification', 'verify',
            'view', 'viewpoint', 'when', 'while', 'xor',
        ]);
        return keywords.has(text);
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
