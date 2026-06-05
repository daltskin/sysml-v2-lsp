/**
 * Platform connection factory — browser (Web Worker) variant.
 *
 * Creates an LSP connection that talks to the extension host over
 * the Web Worker `postMessage` channel.  Used when the language
 * server runs inside a dedicated worker on vscode.dev / github.dev.
 *
 * This module is substituted for `connection.ts` in the browser
 * bundle by the esbuild resolver plugin (see esbuild.mjs).
 */

import {
    BrowserMessageReader,
    BrowserMessageWriter,
    Connection,
    ProposedFeatures,
    createConnection,
} from 'vscode-languageserver/browser';

/** Create the server-side LSP connection for the running platform. */
export function createServerConnection(): Connection {
    // In a dedicated worker the global scope itself is the message port.
    const workerScope = globalThis as unknown as {
        postMessage(data: unknown): void;
        addEventListener(type: string, listener: (ev: unknown) => void): void;
    };
    const reader = new BrowserMessageReader(workerScope as never);
    const writer = new BrowserMessageWriter(workerScope as never);
    return createConnection(ProposedFeatures.all, reader, writer);
}
