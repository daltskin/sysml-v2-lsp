/**
 * Allowed Cyclical Types Example
 *
 * Not every cycle is an error. SysML v2 permits a definition to reference
 * *itself* — recursive decomposition — because each instance terminates the
 * recursion in practice (a tree has leaf nodes, an org chart has individual
 * contributors, and so on). The language server distinguishes these valid
 * self-referential patterns from the genuine cycles flagged in
 * `type-errors.sysml`.
 *
 * None of the definitions below should produce a `circular-containment` or
 * `circular-specialization` diagnostic. Verify with:
 *
 *   python3 clients/python/sysml_lsp_client.py examples/allowed-cycles.sysml
 */
package AllowedCycles {

    // ── 1. Recursive behaviour (self-typed action feature) ────────────────
    // An action that decomposes into sub-actions of the *same* kind. The `[*]`
    // multiplicity allows zero sub-functions, so the recursion bottoms out.
    abstract action def Function {
        doc /* A behaviour that may decompose into sub-functions of its own kind. */
        action subfunctions[*] : Function;
    }

    // ── 2. Recursive structure (tree / composite pattern) ─────────────────
    // A classic tree: every node may own any number of child nodes of its own
    // type. Leaf nodes simply have zero children.
    part def TreeNode {
        doc /* A node that may own any number of child nodes of the same type. */
        part children[*] : TreeNode;
    }

    // ── 3. Recursive assembly (parts made of sub-parts) ───────────────────
    // An assembly that contains further sub-assemblies. Bounded multiplicity
    // makes the intent explicit but the self-reference is still valid.
    part def Assembly {
        doc /* An assembly that may contain bounded sub-assemblies of its own type. */
        part subassemblies[0..10] : Assembly;
        part fasteners[*] : Fastener;
    }

    part def Fastener {
        doc /* A component used to join assemblies together. */
    }

    // ── 4. Recursive organisation (manager → reports) ─────────────────────
    // An employee who manages other employees. Optional `manager` and any
    // number of `reports`, all typed by the same definition.
    part def Employee {
        doc /* A person who may manage, and be managed by, other employees. */
        ref part manager[0..1] : Employee;
        part reports[*] : Employee;
        attribute name : String;
    }

    // ── 5. Self-referential data structure (linked list) ──────────────────
    // A node that optionally points to the next node — the data-value
    // equivalent of recursive structure.
    item def ListNode {
        doc /* A list element that optionally points to the next element. */
        attribute value : Integer;
        ref item next[0..1] : ListNode;
    }

    // ── 6. Mutually recursive trees that DO terminate ─────────────────────
    // Folder contains Files and sub-Folders. Files never contain Folders, so
    // there is no mutual-containment cycle — only the Folder self-reference,
    // which is allowed.
    part def Folder {
        doc /* A folder that may contain files and nested sub-folders. */
        part files[*] : File;
        part subfolders[*] : Folder;
    }

    part def File {
        doc /* A leaf node that never contains folders, so no cycle forms. */
        attribute sizeBytes : Integer;
    }
}
