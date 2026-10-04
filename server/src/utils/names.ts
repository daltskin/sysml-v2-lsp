import { SYSML_KEYWORDS } from './sysmlKeywords.js';

const BASIC_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * A name as written in the textual notation (KerML 7.2.2.2): a basic name that
 * isn't a reserved keyword as is, any other in single quotes, with `\` and `'`
 * escaped (`Engine`, `'my car'`, `'part'`).
 */
export function escapeName(name: string): string {
    if (BASIC_NAME.test(name) && !SYSML_KEYWORDS.has(name)) return name;
    return `'${name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}
