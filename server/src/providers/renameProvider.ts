import {
    ErrorCodes,
    Range,
    RenameParams,
    ResponseError,
    TextDocumentPositionParams,
    TextEdit,
    WorkspaceEdit,
} from 'vscode-languageserver/node';
import { DocumentManager } from '../documentManager.js';
import { NameReferences } from '../symbols/nameReferences.js';
import { quoteName, readNameAt } from '../utils/identUtils.js';

/** Rename complete source names, never substrings, comments, strings or usage declarations. */
export class RenameProvider {
    constructor(private readonly documentManager: DocumentManager) { }

    prepareRename(params: TextDocumentPositionParams): Range | null {
        const ref = new NameReferences(this.documentManager).at(params.textDocument.uri, params.position);
        return ref?.symbol ? ref.range : null;
    }

    provideRename(params: RenameParams): WorkspaceEdit | null {
        const references = new NameReferences(this.documentManager);
        const ref = references.at(params.textDocument.uri, params.position);
        if (!ref?.symbol) return null;
        const invalidControl = [...params.newName].some(ch => {
            const code = ch.charCodeAt(0);
            return (code < 32 && !'\t\n\r'.includes(ch)) || code === 127;
        });
        if (!params.newName || invalidControl) {
            throw new ResponseError(ErrorCodes.InvalidParams, 'A SysML name must be non-empty and contain printable characters or escaped whitespace.');
        }
        const parsed = params.newName.startsWith("'") ? readNameAt(params.newName, 0) : undefined;
        if (params.newName.startsWith("'") && parsed?.end !== params.newName.length) {
            throw new ResponseError(ErrorCodes.InvalidParams, 'The quoted SysML name is incomplete or contains an invalid escape sequence.');
        }
        const newText = quoteName(parsed?.name ?? params.newName);
        const changes: Record<string, TextEdit[]> = {};
        for (const occurrence of references.to(ref.symbol)) {
            if (occurrence.name !== ref.name) continue;
            (changes[occurrence.uri] ??= []).push({ range: occurrence.range, newText });
        }
        return Object.keys(changes).length > 0 ? { changes } : null;
    }
}
