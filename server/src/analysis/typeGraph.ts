import { SysMLElementKind, SysMLSymbol, isDefinition } from '../symbols/sysmlElements.js';

/**
 * Super-type graph for SysML v2 type checking.
 *
 * The graph models the SysML v2 generalization relationships between
 * types as a directed graph whose edges point from a type to each of its
 * super-types.  Edges are *kinded* — every edge records *why* the target
 * is a super-type of the source (explicit specialization, subsetting,
 * redefinition, feature typing, or an implicit/default super-type that the
 * language injects automatically).
 *
 * Two capabilities are built on top of the graph:
 *
 *  1. {@link SuperTypeGraph.specializes} — a depth-first search (DFS) that
 *     answers "does type A specialize (directly or transitively) type B?".
 *  2. Implicit super-type injection — every definition is automatically
 *     linked to the root library type for its kind (e.g. `part def Wheel`
 *     gains an implicit edge to `Parts::Part`), mirroring the implicit
 *     generalizations defined by the SysML v2 specification and the Pilot
 *     Implementation.
 *
 * Node identity is the *simple* (unqualified) type name — the last segment
 * of a qualified reference such as `ISQ::MassValue` → `MassValue`.  This
 * matches how the symbol table indexes names and keeps lookups robust
 * whether references are written qualified or unqualified.
 */

/** The reason a target node is a super-type of a source node. */
export enum EdgeKind {
    /** Explicit `:>` / `specializes` / `subclassifier` on a definition. */
    Specialization = 'specialization',
    /** Explicit `:>` / `subsets` on a usage (feature). */
    Subsetting = 'subsetting',
    /** Explicit `:>>` / `redefines` on a usage (feature). */
    Redefinition = 'redefinition',
    /** Explicit `:` / `typed by` — a usage typed by its definition. */
    FeatureTyping = 'feature-typing',
    /** Injected default super-type for the element's kind (e.g. `Parts::Part`). */
    Implicit = 'implicit',
}

/** A directed, kinded super-type edge. */
export interface SuperTypeEdge {
    /** Simple name of the super-type node this edge points to. */
    readonly target: string;
    /** Why {@link target} is a super-type of the source node. */
    readonly kind: EdgeKind;
    /** The reference text as written (may be qualified, e.g. `Parts::Part`). */
    readonly reference: string;
}

/**
 * The implicit (default) super-type injected for each definition kind.
 *
 * Mirrors the implicit generalization map of the SysML v2 specification and
 * the Systems-Modeling Pilot Implementation.  Each entry maps a definition
 * kind to the qualified name of the standard-library type it implicitly
 * specializes.  The simple name (last segment) is used as the graph node.
 *
 * @see https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation
 * @see sysml.library/Systems Library (Parts.sysml, Items.sysml, …)
 */
export const IMPLICIT_DEFINITION_SUPERTYPES: ReadonlyMap<SysMLElementKind, string> = new Map([
    [SysMLElementKind.PartDef, 'Parts::Part'],
    [SysMLElementKind.ItemDef, 'Items::Item'],
    [SysMLElementKind.AttributeDef, 'Base::DataValue'],
    [SysMLElementKind.EnumDef, 'Base::DataValue'],
    [SysMLElementKind.PortDef, 'Ports::Port'],
    [SysMLElementKind.ConnectionDef, 'Connections::Connection'],
    [SysMLElementKind.InterfaceDef, 'Interfaces::Interface'],
    [SysMLElementKind.AllocationDef, 'Allocations::Allocation'],
    [SysMLElementKind.ActionDef, 'Actions::Action'],
    [SysMLElementKind.StateDef, 'States::StateAction'],
    [SysMLElementKind.CalcDef, 'Calculations::Calculation'],
    [SysMLElementKind.ConstraintDef, 'Constraints::ConstraintCheck'],
    [SysMLElementKind.RequirementDef, 'Requirements::RequirementCheck'],
    [SysMLElementKind.UseCaseDef, 'UseCases::UseCase'],
    [SysMLElementKind.AnalysisCaseDef, 'AnalysisCases::AnalysisCase'],
    [SysMLElementKind.VerificationCaseDef, 'VerificationCases::VerificationCase'],
    [SysMLElementKind.ViewDef, 'Views::View'],
    [SysMLElementKind.ViewpointDef, 'Views::Viewpoint'],
    [SysMLElementKind.RenderingDef, 'Views::Rendering'],
    [SysMLElementKind.OccurrenceDef, 'Occurrences::Occurrence'],
    [SysMLElementKind.MetadataDef, 'Metaobjects::Metaobject'],
]);

/**
 * Specialization edges that hold *within* the standard library between the
 * implicit root types.  These let the DFS reason across kinds (for example
 * `Part :> Item :> Object :> Occurrence`) without requiring the bundled
 * library to be fully parsed into the workspace symbol table.
 *
 * Sourced from the bundled `sysml.library` (e.g. `part def Part :> Item`,
 * `item def Item :> Object`).  Targets are simple names.
 */
const BASE_TYPE_HIERARCHY: ReadonlyArray<readonly [string, string]> = [
    ['Part', 'Item'],
    ['Item', 'Object'],
    ['Object', 'Occurrence'],
    ['Action', 'Occurrence'],
    ['StateAction', 'Action'],
    ['Calculation', 'Action'],
    ['ConstraintCheck', 'BooleanEvaluation'],
    ['RequirementCheck', 'ConstraintCheck'],
    ['Case', 'Calculation'],
    ['AnalysisCase', 'Case'],
    ['VerificationCase', 'Case'],
    ['UseCase', 'Case'],
    ['Connection', 'Part'],
    ['Interface', 'Connection'],
    ['Allocation', 'Connection'],
    ['Occurrence', 'Anything'],
    ['DataValue', 'Anything'],
    ['Port', 'Occurrence'],
    ['View', 'Part'],
    ['Viewpoint', 'RequirementCheck'],
    ['Rendering', 'Part'],
    ['Metaobject', 'Anything'],
];

/**
 * The two disjoint top-level families of the SysML v2 type system, rooted
 * directly under `Anything`.  A type cannot belong to both: occurrences
 * (things that exist in space/time — parts, items, actions, ports, …) are
 * disjoint from data values (attributes, enumerations).  A specialization
 * that crosses this boundary is a type error.
 */
export enum TypeFamily {
    /** Structural / behavioural things (rooted at `Occurrence`). */
    Occurrence = 'occurrence',
    /** Data values (rooted at `DataValue`). */
    DataValue = 'data',
}

/** Return the simple (unqualified) name — the last `::`-separated segment. */
export function simpleName(reference: string): string {
    const stripped = reference.replace(/^~/, '');
    const idx = stripped.lastIndexOf('::');
    return idx >= 0 ? stripped.slice(idx + 2) : stripped;
}

/**
 * A directed graph of super-type relationships with kinded edges.
 */
export class SuperTypeGraph {
    /** Adjacency list: node simple name → its outgoing super-type edges. */
    private readonly edges = new Map<string, SuperTypeEdge[]>();

    /** Add a kinded super-type edge from `source` to `reference`. */
    addEdge(source: string, reference: string, kind: EdgeKind): void {
        const from = simpleName(source);
        const target = simpleName(reference);
        if (!from || !target || from === target) return; // ignore empty / self-loops

        let list = this.edges.get(from);
        if (!list) {
            list = [];
            this.edges.set(from, list);
        }
        // De-duplicate identical (target, kind) edges.
        if (list.some(e => e.target === target && e.kind === kind)) return;
        list.push({ target, kind, reference });
    }

    /** Get the outgoing super-type edges declared directly on `name`. */
    getSupertypeEdges(name: string): readonly SuperTypeEdge[] {
        return this.edges.get(simpleName(name)) ?? [];
    }

    /**
     * Depth-first search: does `sub` specialize `sup` (directly or
     * transitively) following super-type edges?
     *
     * @param sub  the candidate sub-type name (qualified or simple)
     * @param sup  the candidate super-type name (qualified or simple)
     * @param edgeKinds optional set restricting which edge kinds may be
     *   traversed.  When omitted, every edge kind is followed.
     */
    specializes(sub: string, sup: string, edgeKinds?: ReadonlySet<EdgeKind>): boolean {
        const start = simpleName(sub);
        const goal = simpleName(sup);
        if (start === goal) return true;

        const visited = new Set<string>();
        const stack: string[] = [start];
        while (stack.length > 0) {
            const current = stack.pop()!;
            if (visited.has(current)) continue;
            visited.add(current);

            for (const edge of this.edges.get(current) ?? []) {
                if (edgeKinds && !edgeKinds.has(edge.kind)) continue;
                if (edge.target === goal) return true;
                if (!visited.has(edge.target)) stack.push(edge.target);
            }
        }
        return false;
    }

    /**
     * Collect every (transitive) super-type of `name`, including the
     * starting node itself.  Uses the same DFS traversal as
     * {@link specializes}.
     */
    collectSupertypes(name: string, edgeKinds?: ReadonlySet<EdgeKind>): Set<string> {
        const result = new Set<string>();
        const start = simpleName(name);
        const stack: string[] = [start];
        while (stack.length > 0) {
            const current = stack.pop()!;
            if (result.has(current)) continue;
            result.add(current);
            for (const edge of this.edges.get(current) ?? []) {
                if (edgeKinds && !edgeKinds.has(edge.kind)) continue;
                if (!result.has(edge.target)) stack.push(edge.target);
            }
        }
        return result;
    }

    /** Total number of nodes with at least one outgoing edge (for tests). */
    get nodeCount(): number {
        return this.edges.size;
    }
}

/**
 * Build a {@link SuperTypeGraph} from a set of symbols.
 *
 * Edges are created from:
 *  - explicit specialization (`:>`) on definitions → {@link EdgeKind.Specialization}
 *  - explicit subsetting (`:>`) on usages → {@link EdgeKind.Subsetting}
 *  - feature typing (`:`) on usages → {@link EdgeKind.FeatureTyping}
 *  - the injected implicit default super-type for each definition kind →
 *    {@link EdgeKind.Implicit}
 *
 * The fixed standard-library root hierarchy (`Part :> Item :> …`) is always
 * seeded so cross-kind reasoning works even when the library itself is not
 * present in the symbol set.
 */
export function buildSuperTypeGraph(symbols: readonly SysMLSymbol[]): SuperTypeGraph {
    const graph = new SuperTypeGraph();

    // Seed the standard-library implicit root hierarchy.
    for (const [sub, sup] of BASE_TYPE_HIERARCHY) {
        graph.addEdge(sub, sup, EdgeKind.Implicit);
    }

    for (const symbol of symbols) {
        const def = isDefinition(symbol.kind);

        if (def) {
            // Definitions: `typeNames` and `specializationNames` are super-types.
            for (const tn of symbol.typeNames) {
                graph.addEdge(symbol.name, tn, EdgeKind.Specialization);
            }
            for (const sn of symbol.specializationNames) {
                graph.addEdge(symbol.name, sn, EdgeKind.Specialization);
            }

            // Inject the implicit default super-type for this kind.
            const implicit = IMPLICIT_DEFINITION_SUPERTYPES.get(symbol.kind);
            if (implicit) {
                graph.addEdge(symbol.name, implicit, EdgeKind.Implicit);
            }
        } else {
            // Usages: `:` typing and `:>` subsetting / `:>>` redefinition.
            for (const tn of symbol.typeNames) {
                graph.addEdge(symbol.name, tn, EdgeKind.FeatureTyping);
            }
            for (const sn of symbol.specializationNames) {
                graph.addEdge(symbol.name, sn, EdgeKind.Subsetting);
            }
        }
    }

    return graph;
}

/**
 * Classify a type into one of the two disjoint top-level {@link TypeFamily}
 * branches by walking its super-types via DFS, or `undefined` when the type
 * is not connected to either root (e.g. an unknown / external type).
 *
 * Note: when a type is (incorrectly) connected to *both* roots — which only
 * happens in the presence of a malformed cross-family specialization — no
 * decision is made.  To classify a definition by its declared kind alone
 * (independent of its possibly-erroneous edges), use
 * {@link familyOfDefinitionKind}.
 */
export function classifyFamily(graph: SuperTypeGraph, name: string): TypeFamily | undefined {
    const supertypes = graph.collectSupertypes(name);
    const isOccurrence = supertypes.has('Occurrence');
    const isData = supertypes.has('DataValue');
    // If somehow connected to both (malformed input), prefer no decision.
    if (isOccurrence && !isData) return TypeFamily.Occurrence;
    if (isData && !isOccurrence) return TypeFamily.DataValue;
    return undefined;
}

/**
 * The simple (unqualified) name of the implicit root super-type for a
 * definition kind, or `undefined` when the kind has no implicit root.
 * e.g. `PartDef` → `Part`, `AttributeDef` → `DataValue`.
 */
export function implicitRootName(kind: SysMLElementKind): string | undefined {
    const qualified = IMPLICIT_DEFINITION_SUPERTYPES.get(kind);
    return qualified ? simpleName(qualified) : undefined;
}

/**
 * Classify a definition into its top-level {@link TypeFamily} purely from its
 * element kind, via the implicit default super-type for that kind.  This is
 * deterministic and unaffected by any (possibly erroneous) explicit
 * specialization edges the definition declares.
 */
export function familyOfDefinitionKind(kind: SysMLElementKind): TypeFamily | undefined {
    const implicitRoot = IMPLICIT_DEFINITION_SUPERTYPES.get(kind);
    if (!implicitRoot) return undefined;
    return simpleName(implicitRoot) === 'DataValue'
        ? TypeFamily.DataValue
        : TypeFamily.Occurrence;
}

