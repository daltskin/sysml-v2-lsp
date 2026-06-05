/**
 * Browser shim for `node:path` (POSIX-style).
 *
 * A minimal implementation covering the operations the server uses
 * (`join`, `resolve`, `dirname`, `basename`, `extname`).  Paths are
 * treated as forward-slash POSIX paths, which is sufficient for the
 * URI-derived paths the browser build deals with.
 */

export const sep = '/';

function normalizeArray(parts: string[], allowAboveRoot: boolean): string[] {
    const res: string[] = [];
    for (const p of parts) {
        if (!p || p === '.') continue;
        if (p === '..') {
            if (res.length && res[res.length - 1] !== '..') {
                res.pop();
            } else if (allowAboveRoot) {
                res.push('..');
            }
        } else {
            res.push(p);
        }
    }
    return res;
}

export function join(...parts: string[]): string {
    const joined = parts.filter(Boolean).join('/');
    const isAbsolute = joined.startsWith('/');
    const normalized = normalizeArray(joined.split('/'), !isAbsolute).join('/');
    return (isAbsolute ? '/' : '') + (normalized || (isAbsolute ? '' : '.'));
}

export function resolve(...parts: string[]): string {
    let resolved = '';
    let isAbsolute = false;
    for (let i = parts.length - 1; i >= 0 && !isAbsolute; i--) {
        const p = parts[i];
        if (!p) continue;
        resolved = resolved ? `${p}/${resolved}` : p;
        isAbsolute = p.startsWith('/');
    }
    const normalized = normalizeArray(resolved.split('/'), !isAbsolute).join('/');
    if (isAbsolute) return '/' + normalized;
    return normalized || '.';
}

export function dirname(p: string): string {
    const idx = p.replace(/\/+$/, '').lastIndexOf('/');
    if (idx < 0) return '.';
    if (idx === 0) return '/';
    return p.slice(0, idx);
}

export function basename(p: string, ext?: string): string {
    let base = p.slice(p.replace(/\/+$/, '').lastIndexOf('/') + 1).replace(/\/+$/, '');
    if (ext && base.endsWith(ext)) base = base.slice(0, -ext.length);
    return base;
}

export function extname(p: string): string {
    const base = basename(p);
    const idx = base.lastIndexOf('.');
    return idx > 0 ? base.slice(idx) : '';
}

export default { sep, join, resolve, dirname, basename, extname };
