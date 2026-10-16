import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { CompletionItem, Diagnostic, Hover, Location, WorkspaceEdit } from 'vscode-languageserver/node';

const serverPath = fileURLToPath(new URL('../../dist/server/server.js', import.meta.url));

it('handles Unicode names and worker positions through the real LSP transport', async () => {
    const rpc = await import('../../server/node_modules/vscode-jsonrpc/lib/node/main.js');
    const child = fork(serverPath, ['--node-ipc'], { silent: true });
    const connection = rpc.createMessageConnection(new rpc.IPCMessageReader(child), new rpc.IPCMessageWriter(child));
    connection.onRequest('client/registerCapability', () => null);
    connection.onRequest('workspace/configuration', (params: { items: unknown[] }) => params.items.map(() => ({})));
    const uri = 'file:///unicode-e2e.sysml';
    let finishDiagnostics: ((diagnostics: Diagnostic[]) => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const nextDiagnostics = (predicate: (diagnostics: Diagnostic[]) => boolean) =>
        new Promise<Diagnostic[]>((resolve, reject) => {
            timer = setTimeout(() => reject(new Error('Timed out waiting for Unicode diagnostics')), 10_000);
            finishDiagnostics = diagnostics => {
                if (!predicate(diagnostics)) return;
                clearTimeout(timer);
                resolve(diagnostics);
            };
        });
    connection.onNotification('textDocument/publishDiagnostics', (params: { uri: string; diagnostics: Diagnostic[] }) => {
        if (params.uri === uri) finishDiagnostics?.(params.diagnostics);
    });
    connection.listen();
    try {
        await connection.sendRequest('initialize', {
            processId: process.pid, rootUri: null, capabilities: {},
        });
        await connection.sendNotification('initialized', {});
        const text = `package '\u{1f680}' {
    part def '\u6e29\u5ea6\u03a9\u{1f680}';
    part instance : '\u6e29\u5ea6\u03a9\u{1f680}';
    attribute :>> referenceUnit = SI::'\u03a9';
    attribute missing : 'Missing\u{1f680}';
    // '\u6e29\u5ea6\u03a9\u{1f680}'
}`;
        const doc = TextDocument.create(uri, 'sysml', 1, text);
        const published = nextDiagnostics(diagnostics => diagnostics.some(d => d.code === 'unresolved-type'));
        await connection.sendNotification('textDocument/didOpen', {
            textDocument: { uri, languageId: 'sysml', version: 1, text },
        });
        const model = await connection.sendRequest<{ diagnostics: Diagnostic[] }>('sysml/model', {
            textDocument: { uri }, scope: ['elements', 'diagnostics'],
        });
        for (const diagnostics of [model.diagnostics, await published]) {
            const unresolved = diagnostics.filter(d => d.code === 'unresolved-type');
            expect(unresolved).toHaveLength(1);
            expect(unresolved[0].message).toContain('Missing\u{1f680}');
        }
        const reference = {
            textDocument: { uri }, position: doc.positionAt(text.indexOf("'\u6e29\u5ea6", text.indexOf('part instance')) + 2),
        };
        const location = await connection.sendRequest<Location>('textDocument/definition', reference);
        expect(doc.getText(location.range)).toBe("'\u6e29\u5ea6\u03a9\u{1f680}'");
        expect(location.range.start.line).toBe(1);
        const hover = await connection.sendRequest<Hover>('textDocument/hover', reference);
        expect(JSON.stringify(hover.contents)).toContain('\u6e29\u5ea6\u03a9\u{1f680}');
        expect(doc.getText(hover.range!)).toBe("'\u6e29\u5ea6\u03a9\u{1f680}'");
        const references = await connection.sendRequest<Location[]>('textDocument/references', {
            ...reference, context: { includeDeclaration: false },
        });
        expect(references).toHaveLength(1);
        expect(doc.getText(references[0].range)).toBe("'\u6e29\u5ea6\u03a9\u{1f680}'");
        const rename = await connection.sendRequest<WorkspaceEdit>('textDocument/rename', {
            ...reference, newName: '\u6539\u540d\u{1f680}',
        });
        expect(rename.changes![uri]).toHaveLength(2);
        const renamed = TextDocument.applyEdits(doc, rename.changes![uri]);
        expect(renamed).toContain("part instance : '\u6539\u540d\u{1f680}'");
        expect(renamed).toContain("// '\u6e29\u5ea6\u03a9\u{1f680}'");
        const completions = await connection.sendRequest<CompletionItem[]>('textDocument/completion', reference);
        expect(completions.find(item => item.label === '\u6e29\u5ea6\u03a9\u{1f680}')?.insertText)
            .toBe("'\u6e29\u5ea6\u03a9\u{1f680}'");
        const unitHover = await connection.sendRequest<Hover>('textDocument/hover', {
            textDocument: { uri }, position: doc.positionAt(text.indexOf("SI::'\u03a9'") + 5),
        });
        expect(JSON.stringify(unitHover.contents)).toContain('ohm');

        const invalid = "package '\u{1f680}' { part def default; }";
        const workerDiagnostics = nextDiagnostics(diagnostics =>
            diagnostics.some(d => d.message.includes('reserved SysML keyword')));
        await connection.sendNotification('textDocument/didChange', {
            textDocument: { uri, version: 2 }, contentChanges: [{ text: invalid }],
        });
        const keyword = (await workerDiagnostics).find(d => d.message.includes('reserved SysML keyword'))!;
        expect(keyword.range.start.character).toBe(invalid.indexOf('default'));
        await connection.sendRequest('shutdown');
        await connection.sendNotification('exit');
    } finally {
        clearTimeout(timer);
        connection.dispose();
        child.kill();
    }
});
