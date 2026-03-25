# Changelog

## [0.9.0]

### Added

- Semantic rules: circular specialization, circular containment, unsatisfied requirements, unverified requirements
- Syntax error suppression for known grammar limitation zones (constraint bodies, calc/analysis expressions)
- Workspace file scanning improvements
- Document formatting provider

### Changed

- Parser self-healing DFA: SLL→LL fallback builds correct DFA states in-place instead of clearing the entire snapshot
- Library index handles `<shortName>` and quoted long-name syntax
- Satisfy/verify caches on `SemanticValidator` avoid redundant workspace scans
- Type-name extraction strips leaked keyword concatenations from `getText()`

## [0.8.0]

### Added

- Update grammar files with Full OMG SysML v2 spec conformance: grammar now passes all official training, validation, and example files (309 .sysml files across 4 suites)
- `make update-grammar` now automatically rebuilds parser and regenerates DFA snapshot
- Standard library smoke test retained in LSP repo (`test/unit/conformance.test.ts`)

### Changed

- Grammar updated with conformance fixes: `endOccurrenceUsageElement` named ends, `unreservedKeyword` for 14 keywords used as names in OMG standard library, `//*..*/` block comment support, `REF` in body expressions, prefix metadata on enum members, `send` without inline payload, `actionNodeMember` reordering, `REGULAR_COMMENT` in expressions, `definitionBodyItem` in `functionBodyPart`
- `update-grammar` Makefile target now sources grammar from `daltskin/sysml-v2-grammar` (was `daltskin/grammars-v4`)

## [0.7.0]

### Added

- Workspace-wide semantic validation with cross-file symbol indexes (byName, byParent, byQualifiedName, definitionsByName, portsByName)
- Three new validation rules: redefinition multiplicity, port type compatibility, constraint body references
- Quick-fix code actions for all three new rules (align multiplicity, switch port endpoint, suggest nearest member)
- Context-aware completions: port endpoints in `connect` blocks, type annotation filtering, workspace definition symbols
- Semantic feedback in hover tooltips — shows diagnostics and repair hints at the hovered position
- Cached semantic diagnostics per document version to avoid redundant revalidation
- MCP preview tool falls back to cached/loaded documents when `code` parameter is omitted

### Changed

- Unused-definition rule narrowed to PartDef/ActionDef, excludes types with base types, promoted from Hint to Warning, now workspace-scoped
- Grammar updated to OMG "2026-02 - SysML v2 Release" — removed local `end <keyword>` patch in favour of upstream `endFeatureUsage` rule
- MCP non-visual tools annotated with explicit "NOT Visualization" routing guidance
- MCP preview response stripped to minimal render data (mermaidMarkup + title)
- MCP tool routing guidance and aliases expanded for diagnostics, validation, and file-focused preview requests

### Fixed

- Semantic validator signal quality: reduced specialization false positives and downgraded low-value unused-definition reports to warnings
- Document-close diagnostics race: pending validation timers are cancelled and diagnostics publishing is guarded for closed documents

## [0.6.0]

### Added

- Shared utilities: `identUtils.ts` for identifier handling, `symbolKindMapping.ts` for LSP SymbolKind mapping
- Keywords now derived from ANTLR grammar at runtime — no manual list to maintain
- Grammar support for `end` keyword syntax in interface/connection definitions
- DFA snapshot infrastructure for parser serialisation

### Changed

- Code actions use structured diagnostic data instead of message parsing
- Semantic tokens provider integrates lexer token types for operators/punctuation
- Library indexing supports qualified name resolution
- Parser retries with cleared DFA on error
- Refactored providers to use shared utility modules

### Removed

- Hand-maintained keyword list (replaced by grammar-derived extraction)

## [0.5.1]

### Changed

- Semantic validator: library type and feature reference checks
- Symbol table: improved keyword and redefinition pattern handling

## [0.5.0]

### Changed

- Symbol table uses `ruleIndex` instead of `constructor.name` for minification safety
- Removed committed dist/ build artefacts from repository

## [0.4.1]

### Fixed

- Web client graceful shutdown
- Release pipeline fix

## [0.4.0]

### Added

- Web client: browser-based SysML editor (`clients/web/`)
- Python LSP client: Jupyter notebook demo

### Changed

- Library index, MCP server, and symbol table improvements

## [0.3.1]

### Fixed

- esbuild: added `keepNames` for debugging
- Removed committed dist/ build artefacts

## [0.3.0]

### Added

- Mermaid diagram preview with 6 diagram types, focus mode, and diff mode
- Complexity analyser: structural metrics with composite 0–100 index
- Semantic validator: unresolved types, invalid multiplicity, duplicate definitions
- MCP tools: `preview`, `getDiagnostics`, `getComplexity`
- Code action quick-fixes: naming conventions, doc stubs, empty enum placeholders
- Library type-level indexing with Go-to-Definition into standard library
- Multiplicity and documentation extraction from parse tree
- LSP `sysml/serverStats`, `sysml/clearCache`, `sysml/status` requests

### Changed

- MCP `validate` response: `syntaxErrors` + `semanticIssues` (was `errors` + `errorCount`)
- Symbol `typeName` → `typeNames` (array)
- Diagnostics computed synchronously (removed background worker)
- Parser simplified to single-pass (removed SLL/LL fallback)
- esbuild output changed from ESM to CJS

### Removed

- Background parse worker thread and DFA warm-up
- Text-scanning reference finder (replaced by symbol-table lookups)

## [0.2.0]

### Added

- Custom LSP request `sysml/model` for full semantic model with scoped queries
- MCP server (`sysml-mcp` CLI): 7 tools, 3 resources, 3 prompts
- Standard library: 94 bundled SysML v2 / KerML files
- LSP providers: inlay hints, call/type hierarchy, signature help, code lens, document links, workspace symbols, linked editing, selection ranges, code actions, formatting
- Keyword validation with "did you mean?" suggestions
- npm package, Python LSP client, background parse worker
- `make update-library`, `make package-server`, `make test-package`

### Changed

- Go-to-definition falls back to standard library
- Element kind enum expanded to 55 kinds

## [0.1.7]

### Changed

- Keyword validator: expanded SysML element coverage
- New parser, symbol table, and provider tests

## [0.1.6]

### Fixed

- Keyword validation diagnostic messages
- Python LSP client diagnostics handling

## [0.1.5]

### Added

- Inlay hints, call hierarchy improvements
- Python LSP client with README
- Client restructured under `clients/vscode/`

## [0.1.4]

### Added

- MCP core module extracted from MCP server
- Constraint parsing tests, grammar refinements

## [0.1.3]

### Fixed

- `constructor.name` minification breaking code lens
- ESM bundles renamed to `.mjs` for Node 20 compatibility
- Bundled deps moved to devDependencies (zero runtime deps)

## [0.1.2]

### Fixed

- Removed unused `antlr4-c3` dependency

## [0.1.1]

### Fixed

- Dropped Node 18 from CI (Vite 7 requires Node 20+)
- Release pipeline and trusted publishing fixes

## [0.1.0]

### Added

- Initial LSP server with ANTLR4-based SysML v2 parser
- LSP providers: diagnostics, document symbols, hover, go-to-definition, find references, completion, semantic tokens, folding, rename
- VS Code Language Client extension
- vitest unit tests, GitHub Actions CI/CD, Dev Container
