import { SysMLSymbol } from './sysmlElements.js';

/**
 * A lexical scope in the SysML model.
 * Scopes form a tree: global → package → definition → nested usage.
 */
export class Scope {
    /** Symbols declared directly in this scope (name → symbol) */
    private symbols = new Map<string, SysMLSymbol>();

    constructor(
        /** Unique identifier for this scope (usually the qualified name) */
        public readonly id: string,
        /** Parent scope, or null for the global scope */
        public readonly parent: Scope | null = null,
    ) { }

    /**
     * Define a new symbol in this scope.
     */
    define(symbol: SysMLSymbol): void {
        this.symbols.set(symbol.name, symbol);
    }

    /**
     * Look up a symbol by name in this scope only (no parent chain).
     */
    lookupLocal(name: string): SysMLSymbol | undefined {
        return this.symbols.get(name);
    }

    /**
     * Look up a symbol by name, walking up the parent scope chain.
     */
    resolve(name: string): SysMLSymbol | undefined {
        const local = this.symbols.get(name);
        if (local) {
            return local;
        }
        return this.parent?.resolve(name);
    }

    /**
     * Look up a qualified name (e.g., "Pkg::SubPkg::Type").
     */
    resolveQualified(qualifiedName: string): SysMLSymbol | undefined {
        const parts = qualifiedName.split('::');
        if (parts.length === 1) {
            return this.resolve(parts[0]);
        }

        // Walk down from the first part
        const current: SysMLSymbol | undefined = this.resolve(parts[0]);
        // For now, simple resolution — just look up the last part globally
        // TODO: proper nested scope resolution
        if (!current) {
            return undefined;
        }

        return current;
    }

    /**
     * Get all symbols in this scope (not including parent scopes).
     */
    getLocalSymbols(): SysMLSymbol[] {
        return Array.from(this.symbols.values());
    }

    /**
     * Get all symbols reachable from this scope (including parent chain).
     */
    getAllVisibleSymbols(): SysMLSymbol[] {
        const result = new Map<string, SysMLSymbol>();

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let scope: Scope | null = this;
        while (scope) {
            for (const [name, symbol] of scope.symbols) {
                if (!result.has(name)) {
                    result.set(name, symbol);
                }
            }
            scope = scope.parent;
        }

        return Array.from(result.values());
    }
}
