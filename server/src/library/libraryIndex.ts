import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Index of SysML v2 standard library packages and type declarations.
 *
 * Maps package names (e.g. "ISQ", "SI", "ScalarValues") to their
 * file URIs on disk.  Also indexes individual type declarations
 * (e.g. "Real", "Boolean", "String") with file URI and line number
 * so Go-to-Definition can navigate directly to library types.
 *
 * Built by scanning the bundled `sysml.library` directory (or a
 * user-specified custom path) for `.sysml` / `.kerml` files.
 */

import { isIdentPart as isWordChar } from '../utils/identUtils.js';

function skipSpaces(line: string, pos: number): number {
    while (pos < line.length && (line[pos] === ' ' || line[pos] === '\t')) pos++;
    return pos;
}

/** Read a word (\w+) at pos after skipping spaces. Returns [word, endPos] or undefined. */
function readWord(line: string, pos: number): [string, number] | undefined {
    pos = skipSpaces(line, pos);
    const start = pos;
    while (pos < line.length && isWordChar(line.charCodeAt(pos))) pos++;
    return pos > start ? [line.slice(start, pos), pos] : undefined;
}

/** Read a name that may be wrapped in single quotes ('Name') or angle brackets (<shortName>). */
function readName(line: string, pos: number): [string, number] | undefined {
    pos = skipSpaces(line, pos);
    if (pos < line.length && line[pos] === "'") {
        pos++;
        const start = pos;
        while (pos < line.length && isWordChar(line.charCodeAt(pos))) pos++;
        const name = line.slice(start, pos);
        if (pos < line.length && line[pos] === "'") pos++;
        return name ? [name, pos] : undefined;
    }
    // Handle <shortName> syntax — index the short name and skip past the
    // optional long name that follows (quoted or unquoted).
    // e.g. `<knot> 'knot (nautical mile per hour)'` or `<kg> kilogram`
    if (pos < line.length && line[pos] === '<') {
        pos++;
        const start = pos;
        while (pos < line.length && line[pos] !== '>') pos++;
        const shortName = line.slice(start, pos).trim();
        if (pos < line.length && line[pos] === '>') pos++;
        // Skip optional long name after the short name
        pos = skipSpaces(line, pos);
        if (pos < line.length && line[pos] === "'") {
            // Quoted long name — skip to closing quote
            pos++;
            while (pos < line.length && line[pos] !== "'") pos++;
            if (pos < line.length) pos++;
        } else if (pos < line.length && isWordChar(line.charCodeAt(pos))) {
            // Unquoted long name (e.g. `<kg> kilogram`)
            while (pos < line.length && isWordChar(line.charCodeAt(pos))) pos++;
        }
        return shortName ? [shortName, pos] : undefined;
    }
    return readWord(line, pos);
}

/**
 * Extract the long name from a `<shortName> longName` or `<shortName> 'longName'` pattern.
 * Returns the single-word long name (e.g. `foot` from `'foot'`, `kilogram` from `kilogram`)
 * or undefined if the long name is multi-word or absent.
 */
function readLongName(line: string, pos: number): string | undefined {
    pos = skipSpaces(line, pos);
    if (pos >= line.length || line[pos] !== '<') return undefined;
    // Skip past <shortName>
    while (pos < line.length && line[pos] !== '>') pos++;
    if (pos < line.length) pos++;
    pos = skipSpaces(line, pos);
    if (pos >= line.length) return undefined;
    if (line[pos] === "'") {
        // Quoted long name
        pos++;
        const start = pos;
        while (pos < line.length && line[pos] !== "'") pos++;
        const longName = line.slice(start, pos).trim();
        if (longName && /^[A-Za-z_]\w*$/.test(longName)) return longName;
        return undefined;
    }
    // Unquoted long name (e.g. `<kg> kilogram`)
    if (isWordChar(line.charCodeAt(pos))) {
        const start = pos;
        while (pos < line.length && isWordChar(line.charCodeAt(pos))) pos++;
        return line.slice(start, pos);
    }
    return undefined;
}

/** Check if the word at pos matches the given keyword (followed by non-word char or end). */
function matchWord(line: string, pos: number, keyword: string): boolean {
    if (!line.startsWith(keyword, pos)) return false;
    const after = pos + keyword.length;
    return after >= line.length || !isWordChar(line.charCodeAt(after));
}

// ---- Declaration keyword sets ----

/** Keywords that require a trailing `def` to form a type declaration. */
const DEF_KEYWORDS = new Set([
    'part', 'attribute', 'port', 'action', 'state', 'item', 'connection',
    'interface', 'requirement', 'constraint', 'allocation', 'usecase',
    'enum', 'calc', 'view', 'viewpoint', 'metadata', 'analysis', 'case',
    'concern', 'rendering', 'verification', 'flow', 'occurrence', 'ref',
]);

/** Keywords that are standalone type declarations (no `def` suffix). */
const STANDALONE_TYPE_KEYWORDS = new Set(['datatype', 'struct', 'metaclass', 'alias', 'classifier']);

/** Keywords that introduce a usage (attribute/part/etc. without `def`). */
const USAGE_KEYWORDS = new Set([
    'attribute', 'part', 'port', 'action', 'state', 'item', 'connection',
    'interface', 'requirement', 'constraint', 'allocation',
    'enum', 'calc', 'view', 'viewpoint', 'occurrence', 'ref', 'flow',
]);

// ---- Declaration extraction functions ----

/**
 * Extract the package name from a library file's header text.
 * Handles:
 *   standard library package ISQ {
 *   standard library package <USCU> USCustomaryUnits {
 *   package Foo {
 */
function extractPackageNameFromHead(head: string): string | undefined {
    const lines = head.split('\n');
    for (const line of lines) {
        let pos = skipSpaces(line, 0);

        // Skip optional "standard"
        if (matchWord(line, pos, 'standard')) {
            pos = skipSpaces(line, pos + 8);
        }

        // Skip optional "library"
        if (matchWord(line, pos, 'library')) {
            pos = skipSpaces(line, pos + 7);
        }

        // Must have "package"
        if (!matchWord(line, pos, 'package')) continue;
        pos = skipSpaces(line, pos + 7);

        // Skip optional <shortName>
        if (pos < line.length && line[pos] === '<') {
            const close = line.indexOf('>', pos);
            if (close < 0) continue;
            pos = skipSpaces(line, close + 1);
        }

        // Read the package name
        const w = readWord(line, pos);
        if (w) return w[0];
    }
    return undefined;
}

/**
 * Extract a type declaration name from a single line.
 * Matches patterns like:
 *   datatype Real specializes Complex;
 *   abstract part def Vehicle { ... }
 *   enum def Color { ... }
 *   alias Box for RectangularCuboid;
 *   abstract classifier Anything { ... }
 *   use case def MyCase { ... }
 */
function extractTypeNameFromLine(line: string): string | undefined {
    let w = readWord(line, 0);
    if (!w) return undefined;
    let [keyword, pos] = w;

    // Skip optional "abstract"
    if (keyword === 'abstract') {
        w = readWord(line, pos);
        if (!w) return undefined;
        [keyword, pos] = w;
    }

    // Check for standalone type keywords (datatype, struct, metaclass, alias, classifier)
    if (STANDALONE_TYPE_KEYWORDS.has(keyword)) {
        // keyword alone — fall through to read name
    } else if (keyword === 'use') {
        // Handle "use case def"
        w = readWord(line, pos);
        if (!w || w[0] !== 'case') return undefined;
        w = readWord(line, w[1]);
        if (!w || w[0] !== 'def') return undefined;
        pos = w[1];
    } else if (DEF_KEYWORDS.has(keyword)) {
        // Must be followed by "def"
        w = readWord(line, pos);
        if (!w || w[0] !== 'def') return undefined;
        pos = w[1];
    } else {
        return undefined;
    }

    // Skip optional "all"
    const nameOrAll = readName(line, pos);
    if (!nameOrAll) return undefined;
    if (nameOrAll[0] === 'all') {
        return readName(line, nameOrAll[1])?.[0];
    }
    return nameOrAll[0];
}

/**
 * Extract a usage declaration name from a single line.
 * Matches indented usage declarations like:
 *   attribute mass: MassValue
 *   abstract attribute speed: SpeedValue
 *   use case MyCase : ...
 * The line must start with exactly 4+ spaces of indentation.
 */
function extractUsageNameFromLine(line: string): string | undefined {
    // Must start with at least 4 spaces (indented inside a package)
    if (line.length < 5 || line[0] !== ' ' || line[1] !== ' ' ||
        line[2] !== ' ' || line[3] !== ' ') {
        return undefined;
    }

    let w = readWord(line, 4);
    if (!w) return undefined;
    let [keyword, pos] = w;

    // Skip optional "abstract"
    if (keyword === 'abstract') {
        w = readWord(line, pos);
        if (!w) return undefined;
        [keyword, pos] = w;
    }

    // Check for usage keyword (no "def")
    if (keyword === 'use') {
        w = readWord(line, pos);
        if (!w || w[0] !== 'case') return undefined;
        pos = w[1];
    } else if (!USAGE_KEYWORDS.has(keyword)) {
        return undefined;
    }

    // Read the usage name (possibly quoted)
    const name = readName(line, pos);
    if (!name) return undefined;

    // Verify followed by :, [, :>, ;, or {
    const afterPos = skipSpaces(line, name[1]);
    if (afterPos >= line.length) return undefined;
    const ch = line[afterPos];
    if (ch !== ':' && ch !== '[' && ch !== ';' && ch !== '{') return undefined;

    return name[0];
}

/**
 * Extract the long quoted name from a usage line that uses `<short> 'long'`.
 * Returns the single-word long name or undefined.
 */
function extractUsageLongNameFromLine(line: string): string | undefined {
    if (line.length < 5 || line[0] !== ' ' || line[1] !== ' ' ||
        line[2] !== ' ' || line[3] !== ' ') {
        return undefined;
    }

    let w = readWord(line, 4);
    if (!w) return undefined;
    let [keyword, pos] = w;

    if (keyword === 'abstract') {
        w = readWord(line, pos);
        if (!w) return undefined;
        [keyword, pos] = w;
    }

    if (keyword === 'use') {
        w = readWord(line, pos);
        if (!w || w[0] !== 'case') return undefined;
        pos = w[1];
    } else if (!USAGE_KEYWORDS.has(keyword)) {
        return undefined;
    }

    return readLongName(line, pos);
}

/**
 * Clean a single line from a doc-comment block, stripping comment
 * delimiters and leading asterisk decoration.
 */
function cleanCommentLine(line: string): string {
    let s = 0;
    let e = line.length;

    // Strip leading /***... and whitespace after it
    if (s < e && line[s] === '/') {
        s++;
        while (s < e && line[s] === '*') s++;
        while (s < e && (line[s] === ' ' || line[s] === '\t')) s++;
    } else if (s < e && line[s] === '*') {
        // Strip leading * and optional single space
        s++;
        if (s < e && line[s] === ' ') s++;
    }

    // Strip trailing ***/  and whitespace before it
    if (e > s && line[e - 1] === '/') {
        let te = e - 1;
        while (te > s && line[te - 1] === '*') te--;
        if (te < e - 1) {
            e = te;
            while (e > s && (line[e - 1] === ' ' || line[e - 1] === '\t')) e--;
        }
    }

    return line.slice(s, e).trim();
}

/** Library type location: file URI and 0-based line number. */
export interface LibraryTypeLocation {
    uri: string;
    line: number;
}

/** package name → file URI (e.g. "file:///.../.sysml") */
let index: Map<string, string> | undefined;

/** type name → { uri, line } for individual declarations */
let typeIndex: Map<string, LibraryTypeLocation> | undefined;

/**
 * Build the library index by scanning a directory tree for
 * `.sysml` / `.kerml` files.
 */
function buildIndex(libRoot: string): { packages: Map<string, string>; types: Map<string, LibraryTypeLocation> } {
    const packages = new Map<string, string>();
    const types = new Map<string, LibraryTypeLocation>();

    const walk = (dir: string): void => {
        let entries: string[];
        try { entries = readdirSync(dir); }
        catch { return; }

        for (const name of entries) {
            const full = join(dir, name);
            try {
                const stat = statSync(full);
                if (stat.isDirectory()) {
                    walk(full);
                } else if (name.endsWith('.sysml') || name.endsWith('.kerml')) {
                    const fileUri = pathToFileURL(full).href;

                    // Quick package extraction from first 512 bytes
                    const fd = openSync(full, 'r');
                    const buf = Buffer.alloc(512);
                    readSync(fd, buf, 0, 512, 0);
                    closeSync(fd);

                    const head = buf.toString('utf8');
                    const pkgName = extractPackageNameFromHead(head);
                    if (pkgName) {
                        packages.set(pkgName, fileUri);
                    }

                    // Full-file scan for type declarations with line numbers
                    const content = readFileSync(full, 'utf8');
                    const lines = content.split('\n');
                    for (let i = 0; i < lines.length; i++) {
                        const typeName = extractTypeNameFromLine(lines[i]);
                        if (typeName) {
                            // Don't overwrite — first match wins (avoids
                            // shadowing by reflective re-declarations)
                            if (!types.has(typeName)) {
                                types.set(typeName, { uri: fileUri, line: i });
                            }
                        }
                        // Also index usage declarations (e.g. attribute mass)
                        const usageName = extractUsageNameFromLine(lines[i]);
                        if (usageName) {
                            if (!types.has(usageName)) {
                                types.set(usageName, { uri: fileUri, line: i });
                            }
                            // Also index qualified form: Pkg::name
                            if (pkgName) {
                                const qualName = `${pkgName}::${usageName}`;
                                if (!types.has(qualName)) {
                                    types.set(qualName, { uri: fileUri, line: i });
                                }
                            }
                            // Also index the long quoted name if present
                            // (e.g. `<ft> 'foot'` → index both `ft` and `foot`)
                            const longName = extractUsageLongNameFromLine(lines[i]);
                            if (longName && longName !== usageName) {
                                if (!types.has(longName)) {
                                    types.set(longName, { uri: fileUri, line: i });
                                }
                                if (pkgName) {
                                    const qualLong = `${pkgName}::${longName}`;
                                    if (!types.has(qualLong)) {
                                        types.set(qualLong, { uri: fileUri, line: i });
                                    }
                                }
                            }
                        }
                    }
                }
            } catch { /* skip unreadable files */ }
        }
    };

    walk(libRoot);
    return { packages, types };
}

/**
 * Initialise the library index.
 *
 * @param serverDir  `__dirname` of the running server module
 *                   (typically `dist/server/` in the npm package).
 * @param customPath Optional user-configured library path override
 *                   (`sysml.library.path` setting).
 * @returns The number of packages indexed.
 */
export function initLibraryIndex(serverDir: string, customPath?: string): number {
    let libRoot: string | undefined;

    if (customPath && customPath.trim()) {
        const abs = resolve(customPath);
        if (existsSync(abs)) {
            libRoot = abs;
        }
    }

    if (!libRoot) {
        // Default: bundled library relative to the server module.
        // Server lives at <pkg>/dist/server/server.js →
        // library is at <pkg>/sysml.library/
        const bundled = resolve(serverDir, '..', '..', 'sysml.library');
        if (existsSync(bundled)) {
            libRoot = bundled;
        }
    }

    if (!libRoot) {
        index = new Map();
        typeIndex = new Map();
        return 0;
    }

    const result = buildIndex(libRoot);
    index = result.packages;
    typeIndex = result.types;
    return index.size;
}

/**
 * Look up a library package by name.
 * Handles qualified names like "ISQ::TorqueValue" — resolves just
 * the first segment (the package name).
 *
 * @returns The file URI of the library file, or `undefined`.
 */
export function resolveLibraryPackage(name: string): string | undefined {
    if (!index) return undefined;
    const pkg = name.split('::')[0];
    return index.get(pkg);
}

/**
 * Look up an individual type declaration in the standard library.
 *
 * Returns the file URI and 0-based line number so Go-to-Definition
 * can navigate directly to the declaration.
 *
 * Handles qualified names like "ISQ::mass" — tries the full
 * qualified name first, then falls back to the simple member name.
 *
 * @returns `{ uri, line }` or `undefined` if not found.
 */
export function resolveLibraryType(name: string): LibraryTypeLocation | undefined {
    if (!typeIndex) return undefined;

    // Try the exact name first (handles both simple and qualified forms)
    const exact = typeIndex.get(name);
    if (exact) return exact;

    // For qualified names, try just the member part
    if (name.includes('::')) {
        const member = name.split('::').pop()!;
        return typeIndex.get(member);
    }

    return undefined;
}

/**
 * Get all indexed package names (for diagnostics / completions).
 */
export function getLibraryPackageNames(): string[] {
    return index ? Array.from(index.keys()) : [];
}

/**
 * Get all indexed type names (for completions / hover).
 */
export function getLibraryTypeNames(): string[] {
    return typeIndex ? Array.from(typeIndex.keys()) : [];
}

/**
 * Library hover information extracted from a declaration and its
 * surrounding doc-comment / context.
 */
export interface LibraryHoverInfo {
    /** The declaration line (e.g. `attribute mass: MassValue[*] ...`) */
    declaration: string;
    /** The containing package name, if known */
    packageName?: string;
    /** ISO / doc comment extracted from `/* ... *\/` above the decl */
    documentation?: string;
}

// ---- Caches for library file content and hover info ----

/** Cache of library file contents keyed by file URI — library files never change at runtime. */
const fileContentCache = new Map<string, string[]>();

/** Maximum number of cached file contents (simple LRU by eviction). */
const FILE_CACHE_MAX = 50;

/** Cache of hover info results keyed by name. */
const hoverInfoCache = new Map<string, LibraryHoverInfo | null>();

/** Maximum number of cached hover info results. */
const HOVER_CACHE_MAX = 200;

/** Read and cache library file lines. Returns undefined on I/O error. */
function getCachedFileLines(uri: string): string[] | undefined {
    const cached = fileContentCache.get(uri);
    if (cached) return cached;

    let filePath: string;
    try {
        filePath = fileURLToPath(uri);
    } catch {
        return undefined;
    }

    let content: string;
    try {
        content = readFileSync(filePath, 'utf8');
    } catch {
        return undefined;
    }

    const lines = content.split('\n');

    // Evict oldest entry if cache is full
    if (fileContentCache.size >= FILE_CACHE_MAX) {
        const firstKey = fileContentCache.keys().next().value;
        if (firstKey !== undefined) fileContentCache.delete(firstKey);
    }
    fileContentCache.set(uri, lines);
    return lines;
}

/**
 * Extract hover information for a library element by reading the
 * declaration line and any preceding doc-comment from disk.
 * Results are cached — library files are immutable at runtime.
 *
 * @param name  Simple or qualified name (e.g. "mass", "ISQ::mass")
 * @returns Hover info or `undefined` if not in the library.
 */
export function getLibraryHoverInfo(name: string): LibraryHoverInfo | undefined {
    // Check hover result cache first
    if (hoverInfoCache.has(name)) {
        return hoverInfoCache.get(name) ?? undefined;
    }

    const loc = resolveLibraryType(name);
    if (!loc) {
        // Cache negative result too
        if (hoverInfoCache.size >= HOVER_CACHE_MAX) {
            const firstKey = hoverInfoCache.keys().next().value;
            if (firstKey !== undefined) hoverInfoCache.delete(firstKey);
        }
        hoverInfoCache.set(name, null);
        return undefined;
    }

    const lines = getCachedFileLines(loc.uri);
    if (!lines) return undefined;
    const declLine = (lines[loc.line] ?? '').trim();

    // Try to find the containing package name from the index
    let packageName: string | undefined;
    if (index) {
        for (const [pkg, uri] of index.entries()) {
            if (uri === loc.uri) {
                packageName = pkg;
                break;
            }
        }
    }

    // Extract preceding doc-comment (/* ... */)
    let documentation: string | undefined;
    const commentLines: string[] = [];
    for (let i = loc.line - 1; i >= 0 && i >= loc.line - 30; i--) {
        const l = (lines[i] ?? '').trim();
        if (l.endsWith('*/')) {
            // Start collecting comment (backwards)
            commentLines.unshift(l);
            for (let j = i - 1; j >= 0 && j >= i - 50; j--) {
                const cl = (lines[j] ?? '').trim();
                commentLines.unshift(cl);
                if (cl.startsWith('/*')) break;
            }
            break;
        }
        // Skip blank lines between comment and declaration
        if (l === '') continue;
        // Hit a non-blank, non-comment line — stop
        break;
    }

    if (commentLines.length > 0) {
        documentation = commentLines
            .map(l => cleanCommentLine(l))
            .filter(l => l.length > 0)
            .join('\n');
    }

    const result: LibraryHoverInfo = {
        declaration: declLine,
        packageName,
        documentation,
    };

    // Cache the result
    if (hoverInfoCache.size >= HOVER_CACHE_MAX) {
        const firstKey = hoverInfoCache.keys().next().value;
        if (firstKey !== undefined) hoverInfoCache.delete(firstKey);
    }
    hoverInfoCache.set(name, result);

    return result;
}
