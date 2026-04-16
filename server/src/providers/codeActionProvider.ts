import {
    CodeAction,
    CodeActionKind,
    CodeActionParams,
    Diagnostic,
    Position,
    TextEdit,
    WorkspaceEdit
} from 'vscode-languageserver/node.js';
import { DocumentManager } from '../documentManager.js';
import { SysMLElementKind, isDefinition } from '../symbols/sysmlElements.js';

/**
 * Provides code actions (quick fixes) for SysML documents.
 *
 * Supports:
 *  - Fix keyword typos (replaces misspelled keyword with suggested correction)
 *  - Naming convention: rename to PascalCase / camelCase
 *  - Missing documentation: insert a doc comment stub
 *  - Empty enumeration: add a placeholder enum value
 *  - Unused definition: prefix with underscore to suppress
 *  - Redefinition multiplicity mismatch: align multiplicity with base
 *  - Incompatible port connection: switch endpoint to a compatible local port
 *  - Unresolved constraint reference: suggest nearest member name
 */
export class CodeActionProvider {
    constructor(private readonly documentManager: DocumentManager) { }

    /**
     * Return code actions for the given range, typically in response to
     * a lightbulb appearing on a diagnostic.
     */
    provideCodeActions(params: CodeActionParams): CodeAction[] {
        const actions: CodeAction[] = [];
        const uri = params.textDocument.uri;

        for (const diagnostic of params.context.diagnostics) {
            // Keyword typo fix
            const typoFix = this.tryKeywordTypoFix(uri, diagnostic);
            if (typoFix) {
                actions.push(typoFix);
            }

            // Naming convention fix
            const namingFix = this.tryNamingConventionFix(uri, diagnostic);
            if (namingFix) {
                actions.push(namingFix);
            }

            // Missing documentation fix
            const docFix = this.tryMissingDocFix(uri, diagnostic);
            if (docFix) {
                actions.push(docFix);
            }

            // Empty enumeration fix
            const enumFix = this.tryEmptyEnumFix(uri, diagnostic);
            if (enumFix) {
                actions.push(enumFix);
            }

            // Unused definition fix
            const unusedFix = this.tryUnusedDefinitionFix(uri, diagnostic);
            if (unusedFix) {
                actions.push(unusedFix);
            }

            // Redefinition multiplicity fix
            const redefMultFix = this.tryRedefinitionMultiplicityFix(uri, diagnostic);
            if (redefMultFix) {
                actions.push(redefMultFix);
            }

            // Incompatible port type fix
            const portCompatFix = this.tryPortCompatibilityFix(uri, diagnostic);
            if (portCompatFix) {
                actions.push(portCompatFix);
            }

            // Constraint reference typo fix
            const constraintRefFix = this.tryConstraintReferenceFix(uri, diagnostic);
            if (constraintRefFix) {
                actions.push(constraintRefFix);
            }

            // Unresolved type quick fixes
            const unresolvedTypeFixes = this.tryUnresolvedTypeFixes(uri, diagnostic);
            if (unresolvedTypeFixes.length > 0) {
                actions.push(...unresolvedTypeFixes);
            }
        }

        return actions;
    }

    // ── Unresolved type fixes ──────────────────────────────────────

    /**
     * For unresolved type diagnostics, offer:
     *  1) Import package quick-fix if the type exists in another workspace package.
        *  2) Create a local type definition stub in current package.
     */
    private tryUnresolvedTypeFixes(
        uri: string,
        diagnostic: Diagnostic,
    ): CodeAction[] {
        if (diagnostic.code !== 'unresolved-type') return [];

        const text = this.documentManager.getText(uri);
        if (!text) return [];

        const data = diagnostic.data as { typeName?: string } | undefined;
        const unresolvedType = data?.typeName
            ?? extractQuotedString(diagnostic.message, "Type '");
        if (!unresolvedType) return [];

        const actions: CodeAction[] = [];
        const symbolTable = this.documentManager.getWorkspaceSymbolTable();
        const allSymbols = symbolTable.getAllSymbols();

        // Import suggestions for matching types defined in other files/packages.
        const packageNames = new Set<string>();
        for (const s of allSymbols) {
            if (!isDefinition(s.kind)) continue;
            if (s.name !== unresolvedType) continue;
            if (s.uri === uri) continue;

            const parentQn = s.parentQualifiedName || '';
            const qn = s.qualifiedName || '';
            const pkg = (parentQn.split('::')[0] || qn.split('::')[0] || '').trim();
            if (!pkg || pkg === unresolvedType) continue;
            if (pkg) packageNames.add(pkg);
        }

        for (const pkg of packageNames) {
            if (this.hasImportForPackage(text, pkg)) {
                continue;
            }

            const insertPos = this.findImportInsertPosition(text);
            const childIndent = this.getChildIndentForPackageLine(text, insertPos.line);
            const importText = `${childIndent}public import ${pkg}::*;\n`;

            const edit: WorkspaceEdit = {
                changes: {
                    [uri]: [
                        TextEdit.insert(insertPos, importText),
                    ],
                },
            };

            actions.push({
                title: `Import '${pkg}::*' to resolve '${unresolvedType}'`,
                kind: CodeActionKind.QuickFix,
                diagnostics: [diagnostic],
                isPreferred: actions.length === 0,
                edit,
            });
        }

        // Always offer a local stub as fallback when import is not desired.
        const stubPos = this.findPackageBodyInsertPosition(text);
        if (stubPos) {
            const childIndent = this.getChildIndentForPackageLine(text, stubPos.line);
            const localTypeStub = this.buildLocalTypeStub(text, diagnostic, unresolvedType, childIndent);

            const edit: WorkspaceEdit = {
                changes: {
                    [uri]: [
                        TextEdit.insert(stubPos, localTypeStub.stubText),
                    ],
                },
            };

            actions.push({
                title: localTypeStub.title,
                kind: CodeActionKind.QuickFix,
                diagnostics: [diagnostic],
                isPreferred: actions.length === 0,
                edit,
            });
        }

        return actions;
    }

    // ── Keyword typo ────────────────────────────────────────────────

    /**
     * If the diagnostic is a keyword typo ("Did you mean 'X'?"), offer
     * a quick fix that replaces the misspelled word with the suggestion.
     */
    private tryKeywordTypoFix(
        uri: string,
        diagnostic: Diagnostic,
    ): CodeAction | undefined {
        // Use structured data from diagnostic if available, fall back to message parsing
        const data = diagnostic.data as { typo?: string; suggestion?: string } | undefined;
        let typo: string | undefined;
        let suggestion: string | undefined;

        if (data?.typo && data?.suggestion) {
            typo = data.typo;
            suggestion = data.suggestion;
        } else {
            // Fallback: parse message "Unknown keyword 'X'. Did you mean 'Y'?"
            const msg = diagnostic.message;
            typo = extractQuotedString(msg, "Unknown keyword '");
            suggestion = extractQuotedString(msg, "Did you mean '");
        }

        if (!typo || !suggestion) return undefined;

        const edit: WorkspaceEdit = {
            changes: {
                [uri]: [
                    TextEdit.replace(diagnostic.range, suggestion),
                ],
            },
        };

        return {
            title: `Fix typo: '${typo}' → '${suggestion}'`,
            kind: CodeActionKind.QuickFix,
            diagnostics: [diagnostic],
            isPreferred: true,
            edit,
        };
    }

    // ── Naming convention ───────────────────────────────────────────

    /**
     * Offer to rename an identifier to PascalCase or camelCase.
     */
    private tryNamingConventionFix(
        uri: string,
        diagnostic: Diagnostic,
    ): CodeAction | undefined {
        if (diagnostic.code !== 'naming-convention') return undefined;

        const data = diagnostic.data as { name?: string; convention?: string } | undefined;
        let name: string | undefined;
        let isPascal: boolean;
        let isCamel: boolean;

        if (data?.name && data?.convention) {
            name = data.name;
            isPascal = data.convention === 'PascalCase';
            isCamel = data.convention === 'camelCase';
        } else {
            // Fallback: parse from message
            isPascal = diagnostic.message.includes('PascalCase');
            isCamel = diagnostic.message.includes('camelCase');
            // Extract name from "Definition 'X'" or "Usage 'X'"
            name = extractQuotedString(diagnostic.message, "Definition '")
                ?? extractQuotedString(diagnostic.message, "Usage '");
        }

        if (!isPascal && !isCamel) return undefined;
        if (!name) return undefined;

        let newName: string;
        if (isPascal) {
            // camelCase → PascalCase: capitalize first letter
            newName = name.charAt(0).toUpperCase() + name.slice(1);
        } else {
            // PascalCase → camelCase: lowercase first letter
            newName = name.charAt(0).toLowerCase() + name.slice(1);
        }

        const edit: WorkspaceEdit = {
            changes: {
                [uri]: [
                    TextEdit.replace(diagnostic.range, newName),
                ],
            },
        };

        return {
            title: `Rename to '${newName}'`,
            kind: CodeActionKind.QuickFix,
            diagnostics: [diagnostic],
            isPreferred: true,
            edit,
        };
    }

    // ── Missing documentation ───────────────────────────────────────

    /**
     * Insert a `doc` comment inside the definition body, right after
     * the opening brace.  Per the SysML v2 spec, `doc` is an owned
     * member of the definition — not a preceding annotation.
     */
    private tryMissingDocFix(
        uri: string,
        diagnostic: Diagnostic,
    ): CodeAction | undefined {
        if (diagnostic.code !== 'missing-doc') return undefined;

        // Extract the definition name from structured data or message
        const data = diagnostic.data as { name?: string } | undefined;
        const name = data?.name ?? extractQuotedString(diagnostic.message, "Definition '");
        if (!name) return undefined;

        const text = this.documentManager.getText(uri);
        if (!text) return undefined;

        // Find the opening brace of the definition body
        const lines = text.split('\n');
        const startLine = diagnostic.range.start.line;

        let bracePos: Position | undefined;
        for (let i = startLine; i < Math.min(startLine + 5, lines.length); i++) {
            const braceIdx = lines[i].indexOf('{');
            if (braceIdx >= 0) {
                bracePos = Position.create(i, braceIdx + 1);
                break;
            }
        }

        if (!bracePos) return undefined;

        // Indent one level deeper than the definition
        const defIndent = this.getLineIndent(text, startLine);
        const childIndent = defIndent + '    ';

        const docComment = `\n${childIndent}doc /* TODO: Describe ${name} */`;

        const edit: WorkspaceEdit = {
            changes: {
                [uri]: [
                    TextEdit.insert(bracePos, docComment),
                ],
            },
        };

        return {
            title: `Add documentation for '${name}'`,
            kind: CodeActionKind.QuickFix,
            diagnostics: [diagnostic],
            isPreferred: false,
            edit,
        };
    }

    // ── Empty enumeration ───────────────────────────────────────────

    /**
     * Add a placeholder `enum value` inside an empty enum definition.
     */
    private tryEmptyEnumFix(
        uri: string,
        diagnostic: Diagnostic,
    ): CodeAction | undefined {
        if (diagnostic.code !== 'empty-enum') return undefined;

        const text = this.documentManager.getText(uri);
        if (!text) return undefined;

        // Find the opening brace after the enum definition
        const lines = text.split('\n');
        const startLine = diagnostic.range.start.line;

        let bracePos: Position | undefined;
        for (let i = startLine; i < Math.min(startLine + 5, lines.length); i++) {
            const braceIdx = lines[i].indexOf('{');
            if (braceIdx >= 0) {
                bracePos = Position.create(i, braceIdx + 1);
                break;
            }
        }

        if (!bracePos) return undefined;

        // Determine indentation (one level deeper than the definition)
        const defIndent = this.getLineIndent(text, startLine);
        const childIndent = defIndent + '    ';

        const insertText = `\n${childIndent}enum value1;\n${childIndent}enum value2;`;

        const edit: WorkspaceEdit = {
            changes: {
                [uri]: [
                    TextEdit.insert(bracePos, insertText),
                ],
            },
        };

        return {
            title: 'Add placeholder enum values',
            kind: CodeActionKind.QuickFix,
            diagnostics: [diagnostic],
            isPreferred: false,
            edit,
        };
    }

    // ── Unused definition ───────────────────────────────────────────

    /**
     * Prefix the definition name with an underscore to mark as intentionally
     * unused (conventional suppression).
     */
    private tryUnusedDefinitionFix(
        uri: string,
        diagnostic: Diagnostic,
    ): CodeAction | undefined {
        if (diagnostic.code !== 'unused-definition') return undefined;

        const data = diagnostic.data as { name?: string } | undefined;
        const name = data?.name ?? extractQuotedString(diagnostic.message, "Definition '");
        if (!name) return undefined;

        // Already prefixed?
        if (name.startsWith('_')) return undefined;

        const newName = `_${name}`;

        const edit: WorkspaceEdit = {
            changes: {
                [uri]: [
                    TextEdit.replace(diagnostic.range, newName),
                ],
            },
        };

        return {
            title: `Prefix with underscore: '_${name}'`,
            kind: CodeActionKind.QuickFix,
            diagnostics: [diagnostic],
            isPreferred: false,
            edit,
        };
    }

    // ── Redefinition multiplicity ──────────────────────────────────

    /**
     * Align an incompatible redefinition multiplicity with the base multiplicity
     * when both are available in the diagnostic message.
     */
    private tryRedefinitionMultiplicityFix(
        uri: string,
        diagnostic: Diagnostic,
    ): CodeAction | undefined {
        if (diagnostic.code !== 'invalid-redefinition-multiplicity') return undefined;

        const msg = diagnostic.message;
        const baseMatch = msg.match(/base\s+'[^']+'\s+multiplicity\s+\[([^\]]+)\]/);
        if (!baseMatch) return undefined;
        const baseMultiplicity = baseMatch[1];

        const text = this.documentManager.getText(uri);
        if (!text) return undefined;

        const line = diagnostic.range.start.line;
        const lineText = text.split('\n')[line] ?? '';
        const multMatch = lineText.match(/\[[^\]]+\]/);
        if (!multMatch) return undefined;

        const startChar = multMatch.index ?? 0;
        const endChar = startChar + multMatch[0].length;
        const edit: WorkspaceEdit = {
            changes: {
                [uri]: [
                    TextEdit.replace(
                        {
                            start: Position.create(line, startChar),
                            end: Position.create(line, endChar),
                        },
                        `[${baseMultiplicity}]`,
                    ),
                ],
            },
        };

        return {
            title: `Align multiplicity with base: [${baseMultiplicity}]`,
            kind: CodeActionKind.QuickFix,
            diagnostics: [diagnostic],
            isPreferred: true,
            edit,
        };
    }

    // ── Port compatibility ──────────────────────────────────────────

    /**
     * Suggest replacing the right endpoint with a local compatible port
     * when a suitable candidate exists.
     */
    private tryPortCompatibilityFix(
        uri: string,
        diagnostic: Diagnostic,
    ): CodeAction | undefined {
        if (diagnostic.code !== 'incompatible-port-types') return undefined;

        const msg = diagnostic.message;
        const m = msg.match(/'([^']+)'\s+\(([^)]+)\)\s+is connected to\s+'([^']+)'\s+\(([^)]+)\)/);
        if (!m) return undefined;
        const left = m[1];
        const leftType = m[2];
        const right = m[3];

        const symbolTable = this.documentManager.getWorkspaceSymbolTable();
        const symbolsInUri = symbolTable.getSymbolsForUri(uri);
        const compatible = symbolsInUri.find((s) =>
            s.kind === SysMLElementKind.PortUsage
            && s.name !== left
            && s.name !== right
            && (s.typeNames[0] ?? s.typeName) === leftType,
        );
        if (!compatible) return undefined;

        const text = this.documentManager.getText(uri);
        if (!text) return undefined;
        const start = diagnostic.range.start;
        const end = diagnostic.range.end;
        const lines = text.split('\n');
        if (start.line !== end.line) return undefined;
        const segment = (lines[start.line] ?? '').slice(start.character, end.character);
        if (!segment) return undefined;

        const replaced = segment.replace(new RegExp(`\\b${right}\\b`), compatible.name);
        if (replaced === segment) return undefined;

        const edit: WorkspaceEdit = {
            changes: {
                [uri]: [
                    TextEdit.replace(diagnostic.range, replaced),
                ],
            },
        };

        return {
            title: `Replace '${right}' with compatible port '${compatible.name}'`,
            kind: CodeActionKind.QuickFix,
            diagnostics: [diagnostic],
            isPreferred: false,
            edit,
        };
    }

    // ── Constraint reference typo ───────────────────────────────────

    /**
     * Suggest nearest member-name replacement for unresolved `a.b` references.
     */
    private tryConstraintReferenceFix(
        uri: string,
        diagnostic: Diagnostic,
    ): CodeAction | undefined {
        if (diagnostic.code !== 'unresolved-constraint-reference') return undefined;

        const msg = diagnostic.message;
        const text = this.documentManager.getText(uri);
        if (!text) return undefined;

        const lines = text.split('\n');
        const sameLine = diagnostic.range.start.line === diagnostic.range.end.line;
        const lineText = sameLine ? (lines[diagnostic.range.start.line] ?? '') : '';
        const rangeExpr = sameLine
            ? lineText.slice(diagnostic.range.start.character, diagnostic.range.end.character)
            : '';
        const tokenExpr = sameLine
            ? extractDottedTokenAtRange(
                lineText,
                diagnostic.range.start.character,
                diagnostic.range.end.character,
            )
            : '';

        const m = msg.match(/Unresolved constraint reference\s+'([^']+)'(?:\s+in scope\s+'([^']+)')?/);
        const expr = (rangeExpr && rangeExpr.includes('.'))
            ? rangeExpr
            : (tokenExpr && tokenExpr.includes('.'))
                ? tokenExpr
                : (m?.[1] ?? '');
        const scopeName = m?.[2];
        if (!expr) return undefined;
        if (!expr.includes('.')) return undefined;

        const parts = expr.split('.');
        if (parts.length < 2) return undefined;
        const root = parts[0];
        const unresolvedLeaf = parts[parts.length - 1];

        const symbolTable = this.documentManager.getWorkspaceSymbolTable();
        const symbolsInUri = symbolTable.getSymbolsForUri(uri);
        const allSymbols = symbolTable.getAllSymbols();

        const scope = scopeName ? symbolsInUri.find((s) => s.name === scopeName) : undefined;
        const scopeMembers = scope
            ? allSymbols.filter((s) => s.parentQualifiedName === scope.qualifiedName)
            : [];
        const rootUsage = scopeMembers.find((s) => s.name === root)
            ?? symbolsInUri.find((s) => s.name === root && !!(s.typeNames[0] ?? s.typeName));

        const rootType = rootUsage ? (rootUsage.typeNames[0] ?? rootUsage.typeName) : undefined;
        let memberNames: string[] = [];
        if (rootType) {
            const typeDef = allSymbols.find((s) => s.name === rootType && s.kind.endsWith(' def'));
            if (typeDef) {
                memberNames = allSymbols
                    .filter((s) => s.parentQualifiedName === typeDef.qualifiedName)
                    .map((s) => s.name);
            }
        }
        if (memberNames.length === 0) {
            memberNames = symbolsInUri
                .map((s) => s.name)
                .filter((n) => n !== root);
        }
        if (memberNames.length === 0) {
            memberNames = allSymbols
                .filter((s) => s.uri === uri)
                .map((s) => s.name)
                .filter((n) => n !== root);
        }
        if (memberNames.length === 0) return undefined;

        const suggestion = memberNames
            .map((name) => ({ name, dist: levenshtein(unresolvedLeaf, name) }))
            .sort((a, b) => a.dist - b.dist)[0];
        let best = suggestion;

        if (!best || best.dist > 3 || best.name === unresolvedLeaf) {
            const textCandidates = extractLikelyMemberNames(text, root);
            const fallback = textCandidates
                .map((name) => ({ name, dist: levenshtein(unresolvedLeaf, name) }))
                .sort((a, b) => a.dist - b.dist)[0];
            if (fallback && fallback.name !== unresolvedLeaf) {
                best = fallback;
            }
        }

        if (!best || best.dist > 4 || best.name === unresolvedLeaf) return undefined;

        const fixedExpr = `${root}.${best.name}`;
        const edit: WorkspaceEdit = {
            changes: {
                [uri]: [
                    TextEdit.replace(diagnostic.range, fixedExpr),
                ],
            },
        };

        return {
            title: `Replace '${expr}' with '${fixedExpr}'`,
            kind: CodeActionKind.QuickFix,
            diagnostics: [diagnostic],
            isPreferred: true,
            edit,
        };
    }

    // ── Helpers ──────────────────────────────────────────────────────

    /**
     * Return the leading whitespace of a given line number.
     */
    private getLineIndent(text: string | undefined, line: number): string {
        if (!text) return '';
        const lines = text.split('\n');
        if (line < 0 || line >= lines.length) return '';
        const ln = lines[line];
        let end = 0;
        while (end < ln.length && (ln[end] === ' ' || ln[end] === '\t')) end++;
        return ln.substring(0, end);
    }

    private hasImportForPackage(text: string, pkg: string): boolean {
        const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`^\\s*(?:public\\s+)?import\\s+${escaped}::\\*\\s*;\\s*$`, 'm');
        return re.test(text);
    }

    private findImportInsertPosition(text: string): Position {
        const lines = text.split('\n');
        let packageLine = -1;
        let firstImport = -1;
        let lastImport = -1;

        for (let i = 0; i < lines.length; i++) {
            const ln = lines[i];
            if (packageLine < 0 && /^\s*(?:standard\s+library\s+)?package\b/.test(ln)) {
                packageLine = i;
            }
            if (/^\s*(?:public\s+)?import\b/.test(ln)) {
                if (firstImport < 0) firstImport = i;
                lastImport = i;
            }
        }

        if (lastImport >= 0) {
            return Position.create(lastImport + 1, 0);
        }
        if (packageLine >= 0) {
            return Position.create(packageLine + 1, 0);
        }
        return Position.create(0, 0);
    }

    private findPackageBodyInsertPosition(text: string): Position | undefined {
        const lines = text.split('\n');
        let lastClosingBraceLine = -1;
        for (let i = lines.length - 1; i >= 0; i--) {
            if (/^\s*}\s*;?\s*$/.test(lines[i])) {
                lastClosingBraceLine = i;
                break;
            }
        }
        if (lastClosingBraceLine < 0) return undefined;
        return Position.create(lastClosingBraceLine, 0);
    }

    private getChildIndentForPackageLine(text: string, line: number): string {
        const base = this.getLineIndent(text, Math.max(0, line));
        return `${base}    `;
    }

    private isAttributeTypeContext(text: string, diagnostic: Diagnostic, unresolvedType: string): boolean {
        const lines = text.split('\n');
        const line = lines[diagnostic.range.start.line] ?? '';
        const beforeRange = line.slice(0, diagnostic.range.start.character);
        const unresolvedInLine = line.slice(diagnostic.range.start.character, diagnostic.range.end.character);

        // If the line is an attribute declaration whose type token matches
        // the unresolved type, treat it as attribute typing context even when
        // the diagnostic range points to the attribute name token.
        const escapedType = unresolvedType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (/^\s*attribute\s+[A-Za-z_][A-Za-z0-9_]*\s*:/.test(line)
            && new RegExp(`:\\s*${escapedType}\\b`).test(line)) {
            return true;
        }

        // Standard case: caret/range is on the type token in
        // `attribute name : TypeName;`
        if (/\battribute\s+[A-Za-z_][A-Za-z0-9_]*\s*:\s*$/.test(beforeRange)) {
            return true;
        }

        // Fallback: tolerate ranges that are shifted but still on the same line.
        // This catches lines like `attribute name : TypeName;` even when
        // the range boundaries are slightly off.
        return /\battribute\s+[A-Za-z_][A-Za-z0-9_]*\s*:\s*[A-Za-z_][A-Za-z0-9_]*\b/.test(beforeRange + unresolvedInLine);
    }

    private buildLocalTypeStub(
        text: string,
        diagnostic: Diagnostic,
        unresolvedType: string,
        childIndent: string,
    ): { title: string; stubText: string } {
        if (this.isAttributeTypeContext(text, diagnostic, unresolvedType)) {
            return {
                title: `Create local 'attribute def ${unresolvedType};'`,
                stubText: `\n${childIndent}attribute def ${unresolvedType};\n`,
            };
        }

        return {
            title: `Create local 'item def ${unresolvedType};'`,
            stubText: `\n${childIndent}item def ${unresolvedType};\n`,
        };
    }
}

function levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const prev = new Array(b.length + 1);
    const curr = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;

    for (let i = 1; i <= a.length; i++) {
        curr[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(
                prev[j] + 1,
                curr[j - 1] + 1,
                prev[j - 1] + cost,
            );
        }
        for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
    }
    return prev[b.length];
}

/**
 * Extract a quoted string from text given a prefix that ends just before the
 * opening quote.  For example:
 *   extractQuotedString("Definition 'Foo' has ...", "Definition '") → "Foo"
 *   extractQuotedString("Unknown keyword 'paart'.", "Unknown keyword '") → "paart"
 */
function extractQuotedString(text: string, prefixWithQuote: string): string | undefined {
    const idx = text.indexOf(prefixWithQuote);
    if (idx < 0) return undefined;
    const start = idx + prefixWithQuote.length;
    const end = text.indexOf("'", start);
    if (end < 0) return undefined;
    return text.substring(start, end);
}

function extractDottedTokenAtRange(line: string, start: number, end: number): string {
    if (!line || start < 0 || end < 0 || start > line.length || end > line.length) return '';

    const isTokenChar = (ch: string): boolean =>
        (ch >= 'a' && ch <= 'z')
        || (ch >= 'A' && ch <= 'Z')
        || (ch >= '0' && ch <= '9')
        || ch === '_'
        || ch === '.';

    let left = Math.max(0, start);
    while (left > 0 && isTokenChar(line[left - 1])) left--;

    let right = Math.min(line.length, end);
    while (right < line.length && isTokenChar(line[right])) right++;

    const token = line.slice(left, right).trim();
    return token.includes('.') ? token : '';
}

function extractLikelyMemberNames(text: string, excludeName: string): string[] {
    const names = new Set<string>();
    const addMatches = (re: RegExp): void => {
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
            const n = m[1];
            if (n && n !== excludeName) {
                names.add(n);
            }
        }
    };

    addMatches(/\battribute\s+([A-Za-z_][A-Za-z0-9_]*)\b/g);
    addMatches(/\bpart\s+([A-Za-z_][A-Za-z0-9_]*)\b/g);
    addMatches(/\bport\s+([A-Za-z_][A-Za-z0-9_]*)\b/g);
    addMatches(/\bitem\s+([A-Za-z_][A-Za-z0-9_]*)\b/g);
    addMatches(/\bsubject\s+([A-Za-z_][A-Za-z0-9_]*)\b/g);

    return [...names];
}
