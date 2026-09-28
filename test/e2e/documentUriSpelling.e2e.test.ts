/**
 * End-to-end regression test for matching workspace files by identity, not
 * URI spelling (`isSameDocumentUri` in `server/src/utils/documentUri.ts`).
 *
 * A client can spell a file's URI differently from the server's own
 * `pathToFileURL` (on Windows, `file:///c%3A/...` vs `file:///C:/...`). The
 * server then held the scanned copy and the opened copy side by side, and
 * every declaration in the file reported an ambiguous-name conflict with
 * itself. This test opens a scanned file under a percent-encoded and a
 * differently-cased spelling, which reproduces the mismatch on any platform.
 *
 * Requires `dist/server/server.js` -- `npm run test:e2e` builds it first.
 */
import { fork } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

type PublishDiagnosticsParams = {
    uri: string;
    diagnostics: { code?: string; message: string }[];
};

const serverPath = fileURLToPath(new URL('../../dist/server/server.js', import.meta.url));

describe('document URI spelling (real server, over LSP)', () => {
    it.each([
        { spelling: 'percent-encoded', fileName: '%75sers.sysml' },
        { spelling: 'differently-cased', fileName: 'Users.SYSML' },
    ])('does not report a file\'s own declarations as ambiguous when the client spells its URI $spelling', async ({ fileName }) => {
        const root = await mkdtemp(join(tmpdir(), 'sysml-uri-spelling-'));
        const rpc = await import('../../server/node_modules/vscode-jsonrpc/lib/node/main.js');
        const child = fork(serverPath, ['--node-ipc'], { silent: true });
        const connection = rpc.createMessageConnection(new rpc.IPCMessageReader(child), new rpc.IPCMessageWriter(child));
        try {
            const text = 'part def Driver;\n';
            await writeFile(join(root, 'users.sysml'), text);
            // Same file as the scan's `pathToFileURL` URI, spelled differently.
            const serverUri = pathToFileURL(join(root, 'users.sysml')).toString();
            const clientUri = serverUri.replace(/\/users\.sysml$/, `/${fileName}`);
            expect(clientUri).not.toBe(serverUri);

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
             * Waits for the next semantic diagnostics published for `uri`, recognized by the
             * `missing-doc` hint on the undocumented `Driver` (earlier publishes are syntax-only).
             */
            async function nextDiagnostics(uri: string): Promise<PublishDiagnosticsParams> {
                const start = published.length;
                const deadline = Date.now() + 10_000;
                while (Date.now() < deadline) {
                    const match = published.slice(start)
                        .find(p => p.uri === uri && p.diagnostics.some(d => d.code === 'missing-doc'));
                    if (match) return match;
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                throw new Error(`No diagnostics for ${uri}`);
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

            const open = async () => {
                const diagnostics = nextDiagnostics(clientUri);
                await connection.sendNotification('textDocument/didOpen', {
                    textDocument: { uri: clientUri, languageId: 'sysml', version: 1, text },
                });
                return (await diagnostics).diagnostics.filter(d => d.code === 'ambiguous-namespace-name');
            };

            expect(await open()).toEqual([]);

            // Closing re-parses the file from disk; reopening must not find that copy as a second declaration.
            await connection.sendNotification('textDocument/didClose', { textDocument: { uri: clientUri } });
            expect(await open()).toEqual([]);
        } finally {
            connection.dispose();
            child.kill();
            await rm(root, { recursive: true, force: true });
        }
    }, 30_000);
});
