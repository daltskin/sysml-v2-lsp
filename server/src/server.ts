import {
    CodeActionKind,
    CodeActionParams,
    CompletionItem,
    createConnection,
    DefinitionParams,
    DidChangeConfigurationNotification,
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
    WorkspaceEdit,
} from 'vscode-languageserver/node.js';

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
import { HoverProvider } from './providers/hoverProvider.js';
import { validateKeywords } from './providers/keywordValidator.js';
import { ReferencesProvider } from './providers/referencesProvider.js';
import { RenameProvider } from './providers/renameProvider.js';
import { SemanticTokensProvider, tokenModifiers, tokenTypes } from './providers/semanticTokensProvider.js';
import { SemanticValidator } from './providers/semanticValidator.js';

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

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

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
    // This eliminates the ~17 s cold-start penalty on first parse.
    // The snapshot contains serialized DFA states/edges generated by
    // parsing representative files at build time.  Loading is nearly
    // instant and the parser's fast path uses the pre-built edges.
    const dfaT0 = Date.now();
    try {
        const dfaStates = loadDFASnapshot();
        const dfaMs = Date.now() - dfaT0;
        connection.console.log(
            `DFA snapshot loaded: ${dfaStates} states in ${dfaMs} ms`
        );
    } catch (e) {
        connection.console.log(
            `DFA snapshot load failed (will use cold DFA): ${e}`
        );
    }
});

// --------------------------------------------------------------------------
// Document sync — parse on open/change
// --------------------------------------------------------------------------

documents.onDidOpen((event) => {
    validateDocument(event.document);
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

    // Parse and cache the document
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

        const semanticValidator = new SemanticValidator(documentManager);
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
