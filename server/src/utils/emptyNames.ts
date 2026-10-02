import type { Token } from 'antlr4ng';
import { SysMLv2Lexer } from '../generated/SysMLv2Lexer.js';

/** Message for a name written as `''`: an unrestricted name is a non-empty sequence of characters (SysML v2 7.2.2). */
export const EMPTY_NAME_MESSAGE = "Empty name '': a name in single quotes must contain at least one character";

/** Whether `token` is a name written in single quotes with nothing between them (`''`). */
export function isEmptyName(token: Token): boolean {
    return token.type === SysMLv2Lexer.STRING && token.text === "''";
}
