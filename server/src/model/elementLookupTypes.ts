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
 * One name to look up, in one of three forms:
 * - A fully qualified name ("Pkg::Name") -- matches only that exact
 *   `qualifiedName` when `scope` is omitted; when `scope` is given, `name`
 *   is instead a path *relative to* `scope` (matches `` `${scope}::${name}` ``
 *   exactly), so `{ name: "A::Wheel", scope: "X" }` matches only
 *   `X::A::Wheel`, not a same-named `A::Wheel` declared elsewhere.
 * - A `<shortName>` alias, delimited with angle brackets exactly like the
 *   grammar's own `<shortName>` syntax (e.g. `"<whl>"`) -- matches only a
 *   declared short-name alias, at any nesting depth, within `scope`'s
 *   subtree when given. Never matches a long name, even one that happens to
 *   equal the bracketed text.
 * - A bare simple name (no brackets, no `::`) -- matches only a declared
 *   long `name`, at any nesting depth, within `scope`'s subtree when given.
 *   Never matches a short-name alias.
 */
export interface ElementLookupQuery {
    name: string;
    /**
     * A namespace path (e.g. `"A"` or `"A::B"`), not a reference to resolve.
     * For a bare or `<shortName>`-bracketed `name`, restricts the match to
     * within this namespace's subtree, at any nesting depth
     * (`sym.qualifiedName.startsWith(scope + "::")`). For a fully qualified
     * `name` (one containing `::`), instead makes `name` a path relative to
     * `scope` -- the match target becomes `` `${scope}::${name}` `` instead
     * of `name` alone. Omitted or empty means "no scope": bare/short-name
     * queries search the whole workspace, and a qualified `name` is matched
     * anywhere it appears as a trailing path segment (not just as an
     * absolute path) -- both the prior, unscoped default.
     *
     * This is also how a client searches a standard-library package once one
     * is available to search: there is no separate "include the standard
     * library" flag -- a library package is just another namespace, so
     * `scope: "ScalarValues"` (for example) is the intended way to search
     * within it. NOT YET POSSIBLE in practice: the standard library isn't
     * part of the symbol table this provider searches at all yet (it's
     * indexed separately, see `library/libraryIndex.ts`), so no `scope`
     * value currently reaches it -- see this fork's "Known remaining gaps."
     *
     * This is a literal namespace-path filter only -- it does not resolve
     * imports or visibility (see this fork's "Scope: unscoped only, for
     * now" doc); it just narrows *where in the tree* to search, or completes
     * a relative path, using data the provider already has.
     */
    scope?: string;
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
     * Matches keyed by each query's `name`, not returned positionally. An
     * empty array for a name means no match was found *among what has been
     * indexed so far* -- check `indexingComplete` before reading that as
     * "name is available". Exactly one match is the normal case; two or
     * more means the same exact name resolves to more than one distinct
     * element -- the API takes no position on whether that's a genuine
     * collision, since the same simple name can legitimately exist in
     * different packages.
     *
     * Batching the same `name` twice in one request with different `scope`
     * values isn't meaningfully supported under this keying -- issue two
     * requests instead.
     */
    results: Record<string, ElementMatch[]>;
    /**
     * `false` while the initial workspace scan (or a `didChangeWatchedFiles`
     * -driven reindex) is still in progress. An empty result while this is
     * `false` means "not found yet", not "doesn't exist".
     */
    indexingComplete: boolean;
}
