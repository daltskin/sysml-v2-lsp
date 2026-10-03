# SysML v2 Language Server

[![npm](https://img.shields.io/npm/v/sysml-v2-lsp?logo=npm)](https://www.npmjs.com/package/sysml-v2-lsp)

[![SysML v2.0 Language Support VS Code Marketplace](https://img.shields.io/badge/Install-VS%20Code%20Marketplace-007ACC?logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=JamieD.sysml-v2-support)

A [Language Server Protocol (LSP)](https://microsoft.github.io/language-server-protocol/) implementation for [SysML v2](https://www.omgsysml.org/SysML-2.htm).

## Features

| Feature                 | Status | Description                                              |
| ----------------------- | ------ | -------------------------------------------------------- |
| **Diagnostics**         | ✅     | Syntax error reporting with red squiggles                |
| **Document Symbols**    | ✅     | Outline panel with SysML model structure                 |
| **Hover**               | ✅     | Element kind, type, and documentation on hover           |
| **Go to Definition**    | ✅     | Ctrl+Click navigation to declarations                    |
| **Find References**     | ✅     | Find all usages of a symbol                              |
| **Code Completion**     | ✅     | Keywords, snippets, and symbol suggestions               |
| **Semantic Tokens**     | ✅     | Rich, context-aware syntax highlighting                  |
| **Folding Ranges**      | ✅     | Collapsible `{ }` blocks and comments                    |
| **Rename**              | ✅     | Rename symbol and all references                         |
| **Semantic Validation** | ✅     | Unresolved types, invalid multiplicity, duplicates       |
| **Code Actions**        | ✅     | Quick-fixes: naming, doc stubs, empty enums, unused defs |
| **Complexity Analysis** | ✅     | Structural metrics, composite index, hotspot detection   |
| **Mermaid Preview**     | ✅     | 6 diagram types with auto-detect, focus, and diff modes  |
| **MCP Server**          | ✅     | AI-assisted modelling via `sysml-mcp` CLI                |

## Quick Start

### Install from Marketplace

Install via the VS Code extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=JamieD.sysml-v2-support).

### Dev Container (recommended)

Open in GitHub Codespaces or VS Code Dev Containers — everything is pre-installed, including Python 3.13, Jupyter, and Node.js 22.

### Manual Setup

```bash
npm install && npm run build && npm test
```

### Development

```bash
npm run watch        # recompiles on file changes
# Then press F5 in VS Code to launch the extension + server
```

Use the **"Client + Server"** compound debug configuration to debug both sides simultaneously.
The TypeScript project and build scripts use `clients/vscode/` as the canonical extension source directory.

Release packaging downloads the pinned VS Code packaging CLI on demand, keeping its dependency tree out of normal development and CI installs:

```bash
npm run package
```

## Client Examples

The LSP server is language-agnostic. Three client implementations are included to demonstrate different integration patterns:

### VS Code Extension (`clients/vscode/`)

The primary client — a full VS Code extension using `vscode-languageclient`, communicating over IPC. Provides diagnostics, completions, hover, go-to-definition, semantic tokens, and all other LSP features directly in the editor.

### Web Client (`clients/web/`)

A browser-based SysML explorer with a Node.js HTTP bridge to the LSP server. Features a live editor with auto-analyse, diagnostics panel, symbol outline, and Mermaid diagram generation with zoom/pan.

```bash
make web             # build + start on http://localhost:3000
```

### Python Client (`clients/python/`)

A zero-dependency Python script and Jupyter notebook that drives the LSP over stdio — the same JSON-RPC protocol VS Code uses, with no framework overhead.

```bash
python3 clients/python/sysml_lsp_client.py                    # analyse all examples
python3 clients/python/sysml_lsp_client.py examples/bike.sysml # analyse a specific file
```

The Jupyter notebook (`sysml_lsp_demo.ipynb`) provides an interactive walkthrough of every LSP feature.

## Architecture

```
                         ┌───────────────────────────┐
                         │    Language Server        │
                         │    (Node.js process)      │
                         ├───────────────────────────┤
                         │ • ANTLR4 parser           │
                         │ • Diagnostics             │
                         │ • Symbols / hover         │
                         │ • Completions / rename    │
                         │ • Semantic tokens         │
                         │ • Go-to-def / references  │
                         └────────┬──────────────────┘
                                  │  LSP (JSON-RPC)
              ┌───────────────────┼────────────────────┐
              │                   │                    │
     ┌────────┴───────┐  ┌────────┴───────┐  ┌─────────┴──────┐
     │  VS Code (IPC) │  │  Web (HTTP)    │  │  Python (stdio)│
     │  Extension     │  │  Browser SPA   │  │  Script/Jupyter│
     └────────────────┘  └────────────────┘  └────────────────┘
```

### Project Structure

```
sysml-v2-lsp/
├── clients/
│   ├── vscode/             # VS Code extension (TypeScript)
│   ├── web/                # Browser SPA + Node.js HTTP bridge
│   └── python/             # Zero-dep Python client + Jupyter notebook
├── server/src/             # Language Server
│   ├── server.ts           # LSP connection, capability registration
│   ├── documentManager.ts  # Parse cache, document lifecycle
│   ├── parser/             # Parse pipeline
│   ├── symbols/            # Symbol table, scopes, element types
│   ├── providers/          # LSP feature implementations
│   ├── analysis/           # Complexity analyzer
│   └── mcp/                # Mermaid diagram generator
├── grammar/                # ANTLR4 grammar files (.g4)
├── sysml.library/          # SysML v2 standard library
├── benchmarks/             # Performance benchmark suite
│   ├── src/                # Runner, suites, reporters, utilities
│   ├── baselines/          # Saved baseline for regression detection
│   ├── results/            # JSON + Markdown output per run
│   └── fixtures/           # Synthetic .sysml files for benchmarking
├── examples/               # Example .sysml models
├── test/                   # Unit tests (vitest)
└── package.json            # Extension manifest + monorepo scripts
```

## Available Commands

```bash
make help             # Show all targets
make install          # Install all dependencies
make build            # Generate parser + compile + bundle
make watch            # Watch mode
make test             # Run unit tests
make lint             # ESLint
make package          # Build .vsix
make package-server   # Build server tarball for npm
make web              # Launch web client (http://localhost:3000)
make update-grammar   # Pull latest grammar, rebuild parser + DFA snapshot
make update-library   # Pull latest SysML v2 standard library
make dfa              # Regenerate DFA snapshot (after any grammar change)
make ci               # Full CI pipeline (lint + build + test)
make bench            # Run all benchmark suites (SUITE="parse" to select)
make bench-baseline   # Save a baseline from the stable suites
make bench-compare    # Compare two runs (BASE=<file|dir> HEAD=<file|dir>)
make bench-history    # Stable historical benchmark trends
```

## Benchmarks

A built-in benchmark suite measures parser, symbol table, LSP provider, memory, throughput, and folder-load performance. Results are written as both JSON and Markdown to `benchmarks/results/`.

### Running Benchmarks

```bash
npm run bench                                        # run all suites
npm run bench -- --suite parse --suite symbolTable   # specific suites
npm run bench -- --runs 10 --warmup 3                # custom iterations
npm run bench -- --output ./my-results               # custom output directory
npm run bench:compare -- --base <a> --head <b>       # compare two runs (used by CI)
npm run bench:history                                # stable historical trends
```

### Suites

| Suite         | What it measures                                                                        |
| ------------- | --------------------------------------------------------------------------------------- |
| `parse`       | Raw ANTLR parse time with syntax validation; warm runs include stale-snapshot recovery  |
| `symbolTable` | Document parse plus symbol build, and cached lookup latency                             |
| `providers`   | Batched provider latency over pre-parsed data with verified non-empty results           |
| `memory`      | Forced-GC retained-heap estimates; use for coarse trends, not precise allocation counts |
| `throughput`  | Syntax-valid lexer/parser throughput, including document-level stale-snapshot recovery  |
| `folderLoad`  | Workspace-style file discovery, parse, and symbol build                                 |

### Regression Detection

Save a baseline, then compare future runs against it:

```bash
make bench-baseline                                            # save a baseline
npm run bench -- --suite symbolTable --suite folderLoad --compare   # compare, exit 1 on regression
```

Run the same suites for the baseline and comparison: suites share a process, so earlier suites slow later ones. The comparison uses the same stable metrics, verdicts, and thresholds as the pull request check: it warns above 15% and fails above 35%. Override the failure threshold with `--threshold <n>`. Baselines must come from the same Node version and platform.

### Viewing Results

Each run produces a JSON file and a Markdown report in `benchmarks/results/`. To convert an existing JSON result to Markdown:

```bash
npx tsx benchmarks/src/reporters/markdownReporter.ts benchmarks/results/<file>.json
```

Generate a historical report from saved JSON results with:

```bash
npm run bench:history
```

The history report tracks the stable metrics used by the pull request check, combining runs of the same commit and environment. Prefer medians and repeated runs for trend decisions; with the default five measured runs, p95 is indicative rather than statistically robust.

### Pull Request Performance Check

The CI `performance` job benchmarks the PR base and head on the same runner using the PR's benchmark harness, then compares the stable metrics:

```bash
npm run bench:compare -- --base <base.json|dir> --head <head.json|dir> --warn 15 --fail 35
```

Results appear in the job summary as a table, slowdowns above 15% raise warning annotations, regressions above 35% fail the job, and the raw JSON/Markdown reports are uploaded as the `benchmark-reports` artifact.

If the base cannot be benchmarked (for example, when a PR changes server APIs the harness calls), the comparison is skipped with a warning and the job passes; check the job summary before relying on a green result.

## Grammar Updates

The grammar files in `grammar/` are sourced from [daltskin/sysml-v2-grammar](https://github.com/daltskin/sysml-v2-grammar). To pull the latest version, rebuild the parser, and regenerate the DFA snapshot:

```bash
make update-grammar
```

This fetches the `.g4` files, runs `npm run build`, and regenerates the DFA snapshot that eliminates the ANTLR4 cold-start penalty. If you edit grammar files manually, run `make dfa` afterwards.

## Technology Stack

| Component | Technology                                                                       |
| --------- | -------------------------------------------------------------------------------- |
| Language  | TypeScript (strict mode)                                                         |
| Runtime   | Node.js ≥ 18                                                                     |
| Parser    | [antlr4ng](https://github.com/mike-lischke/antlr4ng)                             |
| Generator | [antlr-ng](https://github.com/nicklockwood/antlr-ng)                             |
| LSP       | [vscode-languageserver](https://github.com/microsoft/vscode-languageserver-node) |
| Bundler   | esbuild                                                                          |
| Tests     | vitest                                                                           |

## Related Projects

- [daltskin/sysml-v2-grammar](https://github.com/daltskin/sysml-v2-grammar) — Grammar for SysML v2
- [daltskin/VSCode_SysML_Extension](https://github.com/daltskin/VSCode_SysML_Extension) — VS Code extension with visualization
- [OMG SysML v2 Specification](https://github.com/Systems-Modeling/SysML-v2-Release)

## License

MIT
