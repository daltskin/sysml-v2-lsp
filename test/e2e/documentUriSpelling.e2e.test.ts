/**
 * End-to-end regression test for matching workspace files by identity, not
 * URI spelling (`isSameDocumentUri` in `server/src/utils/documentUri.ts`).
 *
 * A client can spell a file's URI differently from the server's own
 * `pathToFileURL` (on Windows, `file:///c%3A/...` vs `file:///C:/...`). The
 * server then held the scanned copy and the opened copy side by side, and
 * every declaration in the file reported an ambiguous-name conflict with
 * itself. These tests open scanned files under a percent-encoded and a
 * differently-cased spelling, which reproduces the mismatch on any platform.
 *
 * Requires `dist/server/server.js` -- `npm run test:e2e` builds it first.
 */
import { fork } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

type PublishDiagnosticsParams = {
    uri: string;
    diagnostics: { code?: string; message: string }[];
};

const serverPath = fileURLToPath(new URL('../../dist/server/server.js', import.meta.url));

/** The client spellings under test of a scanned `users.sysml`, and how messages show them. */
const spellings = [
    { spelling: 'percent-encoded', fileName: '%75sers.sysml', shownAs: 'users.sysml' },
    { spelling: 'differently-cased', fileName: 'Users.SYSML', shownAs: 'Users.SYSML' },
];

/**
 * Starts the real server on a workspace `root` whose files are written first,
 * and resolves once its workspace scan is done.
 */
async function startServer(root: string, files: Record<string, string>) {
    for (const [name, text] of Object.entries(files)) {
        await mkdir(dirname(join(root, name)), { recursive: true });
        await writeFile(join(root, name), text);
    }
    const rpc = await import('../../server/node_modules/vscode-jsonrpc/lib/node/main.js');
    const child = fork(serverPath, ['--node-ipc'], { silent: true });
    const connection = rpc.createMessageConnection(new rpc.IPCMessageReader(child), new rpc.IPCMessageWriter(child));
    connection.onRequest('client/registerCapability', () => null);
    connection.onRequest('workspace/configuration', () => [{}]);
    let scanned!: () => void;
    const scanDone = new Promise<void>(resolve => { scanned = resolve; });
    connection.onNotification('window/logMessage', (params: { message: string }) => {
        if (params.message.startsWith('Workspace scan:')) scanned();
    });
    const published: PublishDiagnosticsParams[] = [];
    connection.onNotification('textDocument/publishDiagnostics', (params: PublishDiagnosticsParams) => {
        published.push(params);
    });

    /**
     * Sends `notify`, then waits for semantic diagnostics for `uri` (recognized by their
     * `missing-doc` hint, as the fixtures' definitions are undocumented) with or without an
     * `ambiguous-namespace-name` conflict, and returns the conflicts.
     */
    async function after(notify: () => Promise<void>, uri: string, ambiguous: boolean) {
        const start = published.length;
        await notify();
        const deadline = Date.now() + 10_000;
        while (Date.now() < deadline) {
            const conflicts = published.slice(start)
                .filter(p => p.uri === uri && p.diagnostics.some(d => d.code === 'missing-doc'))
                .map(p => p.diagnostics.filter(d => d.code === 'ambiguous-namespace-name'))
                .find(c => (c.length > 0) === ambiguous);
            if (conflicts) return conflicts;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        throw new Error(`No diagnostics for ${uri} with ambiguous=${ambiguous}: ${JSON.stringify(published.slice(start))}`);
    }

    const notify = (method: string, params: object) => () => connection.sendNotification(method, params);

    /** Closes `uri` and waits until the server has processed it (it then clears the document's diagnostics). */
    async function close(uri: string) {
        const start = published.length;
        await connection.sendNotification('textDocument/didClose', { textDocument: { uri } });
        const deadline = Date.now() + 10_000;
        while (!published.slice(start).some(p => p.uri === uri && p.diagnostics.length === 0)) {
            if (Date.now() > deadline) throw new Error(`${uri} was not closed`);
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }

    connection.listen();
    await connection.sendRequest('initialize', {
        processId: process.pid,
        rootUri: pathToFileURL(root).toString(),
        capabilities: { workspace: { configuration: true } },
        initializationOptions: { isWorkspaceFile: true },
    });
    await connection.sendNotification('initialized', {});
    await scanDone;

    /** The `ambiguous-namespace-name` conflicts `sysml/model` reports for `uri`. */
    async function modelConflicts(uri: string) {
        const model = await connection.sendRequest<{ diagnostics?: { code?: string; message: string }[] }>(
            'sysml/model', { textDocument: { uri }, scope: ['diagnostics'] });
        return (model.diagnostics ?? []).filter(d => d.code === 'ambiguous-namespace-name');
    }

    return {
        after,
        notify,
        close,
        modelConflicts,
        dispose: () => { connection.dispose(); child.kill(); },
    };
}

/** `uri`, the scan's `pathToFileURL` URI of `users.sysml`, with that file name spelled as `fileName`. */
function respell(uri: string, fileName: string): string {
    const respelled = uri.replace(/\/users\.sysml$/, `/${fileName}`);
    expect(respelled).not.toBe(uri);
    return respelled;
}

describe('document URI spelling (real server, over LSP)', () => {
    it.each(spellings)('does not report a file\'s own declarations as ambiguous when the client spells its URI $spelling', async ({ fileName }) => {
        const root = await mkdtemp(join(tmpdir(), 'sysml-uri-spelling-'));
        const text = 'part def Driver;\n';
        const server = await startServer(root, { 'users.sysml': text });
        try {
            const clientUri = respell(pathToFileURL(join(root, 'users.sysml')).toString(), fileName);
            const open = server.notify('textDocument/didOpen', {
                textDocument: { uri: clientUri, languageId: 'sysml', version: 1, text },
            });

            expect(await server.after(open, clientUri, false)).toEqual([]);
            expect(await server.modelConflicts(clientUri)).toEqual([]);

            // Closing re-parses the file from disk; reopening must not find that copy as a second declaration.
            await server.close(clientUri);
            expect(await server.after(open, clientUri, false)).toEqual([]);
            expect(await server.modelConflicts(clientUri)).toEqual([]);
        } finally {
            server.dispose();
            await rm(root, { recursive: true, force: true });
        }
    }, 30_000);

    it.each(spellings)(
        'tracks a conflict introduced, resolved, reintroduced and removed with a file the client spells $spelling',
        async ({ fileName, shownAs }) => {
            const root = await mkdtemp(join(tmpdir(), 'sysml-uri-spelling-'));
            const noConflict = 'part def Other;\n';
            const conflict = 'part def Driver;\n';
            const vehiclePath = join(root, 'Parts', 'vehicle.sysml');
            const usersPath = join(root, 'Definitions', 'users.sysml');
            const server = await startServer(root, { 'Parts/vehicle.sysml': conflict, 'Definitions/users.sysml': noConflict });
            try {
                const vehicleUri = pathToFileURL(vehiclePath).toString();
                const usersServerUri = pathToFileURL(usersPath).toString();
                const usersUri = respell(usersServerUri, fileName);
                const edit = (version: number, text: string) => server.notify('textDocument/didChange', {
                    textDocument: { uri: usersUri, version }, contentChanges: [{ text }],
                });
                // Exactly one other declaration: users.sysml must not also count under the scan's spelling.
                const expectOneConflict = (conflicts: { message: string }[]) => {
                    expect(conflicts).toHaveLength(1);
                    expect(conflicts[0].message).toContain(`in document ../Definitions/${shownAs} (line 1)`);
                    expect(conflicts[0].message).not.toContain('other occurrence');
                };
                // Published diagnostics and `sysml/model` must agree on vehicle.sysml's conflicts.
                const expectConflict = async (published: { message: string }[]) => {
                    expectOneConflict(published);
                    const model = await server.modelConflicts(vehicleUri);
                    expectOneConflict(model);
                    expect(model[0].message).toBe(published[0].message);
                };
                const expectNoConflict = async (published: { message: string }[]) => {
                    expect(published).toEqual([]);
                    expect(await server.modelConflicts(vehicleUri)).toEqual([]);
                };

                // 1. First document, no conflict.
                await expectNoConflict(await server.after(server.notify('textDocument/didOpen', {
                    textDocument: { uri: vehicleUri, languageId: 'sysml', version: 1, text: conflict },
                }), vehicleUri, false));
                await server.after(server.notify('textDocument/didOpen', {
                    textDocument: { uri: usersUri, languageId: 'sysml', version: 1, text: noConflict },
                }), usersUri, false);
                expect(await server.modelConflicts(usersUri)).toEqual([]);
                expect(await server.modelConflicts(vehicleUri)).toEqual([]);

                // 2. Editing the second document creates the conflict.
                await expectConflict(await server.after(edit(2, conflict), vehicleUri, true));

                // 3. Editing it again resolves it.
                await expectNoConflict(await server.after(edit(3, noConflict), vehicleUri, false));

                // 4. Editing it again recreates it.
                await expectConflict(await server.after(edit(4, conflict), vehicleUri, true));

                // 5. Removing it resolves the conflict: saved, closed (re-parsed from disk), then
                // deleted, with the watcher reporting the deletion under the scan's own spelling.
                const remove = async () => {
                    await writeFile(usersPath, conflict);
                    await server.close(usersUri);
                    await rm(usersPath);
                    await server.notify('workspace/didChangeWatchedFiles', {
                        changes: [{ uri: usersServerUri, type: 3 }],
                    })();
                };
                await expectNoConflict(await server.after(remove, vehicleUri, false));
            } finally {
                server.dispose();
                await rm(root, { recursive: true, force: true });
            }
        },
        30_000,
    );
});
