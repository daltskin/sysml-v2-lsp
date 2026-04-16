/**
 * Model Complexity Analyzer for SysML v2 documents.
 *
 * Computes structural complexity metrics analogous to cyclomatic complexity
 * in imperative languages (C#, Java, etc.).
 *
 * In traditional code, cyclomatic complexity = E − N + 2P (edges, nodes,
 * connected components in the control flow graph).  SysML models have no
 * control flow, but we can measure equivalent structural properties:
 *
 *   1. Element count          — total definitions + usages (≈ lines of code)
 *   2. Definition count       — reusable types
 *   3. Usage count            — instances / references
 *   4. Max nesting depth      — deepest package→def→usage chain (≈ nesting)
 *   5. Avg children per def   — fan-out / breadth
 *   6. Coupling (type refs)   — cross-definition type references (≈ coupling)
 *   7. Unused definitions     — dead definitions (≈ dead code)
 *   8. Documentation coverage — % of definitions with doc comments
 *   9. Advanced behavior/use  — specialization links, perform/transition usage,
 *                               calc-chain depth, action complexity, stdlib refs
 *  10. Complexity index       — weighted composite (0 = trivial, 100 = complex)
 *
 * The complexity index is deliberately opinionated. It combines size,
 * depth, coupling, fan-out, documentation debt, and advanced behavioral
 * signals into one score that can be displayed in a status bar item.
 */

import { SysMLElementKind, SysMLSymbol, isDefinition, isUsage } from '../symbols/sysmlElements.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Individual metrics for a single definition. */
export interface DefinitionComplexity {
    /** Qualified name */
    qualifiedName: string;
    /** Element kind */
    kind: string;
    /** Number of direct children (features) */
    childCount: number;
    /** Nesting depth from root */
    depth: number;
    /** Number of distinct type references made by children */
    typeRefs: number;
    /** Whether it has documentation */
    hasDoc: boolean;
    /** Per-definition complexity score */
    score: number;
}

/** Document-level complexity report. */
export interface ComplexityReport {
    /** Total symbols (definitions + usages + packages + other) */
    totalElements: number;
    /** Number of definitions */
    definitions: number;
    /** Number of usages */
    usages: number;
    /** Number of packages */
    packages: number;
    /** Maximum nesting depth */
    maxDepth: number;
    /** Average children per definition */
    avgChildrenPerDef: number;
    /** Total cross-definition type references */
    couplingCount: number;
    /** Number of defined-but-never-referenced definitions */
    unusedDefinitions: number;
    /** Percentage of definitions with documentation (0–100) */
    documentationCoverage: number;
    /** Overall complexity index (0–100) */
    complexityIndex: number;
    /** Human-readable complexity rating */
    rating: 'trivial' | 'simple' | 'moderate' | 'complex' | 'very complex';
    /** Per-definition breakdown (sorted by score, descending) */
    hotspots: DefinitionComplexity[];
}

// ---------------------------------------------------------------------------
// Weights for the composite index
// ---------------------------------------------------------------------------

/** Tuneable weights — sum should equal 1.0 */
const WEIGHTS = {
    /** Raw element count contribution (log-scaled) — slightly higher so
     *  large, feature-rich documents score proportionally higher. */
    size: 0.25,
    /** Max nesting depth */
    depth: 0.20,
    /** Coupling / type references per definition */
    coupling: 0.25,
    /** Inverse documentation coverage (less docs = more complex) */
    docDebt: 0.10,
    /** Average fan-out (children per def) */
    fanOut: 0.20,
};

interface AdvancedSignals {
    specializationLinks: number;
    performUsages: number;
    transitionUsages: number;
    stdLibTypeRefs: number;
    maxCalcChainDepth: number;
    actionComplexityBonus: number;
    behaviorByDef: Map<string, number>;
}

// ---------------------------------------------------------------------------
// Main analysis function
// ---------------------------------------------------------------------------

/**
 * Analyse a set of symbols and produce a complexity report.
 *
 * @param symbols - All symbols for the document(s) being analysed.
 * @returns A full complexity report.
 */
export function analyseComplexity(symbols: SysMLSymbol[]): ComplexityReport {
    if (symbols.length === 0) {
        return emptyReport();
    }

    const defs = symbols.filter(s => isDefinition(s.kind));
    const usages = symbols.filter(s => isUsage(s.kind));
    const packages = symbols.filter(s => s.kind === SysMLElementKind.Package);

    // --- Nesting depth ---
    const depthMap = computeDepths(symbols);
    const maxDepth = Math.max(...Array.from(depthMap.values()), 0);
    const byQualifiedName = new Map(symbols.map(s => [s.qualifiedName, s]));

    // --- Children per definition ---
    const childCounts = new Map<string, number>();
    for (const d of defs) {
        childCounts.set(d.qualifiedName, 0);
    }
    for (const s of symbols) {
        if (s.parentQualifiedName && childCounts.has(s.parentQualifiedName)) {
            childCounts.set(s.parentQualifiedName, (childCounts.get(s.parentQualifiedName) ?? 0) + 1);
        }
    }
    const avgChildrenPerDef = defs.length > 0
        ? round(Array.from(childCounts.values()).reduce((a, b) => a + b, 0) / defs.length)
        : 0;

    // --- Coupling (type refs that point to definitions in this document) ---
    const defNames = new Set(defs.map(d => d.name));
    let couplingCount = 0;
    const typeRefsPerDef = new Map<string, number>();
    for (const d of defs) {
        typeRefsPerDef.set(d.qualifiedName, 0);
    }

    // --- Advanced SysML feature signals ---
    const advanced = computeAdvancedSignals(symbols, defs, byQualifiedName);
    for (const s of usages) {
        for (const tn of s.typeNames) {
            if (defNames.has(tn)) {
                couplingCount++;
                // attribute to the parent definition
                if (s.parentQualifiedName && typeRefsPerDef.has(s.parentQualifiedName)) {
                    typeRefsPerDef.set(
                        s.parentQualifiedName,
                        (typeRefsPerDef.get(s.parentQualifiedName) ?? 0) + 1,
                    );
                }
            }
        }
    }

    // --- Unused definitions ---
    const referencedTypes = new Set(
        usages.flatMap(s => s.typeNames),
    );
    const unusedDefinitions = defs.filter(
        d => d.kind !== SysMLElementKind.EnumDef && !referencedTypes.has(d.name),
    ).length;

    // --- Documentation coverage ---
    const documentedDefs = defs.filter(d => d.documentation).length;
    const documentationCoverage = defs.length > 0
        ? round((documentedDefs / defs.length) * 100)
        : 100; // no defs ⇒ 100 %

    // --- Per-definition hotspots ---
    const hotspots: DefinitionComplexity[] = defs.map(d => {
        const cc = childCounts.get(d.qualifiedName) ?? 0;
        const dp = depthMap.get(d.qualifiedName) ?? 0;
        const tr = typeRefsPerDef.get(d.qualifiedName) ?? 0;
        const hasDoc = !!d.documentation;
        const behaviorSignal = advanced.behaviorByDef.get(d.qualifiedName) ?? 0;
        const score = computeDefScore(cc, dp, tr, hasDoc, behaviorSignal);
        return {
            qualifiedName: d.qualifiedName,
            kind: d.kind,
            childCount: cc,
            depth: dp,
            typeRefs: tr,
            hasDoc,
            score,
        };
    }).sort((a, b) => b.score - a.score);

    // --- Composite index ---
    // Fold advanced SysML feature usage into the existing dimensions so the
    // score remains comparable while accounting for richer modelling features.
    const enrichedDepth = Math.max(maxDepth, advanced.maxCalcChainDepth + 1);
    const enrichedCoupling = couplingCount
        + advanced.specializationLinks
        + Math.round(advanced.performUsages * 0.5)
        + Math.round(advanced.transitionUsages * 0.5)
        + Math.round(advanced.stdLibTypeRefs * 0.6);
    const enrichedFanOut = avgChildrenPerDef + advanced.actionComplexityBonus;

    const complexityIndex = computeIndex(
        symbols.length,
        enrichedDepth,
        enrichedCoupling,
        defs.length,
        enrichedFanOut,
        documentationCoverage,
    );

    return {
        totalElements: symbols.length,
        definitions: defs.length,
        usages: usages.length,
        packages: packages.length,
        maxDepth,
        avgChildrenPerDef,
        couplingCount,
        unusedDefinitions,
        documentationCoverage,
        complexityIndex,
        rating: indexToRating(complexityIndex),
        hotspots,
    };
}

function computeAdvancedSignals(
    symbols: SysMLSymbol[],
    defs: SysMLSymbol[],
    byQualifiedName: Map<string, SysMLSymbol>,
): AdvancedSignals {
    const defNames = new Set(defs.map(d => d.name));
    const behaviorByDef = new Map<string, number>();
    for (const d of defs) {
        behaviorByDef.set(d.qualifiedName, 0);
    }

    let specializationLinks = 0;
    let performUsages = 0;
    let transitionUsages = 0;
    let stdLibTypeRefs = 0;
    let maxCalcChainDepth = 0;
    let actionComplexityBonus = 0;

    const addBehavior = (qualifiedName: string | undefined, amount: number): void => {
        if (!qualifiedName || !behaviorByDef.has(qualifiedName)) return;
        behaviorByDef.set(qualifiedName, (behaviorByDef.get(qualifiedName) ?? 0) + amount);
    };

    for (const d of defs) {
        specializationLinks += d.typeNames.length;
        addBehavior(d.qualifiedName, Math.min(3, d.typeNames.length));
    }

    for (const s of symbols) {
        switch (s.kind) {
            case SysMLElementKind.PerformActionUsage:
                performUsages++;
                addBehavior(s.parentQualifiedName, 2);
                break;
            case SysMLElementKind.CalcUsage:
                addBehavior(s.parentQualifiedName, 2);
                break;
            case SysMLElementKind.CalcDef:
                addBehavior(s.parentQualifiedName, 1);
                break;
            case SysMLElementKind.TransitionUsage:
                transitionUsages++;
                addBehavior(s.parentQualifiedName, 2);
                break;
            case SysMLElementKind.ExhibitStateUsage:
                addBehavior(s.parentQualifiedName, 1);
                break;
            default:
                break;
        }

        if (s.kind === SysMLElementKind.ActionDef) {
            const localBehavior = symbols.filter(c => c.parentQualifiedName === s.qualifiedName)
                .reduce((score, c) => {
                    if (c.kind === SysMLElementKind.PerformActionUsage) return score + 2;
                    if (c.kind === SysMLElementKind.CalcUsage || c.kind === SysMLElementKind.CalcDef) return score + 2;
                    if (c.kind === SysMLElementKind.ActionUsage) return score + 1;
                    return score;
                }, 0);
            actionComplexityBonus += Math.min(4, localBehavior / 4);
            addBehavior(s.qualifiedName, Math.min(4, localBehavior));
        }

        if (s.kind === SysMLElementKind.CalcUsage || s.kind === SysMLElementKind.CalcDef) {
            const chainDepth = calcChainDepth(s, byQualifiedName);
            if (chainDepth > maxCalcChainDepth) {
                maxCalcChainDepth = chainDepth;
            }
            addBehavior(s.parentQualifiedName, Math.min(3, chainDepth));
        }

        for (const typeName of s.typeNames) {
            if (defNames.has(typeName)) continue;
            if (looksLikeStdLibType(typeName)) {
                stdLibTypeRefs++;
                addBehavior(s.parentQualifiedName, 1);
            }
        }
    }

    return {
        specializationLinks,
        performUsages,
        transitionUsages,
        stdLibTypeRefs,
        maxCalcChainDepth,
        actionComplexityBonus,
        behaviorByDef,
    };
}

function calcChainDepth(symbol: SysMLSymbol, byQualifiedName: Map<string, SysMLSymbol>): number {
    let depth = 1;
    let cursor = symbol.parentQualifiedName ? byQualifiedName.get(symbol.parentQualifiedName) : undefined;
    while (cursor && (cursor.kind === SysMLElementKind.CalcUsage || cursor.kind === SysMLElementKind.CalcDef)) {
        depth++;
        cursor = cursor.parentQualifiedName ? byQualifiedName.get(cursor.parentQualifiedName) : undefined;
    }
    return depth;
}

function looksLikeStdLibType(typeName: string): boolean {
    if (!typeName) return false;
    if (typeName.includes('::')) return true;

    const commonStdLibTypes = new Set([
        'String', 'Boolean', 'Integer', 'Natural', 'Real', 'Complex', 'Number',
        'Map', 'OrderedMap', 'Set', 'Sequence', 'Bag', 'Vector', 'KeyValuePair',
        'Duration', 'Time', 'DateTime', 'Mass', 'Length', 'Speed', 'Acceleration',
    ]);
    return commonStdLibTypes.has(typeName);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function emptyReport(): ComplexityReport {
    return {
        totalElements: 0,
        definitions: 0,
        usages: 0,
        packages: 0,
        maxDepth: 0,
        avgChildrenPerDef: 0,
        couplingCount: 0,
        unusedDefinitions: 0,
        documentationCoverage: 100,
        complexityIndex: 0,
        rating: 'trivial',
        hotspots: [],
    };
}

/** Compute the nesting depth of every symbol (0 = top-level). */
function computeDepths(symbols: SysMLSymbol[]): Map<string, number> {
    const result = new Map<string, number>();
    const byQN = new Map(symbols.map(s => [s.qualifiedName, s]));

    function depth(qn: string): number {
        if (result.has(qn)) return result.get(qn)!;
        const sym = byQN.get(qn);
        if (!sym || !sym.parentQualifiedName) {
            result.set(qn, 0);
            return 0;
        }
        const d = depth(sym.parentQualifiedName) + 1;
        result.set(qn, d);
        return d;
    }

    for (const s of symbols) {
        depth(s.qualifiedName);
    }
    return result;
}

/**
 * Compute the composite complexity index (0–100).
 *
 * Each sub-metric is normalised to 0–1 using a sigmoid/log curve so the
 * final number stays readable even for very large models.
 */
function computeIndex(
    elementCount: number,
    maxDepth: number,
    coupling: number,
    defCount: number,
    avgFanOut: number,
    docCoverage: number, // 0–100
): number {
    // Normalise each metric to 0–1
    const sizeN = clamp(Math.log2(Math.max(elementCount, 1)) / 10); // 1024 elements ≈ 1.0
    const depthN = clamp(maxDepth / 8);                             // depth 8 ≈ 1.0
    const couplingN = defCount > 0
        ? clamp((coupling / defCount) / 5)                          // 5 refs/def ≈ 1.0
        : 0;
    const fanOutN = clamp(avgFanOut / 15);                          // 15 children/def ≈ 1.0
    const docDebtN = clamp(1 - docCoverage / 100);                  // 0% docs ≈ 1.0

    const raw =
        WEIGHTS.size * sizeN +
        WEIGHTS.depth * depthN +
        WEIGHTS.coupling * couplingN +
        WEIGHTS.fanOut * fanOutN +
        WEIGHTS.docDebt * docDebtN;

    return Math.round(raw * 100);
}

/** Per-definition score (0–100), used for hotspot ranking. */
function computeDefScore(
    childCount: number,
    depth: number,
    typeRefs: number,
    hasDoc: boolean,
    behaviorSignal = 0,
): number {
    const cc = clamp(childCount / 15) * 30;
    const dp = clamp(depth / 6) * 20;
    const tr = clamp(typeRefs / 5) * 25;
    const dc = hasDoc ? 0 : 15;
    const bs = clamp(behaviorSignal / 8) * 10;
    return Math.round(Math.min(100, cc + dp + tr + dc + bs));
}

function indexToRating(index: number): ComplexityReport['rating'] {
    if (index <= 10) return 'trivial';
    if (index <= 25) return 'simple';
    if (index <= 50) return 'moderate';
    if (index <= 75) return 'complex';
    return 'very complex';
}

function clamp(value: number): number {
    return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
    return Math.round(value * 100) / 100;
}
