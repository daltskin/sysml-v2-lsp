"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const path = __importStar(require("path"));
const vscode_1 = require("vscode");
const node_js_1 = require("vscode-languageclient/node.js");
let client;
const outputChannel = vscode_1.window.createOutputChannel('SysML v2 LSP');
function activate(context) {
    outputChannel.appendLine('SysML v2 extension activating...');
    // Path to the server module — use the esbuild-bundled output in dist/
    // so the extension works both in development and when packaged as a VSIX.
    const serverModule = context.asAbsolutePath(path.join('dist', 'server', 'server.js'));
    outputChannel.appendLine(`Server module path: ${serverModule}`);
    // Debug options: the server is started with --inspect for debugging
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
    // Server options: run and debug configurations
    const serverOptions = {
        run: {
            module: serverModule,
            transport: node_js_1.TransportKind.ipc,
        },
        debug: {
            module: serverModule,
            transport: node_js_1.TransportKind.ipc,
            options: debugOptions,
        },
    };
    // Client options: register for SysML documents
    const clientOptions = {
        documentSelector: [
            { scheme: 'file', language: 'sysml' },
            { scheme: 'untitled', language: 'sysml' },
        ],
        synchronize: {
            // Notify the server about file changes to .sysml and .kerml files
            fileEvents: vscode_1.workspace.createFileSystemWatcher('**/*.{sysml,kerml}'),
        },
        outputChannel,
    };
    // Create and start the language client
    client = new node_js_1.LanguageClient('sysmlLanguageServer', 'SysML v2 Language Server', serverOptions, clientOptions);
    // Start the client — this also starts the server
    client.start().then(() => outputChannel.appendLine('Language client started successfully'), (err) => outputChannel.appendLine(`Language client failed to start: ${err}`));
    // Register restart command
    context.subscriptions.push(vscode_1.commands.registerCommand('sysml.restartServer', async () => {
        outputChannel.appendLine('Restarting language server...');
        if (client) {
            await client.restart();
            outputChannel.appendLine('Language server restarted successfully');
            vscode_1.window.showInformationMessage('SysML Language Server restarted.');
        }
    }));
    // Bridge command for CodeLens "N references" — converts raw JSON
    // arguments from the server into proper vscode.Uri / vscode.Position
    // objects that editor.action.findReferences expects.
    context.subscriptions.push(vscode_1.commands.registerCommand('sysml.findReferences', (rawUri, rawPos) => {
        const uri = vscode_1.Uri.parse(rawUri);
        const pos = new vscode_1.Position(rawPos.line, rawPos.character);
        return vscode_1.commands.executeCommand('editor.action.findReferences', uri, pos);
    }));
}
function deactivate() {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
//# sourceMappingURL=extension.js.map