#!/usr/bin/env python3
"""
Lightweight Python LSP client for the SysML v2 Language Server.

This script demonstrates how to use the SysML v2 LSP server from Python,
communicating over JSON-RPC/stdio — the same protocol VS Code uses.

No Python dependencies required — just the standard library.

Usage:
    python3 sysml_lsp_client.py                          # analyse all examples/*.sysml
    python3 sysml_lsp_client.py path/to/file.sysml       # analyse a specific file

Prerequisites:
    - Node.js >= 20
    - The LSP server bundle at dist/server/server.js (run `npm run build` first)
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# JSON-RPC / LSP transport layer (zero dependencies)
# ---------------------------------------------------------------------------

class JsonRpcClient:
    """Minimal JSON-RPC 2.0 client speaking LSP's Content-Length framing over stdio."""

    def __init__(self, process: subprocess.Popen):
        self._proc = process
        self._id = 0
        self._open_docs: dict[str, int] = {}  # uri -> version

    # -- Sending ---------------------------------------------------------------

    def _send(self, msg: dict[str, Any]) -> None:
        body = json.dumps(msg)
        header = f"Content-Length: {len(body)}\r\n\r\n"
        self._proc.stdin.write(header.encode("utf-8"))
        self._proc.stdin.write(body.encode("utf-8"))
        self._proc.stdin.flush()

    def request(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        """Send a request and block until the matching response arrives."""
        self._id += 1
        msg: dict[str, Any] = {"jsonrpc": "2.0", "id": self._id, "method": method}
        if params is not None:
            msg["params"] = params
        self._send(msg)
        return self._wait_for_response(self._id)

    def notify(self, method: str, params: dict[str, Any] | None = None) -> None:
        """Send a notification (no response expected)."""
        msg: dict[str, Any] = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            msg["params"] = params
        self._send(msg)

    # -- Receiving -------------------------------------------------------------

    def _read_headers(self) -> dict[str, str]:
        headers: dict[str, str] = {}
        while True:
            line = self._proc.stdout.readline()
            if not line or line == b"\r\n":
                break
            key, _, val = line.decode("utf-8").partition(":")
            headers[key.strip().lower()] = val.strip()
        return headers

    def _read_message(self) -> dict[str, Any] | None:
        headers = self._read_headers()
        length = int(headers.get("content-length", 0))
        if length == 0:
            return None
        body = self._proc.stdout.read(length)
        return json.loads(body.decode("utf-8"))

    def _wait_for_response(self, req_id: int) -> dict[str, Any]:
        """Read messages until we get the response matching *req_id*."""
        while True:
            msg = self._read_message()
            if msg is None:
                raise RuntimeError("Server closed the connection")
            # Server-initiated requests / notifications — just collect them
            if "id" in msg and msg["id"] == req_id:
                return msg
            # (diagnostics and other notifications arrive here — we record them)
            if "method" in msg:
                self._handle_server_message(msg)

    def drain_notifications(self, timeout: float = 0.5) -> list[dict[str, Any]]:
        """Non-blocking: read any pending notifications for *timeout* seconds."""
        import select
        collected: list[dict[str, Any]] = []
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            remaining = max(deadline - time.monotonic(), 0)
            rlist, _, _ = select.select([self._proc.stdout], [], [], remaining)
            if not rlist:
                break
            msg = self._read_message()
            if msg is None:
                break
            if "method" in msg:
                self._handle_server_message(msg)
            collected.append(msg)
        return collected

    def drain_until_diagnostics(self, uri: str, timeout: float = 30.0) -> list[dict[str, Any]]:
        """Read notifications until diagnostics for *uri* arrive, or *timeout* expires."""
        import select
        collected: list[dict[str, Any]] = []
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            remaining = max(deadline - time.monotonic(), 0)
            rlist, _, _ = select.select([self._proc.stdout], [], [], remaining)
            if not rlist:
                break
            msg = self._read_message()
            if msg is None:
                break
            if "method" in msg:
                self._handle_server_message(msg)
            collected.append(msg)
            # Stop early once we've received diagnostics for our document
            if msg.get("method") == "textDocument/publishDiagnostics":
                if msg.get("params", {}).get("uri") == uri:
                    break
        return collected

    # -- Server-initiated messages --------------------------------------------

    _diagnostics: dict[str, list[dict[str, Any]]] = {}

    def _handle_server_message(self, msg: dict[str, Any]) -> None:
        method = msg.get("method", "")
        if method == "textDocument/publishDiagnostics":
            uri = msg["params"]["uri"]
            self._diagnostics[uri] = msg["params"]["diagnostics"]
        # Other notifications (window/logMessage, etc.) are silently ignored.

    def get_diagnostics(self, uri: str) -> list[dict[str, Any]]:
        return self._diagnostics.get(uri, [])


# ---------------------------------------------------------------------------
# LSP session helpers
# ---------------------------------------------------------------------------

def file_uri(path: Path) -> str:
    """Convert a filesystem path to a file:// URI."""
    return path.resolve().as_uri()


def start_server(server_js: Path) -> subprocess.Popen:
    """Launch the SysML v2 language server with --stdio transport."""
    return subprocess.Popen(
        ["node", str(server_js), "--stdio"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def initialize(client: JsonRpcClient, root_path: Path) -> dict[str, Any]:
    """Perform the LSP initialize / initialized handshake."""
    result = client.request("initialize", {
        "processId": os.getpid(),
        "rootUri": file_uri(root_path),
        "capabilities": {
            "textDocument": {
                "hover": {"contentFormat": ["plaintext", "markdown"]},
                "completion": {
                    "completionItem": {"snippetSupport": False},
                },
                "documentSymbol": {"hierarchicalDocumentSymbolSupport": True},
                "publishDiagnostics": {"relatedInformation": True},
            },
        },
        "workspaceFolders": [
            {"uri": file_uri(root_path), "name": root_path.name}
        ],
    })
    client.notify("initialized")
    return result


def open_document(client: JsonRpcClient, path: Path) -> str:
    """Send textDocument/didOpen for a .sysml file. Returns the file URI.

    If the document was already opened, it is closed and re-opened so that
    the server picks up the latest content from disk.
    """
    uri = file_uri(path)
    # If already open, close first so the server drops its cached copy
    if uri in client._open_docs:
        close_document(client, uri)
    text = path.read_text(encoding="utf-8")
    version = client._open_docs.get(uri, 0) + 1
    client.notify("textDocument/didOpen", {
        "textDocument": {
            "uri": uri,
            "languageId": "sysml",
            "version": version,
            "text": text,
        },
    })
    client._open_docs[uri] = version
    return uri


def close_document(client: JsonRpcClient, uri: str) -> None:
    """Send textDocument/didClose so the server releases the document."""
    client.notify("textDocument/didClose", {
        "textDocument": {"uri": uri},
    })
    client._open_docs.pop(uri, None)
    client._diagnostics.pop(uri, None)
    # Drain the empty diagnostics the server publishes in response to didClose,
    # so a subsequent drain_until_diagnostics won't match on the stale message.
    client.drain_notifications(timeout=1.0)


def reload_document(client: JsonRpcClient, path: Path) -> str:
    """Close and re-open a document to force the server to re-read from disk.

    This is the correct way to pick up on-disk edits, because the LSP spec
    says the server must use the client-provided text once didOpen is sent.
    Returns the file URI.
    """
    return open_document(client, path)  # open_document already handles close-if-open


def get_document_symbols(client: JsonRpcClient, uri: str) -> list[dict[str, Any]]:
    """Request the document symbol tree (outline)."""
    resp = client.request("textDocument/documentSymbol", {
        "textDocument": {"uri": uri},
    })
    return resp.get("result") or []


def get_hover(client: JsonRpcClient, uri: str, line: int, character: int) -> dict[str, Any] | None:
    """Request hover info at a specific position (0-based line/character)."""
    resp = client.request("textDocument/hover", {
        "textDocument": {"uri": uri},
        "position": {"line": line, "character": character},
    })
    return resp.get("result")


def get_completions(client: JsonRpcClient, uri: str, line: int, character: int) -> list[dict[str, Any]]:
    """Request completion items at a position."""
    resp = client.request("textDocument/completion", {
        "textDocument": {"uri": uri},
        "position": {"line": line, "character": character},
    })
    result = resp.get("result")
    if isinstance(result, list):
        return result
    if isinstance(result, dict):
        return result.get("items", [])
    return []


def get_definition(client: JsonRpcClient, uri: str, line: int, character: int) -> Any:
    """Request go-to-definition at a position."""
    resp = client.request("textDocument/definition", {
        "textDocument": {"uri": uri},
        "position": {"line": line, "character": character},
    })
    return resp.get("result")


def get_folding_ranges(client: JsonRpcClient, uri: str) -> list[dict[str, Any]]:
    """Request folding ranges for a document."""
    resp = client.request("textDocument/foldingRange", {
        "textDocument": {"uri": uri},
    })
    return resp.get("result") or []


def shutdown(client: JsonRpcClient) -> None:
    """Graceful LSP shutdown."""
    client.request("shutdown")
    client.notify("exit")


# ---------------------------------------------------------------------------
# Pretty printing helpers
# ---------------------------------------------------------------------------

SEVERITY = {1: "Error", 2: "Warning", 3: "Info", 4: "Hint"}
SYMBOL_KIND = {
    1: "File", 2: "Module", 3: "Namespace", 4: "Package", 5: "Class",
    6: "Method", 7: "Property", 8: "Field", 9: "Constructor", 10: "Enum",
    11: "Interface", 12: "Function", 13: "Variable", 14: "Constant",
    15: "String", 16: "Number", 17: "Boolean", 18: "Array", 19: "Object",
    20: "Key", 21: "Null", 22: "EnumMember", 23: "Struct", 24: "Event",
    25: "Operator", 26: "TypeParameter",
}


def print_symbols(symbols: list[dict[str, Any]], indent: int = 0) -> None:
    """Recursively print the document symbol tree."""
    for sym in symbols:
        kind = SYMBOL_KIND.get(sym.get("kind", 0), "?")
        name = sym.get("name", "?")
        r = sym.get("range", {}).get("start", {})
        line = r.get("line", 0) + 1
        print(f"{'  ' * indent}{kind:12s} {name}  (line {line})")
        children = sym.get("children", [])
        if children:
            print_symbols(children, indent + 1)


def print_diagnostics(diags: list[dict[str, Any]], filename: str) -> None:
    """Print diagnostics like compiler output."""
    if not diags:
        print(f"  No diagnostics — file is clean.")
        return
    for d in diags:
        sev = SEVERITY.get(d.get("severity", 1), "?")
        line = d["range"]["start"]["line"] + 1
        col = d["range"]["start"]["character"] + 1
        msg = d.get("message", "")
        print(f"  {filename}:{line}:{col} [{sev}] {msg}")


def print_hover(hover: dict[str, Any] | None) -> None:
    if hover is None:
        print("  (no hover info)")
        return
    contents = hover.get("contents", {})
    if isinstance(contents, dict):
        value = contents.get("value", str(contents))
    elif isinstance(contents, list):
        value = "\n".join(c.get("value", str(c)) if isinstance(c, dict) else str(c) for c in contents)
    else:
        value = str(contents)
    for line in value.splitlines():
        print(f"  {line}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    # Resolve paths
    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parent.parent          # clients/python -> repo root
    server_js = repo_root / "dist" / "server" / "server.js"

    if not server_js.exists():
        print(f"ERROR: Server bundle not found at {server_js}")
        print("Run 'npm run build' from the repository root first.")
        sys.exit(1)

    # Determine which .sysml files to analyse
    if len(sys.argv) > 1:
        sysml_files = [Path(a).resolve() for a in sys.argv[1:]]
    else:
        examples_dir = repo_root / "examples"
        sysml_files = sorted(p for p in examples_dir.glob("*.sysml") if p.is_file())

    if not sysml_files:
        print("No .sysml files found.")
        sys.exit(1)

    print("=" * 60)
    print("SysML v2 — Python LSP Client Demo")
    print("=" * 60)
    print(f"Server : {server_js.relative_to(repo_root)}")
    print(f"Files  : {len(sysml_files)}")
    print()

    # Start server
    proc = start_server(server_js)
    client = JsonRpcClient(proc)

    try:
        # 1. Initialize
        init_result = initialize(client, repo_root)
        caps = init_result.get("result", {}).get("capabilities", {})
        cap_names = [k for k, v in caps.items() if v]
        print(f"Server capabilities: {', '.join(sorted(cap_names))}")
        print()

        for sysml_file in sysml_files:
            rel = sysml_file.relative_to(repo_root) if sysml_file.is_relative_to(repo_root) else sysml_file
            print("-" * 60)
            print(f"FILE: {rel}")
            print("-" * 60)

            # 2. Open document
            uri = open_document(client, sysml_file)

            # Wait for the server to parse and publish diagnostics.
            # The first file may take ~20s (DFA warm-up); subsequent files are fast.
            client.drain_until_diagnostics(uri, timeout=30.0)

            # 3. Document Symbols (outline)
            print("\n[Document Symbols]")
            symbols = get_document_symbols(client, uri)
            if symbols:
                print_symbols(symbols)
            else:
                print("  (none)")

            # 4. Diagnostics (errors/warnings pushed by the server)
            print("\n[Diagnostics]")
            diags = client.get_diagnostics(uri)
            print_diagnostics(diags, rel.name if isinstance(rel, Path) else str(rel))

            # 5. Hover on the first symbol
            print("\n[Hover]")
            if symbols:
                first = symbols[0]
                r = first.get("selectionRange", first.get("range", {}))
                start = r.get("start", {"line": 0, "character": 0})
                print(f"  Hovering on '{first.get('name', '?')}' at line {start['line'] + 1}:")
                hover = get_hover(client, uri, start["line"], start["character"])
                print_hover(hover)
            else:
                print("  (no symbols to hover on)")

            # 6. Completions at the top of the file
            print("\n[Completions at line 1]")
            completions = get_completions(client, uri, 0, 0)
            if completions:
                labels = [c.get("label", "?") for c in completions[:10]]
                print(f"  {len(completions)} items, first 10: {', '.join(labels)}")
            else:
                print("  (none)")

            # 7. Folding ranges
            print("\n[Folding Ranges]")
            folds = get_folding_ranges(client, uri)
            if folds:
                print(f"  {len(folds)} foldable region(s)")
                for f in folds[:5]:
                    start_line = f.get("startLine", 0) + 1
                    end_line = f.get("endLine", 0) + 1
                    kind = f.get("kind", "region")
                    print(f"    lines {start_line}-{end_line} ({kind})")
                if len(folds) > 5:
                    print(f"    ... and {len(folds) - 5} more")
            else:
                print("  (none)")

            print()

        # Shutdown
        shutdown(client)

    except Exception as exc:
        print(f"\nERROR: {exc}", file=sys.stderr)
        proc.kill()
        sys.exit(1)
    finally:
        proc.wait(timeout=5)

    print("=" * 60)
    print("Done. The same LSP server used by VS Code was driven entirely")
    print("from Python — no VS Code, no special plugins, just JSON-RPC.")
    print("=" * 60)


if __name__ == "__main__":
    main()
