# Copilot Instructions

## Specification conformance

Every change that affects how SysML or KerML is parsed, named, resolved, validated or reported (symbols, `sysml/model`, diagnostics, MCP output) must be validated against the latest OMG specifications before it is proposed:

1. Identify the current formal versions at <https://www.omg.org/spec/SysML> and <https://www.omg.org/spec/KerML> (at the time of writing: SysML 2.0 Language, `formal/26-03-02`; KerML 1.0, `formal/26-03-01`).
2. Check the behaviour against the relevant textual notation productions in [grammar/SysMLv2Parser.g4](../grammar/SysMLv2Parser.g4), and against the specification's abstract syntax and semantics clauses. The parser is generated from this file, which is the release pinned by `GRAMMAR_BRANCH` in the [Makefile](../Makefile) of [daltskin/sysml-v2-grammar](https://github.com/daltskin/sysml-v2-grammar), itself derived from the specification. If the specification is newer than that release, check the upstream grammar too, and update the pinned release with `make update-grammar` where needed.
3. Cite the specification clause or grammar production that justifies the behaviour in the pull request description, and in a code comment where the reason is not obvious.
4. Add a regression test for the specified behaviour that fails without the change.
5. Where the server knowingly departs from the specification, document the departure in the changelog and code rather than leaving it implicit.
