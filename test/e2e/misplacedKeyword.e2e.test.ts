import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { Diagnostic } from 'vscode-languageserver/node';
import { hiddenSyntaxErrorCases } from '../fixtures/syntaxDiagnostics.js';

const serverPath = fileURLToPath(new URL('../../dist/server/server.js', import.meta.url));

/**
 * A misplaced keyword through the real LSP transport: every diagnostics set published for a
 * document -- the parse worker's fast one and the main thread's -- preserves syntax errors
 * and reports a keyword used as a name only where it is one.
 */
it('preserves syntax errors and keyword messages in worker and main-thread diagnostics', async () => {
    const rpc = await import('../../server/node_modules/vscode-jsonrpc/lib/node/main.js');
    const child = fork(serverPath, ['--node-ipc'], { silent: true });
    const connection = rpc.createMessageConnection(new rpc.IPCMessageReader(child), new rpc.IPCMessageWriter(child));
    connection.onRequest('client/registerCapability', () => null);
    connection.onRequest('workspace/configuration', (params: { items: unknown[] }) => params.items.map(() => ({})));
    const published = new Map<string, Diagnostic[][]>();
    connection.onNotification('textDocument/publishDiagnostics', (params: { uri: string; diagnostics: Diagnostic[] }) => {
        published.set(params.uri, [...(published.get(params.uri) ?? []), params.diagnostics]);
    });
    const workerParsed = new Set<string>();
    connection.onNotification('sysml/status', (params: { state: string; message: string; uri?: string }) => {
        if (params.state === 'end' && params.uri && params.message.includes('worker + main')) workerParsed.add(params.uri);
    });
    connection.listen();
    const cases: Record<string, { text: string; asName: boolean; parserMessage?: string; syntaxLine?: number }> = {
        keywordName: { text: 'part def part;', asName: true },
        missingSemicolon: { text: 'part def A {\n  attribute x : Real\n  attribute y : Real;\n}', asName: false },
        successionFlowDef: { text: 'succession flow def SF;', asName: false },
        repeatedDirectionBasicName: { text: 'part def B { in attribute in y; }', asName: false, parserMessage: "extraneous input 'in'" },
        repeatedDirectionUnrestrictedName: { text: "part def B { in attribute in 'y'; }", asName: false, parserMessage: "extraneous input 'in'" },
        repeatedDirectionUnreservedKeywordName: { text: 'part def B { in attribute in type; }', asName: false, parserMessage: "extraneous input 'in'" },
    };
    hiddenSyntaxErrorCases.forEach(({ text, line }, index) => {
        cases[`hiddenSyntaxError${index}`] = { text, asName: false, syntaxLine: line };
    });
    try {
        await connection.sendRequest('initialize', { processId: process.pid, rootUri: null, capabilities: {} });
        await connection.sendNotification('initialized', {});
        for (const [name, { text }] of Object.entries(cases)) {
            await connection.sendNotification('textDocument/didOpen', {
                textDocument: { uri: `file:///${name}.sysml`, languageId: 'sysml', version: 1, text },
            });
        }
        // Diagnostics can arrive before the worker/main completion notification.
        const deadline = Date.now() + 10_000;
        while (Object.keys(cases).some(name => {
            const uri = `file:///${name}.sysml`;
            return !workerParsed.has(uri) || (published.get(uri)?.length ?? 0) < 2;
        }) && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        for (const [name, { asName, parserMessage, syntaxLine }] of Object.entries(cases)) {
            const sets = published.get(`file:///${name}.sysml`) ?? [];
            expect(workerParsed.has(`file:///${name}.sysml`), `${name} parsed by the worker`).toBe(true);
            expect(sets.length, name).toBeGreaterThanOrEqual(2);
            for (const diagnostics of sets) {
                expect(diagnostics.some(d => Diagnostic.getMessageString(d).includes('reserved SysML keyword')), name).toBe(asName);
                if (parserMessage) {
                    expect(diagnostics.some(d => Diagnostic.getMessageString(d).startsWith(parserMessage)), name).toBe(true);
                }
                if (syntaxLine !== undefined) {
                    expect(diagnostics.some(d => d.severity === 1 && d.code === undefined
                        && d.range.start.line === syntaxLine), name).toBe(true);
                }
            }
        }
        await connection.sendRequest('shutdown');
        await connection.sendNotification('exit');
    } finally {
        connection.dispose();
        child.kill();
    }
}, 30_000);
