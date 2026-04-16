# SysML v2 Web Client

A lightweight web-based explorer for SysML v2 models. Write or paste SysML, hit **Analyse**, and instantly see diagnostics, a symbol outline, and a Mermaid diagram — all powered by the SysML v2 LSP server.

![Architecture: Browser ↔ HTTP ↔ Node bridge ↔ LSP stdio](https://img.shields.io/badge/Architecture-Browser_%E2%86%94_HTTP_%E2%86%94_LSP-blue)

## Quick Start

```bash
# From the repository root:
npm run compile && npm run build   # build the LSP server bundle
node clients/web/server.mjs        # start on http://localhost:3000
```

Then open **http://localhost:3000** in your browser.

### Options

| Flag       | Default | Description              |
| ---------- | ------- | ------------------------ |
| `--port`   | `3000`  | HTTP port to listen on   |

```bash
node clients/web/server.mjs --port 8080
```

## Features

| Feature                  | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| **SysML Editor**         | Monospace editor with line numbers, tab support, Cmd/Ctrl+Enter to analyse |
| **Live Diagnostics**     | Errors, warnings, and hints rendered inline beneath the editor |
| **Symbol Outline**       | Hierarchical tree of packages, parts, attributes, enums, etc. |
| **Mermaid Diagram**      | Auto-generated class diagram from the model's symbol structure |
| **Example Loader**       | Drop-down to load any `.sysml` file from the `examples/` directory |

## Architecture

```
┌──────────────────────┐
│   Browser (SPA)      │
│  index.html + JS     │
│  Mermaid.js (CDN)    │
└────────┬─────────────┘
         │  HTTP (JSON)
         │  POST /api/analyse
         │  GET  /api/examples
┌────────┴─────────────┐
│  Node.js HTTP Bridge │
│  server.mjs          │
└────────┬─────────────┘
         │  JSON-RPC / stdio
         │  LSP protocol
┌────────┴──────────────┐
│  SysML v2 LSP Server  │
│  dist/server/server.js│
└───────────────────────┘
```

### API Endpoints

#### `POST /api/analyse`

Send SysML source code, receive diagnostics + symbols + model.

**Request:**
```json
{ "code": "package Foo { part def Bar; }" }
```

**Response:**
```json
{
  "diagnostics": [
    { "range": { "start": { "line": 0, "character": 0 } }, "message": "...", "severity": 2 }
  ],
  "symbols": [
    { "name": "Foo", "kind": 4, "children": [ { "name": "Bar", "kind": 5 } ] }
  ],
  "model": { "elements": [], "relationships": [] }
}
```

#### `GET /api/examples`

Returns an array of example files from the `examples/` directory.

```json
[
  { "name": "bike", "code": "package Bike { ... }" },
  { "name": "camera", "code": "..." }
]
```

## Development

The web client has **zero npm dependencies** — it uses only Node.js built-ins and loads Mermaid.js from a CDN.

```
clients/web/
├── server.mjs          # HTTP bridge (Node.js)
├── public/
│   └── index.html      # Single-page application
└── README.md
```

To iterate on the frontend, just edit `public/index.html` and refresh the browser. No build step needed.

## Requirements

- Node.js 18+
- The LSP server must be built first (`npm run compile && npm run build`)
