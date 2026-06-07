import { TextDocument } from 'vscode-languageserver-textdocument';
import { Diagnostic } from 'vscode-languageserver/node';
import { parseDocument, parseDocumentBatch, ParseResult } from './parser/parseDocument.js';
import { SymbolTable } from './symbols/symbolTable.js';
import { stripComments } from './utils/identUtils.js';

/**
 * Manages parsed documents — caches parse results by URI and content hash.
 * Re-parses only when the document content has changed.
 */
export class DocumentManager {
    private cache = new Map<string, CachedDocument>();
    /** Shared workspace-wide symbol table — rebuilt incrementally. */
    private wsSymbolTable = new SymbolTable();
    /** Tracks per-URI versions that were last built into the workspace table. */
    private wsBuiltVersions = new Map<string, number>();

    /**
     * Parse a document and cache the result.
     * Returns the cached result if the content hasn't changed.
     */
    parse(document: TextDocument): ParseResult {
        const uri = document.uri;
        const version = document.version;
        const cached = this.cache.get(uri);

        if (cached && cached.version === version && !cached.needsParse) {
            return cached.result;
        }

        const text = document.getText();
        const result = parseDocument(text);

        this.cache.set(uri, {
            version,
            text,
            result,
            needsParse: false,
        });

        return result;
    }

    /**
     * Parse a document using the batch-optimised path (reuses lexer/parser
     * instances across calls).  Use this for workspace scanning where many
     * files are parsed sequentially and the per-file constructor overhead
     * matters.
     */
    parseBatch(uri: string, version: number, text: string): ParseResult {
        const cached = this.cache.get(uri);
        if (cached && cached.version === version && !cached.needsParse) {
            return cached.result;
        }

        const result = parseDocumentBatch(text);

        this.cache.set(uri, {
            version,
            text,
            result,
            needsParse: false,
        });

        return result;
    }

    /**
     * Cache the document text and version without parsing.
     * The actual ANTLR parse is deferred until a provider needs the
     * symbol table (via `getSymbolTable` / `getWorkspaceSymbolTable`).
     * This avoids the double-parse penalty when a parse worker has
     * already produced diagnostics for this version.
     */
    cacheTextOnly(uri: string, version: number, text: string): void {
        const cached = this.cache.get(uri);
        // Don't overwrite a fully parsed entry for the same version
        if (cached && cached.version === version && !cached.needsParse) {
            return;
        }
        this.cache.set(uri, {
            version,
            text,
            // Stub result — will be replaced by real parse when needed
            result: {
                tree: null,
                tokenStream: null as any,
                parser: null as any,
                lexer: null as any,
                errors: [],
                timing: { lexMs: 0, parseMs: 0 },
            },
            needsParse: true,
        });
    }

    /**
     * Ensure the cached entry for a URI has been fully parsed.
     * Called lazily by symbol table accessors.
     */
    private ensureParsed(uri: string): void {
        const cached = this.cache.get(uri);
        if (!cached || !cached.needsParse) return;
        const result = parseDocument(cached.text);
        cached.result = result;
        cached.needsParse = false;
        cached.symbolTable = undefined; // invalidate stale symbol table
    }

    /**
     * Get the cached parse result for a URI, or undefined if not cached.
     * Triggers a lazy parse if the entry was created via cacheTextOnly.
     */
    get(uri: string): ParseResult | undefined {
        this.ensureParsed(uri);
        return this.cache.get(uri)?.result;
    }

    /**
     * Get the cached text for a URI.
     */
    getText(uri: string): string | undefined {
        return this.cache.get(uri)?.text;
    }

    /**
     * Get the cached document version for a URI.
     */
    getVersion(uri: string): number {
        return this.cache.get(uri)?.version ?? -1;
    }

    /**
     * Get the text with comments stripped (cached per version).
     * Avoids running the 2-pass regex on the same text multiple times.
     */
    getStrippedText(uri: string): string | undefined {
        const cached = this.cache.get(uri);
        if (!cached) return undefined;
        if (cached.strippedText === undefined) {
            cached.strippedText = stripComments(cached.text);
        }
        return cached.strippedText;
    }

    /**
     * Get the parse time in milliseconds for a URI.
     */
    getParseTimeMs(uri: string): number {
        const cached = this.cache.get(uri);
        if (!cached) return 0;
        const t = cached.result.timing;
        return t.lexMs + t.parseMs;
    }

    /**
     * Get detailed timing breakdown for a URI.
     */
    getTimingBreakdown(uri: string): { lexMs: number; parseMs: number } {
        const cached = this.cache.get(uri);
        if (!cached) return { lexMs: 0, parseMs: 0 };
        return { lexMs: cached.result.timing.lexMs, parseMs: cached.result.timing.parseMs };
    }

    /**
     * Get a cached symbol table for a URI, building it if necessary.
     * The symbol table is cached alongside the parse result and only
     * rebuilt when the document version changes.
     */
    getSymbolTable(uri: string): SymbolTable | undefined {
        this.ensureParsed(uri);
        const cached = this.cache.get(uri);
        if (!cached) return undefined;

        if (!cached.symbolTable) {
            const st = new SymbolTable();
            st.build(uri, cached.result);
            cached.symbolTable = st;
        }
        return cached.symbolTable;
    }

    /**
     * Get a workspace-wide symbol table covering all cached documents.
     *
     * Incrementally maintained — only re-builds URIs whose document
     * version has changed since the last call.  All 6+ providers that
     * previously built their own private tables should use this instead.
     */
    getWorkspaceSymbolTable(): SymbolTable {
        for (const [uri, cached] of this.cache) {
            // Ensure lazy-cached entries are parsed before building workspace table
            if (cached.needsParse) {
                this.ensureParsed(uri);
            }
            const builtVersion = this.wsBuiltVersions.get(uri);
            if (builtVersion === cached.version) continue;
            this.wsSymbolTable.build(uri, cached.result);
            this.wsBuiltVersions.set(uri, cached.version);
        }
        return this.wsSymbolTable;
    }

    /**
     * Cache semantic diagnostics for the current document version.
     */
    setSemanticDiagnostics(uri: string, diagnostics: Diagnostic[]): void {
        const cached = this.cache.get(uri);
        if (!cached) return;
        cached.semanticDiagnostics = {
            version: cached.version,
            diagnostics,
        };
    }

    /**
     * Return cached semantic diagnostics if they match the current document version.
     */
    getSemanticDiagnostics(uri: string): Diagnostic[] | undefined {
        const cached = this.cache.get(uri);
        if (!cached?.semanticDiagnostics) return undefined;
        if (cached.semanticDiagnostics.version !== cached.version) return undefined;
        return cached.semanticDiagnostics.diagnostics;
    }

    /**
     * Remove a document from the cache (called on document close).
     */
    remove(uri: string): void {
        this.cache.delete(uri);
        // Also evict from the workspace symbol table
        this.wsSymbolTable.removeUri(uri);
        this.wsBuiltVersions.delete(uri);
    }

    /**
     * Get all cached URIs.
     */
    getUris(): string[] {
        return Array.from(this.cache.keys());
    }
}

interface CachedDocument {
    version: number;
    text: string;
    result: ParseResult;
    /** Lazily built and cached symbol table — invalidated on re-parse. */
    symbolTable?: SymbolTable;
    /** Semantic diagnostics for a specific version, if computed. */
    semanticDiagnostics?: {
        version: number;
        diagnostics: Diagnostic[];
    };
    /** When true, this entry was created via cacheTextOnly and needs parsing before symbol table access. */
    needsParse?: boolean;
    /** Lazily computed comment-stripped text — invalidated on version change. */
    strippedText?: string;
}
