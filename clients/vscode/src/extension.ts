import * as path from 'path';
import { ExtensionContext, workspace, window, commands, Uri, Position } from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from 'vscode-languageclient/node.js';

let client: LanguageClient;
const outputChannel = window.createOutputChannel('SysML v2 LSP');

export function activate(context: ExtensionContext): void {
    outputChannel.appendLine('SysML v2 extension activating...');

    // Path to the server module — use the esbuild-bundled output in dist/
    // so the extension works both in development and when packaged as a VSIX.
    const serverModule = context.asAbsolutePath(
        path.join('dist', 'server', 'server.js')
    );
    outputChannel.appendLine(`Server module path: ${serverModule}`);

    // Debug options: the server is started with --inspect for debugging
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

    // Server options: run and debug configurations
    const serverOptions: ServerOptions = {
        run: {
            module: serverModule,
            transport: TransportKind.ipc,
        },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions,
        },
    };

    // Client options: register for SysML documents
    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            { scheme: 'file', language: 'sysml' },
            { scheme: 'untitled', language: 'sysml' },
        ],
        synchronize: {
            // Notify the server about file changes to .sysml and .kerml files
            fileEvents: workspace.createFileSystemWatcher('**/*.{sysml,kerml}'),
        },
        outputChannel,
    };

    // Create and start the language client
    client = new LanguageClient(
        'sysmlLanguageServer',
        'SysML v2 Language Server',
        serverOptions,
        clientOptions,
    );

    // Start the client — this also starts the server
    client.start().then(
        () => outputChannel.appendLine('Language client started successfully'),
        (err) => outputChannel.appendLine(`Language client failed to start: ${err}`)
    );

    // Register restart command
    context.subscriptions.push(
        commands.registerCommand('sysml.restartServer', async () => {
            outputChannel.appendLine('Restarting language server...');
            if (client) {
                await client.restart();
                outputChannel.appendLine('Language server restarted successfully');
                window.showInformationMessage('SysML Language Server restarted.');
            }
        })
    );

    // Bridge command for CodeLens "N references" — converts raw JSON
    // arguments from the server into proper vscode.Uri / vscode.Position
    // objects that editor.action.findReferences expects.
    context.subscriptions.push(
        commands.registerCommand('sysml.findReferences', (rawUri: string, rawPos: { line: number; character: number }) => {
            const uri = Uri.parse(rawUri);
            const pos = new Position(rawPos.line, rawPos.character);
            return commands.executeCommand('editor.action.findReferences', uri, pos);
        })
    );
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
