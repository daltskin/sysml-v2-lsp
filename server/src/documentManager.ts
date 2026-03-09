import { TextDocument } from 'vscode-languageserver-textdocument';
import { Diagnostic } from 'vscode-languageserver/node.js';
import { parseDocument, ParseResult } from './parser/parseDocument.js';
import { SymbolTable } from './symbols/symbolTable.js';

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

        if (cached && cached.version === version) {
            return cached.result;
        }

        const text = document.getText();
        const result = parseDocument(text);

        this.cache.set(uri, {
            version,
            text,
            result,
        });

        return result;
    }

    /**
     * Get the cached parse result for a URI, or undefined if not cached.
     */
    get(uri: string): ParseResult | undefined {
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
}
