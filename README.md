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
```

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
