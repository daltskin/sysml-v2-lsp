/**
 * End-to-end regression test for the cross-file diagnostics revalidation
 * scheduling fix (`scheduleCrossFileRevalidate` in `server/src/server.ts`).
 *
 * Unlike `test/unit/diagnostics.test.ts`, which calls `SemanticValidator`
 * directly, this spawns the real, bundled server process and drives it over
 * the actual LSP transport (`vscode-jsonrpc`). A test that calls the
 * validator directly would still pass even if the server never rescheduled
 * revalidation for a sibling document after a `didChange` -- that wiring
 * only exists in `server.ts`'s document-sync handlers, not in the
 * validator itself. This test proves the server actually pushes updated
 * `publishDiagnostics` for a document the client never touched.
 *
 * Requires `dist/server/server.js` (the esbuild bundle) to exist -- a plain
 * `tsc -b` output can't run standalone (its extensionless ESM imports like
 * `vscode-languageserver/node` don't resolve under plain Node). `npm run
 * test:e2e` builds it first; see that script in package.json.
 */
import { fork, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type PublishDiagnosticsParams = {
    uri: string;
    diagnostics: { code?: string; message: string }[];
};

const serverPath = fileURLToPath(new URL('../../dist/server/server.js', import.meta.url));

describe('cross-file diagnostics revalidation (real server, over LSP)', () => {
    // Typed from the same relative module the runtime import below uses (not the bare
    // specifier 'vscode-jsonrpc/node', which isn't installed at this package's own root) --
    // otherwise TS treats them as two different module identities with incompatible types.
    let child: ChildProcess;
    let connection: import('../../server/node_modules/vscode-jsonrpc/lib/node/main.js').MessageConnection;
    let received: PublishDiagnosticsParams[];

    /** Waits until a `publishDiagnostics` matching `predicate` has been received, or times out. */
    async function waitForDiagnostics(
        predicate: (p: PublishDiagnosticsParams) => boolean,
        timeoutMs = 5000,
    ): Promise<PublishDiagnosticsParams> {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const match = received.find(predicate);
            if (match) return match;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        throw new Error(`Timed out waiting for a matching publishDiagnostics notification. Received: ${JSON.stringify(received)}`);
    }

    beforeAll(async () => {
        const rpc = await import('../../server/node_modules/vscode-jsonrpc/lib/node/main.js');

        child = fork(serverPath, ['--node-ipc'], { silent: true });
        connection = rpc.createMessageConnection(new rpc.IPCMessageReader(child), new rpc.IPCMessageWriter(child));
        connection.listen();

        received = [];
        connection.onNotification('textDocument/publishDiagnostics', (params: PublishDiagnosticsParams) => {
            received.push(params);
        });

        await connection.sendRequest('initialize', { processId: process.pid, rootUri: null, capabilities: {} });
        await connection.sendNotification('initialized', {});
    }, 20_000);

    afterAll(async () => {
        await connection.sendRequest('shutdown');
        connection.sendNotification('exit');
        child.kill();
    });

    it(
        'pushes updated diagnostics to an untouched sibling document, in both directions, as another document\'s conflict is introduced and then resolved',
        async () => {
            const uriA = 'file:///vehicle.sysml';
            const uriB = 'file:///duplicate-wheel.sysml';
            const aText = '\npart def Wheel {}\npart def Vehicle {\n    part wheels : Wheel;\n}\n';
            const bTextNoConflict = '\npart def Wheel2;\n';
            const bTextConflicting = '\npart def Wheel;\n';

            await connection.sendNotification('textDocument/didOpen', {
                textDocument: { uri: uriA, languageId: 'sysml', version: 1, text: aText },
            });
            await connection.sendNotification('textDocument/didOpen', {
                textDocument: { uri: uriB, languageId: 'sysml', version: 1, text: bTextNoConflict },
            });

            // Let the initial parse settle, AND let `onDidOpen`'s own 500ms
            // cross-file-revalidate timer (rescheduled by opening B right
            // after A) fully fire and clear. Otherwise that unrelated timer
            // can still be pending when the didChange below lands, fire
            // afterwards on its own schedule, and revalidate A against B's
            // already-conflicting content -- passing this test even without
            // the onDidChangeContent scheduling fix under test.
            await waitForDiagnostics(p => p.uri === uriA);
            await new Promise(resolve => setTimeout(resolve, 700));
            const baselineA = received.filter(p => p.uri === uriA).at(-1)!;
            expect(baselineA.diagnostics.some(d => d.code === 'ambiguous-namespace-name')).toBe(false);
            expect(baselineA.diagnostics.some(d => d.code === 'unresolved-type')).toBe(false);

            received = [];

            // Edit only document B -- the client never re-sends anything for A.
            await connection.sendNotification('textDocument/didChange', {
                textDocument: { uri: uriB, version: 2 },
                contentChanges: [{ text: bTextConflicting }],
            });

            // The fix under test: without `scheduleCrossFileRevalidate` in the
            // `onDidChangeContent` handler, no further publishDiagnostics for
            // uriA would ever arrive here -- A would keep showing its stale,
            // conflict-free diagnostics until closed and reopened.
            const updatedA = await waitForDiagnostics(
                p => p.uri === uriA && p.diagnostics.some(d => d.code === 'ambiguous-namespace-name'),
            );

            expect(updatedA.diagnostics.some(d => d.code === 'ambiguous-namespace-name' && d.message.includes("'Wheel'"))).toBe(true);
            expect(updatedA.diagnostics.some(d => d.code === 'unresolved-type' && d.message.includes("'Wheel'"))).toBe(true);

            received = [];

            // Revert B to remove the conflict -- the fix must also clear A's stale
            // diagnostics on the way back, not just apply them going forward.
            await connection.sendNotification('textDocument/didChange', {
                textDocument: { uri: uriB, version: 3 },
                contentChanges: [{ text: bTextNoConflict }],
            });

            const revertedA = await waitForDiagnostics(
                p => p.uri === uriA && !p.diagnostics.some(d => d.code === 'ambiguous-namespace-name'),
            );

            expect(revertedA.diagnostics.some(d => d.code === 'ambiguous-namespace-name')).toBe(false);
            expect(revertedA.diagnostics.some(d => d.code === 'unresolved-type')).toBe(false);
        },
        15_000,
    );
});
