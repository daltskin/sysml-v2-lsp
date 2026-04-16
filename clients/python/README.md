# Python LSP Client Example

A lightweight, **zero-dependency** Python script that connects to the SysML v2 Language Server over JSON-RPC/stdio — the exact same server that powers the VS Code extension.

This demonstrates that the LSP is truly language-agnostic: any tool (Python, Rust, Go, Emacs, Vim, …) can drive the same server using the [Language Server Protocol](https://microsoft.github.io/language-server-protocol/).

## Architecture

```
┌─────────────────────┐       stdio (JSON-RPC)       ┌─────────────────────┐
│  sysml_lsp_client.py│ ◄──────────────────────────► │  server.js (Node)   │
│  (Python 3.10+)     │   Content-Length framing     │  ANTLR4 parser      │
└─────────────────────┘                              └─────────────────────┘
        │                                                     │
        │  reads .sysml files                                 │  full LSP:
        │  from examples/                                     │  diagnostics,
        │                                                     │  symbols,
        ▼                                                     │  hover, etc.
   *.sysml files                                              ▼
                                                    Same server as VS Code
```

## Prerequisites

- **Python 3.10+** (no pip packages needed — uses only the standard library)
- **Node.js >= 20**
- The server bundle must be built first:
  ```bash
  cd ../..          # repository root
  npm install
  npm run build
  ```

## Usage

```bash
# Analyse all examples/*.sysml files
python3 sysml_lsp_client.py

# Analyse specific file(s)
python3 sysml_lsp_client.py ../../examples/vehicle-model.sysml
python3 sysml_lsp_client.py /path/to/your/model.sysml
```

## What It Does

The script performs a full LSP session against each `.sysml` file:

| Step | LSP Method | What You See |
|------|-----------|--------------|
| 1 | `initialize` / `initialized` | Server capabilities |
| 2 | `textDocument/didOpen` | — |
| 3 | `textDocument/documentSymbol` | Symbol tree (packages, parts, constraints, …) |
| 4 | `textDocument/publishDiagnostics` | Errors and warnings |
| 5 | `textDocument/hover` | Hover info on the first symbol |
| 6 | `textDocument/completion` | Available completions at line 1 |
| 7 | `textDocument/foldingRange` | Foldable regions |
| 8 | `shutdown` / `exit` | Clean teardown |

## Example Output

```
============================================================
SysML v2 — Python LSP Client Demo
============================================================
Server : dist/server/server.js
Files  : 4

Server capabilities: codeActionProvider, codeLensProvider, completionProvider, ...

------------------------------------------------------------
FILE: examples/vehicle-model.sysml
------------------------------------------------------------

[Document Symbols]
  Package      VehicleModel  (line 1)
    Class        Vehicle  (line 7)
      Field        engine  (line 8)
      ...

[Diagnostics]
  No diagnostics — file is clean.

[Hover]
  Hovering on 'VehicleModel' at line 1:
  package VehicleModel

[Completions at line 1]
  18 items, first 10: package, part, ...
```

## Extending This

This is intentionally minimal. Ideas for building on it:

- **CI validation** — parse all `.sysml` files and fail on diagnostics
- **Batch analysis** — extract all symbols/types from a model for documentation
- **Watch mode** — re-send `didChange` on file modification for live linting
- **Custom tooling** — combine LSP queries with domain-specific post-processing
- **Integration** — embed in a Jupyter notebook or Flask API

## How It Works

The script implements just enough of the LSP transport layer:

1. **Content-Length framing** — each message is prefixed with `Content-Length: N\r\n\r\n`
2. **JSON-RPC 2.0** — requests have an `id`, notifications don't
3. **stdio** — the server is launched with `node dist/server/server.js --stdio`

This is the same wire protocol VS Code uses (via `vscode-languageclient`), just
without the framework overhead.
