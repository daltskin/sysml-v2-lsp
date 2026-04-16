/**
 * Canonical SysML v2 keyword list — derived from the ANTLR grammar.
 *
 * Extracts keyword strings from the generated lexer's `literalNames`
 * so there is a single source of truth (the .g4 grammar file) and
 * the list never drifts out of sync.
 */

import { SysMLv2Lexer } from '../generated/SysMLv2Lexer.js';

/** All keywords extracted from the generated lexer (alphabetically sorted). */
export const SYSML_KEYWORDS_ARRAY: readonly string[] = SysMLv2Lexer.literalNames
    .filter((n): n is string => n != null)
    .map(n => n.replace(/^'|'$/g, ''))
    .filter(n => /^[a-z]+$/.test(n))
    .sort();

/** Fast O(1) keyword lookup. */
export const SYSML_KEYWORDS: ReadonlySet<string> = new Set(SYSML_KEYWORDS_ARRAY);
