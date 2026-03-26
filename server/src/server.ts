import {
    CodeActionKind,
    CodeActionParams,
    CompletionItem,
    createConnection,
    DefinitionParams,
    DidChangeConfigurationNotification,
    DocumentFormattingParams,
    DocumentRangeFormattingParams,
    DocumentSymbol,
    DocumentSymbolParams,
    FoldingRange,
    FoldingRangeParams,
    Hover,
    InitializeParams,
    InitializeResult,
    Location,
    ProposedFeatures,
    ReferenceParams,
    RenameParams,
    SemanticTokens,
    SemanticTokensLegend,
    SemanticTokensParams,
    TextDocumentPositionParams,
    TextDocuments,
    TextDocumentSyncKind,
    TextEdit,
    WorkspaceEdit,
} from 'vscode-languageserver/node.js';

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from './documentManager.js';
import { initLibraryIndex } from './library/libraryIndex.js';
import { SysMLModelProvider } from './model/sysmlModelProvider.js';
import type { SysMLModelParams } from './model/sysmlModelTypes.js';
import { loadDFASnapshot } from './parser/dfaLoader.js';
import { CodeActionProvider } from './providers/codeActionProvider.js';
import { CompletionProvider } from './providers/completionProvider.js';
import { DefinitionProvider } from './providers/definitionProvider.js';
import { DiagnosticsProvider } from './providers/diagnosticsProvider.js';
import { DocumentSymbolProvider } from './providers/documentSymbolProvider.js';
import { FoldingRangeProvider } from './providers/foldingRangeProvider.js';
import { FormattingProvider } from './providers/formattingProvider.js';
import { HoverProvider } from './providers/hoverProvider.js';
import { validateKeywords } from './providers/keywordValidator.js';
import { ReferencesProvider } from './providers/referencesProvider.js';
import { RenameProvider } from './providers/renameProvider.js';
import { SemanticTokensProvider, tokenModifiers, tokenTypes } from './providers/semanticTokensProvider.js';
import { SemanticValidator } from './providers/semanticValidator.js';

/** Convert a file:// URI to a filesystem path, returning undefined for non-file URIs. */
function toFsPath(uri: string): string | undefined {
    try {
        if (uri.startsWith('file://')) return fileURLToPath(uri);
    } catch { /* ignore malformed URIs */ }
    return undefined;
}

// Create a connection using all proposed LSP features
const connection = createConnection(ProposedFeatures.all);

// Text document manager — handles open/change/close lifecycle
const documents = new TextDocuments<TextDocument>(TextDocument);

// Server start timestamp (for uptime reporting)
const serverStartTime = Date.now();

// Core services
const documentManager = new DocumentManager();
const modelProvider = new SysMLModelProvider(documentManager);
const diagnosticsProvider = new DiagnosticsProvider(documentManager);
const completionProvider = new CompletionProvider(documentManager);
const hoverProvider = new HoverProvider(documentManager);
const definitionProvider = new DefinitionProvider(documentManager);
const referencesProvider = new ReferencesProvider(documentManager);
const documentSymbolProvider = new DocumentSymbolProvider(documentManager);
const semanticTokensProvider = new SemanticTokensProvider(documentManager);
const foldingRangeProvider = new FoldingRangeProvider(documentManager);
const renameProvider = new RenameProvider(documentManager);
const codeActionProvider = new CodeActionProvider(documentManager);
const formattingProvider = new FormattingProvider(documents);
const semanticValidator = new SemanticValidator(documentManager);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

/** Workspace folder roots (file-system paths) captured during initialization. */
let workspaceRoots: string[] = [];

/** Set to true after onInitialized completes (DFA loaded, library indexed). */
let serverReady = false;
/** URIs of documents opened before the server was ready. */
const earlyOpenUris = new Set<string>();

// --------------------------------------------------------------------------
// Parse worker bridge
// --------------------------------------------------------------------------

/** Next request ID for the parse worker. */
let workerRequestId = 0;

/** The parse worker thread (spawned lazily). */
let parseWorker: Worker | undefined;
/** True when the worker is available (spawned + not crashed). */
let workerReady = false;

/**
 * Spawn the parse worker.  Called once from onInitialized after the
 * DFA snapshot is loaded on the main thread.  The worker loads its own
 * snapshot independently.
 */
function spawnParseWorker(): void {
    const workerPath = path.join(__dirname, 'parseWorker.js');
    try {
        parseWorker = new Worker(workerPath);
        parseWorker.on('message', handleWorkerMessage);
        parseWorker.on('error', (err) => {
            connection.console.log(`Parse worker error: ${err.message}`);
            workerReady = false;
        });
        parseWorker.on('exit', (code) => {
            connection.console.log(`Parse worker exited with code ${code}`);
            workerReady = false;
            parseWorker = undefined;
        });
        workerReady = true;
        connection.console.log('Parse worker spawned');
    } catch (err) {
        connection.console.log(`Failed to spawn parse worker: ${err}`);
    }
}

/**
 * Handle messages from the parse worker.
 */
function handleWorkerMessage(msg: any): void {
    // Warm-up completion notification
    if (msg.warmup) {
        connection.console.log(
            `Worker DFA warm-up: ${msg.elapsed} ms, ` +
            `${msg.chunksCompleted}/${msg.totalChunks} chunks` +
            (msg.interrupted ? ' (interrupted by real parse)' : ''),
        );
        return;
    }

    // Parse response — deliver fast diagnostics
    const { uri, version, errors, keywordDiagnostics } = msg;

    // Skip if the document was closed or re-edited since
    const doc = documents.get(uri);
    if (!doc || doc.version !== version) return;

    // Convert worker errors → LSP Diagnostics
    const diagnostics: import('vscode-languageserver/node.js').Diagnostic[] = [];
    for (const e of errors) {
        diagnostics.push({
            severity: 1, // Error
            range: {
                start: { line: e.line - 1, character: e.column },
                end: { line: e.line - 1, character: e.column + (e.length || 1) },
            },
            message: e.message,
            source: 'sysml',
        });
    }
    for (const kd of keywordDiagnostics) {
        diagnostics.push({
            severity: kd.severity,
            range: kd.range,
            message: kd.message,
            source: 'sysml',
            code: kd.code,
        });
    }

    // Send worker diagnostics immediately (fast path)
    connection.sendDiagnostics({ uri, diagnostics });

    // Now do the main-thread parse for the symbol table (needed by
    // hover, completion, go-to-def, etc.).  The main-thread DFA is
    // already warm from the snapshot so this is fast (~50-200 ms).
    // We do this asynchronously via setImmediate to keep the event
    // loop responsive between the fast diagnostic push and the
    // heavier symbol-table build.
    setImmediate(() => {
        const currentDoc = documents.get(uri);
        if (!currentDoc || currentDoc.version !== version) return;

        documentManager.parse(currentDoc);

        // Merge syntax diagnostics from the authoritative main-thread
        // parse with semantic diagnostics (deferred).
        const mainDiags = diagnosticsProvider.getDiagnostics(uri);
        const parseResult = documentManager.get(uri);
        if (parseResult) {
            mainDiags.push(...validateKeywords(parseResult));
        }
        connection.sendDiagnostics({ uri, diagnostics: mainDiags });

        connection.sendNotification('sysml/status', {
            state: 'end',
            message: `Parsed ${uri.split('/').pop()} (worker + main)`,
            fileName: uri.split('/').pop(),
            uri,
        });

        // Deferred semantic validation
        const existingSemantic = semanticTimers.get(uri);
        if (existingSemantic) clearTimeout(existingSemantic);
        semanticTimers.set(uri, setTimeout(() => {
            semanticTimers.delete(uri);
            if (documentManager.getVersion(uri) !== version) return;
            if (!documents.get(uri)) return;
            const semanticDiags = semanticValidator.validate(uri);
            documentManager.setSemanticDiagnostics(uri, semanticDiags);
            if (semanticDiags.length === 0) return;
            mainDiags.push(...semanticDiags);
            connection.sendDiagnostics({ uri, diagnostics: mainDiags });
        }, 50));
    });
}

/**
 * Send a parse request to the worker.  Returns true if the worker
 * accepted the request, false if the worker is unavailable (fallback
 * to main-thread parsing).
 */
function requestWorkerParse(document: TextDocument): boolean {
    if (!workerReady || !parseWorker) return false;
    const id = ++workerRequestId;
    parseWorker.postMessage({
        id,
        text: document.getText(),
        uri: document.uri,
        version: document.version,
    });
    return true;
}

// --------------------------------------------------------------------------
// Lifecycle
// --------------------------------------------------------------------------

connection.onInitialize((params: InitializeParams): InitializeResult => {
    const capabilities = params.capabilities;

    hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
    );
    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );

    // Capture workspace folder roots for background file scanning.
    if (params.workspaceFolders) {
        workspaceRoots = params.workspaceFolders
            .map(f => toFsPath(f.uri))
            .filter((p): p is string => p !== undefined);
    } else if (params.rootUri) {
        const root = toFsPath(params.rootUri);
        if (root) workspaceRoots = [root];
    }

    const legend: SemanticTokensLegend = {
        tokenTypes,
        tokenModifiers,
    };

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,

            // Completion
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['.', ':', ' '],
            },

            // Hover
            hoverProvider: true,

            // Go to definition
            definitionProvider: true,

            // Find references
            referencesProvider: true,

            // Document symbols (outline)
            documentSymbolProvider: true,

            // Semantic tokens
            semanticTokensProvider: {
                full: true,
                legend,
            },

            // Folding ranges
            foldingRangeProvider: true,

            // Rename
            renameProvider: {
                prepareProvider: true,
            },

            // Code actions (quick fixes)
            codeActionProvider: {
                codeActionKinds: [
                    CodeActionKind.QuickFix,
                ],
            },

            // Document formatting
            documentFormattingProvider: true,
            documentRangeFormattingProvider: true,
        },
    };

    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true,
            },
        };
    }

    return result;
});

connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        connection.client.register(
            DidChangeConfigurationNotification.type,
            undefined
        );
    }

    // Bootstrap the standard library index for Go-to-Definition on
    // built-in types (String, Real, Boolean, etc.).
    const libCount = initLibraryIndex(__dirname);
    connection.console.log(`SysML v2 Language Server initialized (${libCount} library packages indexed)`);

    // Pre-populate the ANTLR4 DFA from a build-time snapshot.
    // Loads serialized DFA states (~20 ms) so most grammar paths are
    // instant.  Uncovered paths self-heal via the LL fallback — the
    // DFA is never cleared.  See parseDocument.ts for details.
    const dfaT0 = Date.now();
    try {
        const dfaStates = loadDFASnapshot();
        connection.console.log(
            `DFA snapshot loaded: ${dfaStates} states in ${Date.now() - dfaT0} ms`
        );
    } catch (e) {
        connection.console.log(
            `DFA snapshot load failed (will use cold DFA): ${e}`
        );
    }

    // Scan workspace folders for .sysml files and pre-parse them so
    // cross-file type references resolve even before files are opened.
    if (workspaceRoots.length > 0) {
        const scanT0 = Date.now();
        let fileCount = 0;
        for (const root of workspaceRoots) {
            fileCount += scanWorkspaceFolder(root);
        }
        const scanMs = Date.now() - scanT0;
        connection.console.log(
            `Workspace scan: pre-parsed ${fileCount} .sysml files in ${scanMs} ms`
        );
    }

    // Server is fully initialized — mark ready and spawn the parse worker.
    serverReady = true;
    spawnParseWorker();

    // Re-validate any documents that were opened before the DFA was loaded.  The
    // early parse may have produced false-positive syntax errors
    // because the cold DFA doesn't cover all grammar paths.
    serverReady = true;
    if (earlyOpenUris.size > 0) {
        connection.console.log(
            `Re-validating ${earlyOpenUris.size} document(s) opened before server was ready`
        );
        for (const uri of earlyOpenUris) {
            const doc = documents.get(uri);
            if (doc) validateDocument(doc);
        }
        earlyOpenUris.clear();
    }
});

// --------------------------------------------------------------------------
// Workspace file scanning
// --------------------------------------------------------------------------

/**
 * Recursively find all .sysml files under a directory.
 */
function findSysMLFiles(dir: string): string[] {
    const results: string[] = [];
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return results;
    }
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
            // Skip nested repositories — they are independent projects
            // whose files should not be loaded into this workspace.
            try {
                fs.statSync(path.join(fullPath, '.git'));
                continue; // has .git → skip
            } catch { /* no .git → recurse */ }
            results.push(...findSysMLFiles(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith('.sysml') || entry.name.endsWith('.kerml'))) {
            results.push(fullPath);
        }
    }
    return results;
}

/**
 * Pre-parse a .sysml file from disk into the document manager
 * so its symbols are available for cross-file resolution.
 * Skips files already managed by the TextDocuments sync (i.e. open in the editor).
 */
function parseWorkspaceFile(filePath: string): boolean {
    const uri = pathToFileURL(filePath).toString();
    // Don't overwrite documents the editor has open — those are authoritative.
    if (documents.get(uri)) return false;

    let content: string;
    try {
        content = fs.readFileSync(filePath, 'utf-8');
    } catch {
        return false;
    }

    const doc = TextDocument.create(uri, 'sysml', 0, content);
    documentManager.parse(doc);
    return true;
}

/**
 * Scan a workspace folder root and pre-parse all .sysml files found.
 */
function scanWorkspaceFolder(root: string): number {
    const files = findSysMLFiles(root);
    let count = 0;
    for (const f of files) {
        if (parseWorkspaceFile(f)) count++;
    }
    return count;
}

/**
 * Re-run semantic validation on all currently open documents.
 * Called when background workspace files change, which may resolve
 * or introduce new cross-file type reference diagnostics.
 */
function revalidateOpenDocuments(): void {
    for (const doc of documents.all()) {
        validateDocument(doc);
    }
}

// --------------------------------------------------------------------------
// Document sync — parse on open/change
// --------------------------------------------------------------------------

/** Debounced timer for cross-file re-validation after a document opens. */
let crossFileRevalidateTimer: ReturnType<typeof setTimeout> | undefined;

documents.onDidOpen((event) => {
    if (!serverReady) {
        // Server not fully initialized (DFA not loaded yet).  Queue
        // the URI for re-validation after onInitialized completes.
        // Still parse it so symbols are available, but don't send
        // diagnostics that may be false positives.
        earlyOpenUris.add(event.document.uri);
        documentManager.parse(event.document);
        return;
    }

    validateDocument(event.document);

    // A newly opened file adds symbols to the workspace table.
    // Debounce cross-file re-validation so bulk-opening many files
    // (e.g. workspace scan) doesn't cause O(n²) validateDocument calls.
    if (crossFileRevalidateTimer) clearTimeout(crossFileRevalidateTimer);
    crossFileRevalidateTimer = setTimeout(() => {
        crossFileRevalidateTimer = undefined;
        revalidateOpenDocuments();
    }, 500);
});

/** Pending debounce timers keyed by document URI. */
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Pending deferred semantic validation timers keyed by document URI. */
const semanticTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Debounce delay in ms — avoids re-parsing on every keystroke. */
const DEBOUNCE_MS = 200;

documents.onDidChangeContent((event) => {
    const uri = event.document.uri;
    const existing = debounceTimers.get(uri);
    if (existing) clearTimeout(existing);

    debounceTimers.set(uri, setTimeout(() => {
        debounceTimers.delete(uri);
        // The document may have been closed before the debounce fired.
        if (!documents.get(uri)) {
            return;
        }
        validateDocument(event.document);
    }, DEBOUNCE_MS));
});

documents.onDidClose((event) => {
    const uri = event.document.uri;

    const debounceTimer = debounceTimers.get(uri);
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimers.delete(uri);
    }

    const semanticTimer = semanticTimers.get(uri);
    if (semanticTimer) {
        clearTimeout(semanticTimer);
        semanticTimers.delete(uri);
    }

    documentManager.remove(event.document.uri);
    modelProvider.removeUri(event.document.uri);
    // Clear diagnostics for closed documents
    connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });

    // When a file is closed, re-parse it from disk so its symbols
    // remain available for cross-file resolution.
    const fsPath = toFsPath(event.document.uri);
    if (fsPath && (fsPath.endsWith('.sysml') || fsPath.endsWith('.kerml'))) {
        parseWorkspaceFile(fsPath);
    }
});

// --------------------------------------------------------------------------
// Watched file events — pick up changes to .sysml files on disk
// --------------------------------------------------------------------------

connection.onDidChangeWatchedFiles((params) => {
    let changed = false;
    for (const change of params.changes) {
        const fsPath = toFsPath(change.uri);
        if (!fsPath) continue;

        // 1 = Created, 2 = Changed, 3 = Deleted
        if (change.type === 3) {
            // File deleted — remove from document manager
            if (documentManager.get(change.uri)) {
                documentManager.remove(change.uri);
                changed = true;
            }
        } else {
            // Created or changed — re-parse from disk (if not open in editor)
            if (!documents.get(change.uri) && (fsPath.endsWith('.sysml') || fsPath.endsWith('.kerml'))) {
                if (parseWorkspaceFile(fsPath)) {
                    changed = true;
                }
            }
        }
    }

    // Re-validate open documents so cross-file diagnostics update.
    if (changed) {
        revalidateOpenDocuments();
    }
});

async function validateDocument(document: TextDocument): Promise<void> {
    if (!documents.get(document.uri)) {
        return;
    }

    const fileName = document.uri.split('/').pop() ?? document.uri;

    // Notify the client that parsing has started
    connection.sendNotification('sysml/status', {
        state: 'begin',
        message: `Parsing ${fileName}`,
        fileName,
        uri: document.uri,
    });

    // Try the worker first — it runs the ANTLR parse off the main
    // thread so hover/completion/go-to-def stay responsive.
    // The worker posts diagnostics back via handleWorkerMessage,
    // which also kicks off the main-thread parse for the symbol table.
    if (requestWorkerParse(document)) {
        return;
    }

    // Fallback: main-thread parse (worker unavailable or not started)
    const parseT0 = Date.now();
    documentManager.parse(document);
    const parseMs = Date.now() - parseT0;

    // Collect diagnostics from all sources (syntax errors — fast)
    const diagnostics = diagnosticsProvider.getDiagnostics(document.uri);

    // Keyword validation (misspelled keywords — fast)
    const parseResult = documentManager.get(document.uri);
    if (parseResult) {
        diagnostics.push(...validateKeywords(parseResult));
    }

    // Send fast diagnostics immediately so the user sees syntax errors
    connection.sendDiagnostics({ uri: document.uri, diagnostics });

    // Notify the client that parsing is complete
    connection.sendNotification('sysml/status', {
        state: 'end',
        message: `Parsed ${fileName} (${parseMs} ms)`,
        fileName,
        uri: document.uri,
    });

    // Defer semantic validation — yield the event loop first so LSP
    // requests (hover, completion, etc.) can be served promptly.
    const version = document.version;
    const existingSemantic = semanticTimers.get(document.uri);
    if (existingSemantic) {
        clearTimeout(existingSemantic);
    }

    const semanticTimer = setTimeout(() => {
        semanticTimers.delete(document.uri);

        // Skip if the document has been re-parsed since we started
        if (documentManager.getVersion(document.uri) !== version) return;

        // Skip if the document was closed while timer was pending.
        if (!documents.get(document.uri)) return;

        const semanticDiags = semanticValidator.validate(document.uri);
        documentManager.setSemanticDiagnostics(document.uri, semanticDiags);
        if (semanticDiags.length === 0) return;

        // Merge with current diagnostics
        diagnostics.push(...semanticDiags);
        connection.sendDiagnostics({ uri: document.uri, diagnostics });
    }, 50);
    semanticTimers.set(document.uri, semanticTimer);
}

// --------------------------------------------------------------------------
// LSP feature handlers
// --------------------------------------------------------------------------

connection.onCompletion(
    (params: TextDocumentPositionParams): CompletionItem[] => {
        return completionProvider.provideCompletions(params);
    }
);

connection.onCompletionResolve(
    (item: CompletionItem): CompletionItem => {
        return completionProvider.resolveCompletion(item);
    }
);

connection.onHover(
    (params: TextDocumentPositionParams): Hover | null => {
        return hoverProvider.provideHover(params);
    }
);

connection.onDefinition(
    (params: DefinitionParams): Location | null => {
        return definitionProvider.provideDefinition(params);
    }
);

connection.onReferences(
    (params: ReferenceParams): Location[] => {
        return referencesProvider.provideReferences(params);
    }
);

connection.onDocumentSymbol(
    (params: DocumentSymbolParams): DocumentSymbol[] => {
        return documentSymbolProvider.provideDocumentSymbols(params);
    }
);

connection.languages.semanticTokens.on(
    (params: SemanticTokensParams): SemanticTokens => {
        return semanticTokensProvider.provideSemanticTokens(params);
    }
);

connection.onFoldingRanges(
    (params: FoldingRangeParams): FoldingRange[] => {
        return foldingRangeProvider.provideFoldingRanges(params);
    }
);

connection.onPrepareRename(
    (params: TextDocumentPositionParams) => {
        return renameProvider.prepareRename(params);
    }
);

connection.onRenameRequest(
    (params: RenameParams): WorkspaceEdit | null => {
        return renameProvider.provideRename(params);
    }
);

connection.onCodeAction(
    (params: CodeActionParams) => {
        return codeActionProvider.provideCodeActions(params);
    }
);

connection.onDocumentFormatting(
    (params: DocumentFormattingParams): TextEdit[] => {
        return formattingProvider.provideDocumentFormatting(params);
    }
);

connection.onDocumentRangeFormatting(
    (params: DocumentRangeFormattingParams): TextEdit[] => {
        return formattingProvider.provideRangeFormatting(params);
    }
);

// --------------------------------------------------------------------------
// Custom LSP requests
// --------------------------------------------------------------------------

/**
 * `sysml/model` — returns the parsed semantic model for a document.
 * Drives the Model Explorer, Dashboard, Feature Inspector, and status bar metrics.
 */
connection.onRequest('sysml/model', (params: SysMLModelParams) => {
    return modelProvider.getModel(
        params.textDocument.uri,
        1,
        params.scope,
    );
});

/**
 * `sysml/serverStats` — returns server health/memory statistics.
 * Drives the LSP Health section of the status bar tooltip.
 */
connection.onRequest('sysml/serverStats', () => {
    const mem = process.memoryUsage();
    const toMB = (bytes: number) => Math.round(bytes / 1024 / 1024);
    return {
        uptime: Math.round((Date.now() - serverStartTime) / 1000),
        memory: {
            heapUsed: toMB(mem.heapUsed),
            heapTotal: toMB(mem.heapTotal),
            rss: toMB(mem.rss),
            external: toMB(mem.external),
        },
        caches: {
            documents: documentManager.getUris().length,
            symbolTables: modelProvider.cacheSize,
            semanticTokens: 0,
        },
    };
});

/**
 * `sysml/clearCache` — flushes all in-memory caches.
 * Returns the number of evicted entries per cache category.
 */
connection.onRequest('sysml/clearCache', () => {
    const docCount = documentManager.getUris().length;
    const stCount = modelProvider.clearAll();
    // Remove all cached documents
    for (const uri of documentManager.getUris()) {
        documentManager.remove(uri);
    }
    return {
        documents: docCount,
        symbolTables: stCount,
        semanticTokens: 0,
    };
});

// --------------------------------------------------------------------------
// Start
// --------------------------------------------------------------------------

documents.listen(connection);
connection.listen();
