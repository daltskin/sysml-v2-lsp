/**
 * sysml-v2-lsp — SysML v2 Language Server
 *
 * Exports the filesystem path to the bundled language server module.
 * Use this to start the server with vscode-languageclient:
 *
 *   const { serverPath } = require('sysml-v2-lsp');
 *   const serverOptions = { module: serverPath, transport: TransportKind.ipc };
 */
'use strict';

const path = require('path');

/** Absolute path to the bundled language server entry point. */
const serverPath = path.join(__dirname, 'dist', 'server', 'server.js');

/** Absolute path to the bundled worker module (used internally by the server). */
const workerPath = path.join(__dirname, 'dist', 'server', 'parseWorker.js');

/** Absolute path to the bundled MCP server entry point (stdio transport). */
const mcpServerPath = path.join(__dirname, 'dist', 'server', 'mcpServer.js');

/**
 * Absolute path to the browser (Web Worker) language server bundle.
 * Load this with `vscode-languageclient/browser` in a web extension host
 * (e.g. vscode.dev), where there is no Node.js runtime.
 */
const browserServerPath = path.join(__dirname, 'dist', 'server', 'browserServerMain.js');

module.exports = { serverPath, workerPath, mcpServerPath, browserServerPath };
