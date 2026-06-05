/**
 * Platform connection factory — Node.js variant.
 *
 * Creates an LSP connection that talks to the client over the
 * Node transport (IPC / stdio, auto-detected from process args).
 *
 * The browser build swaps this module for `connection.browser.ts`
 * via the esbuild resolver plugin (see esbuild.mjs).
 */

import {
    Connection,
    ProposedFeatures,
    createConnection,
} from 'vscode-languageserver/node.js';

/** Create the server-side LSP connection for the running platform. */
export function createServerConnection(): Connection {
    return createConnection(ProposedFeatures.all);
}
