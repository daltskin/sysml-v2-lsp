#!/usr/bin/env node
/**
 * SysML v2 Web Client — Lightweight HTTP bridge
 *
 * Spawns the LSP server as a child process and exposes a simple REST API
 * for the web frontend. Also serves the static HTML/JS/CSS.
 *
 * Usage:
 *   node clients/web/server.mjs [--port 3000]
 */

import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname, extname, join } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.argv.find((_, i, a) => a[i - 1] === "--port") ?? "3000", 10);

// Resolve the repo root from this script's location (clients/web/)
const REPO_ROOT = resolve(__dirname, "../..");
const SERVER_JS = join(REPO_ROOT, "dist/server/server.js");

if (!existsSync(SERVER_JS)) {
    console.error(`\x1b[31mERROR:\x1b[0m Server bundle not found at ${SERVER_JS}`);
    console.error('Run "npm run build" from the repository root first.');
    process.exit(1);
}

// ---------------------------------------------------------------------------
// LSP Client — minimal JSON-RPC over stdio
// ---------------------------------------------------------------------------

class LspClient {
    constructor() {
        this._id = 0;
        this._pending = new Map();
        this._diagnostics = new Map();
        this._buffer = Buffer.alloc(0);
        this._proc = null;
    }

    start() {
        this._proc = spawn("node", [SERVER_JS, "--stdio"], {
            cwd: REPO_ROOT,
            stdio: ["pipe", "pipe", "pipe"],
        });

        this._proc.stdout.on("data", (chunk) => this._onData(chunk));
        this._proc.stderr.on("data", (d) => {
            // Suppress noisy stderr unless debugging
            if (process.env.DEBUG) process.stderr.write(d);
        });
        this._proc.on("exit", (code) => {
            console.log(`LSP server exited (code ${code})`);
        });

        return this._request("initialize", {
            processId: process.pid,
            rootUri: `file://${REPO_ROOT}`,
            capabilities: {
                textDocument: {
                    publishDiagnostics: { relatedInformation: true },
                    documentSymbol: { hierarchicalDocumentSymbolSupport: true },
                    hover: { contentFormat: ["plaintext", "markdown"] },
                    completion: { completionItem: { snippetSupport: false } },
                },
            },
            workspaceFolders: [{ uri: `file://${REPO_ROOT}`, name: "sysml-v2-lsp" }],
        }).then(() => {
            this._notify("initialized");
            console.log("LSP server initialized");
        });
    }

    // --- API ----------------------------------------------------------------

    async openAndAnalyse(code, uri = "file:///virtual/editor.sysml") {
        this._version = (this._version ?? 0) + 1;
        const expectedVersion = this._version;

        // Close previous version if open — and drain the stale close notification
        if (this._openDocs?.has(uri)) {
            this._diagnostics.delete(uri);
            this._notify("textDocument/didClose", { textDocument: { uri } });
            // Give Node event loop a tick to process the stale empty diagnostics
            await new Promise(r => setTimeout(r, 50));
            // Drain any buffered data (close notification's empty diagnostics)
            // so they don't interfere with the real waiter
        }

        // Clear diagnostics and set up waiter BEFORE opening
        this._diagnostics.delete(uri);
        this._diagWaiters?.delete(uri);
        const diagPromise = this._waitForStatusEnd(uri, 15_000);

        // Open with new content
        this._notify("textDocument/didOpen", {
            textDocument: { uri, languageId: "sysml", version: expectedVersion, text: code },
        });
        if (!this._openDocs) this._openDocs = new Set();
        this._openDocs.add(uri);

        // Wait for parse completion (sysml/status end notification)
        await diagPromise;
        const diagnostics = this._diagnostics.get(uri) ?? [];

        // Get symbols
        const symbolResult = await this._request("textDocument/documentSymbol", {
            textDocument: { uri },
        });
        const symbols = symbolResult?.result ?? [];

        // Get model with mermaid-relevant data
        let model = null;
        try {
            model = await this._request("sysml/model", {
                textDocument: { uri },
                scope: ["elements", "relationships", "diagnostics"],
            });
        } catch { /* model request may not be available */ }

        return { diagnostics, symbols, model: model?.result ?? null };
    }

    async shutdown() {
        const timeout = (ms) => new Promise((_, reject) =>
            setTimeout(() => reject(new Error("shutdown timed out")), ms));
        try {
            await Promise.race([this._request("shutdown"), timeout(2000)]);
            this._notify("exit");
        } catch { /* timed out or LSP already gone */ }
        this._proc?.kill();
    }

    // --- Transport ----------------------------------------------------------

    _send(msg) {
        const body = JSON.stringify(msg);
        const header = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`;
        this._proc.stdin.write(header + body);
    }

    _request(method, params) {
        return new Promise((resolve, reject) => {
            const id = ++this._id;
            this._pending.set(id, { resolve, reject });
            this._send({ jsonrpc: "2.0", id, method, ...(params !== undefined ? { params } : {}) });

            setTimeout(() => {
                if (this._pending.has(id)) {
                    this._pending.delete(id);
                    resolve(null);
                }
            }, 30_000);
        });
    }

    _notify(method, params) {
        this._send({ jsonrpc: "2.0", method, ...(params !== undefined ? { params } : {}) });
    }

    _onData(chunk) {
        this._buffer = Buffer.concat([this._buffer, chunk]);
        while (true) {
            const headerEnd = this._buffer.indexOf("\r\n\r\n");
            if (headerEnd === -1) break;
            const header = this._buffer.subarray(0, headerEnd).toString();
            const match = header.match(/Content-Length:\s*(\d+)/i);
            if (!match) break;
            const len = parseInt(match[1], 10);
            const bodyStart = headerEnd + 4;
            if (this._buffer.length < bodyStart + len) break;
            const body = this._buffer.subarray(bodyStart, bodyStart + len).toString();
            this._buffer = this._buffer.subarray(bodyStart + len);
            try {
                const msg = JSON.parse(body);
                this._handleMessage(msg);
            } catch { /* ignore malformed */ }
        }
    }

    _handleMessage(msg) {
        // Response to a request
        if (msg.id && this._pending.has(msg.id)) {
            this._pending.get(msg.id).resolve(msg);
            this._pending.delete(msg.id);
            return;
        }
        // Diagnostic notification
        if (msg.method === "textDocument/publishDiagnostics") {
            const { uri, diagnostics } = msg.params;
            this._diagnostics.set(uri, diagnostics);
        }
        // Parse-complete notification from our server
        if (msg.method === "sysml/status" && msg.params?.state === "end") {
            const uri = msg.params.uri;
            if (uri) {
                const waiters = this._statusWaiters?.get(uri);
                if (waiters) {
                    waiters.forEach(fn => fn());
                    this._statusWaiters.delete(uri);
                }
            }
        }
    }

    _waitForStatusEnd(uri, timeout) {
        return new Promise((resolve) => {
            if (!this._statusWaiters) this._statusWaiters = new Map();
            const list = this._statusWaiters.get(uri) ?? [];
            list.push(resolve);
            this._statusWaiters.set(uri, list);
            setTimeout(resolve, timeout);
        });
    }
}

// ---------------------------------------------------------------------------
// HTTP Server
// ---------------------------------------------------------------------------

const MIME = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
};

const lsp = new LspClient();

const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    // --- API: POST /api/analyse ---
    if (url.pathname === "/api/analyse" && req.method === "POST") {
        try {
            const body = await readBody(req);
            const { code } = JSON.parse(body);
            if (!code) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Missing 'code' field" }));
                return;
            }
            const result = await lsp.openAndAnalyse(code);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(result));
        } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // --- API: GET /api/examples ---
    if (url.pathname === "/api/examples" && req.method === "GET") {
        const exDir = join(REPO_ROOT, "examples");
        const { readdirSync } = await import("fs");
        const files = readdirSync(exDir).filter((f) => f.endsWith(".sysml"));
        const examples = files.map((f) => ({
            name: f.replace(".sysml", ""),
            code: readFileSync(join(exDir, f), "utf-8"),
        }));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(examples));
        return;
    }

    // --- Static files ---
    let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const publicDir = resolve(__dirname, "public");
    const fullPath = resolve(publicDir, filePath.replace(/^\/+/, ""));

    // Prevent path traversal — resolved path must be inside public/
    if (!fullPath.startsWith(publicDir + "/") && fullPath !== publicDir) {
        res.writeHead(403, { "Content-Type": "text/plain" });
        res.end("Forbidden");
        return;
    }

    if (existsSync(fullPath)) {
        const ext = extname(fullPath);
        res.writeHead(200, { "Content-Type": MIME[ext] || "text/plain" });
        res.end(readFileSync(fullPath));
    } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
    }
});

const MAX_BODY_SIZE = 1024 * 1024; // 1 MB limit

function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = "";
        req.on("data", (c) => {
            data += c;
            if (data.length > MAX_BODY_SIZE) {
                req.destroy();
                reject(new Error("Request body too large"));
            }
        });
        req.on("end", () => resolve(data));
        req.on("error", reject);
    });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
    console.log("Starting SysML v2 Web Client...");
    await lsp.start();

    server.listen(PORT, () => {
        console.log(`\n\x1b[32m✓\x1b[0m SysML v2 Web Client running at \x1b[36mhttp://localhost:${PORT}\x1b[0m\n`);
    });

    process.on("SIGINT", async () => {
        console.log("\nShutting down...");
        // Force-exit after 3s in case graceful shutdown hangs
        const forceTimer = setTimeout(() => process.exit(1), 3000);
        forceTimer.unref();
        await lsp.shutdown();
        process.exit(0);
    });
}

main().catch((err) => {
    console.error("Failed to start:", err);
    process.exit(1);
});
