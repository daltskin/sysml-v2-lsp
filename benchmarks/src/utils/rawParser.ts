import { BailErrorStrategy, CharStream, CommonTokenStream, DefaultErrorStrategy, PredictionMode } from 'antlr4ng';
import { SysMLv2Lexer } from '../../../server/src/generated/SysMLv2Lexer.js';
import { SysMLv2Parser } from '../../../server/src/generated/SysMLv2Parser.js';

export interface RawParseResult {
    tokens: number;
    lines: number;
    mode: 'SLL' | 'SLL+LL';
    errors: number;
}

export function resetDFA(): void {
    const dfas = (SysMLv2Parser as unknown as Record<string, unknown[]>).decisionsToDFA as Array<{s0?: undefined; states?: {clear?: () => void}}>;
    for (const dfa of dfas) {
        if (!dfa) continue;
        dfa.s0 = undefined;
        if (dfa.states && typeof dfa.states.clear === 'function') dfa.states.clear();
    }
}

export function parseRaw(text: string): RawParseResult {
    const input = CharStream.fromString(text);
    const lexer = new SysMLv2Lexer(input);
    const tokenStream = new CommonTokenStream(lexer);
    tokenStream.fill();

    const parser = new SysMLv2Parser(tokenStream);
    parser.removeErrorListeners();
    parser.interpreter.predictionMode = PredictionMode.SLL;
    parser.errorHandler = new BailErrorStrategy();

    let mode: RawParseResult['mode'] = 'SLL';
    let errors = 0;
    try {
        parser.rootNamespace();
    } catch {
        mode = 'SLL+LL';
        tokenStream.seek(0);
        parser.reset();
        parser.interpreter.predictionMode = PredictionMode.LL;
        parser.errorHandler = new DefaultErrorStrategy();
        parser.removeErrorListeners();
        parser.addErrorListener({
            syntaxError: () => { errors++; },
            reportAmbiguity: () => { },
            reportAttemptingFullContext: () => { },
            reportContextSensitivity: () => { },
        });
        parser.rootNamespace();
    }

    return {
        tokens: tokenStream.getTokens().length,
        lines: text.split('\n').length,
        mode,
        errors,
    };
}