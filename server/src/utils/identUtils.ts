import { BailErrorStrategy, BaseErrorListener, CharStream, CommonTokenStream, Token } from 'antlr4ng';
import { SysMLv2Lexer } from '../generated/SysMLv2Lexer.js';
import { SysMLv2Parser } from '../generated/SysMLv2Parser.js';
import { SYSML_KEYWORDS, SYSML_RESERVED_KEYWORDS } from './sysmlKeywords.js';

/**
 * Shared character-classification and identifier-scanning utilities.
 *
 * Consolidates functions that were previously duplicated across
 * definitionProvider, hoverProvider, signatureHelpProvider,
 * renameProvider, sysmlModelProvider, and libraryIndex.
 */

/** Whether `c` can start an identifier (A-Z, a-z, _). */
export function isIdentStart(c: number): boolean {
    return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95;
}

/**
 * Whether `c` can appear inside an identifier (A-Z, a-z, 0-9, _).
 *
 * This is the single canonical implementation — replaces the former
 * `isWordChar` helpers that had the same logic.
 */
export function isIdentPart(c: number): boolean {
    return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 95;
}

/** A source name and its UTF-16 offsets, including any quote delimiters. */
export interface NameSpan {
    readonly name: string;
    readonly start: number;
    readonly end: number;
}

/** A qualified name with independently addressable source segments. */
export interface QualifiedNameSpan extends NameSpan {
    readonly segments: readonly NameSpan[];
}

const ESCAPES: Readonly<Record<string, string>> = {
    b: '\b', t: '\t', n: '\n', f: '\f', r: '\r', "'": "'", '"': '"', '\\': '\\',
};

/** Decode an unrestricted name according to KerML 8.2.2.3, without Unicode normalization. */
export function unquoteName(text: string): string {
    if (!text.startsWith("'") || !text.endsWith("'")) return text;
    return text.slice(1, -1).replace(/\\([btnfr'"\\])/g, (_, ch: string) => ESCAPES[ch]);
}

const BASIC_NAME = /^[A-Za-z_][A-Za-z_0-9]*$/;

/**
 * `name` as an unrestricted name: in single quotes, with special characters escaped (KerML 8.2.2.3).
 * Departs from KerML Table 4, which has no escape for a carriage return and no way to write another
 * control character: a carriage return is written `\r`, which the lexer reads back, others as is.
 */
function toUnrestrictedName(name: string): string {
    const escaped = name.replace(/[\\'\b\t\n\f\r]/g, ch => {
        const entry = Object.entries(ESCAPES).find(([, value]) => value === ch)!;
        return `\\${entry[0]}`;
    });
    return `'${escaped}'`;
}

/** Render a semantic name as valid SysML source (basic names remain ASCII, per KerML). */
export function quoteName(name: string): string {
    if (BASIC_NAME.test(name) && !SYSML_KEYWORDS.has(name)) return name;
    return toUnrestrictedName(name);
}

/**
 * A name as KerML `escapedName()` writes it (KerML 8.3.2.1.2): as is if it has the form of a basic
 * name, ASCII and not a reserved keyword (SysML v2 7.2.2), otherwise as an unrestricted name. The
 * reserved keywords are the grammar's, see `SYSML_RESERVED_KEYWORDS` for how they depart from
 * SysML 8.2.2.1.2.
 */
export function escapedName(name: string): string {
    return BASIC_NAME.test(name) && !SYSML_RESERVED_KEYWORDS.has(name) ? name : toUnrestrictedName(name);
}

/**
 * A qualified name kept internally (`joinQualifiedName`) as KerML `qualifiedName` represents it
 * (KerML 8.3.2.1.2): its segment names joined by `::`, each as `escapedName` writes it.
 */
export function escapedQualifiedName(qualifiedName: string): string {
    return splitQualifiedName(qualifiedName).map(escapedName).join('::');
}

/** A qualified name read from the textual notation: whether it starts with `$::`, and its names. */
export interface ParsedQualifiedName {
    readonly global: boolean;
    readonly names: readonly string[];
}

/** Records that the lexer or parser met text outside the rule it was asked for. */
class FailureListener extends BaseErrorListener {
    failed = false;

    override syntaxError(): void {
        this.failed = true;
    }
}

/**
 * `text` read as a qualified name in the textual notation (KerML 8.2.3.5.1), by the grammar's own
 * lexer and `qualifiedName` rule: an optional global `$::` (KerML 7.2.5.1), then names separated
 * by `::`, each decoded as `unquoteName` does. Undefined unless the whole text is one qualified name.
 */
export function parseQualifiedName(text: string): ParsedQualifiedName | undefined {
    const listener = new FailureListener();
    const lexer = new SysMLv2Lexer(CharStream.fromString(text));
    lexer.removeErrorListeners();
    lexer.addErrorListener(listener);
    const tokens = new CommonTokenStream(lexer);
    const parser = new SysMLv2Parser(tokens);
    parser.removeErrorListeners();
    parser.addErrorListener(listener);
    parser.errorHandler = new BailErrorStrategy();
    try {
        const ctx = parser.qualifiedName();
        if (listener.failed || tokens.LA(1) !== Token.EOF) return undefined;
        return { global: ctx.DOLLAR() !== null, names: ctx.name().map(name => unquoteName(name.getText())) };
    } catch {
        return undefined;
    }
}

/** Split a semantic or source qualified name without splitting quoted `::` characters. */
export function splitQualifiedName(text: string): string[] {
    const parts: string[] = [];
    let start = 0;
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        if (quoted && text[i] === '\\') { i++; continue; }
        if (text[i] === "'" && (quoted || i === start)) quoted = !quoted;
        if (!quoted && text.startsWith('::', i)) {
            parts.push(unquoteName(text.slice(start, i).trim()));
            start = i + 2;
            i++;
        }
    }
    parts.push(unquoteName(text.slice(start).trim()));
    return parts;
}

/**
 * Keep internal names readable, quoting only segments that would be ambiguous when joined or split
 * again: one holding `::`, a quote, a backslash or a control character, starting or ending with
 * `:` or whitespace, spelled `$` (the global qualifier, KerML 7.2.5.1), or empty.
 */
export function joinQualifiedName(parts: readonly string[]): string {
    return parts.map(part => /::|^:|:$|['\\\r\n\t\b\f]|^\s|\s$|^\$?$/.test(part) ? quoteName(part) : part).join('::');
}

/**
 * A reference in the textual notation: a feature chain (KerML 7.3.4.6) of qualified names, each
 * optionally global (`$::`, KerML 7.2.5.1, 8.2.3.5.1), optionally conjugated (SysML 8.3.12.3), each name as KerML
 * `escapedName()` writes it (8.3.2.1.2), the global qualifier, `.` and `~` outside the quotes.
 */
export function joinReference(chain: readonly { global: boolean; names: readonly string[] }[], conjugated = false): string {
    return (conjugated ? '~' : '') + chain.map(({ global, names }) => (global ? '$::' : '')
        + names.map(escapedName).join('::')).join('.');
}

/** Read one basic or unrestricted source name at an exact UTF-16 offset. */
export function readNameAt(text: string, start: number, allowIncomplete = false): NameSpan | undefined {
    if (text[start] === "'") {
        let end = start + 1;
        while (end < text.length && text[end] !== "'") {
            if (text[end] === '\r' || text[end] === '\n') return undefined;
            if (text[end] === '\\') {
                if (!Object.hasOwn(ESCAPES, text[end + 1])) return undefined;
                end++;
            }
            end++;
        }
        if (end >= text.length) {
            return allowIncomplete
                ? { name: unquoteName(`${text.slice(start)}'`), start, end: text.length }
                : undefined;
        }
        if (end === start + 1 && !allowIncomplete) return undefined;
        return { name: unquoteName(text.slice(start, end + 1)), start, end: end + 1 };
    }
    if (!isIdentStart(text.charCodeAt(start))) return undefined;
    let end = start + 1;
    while (end < text.length && isIdentPart(text.charCodeAt(end))) end++;
    return { name: text.slice(start, end), start, end };
}

/** Read source qualified-name segments, allowing whitespace around `::`. */
export function readQualifiedNameAt(text: string, start: number, allowIncomplete = false): QualifiedNameSpan | undefined {
    const first = readNameAt(text, start, allowIncomplete);
    if (!first) return undefined;
    const segments = [first];
    let end = first.end;
    while (end < text.length) {
        let next = end;
        while (/\s/.test(text[next] ?? '') && next < text.length) next++;
        if (!text.startsWith('::', next)) break;
        next += 2;
        while (/\s/.test(text[next] ?? '') && next < text.length) next++;
        const segment = readNameAt(text, next, allowIncomplete);
        if (!segment) break;
        segments.push(segment);
        end = segment.end;
    }
    return { name: joinQualifiedName(segments.map(s => s.name)), start, end, segments };
}

/** Scan names, excluding comments and double-quoted string literals. */
export function* scanQualifiedNames(text: string, allowIncomplete = false): Generator<QualifiedNameSpan> {
    let i = 0;
    while (i < text.length) {
        if (text.startsWith('//', i)) {
            const end = text.indexOf('\n', i + 2);
            i = end < 0 ? text.length : end + 1;
        } else if (text.startsWith('/*', i)) {
            const end = text.indexOf('*/', i + 2);
            i = end < 0 ? text.length : end + 2;
        } else if (text[i] === '"') {
            i++;
            while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
            i++;
        } else if (/\d/.test(text[i]) || (text[i] === '.' && /\d/.test(text[i + 1] ?? ''))) {
            const number = text.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/)!;
            i += number[0].length;
        } else {
            const name = readQualifiedNameAt(text, i, allowIncomplete);
            if (name) {
                yield name;
                i = name.end;
            } else if (text[i] === "'") {
                i++;
                while (i < text.length && text[i] !== "'" && text[i] !== '\n') {
                    i += text[i] === '\\' ? 2 : 1;
                }
                if (text[i] === "'") i++;
            } else {
                i++;
            }
        }
    }
}

/** Scan feature paths without treating dots inside unrestricted names as separators. */
export function* scanFeaturePaths(text: string): Generator<NameSpan & {
    readonly parts: readonly string[];
    readonly qualifiedNames: readonly QualifiedNameSpan[];
}> {
    const names = [...scanQualifiedNames(text)];
    for (let i = 0; i < names.length; i++) {
        const first = names[i];
        const parts = [first.name];
        const qualifiedNames = [first];
        let end = first.end;
        while (i + 1 < names.length && /^\s*\.\s*$/.test(text.slice(end, names[i + 1].start))) {
            parts.push(names[++i].name);
            qualifiedNames.push(names[i]);
            end = names[i].end;
        }
        yield { name: parts.join('.'), start: first.start, end, qualifiedNames, parts: parts.map(part => {
            const segments = splitQualifiedName(part);
            return segments.length === 1 ? segments[0] : part;
        }) };
    }
}

/** Find the whole qualified name at a UTF-16 cursor position. */
export function extractQualifiedNameAt(text: string, character: number): string | undefined {
    for (const name of scanQualifiedNames(text)) {
        if (character >= name.start && character <= name.end) return name.name;
        if (name.start > character) break;
    }
    return undefined;
}

/**
 * Replace line and block comments with spaces while preserving line/offset
 * positions so index-based scans remain valid.
 */
export function stripComments(text: string): string {
    return text
        .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
        .replace(/\/\/[^\n]*/g, m => ' '.repeat(m.length));
}
