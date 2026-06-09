/**
 * Type Errors Example
 *
 * Every definition in this package deliberately violates one of the SysML v2
 * semantic type-checking rules. Open it with the language server to see the
 * diagnostics, or run:
 *
 *   python3 clients/python/sysml_lsp_client.py examples/type-errors.sysml
 *
 * For each section the expected diagnostic `code` is noted in a comment.
 */
package TypeErrors {

    // ── 1. Incompatible specialization (disjoint type families) ───────────
    // `part def` is rooted at Parts::Part (occurrence family); `attribute def`
    // is rooted at Base::DataValue (data family). A part may not specialize a
    // data value — they belong to disjoint type families.
    // → code: incompatible-specialization
    attribute def Mass;

    part def Wheel :> Mass;

    // The reverse direction is equally invalid: a data value cannot specialize
    // an occurrence.
    // → code: incompatible-specialization
    part def Person;

    attribute def ForceUnit :> Person;

    // ── 2. Circular specialization chain ──────────────────────────────────
    // A :> B, B :> C, C :> A forms a generalization cycle. A type cannot be
    // its own (transitive) super-type.
    // → code: circular-specialization
    part def A :> C;

    part def B :> A;

    part def C :> B;

    // ── 3. Circular containment (mutual ownership) ────────────────────────
    // Container owns a feature typed by Contained, and Contained owns a
    // feature typed by Container — an infinite containment loop.
    // → code: circular-containment
    part def Container {
        part inner : Contained;
    }

    part def Contained {
        part outer : Container;
    }

    // ── 4. Unresolved type reference ──────────────────────────────────────
    // `Gearbox` is never defined anywhere in the workspace.
    // → code: unresolved-type
    part def Transmission {
        part gearbox : Gearbox;
    }

    // ── 5. Invalid multiplicity bounds ────────────────────────────────────
    // The lower bound (5) exceeds the upper bound (2).
    // → code: invalid-multiplicity
    part def Axle {
        part bearings : Bearing[5..2];
    }

    part def Bearing;

    // ── 6. Empty enumeration ──────────────────────────────────────────────
    // An enum definition that declares no values is almost certainly a
    // mistake.
    // → code: empty-enum
    enum def Color;
}
