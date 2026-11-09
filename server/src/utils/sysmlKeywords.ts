/**
 * Canonical SysML v2 keyword list — derived from the ANTLR grammar.
 *
 * Extracts keyword strings from the generated lexer's `literalNames`
 * so there is a single source of truth (the .g4 grammar file) and
 * the list never drifts out of sync.
 */

import { SysMLv2Lexer } from '../generated/SysMLv2Lexer.js';
import { SysMLv2Parser } from '../generated/SysMLv2Parser.js';

/** All keywords extracted from the generated lexer (alphabetically sorted). */
export const SYSML_KEYWORDS_ARRAY: readonly string[] = SysMLv2Lexer.literalNames
    .filter((n): n is string => n != null)
    .map(n => n.replace(/^'|'$/g, ''))
    .filter(n => /^[a-z]+$/.test(n))
    .sort();

/** Fast O(1) keyword lookup. */
export const SYSML_KEYWORDS: ReadonlySet<string> = new Set(SYSML_KEYWORDS_ARRAY);

/** The tokens the grammar's `name` rule accepts: basic and unrestricted names, and its unreserved keywords. */
const NAME_TOKENS = SysMLv2Parser._ATN.nextTokens(SysMLv2Parser._ATN.ruleToStartState[SysMLv2Parser.RULE_name]!);

/**
 * The reserved keywords (SysML v2 7.2.2, 8.2.2.1.2), which can't be basic names: as the grammar
 * defines them, every lexer keyword its `name` rule doesn't accept as a name. This departs from
 * SysML 8.2.2.1.2 where the grammar does: it accepts some reserved keywords as names, and rejects
 * KerML keywords that SysML doesn't reserve.
 */
export const SYSML_RESERVED_KEYWORDS: ReadonlySet<string> = new Set(SYSML_KEYWORDS_ARRAY.filter(
    keyword => !NAME_TOKENS.contains(SysMLv2Lexer.literalNames.indexOf(`'${keyword}'`)),
));
