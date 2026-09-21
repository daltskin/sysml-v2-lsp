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

/**
 * What a query's `name` denotes -- disambiguates a plain declared name from
 * a `<shortName>` alias from a (possibly partial) qualified path, since a
 * bare string alone can't tell those apart (a short name and a long name can
 * be spelled identically, and nothing marks a query as "this is a short
 * name" other than the caller saying so).
 *
 * - `'name'` (the default when `kind` is omitted and `name` contains no
 *   `::`) -- matches a declared long `name` only. Never matches a short-name
 *   alias, even one spelled the same.
 * - `'shortName'` -- matches a declared `<shortName>` alias only, by its
 *   plain value (no angle brackets in `name` -- those are grammar syntax for
 *   *declaring* a short name, not part of the name itself, and are not
 *   accepted here). Never matches a long name.
 * - `'qualifiedName'` (the default when `kind` is omitted and `name`
 *   contains `::`) -- matches by `qualifiedName`; see `ElementLookupQuery.name`'s
 *   doc comment for exactly how, including the `scope` interaction.
 */
export type ElementLookupQueryKind = 'name' | 'shortName' | 'qualifiedName';

/**
 * One name to look up. `kind` says which of the three forms `name` is;
 * when omitted, it's inferred from `name`'s shape (`'qualifiedName'` if it
 * contains `::`, else `'name'`) -- `'shortName'` is never inferred and must
 * be requested explicitly, since a short name can't otherwise be told apart
 * from a same-spelled long name. For `kind: 'qualifiedName'`, `name` need
 * not be the complete/absolute path -- see `scope`'s doc comment for how an
 * unscoped or partial path is resolved.
 */
export interface ElementLookupQuery {
    name: string;
    /** See `ElementLookupQueryKind`'s doc comment. */
    kind?: ElementLookupQueryKind;
    /**
     * A namespace path, not a reference to resolve -- a literal filter over
     * `qualifiedName` data the provider already has, not import/visibility
     * resolution (see this fork's "Scope: unscoped only, for now" doc). For
     * `kind: 'name'`/`'shortName'`, restricts the match to within this
     * namespace's subtree. For `kind: 'qualifiedName'`, instead completes
     * `name` as a path relative to `scope`. Omitted or empty means "no
     * scope": `'name'`/`'shortName'` search the whole workspace, and a
     * `'qualifiedName'` query matches anywhere it occurs, not just as an
     * absolute path -- both the prior, unscoped default. This is also how a
     * client would search a standard-library package (there's no separate
     * include-library flag), once the library is reachable through this
     * provider's symbol table at all -- not yet true, see "Known remaining
     * gaps."
     */
    scope?: string;
}

export interface SysMLElementLookupParams {
    queries: ElementLookupQuery[];
}

/** One exact match for a lookup query. */
export interface ElementMatch {
    /** The element's declared long name, e.g. `"Wheel"`. Always present. */
    name: string;
    /** The element's declared `<shortName>` alias, e.g. `"whl"`. Omitted
     *  (not an empty string) when the element has no short name. */
    shortName?: string;
    qualifiedName: string;
    /** SysML-specific element type keyword, e.g. 'part def', 'part'. Same
     *  value space as `SysMLElementDTO.type` (`sysmlModelTypes.ts`). */
    type: string;
    uri: string;
    range: RangeDTO;
}

export interface SysMLElementLookupResult {
    /**
     * Matches keyed by each query's `name`, not returned positionally. An
     * empty array for a name means no match was found *among what has been
     * indexed so far* -- check `indexingComplete` before reading that as
     * "name is available". Exactly one match is the normal case; two or
     * more means the same exact name resolves to more than one distinct
     * element -- the API takes no position on whether that's a genuine
     * collision, since the same simple name can legitimately exist in
     * different packages.
     *
     * Batching the same `name` string twice in one request with a different
     * `kind` or `scope` isn't meaningfully supported under this keying (e.g.
     * `{ name: "whl", kind: "name" }` and `{ name: "whl", kind: "shortName" }`
     * in the same batch collide on the `"whl"` key, the second overwriting
     * the first) -- issue two requests instead.
     */
    results: Record<string, ElementMatch[]>;
    /**
     * `false` while the initial workspace scan (or a `didChangeWatchedFiles`
     * -driven reindex) is still in progress. An empty result while this is
     * `false` means "not found yet", not "doesn't exist".
     */
    indexingComplete: boolean;
}
