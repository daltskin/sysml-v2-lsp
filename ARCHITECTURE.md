# SysML v2 LSP — Architecture

## Overview

A Language Server Protocol implementation for SysML v2, structured as a client/server monorepo. The server runs in a separate Node.js process, communicating with the VS Code extension (client) via IPC.

## Data Flow

```
 .sysml file
      │
      ▼
┌─────────────────┐     ┌──────────────────┐    ┌──────────────────┐
│  TextDocument   │───▶ │ ANTLR4 Lexer +  │───▶│  Parse Tree      │
│  (LSP protocol) │     │ Parser (antlr4ng)│    │  (AST)           │
└─────────────────┘     └──────────────────┘    └────────┬─────────┘
                                                         │
                              ┌──────────────────────────┤
                              ▼                          ▼
                    ┌──────────────────┐       ┌──────────────────┐
                    │  Error Listener  │       │  Symbol Table    │
                    │  → Diagnostics   │       │  → Scope Tree    │
                    └──────────────────┘       └─────────┬────────┘
                                                         │
                    ┌───────────────────┬────────────────┼────────────────┐
                    ▼                   ▼                ▼                ▼
          ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  ┌──────────┐
          │  Completion    │  │   Hover        │  │  Definition  │  │ Symbols  │
          │  (keywords +   │  │   (type info)  │  │  (resolve)   │  │ (outline)│
          │   symbols)     │  │                │  │              │  │          │
          └────────────────┘  └────────────────┘  └──────────────┘  └──────────┘
```

## Key Components

### Parser Layer (`server/src/parser/`)

- **parseDocument.ts** — Entry point. Takes raw text, feeds it through the ANTLR4 lexer and parser, returns a `ParseResult` containing the parse tree, token stream, and collected syntax errors.
- **errorListener.ts** — Custom `ANTLRErrorListener` that collects syntax errors as structured objects instead of printing to stderr.
- **positionUtils.ts** — Bridges the position systems: ANTLR uses 1-based lines; LSP uses 0-based.

### Symbol Layer (`server/src/symbols/`)

- **symbolTable.ts** — Walks the parse tree and builds a flat + hierarchical index of all named SysML declarations (packages, parts, attributes, etc.).
- **scope.ts** — Manages nested lexical scopes for name resolution (package → definition → usage).
- **sysmlElements.ts** — Type definitions for SysML element kinds (PartDef, PartUsage, etc.).

### Provider Layer (`server/src/providers/`)

Each LSP feature is implemented as a standalone provider class:

| Provider               | LSP Method                        | Purpose                       |
| ---------------------- | --------------------------------- | ----------------------------- |
| DiagnosticsProvider    | `textDocument/publishDiagnostics` | Syntax errors → red squiggles |
| CompletionProvider     | `textDocument/completion`         | Keywords + snippets           |
| HoverProvider          | `textDocument/hover`              | Element info on hover         |
| DefinitionProvider     | `textDocument/definition`         | Go-to-definition              |
| ReferencesProvider     | `textDocument/references`         | Find all references           |
| DocumentSymbolProvider | `textDocument/documentSymbol`     | Outline panel                 |
| SemanticTokensProvider | `textDocument/semanticTokens`     | Rich highlighting             |
| FoldingRangeProvider   | `textDocument/foldingRange`       | Collapsible regions           |
| RenameProvider         | `textDocument/rename`             | Symbol rename                 |

### Document Manager (`server/src/documentManager.ts`)

Caches parse results by document URI and version number. Re-parses only when the document content changes. This avoids redundant ANTLR work when multiple providers query the same document.

## Grammar Source

The ANTLR4 grammar files (`grammar/SysMLv2Lexer.g4`, `grammar/SysMLv2Parser.g4`) are sourced from [daltskin/sysml-v2-grammar](https://github.com/daltskin/sysml-v2-grammar) and committed directly to this repo. The `npm run update-grammar` script pulls the latest versions.

Generated TypeScript parser files (`server/src/generated/`) are produced by `antlr-ng` and committed to the repo for contributor convenience.
