/**
 * DTO types for the `sysml/elementLookup` custom LSP request.
 *
 * Batch, exact-match lookup of elements by name across the whole workspace
 * symbol table -- unscoped: no import/namespace-aware (§7.5) resolution, no
 * fuzzy or substring matching. Intended for a client that needs to know
 * "does an element with exactly this name exist, and how many are there" --
 * e.g. duplicate-name detection -- which the standard `workspace/symbol`
 * request can't answer precisely (its query matching is spec-recommended to
 * be relaxed/fuzzy, the opposite of what an exact existence check needs).
 */

import type { RangeDTO } from './sysmlModelTypes.js';

/** One name to look up: a bare simple name (matches anywhere) or a fully
 *  qualified name ("Pkg::Name", matches only that exact qualifiedName). */
export interface ElementLookupQuery {
    name: string;
}

export interface SysMLElementLookupParams {
    queries: ElementLookupQuery[];
}

/** One exact match for a lookup query. */
export interface ElementMatch {
    qualifiedName: string;
    /** SysML-specific element type keyword, e.g. 'part def', 'part'. Same
     *  value space as `SysMLElementDTO.type` (`sysmlModelTypes.ts`). */
    type: string;
    uri: string;
    range: RangeDTO;
}

export interface SysMLElementLookupResult {
    /**
     * One entry per query, in request order. An empty array means the name
     * doesn't exist anywhere in the workspace. Exactly one match is the
     * normal case. Two or more matches means a genuine duplicate/collision --
     * two distinct elements sharing this exact name (or qualifiedName).
     */
    results: ElementMatch[][];
}
