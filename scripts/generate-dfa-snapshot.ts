#!/usr/bin/env npx tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * DFA Snapshot Generator
 *
 * Parses representative SysML files to populate the ANTLR4 parser's DFA
 * tables, then serializes the DFA state graph to a TypeScript module.
 *
 * The generated snapshot is loaded at server startup to pre-populate the
 * DFA, eliminating the ~17 s cold-start penalty on first parse.
 *
 * Usage:
 *   npx tsx scripts/generate-dfa-snapshot.ts
 *
 * Output:
 *   server/src/parser/dfaSnapshot.ts
 */

import { BailErrorStrategy, CharStream, CommonTokenStream, DefaultErrorStrategy, PredictionMode } from 'antlr4ng';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SysMLv2Lexer } from '../server/src/generated/SysMLv2Lexer.js';
import { SysMLv2Parser } from '../server/src/generated/SysMLv2Parser.js';

// ---------------------------------------------------------------------------
// Types for the serialized snapshot
// ---------------------------------------------------------------------------

interface StateSnapshot {
    /** isAcceptState */
    a?: 1;
    /** prediction (omitted when -1 / not accept) */
    p?: number;
    /** requiresFullContext */
    r?: 1;
    /** edges as flat [tokenIndex, targetStateIndex, ...] pairs */
    e: number[];
}

interface DecisionSnapshot {
    /** Decision number */
    d: number;
    /** Index of s0 in the states array */
    s0: number;
    /** Is this a precedence DFA? */
    prec?: 1;
    /** Precedence edges: flat [precedence, stateIndex, ...] — only for precedence DFAs */
    precEdges?: number[];
    /** All states for this decision's DFA */
    s: StateSnapshot[];
}

// ---------------------------------------------------------------------------
// Parse representative files to populate the DFA
// ---------------------------------------------------------------------------

function parseFile(filePath: string): void {
    const text = fs.readFileSync(filePath, 'utf-8');
    const input = CharStream.fromString(text);
    const lexer = new SysMLv2Lexer(input);
    const tokens = new CommonTokenStream(lexer);
    tokens.fill();

    const parser = new SysMLv2Parser(tokens);
    parser.removeErrorListeners();

    // SLL first (populates DFA)
    parser.interpreter.predictionMode = PredictionMode.SLL;
    parser.errorHandler = new BailErrorStrategy();
    try {
        parser.rootNamespace();
    } catch {
        // SLL failed — try LL for more DFA coverage
        tokens.seek(0);
        parser.reset();
        parser.interpreter.predictionMode = PredictionMode.LL;
        parser.errorHandler = new DefaultErrorStrategy();
        parser.removeErrorListeners();
        try {
            parser.rootNamespace();
        } catch {
            // best effort
        }
    }
}

// ---------------------------------------------------------------------------
// Extract DFA state graph
// ---------------------------------------------------------------------------

function extractSnapshot(): DecisionSnapshot[] {
    // Access the shared static decisionsToDFA array
    const dfas = (SysMLv2Parser as any).decisionsToDFA as any[];
    const snapshots: DecisionSnapshot[] = [];

    for (let d = 0; d < dfas.length; d++) {
        const dfa = dfas[d];
        if (!dfa.s0) continue;

        const isPrecedence = dfa.isPrecedenceDfa === true;

        // Collect all reachable DFA states via BFS
        const visited = new Map<any, number>(); // DFAState → index
        const queue: any[] = [];
        const stateList: any[] = [];

        function enqueue(state: any): number {
            if (!state) return -1;
            let idx = visited.get(state);
            if (idx !== undefined) return idx;
            idx = stateList.length;
            visited.set(state, idx);
            stateList.push(state);
            queue.push(state);
            return idx;
        }

        // For precedence DFAs, s0 is a special state whose edges are
        // indexed by precedence value (not token type).
        // We record s0 separately and then BFS from each precedence start state.
        const s0Idx = enqueue(dfa.s0);

        if (isPrecedence && dfa.s0.edges) {
            // Enqueue all precedence start states
            for (let p = 0; p < dfa.s0.edges.length; p++) {
                if (dfa.s0.edges[p]) {
                    enqueue(dfa.s0.edges[p]);
                }
            }
        }

        // BFS to find all reachable states
        while (queue.length > 0) {
            const state = queue.shift()!;
            if (!state.edges) continue;
            for (let t = 0; t < state.edges.length; t++) {
                const target = state.edges[t];
                if (target && target.stateNumber !== 2147483647) {
                    enqueue(target);
                }
            }
        }

        // Skip decisions with very few states (not worth snapshotting)
        if (stateList.length < 2) continue;

        // Skip decisions where any state has predicates — we can't
        // serialize SemanticContext objects, and the parser needs them
        // to make correct predictions at those states.
        let hasPredicates = false;
        for (const state of stateList) {
            if (state.predicates) {
                hasPredicates = true;
                break;
            }
        }
        if (hasPredicates) continue;

        // Serialize states
        const states: StateSnapshot[] = [];
        for (const state of stateList) {
            const snap: StateSnapshot = { e: [] };
            if (state.isAcceptState) {
                snap.a = 1;
                if (state.prediction !== -1) {
                    snap.p = state.prediction;
                }
            }
            if (state.requiresFullContext) {
                snap.r = 1;
            }

            // Serialize edges as flat [tokenIndex, targetStateIndex] pairs
            // Use -1 as sentinel for ERROR edges (ATNSimulator.ERROR)
            if (state.edges) {
                for (let t = 0; t < state.edges.length; t++) {
                    const target = state.edges[t];
                    if (target) {
                        if (target.stateNumber === 2147483647) {
                            // ERROR edge — record with sentinel -1
                            snap.e.push(t, -1);
                        } else {
                            const targetIdx = visited.get(target);
                            if (targetIdx !== undefined) {
                                snap.e.push(t, targetIdx);
                            }
                        }
                    }
                }
            }

            states.push(snap);
        }

        const decSnap: DecisionSnapshot = {
            d,
            s0: s0Idx,
            s: states,
        };

        if (isPrecedence) {
            decSnap.prec = 1;
            // Record precedence edges from s0
            const precEdges: number[] = [];
            if (dfa.s0.edges) {
                for (let p = 0; p < dfa.s0.edges.length; p++) {
                    const target = dfa.s0.edges[p];
                    if (target) {
                        const idx = visited.get(target);
                        if (idx !== undefined) {
                            precEdges.push(p, idx);
                        }
                    }
                }
            }
            if (precEdges.length > 0) {
                decSnap.precEdges = precEdges;
            }
        }

        snapshots.push(decSnap);
    }

    return snapshots;
}

// ---------------------------------------------------------------------------
// Write the snapshot module
// ---------------------------------------------------------------------------

function writeSnapshot(snapshots: DecisionSnapshot[], outPath: string): void {
    const json = JSON.stringify(snapshots);

    const content = `// AUTO-GENERATED by scripts/generate-dfa-snapshot.ts — DO NOT EDIT
// Generated: ${new Date().toISOString()}
//
// This module contains a pre-built DFA snapshot that eliminates the ANTLR4
// cold-start penalty (~17 s) on first parse.  The DFA state graph is loaded
// at server startup and pre-populates the parser's static DFA tables.

/**
 * Per-state snapshot.
 * - a: isAcceptState (1 if true, absent if false)
 * - p: prediction alt (absent if -1 or not accept)
 * - r: requiresFullContext (1 if true, absent if false)
 * - e: edges as flat [tokenIndex, targetStateIndex, ...] pairs
 */
export interface StateSnapshot {
    a?: 1;
    p?: number;
    r?: 1;
    e: number[];
}

/**
 * Per-decision DFA snapshot.
 * - d: decision number
 * - s0: index of the start state in the states array
 * - prec: 1 if this is a precedence DFA
 * - precEdges: flat [precedence, stateIndex, ...] for precedence s0
 * - s: array of state snapshots
 */
export interface DecisionSnapshot {
    d: number;
    s0: number;
    prec?: 1;
    precEdges?: number[];
    s: StateSnapshot[];
}

export const DFA_SNAPSHOT: DecisionSnapshot[] = ${json};
`;

    fs.writeFileSync(outPath, content, 'utf-8');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const rootDir = path.resolve(import.meta.dirname || __dirname, '..');
const exampleFiles = [
    path.join(rootDir, 'benchmarks/fixtures/synthetic-100.sysml'),
    path.join(rootDir, 'benchmarks/fixtures/synthetic-500.sysml'),
    path.join(rootDir, 'benchmarks/fixtures/synthetic-1000.sysml'),
    path.join(rootDir, 'examples/smart-home.sysml'),
    path.join(rootDir, 'examples/smart-home-complex.sysml'),
    path.join(rootDir, 'examples/smart-home-complex2.sysml'),
    path.join(rootDir, 'examples/multiplicity.sysml'),
    path.join(rootDir, 'examples/vehicle-model.sysml'),
    path.join(rootDir, 'examples/bike.sysml'),
    path.join(rootDir, 'examples/camera.sysml'),
    path.join(rootDir, 'examples/toaster-system.sysml'),
    path.join(rootDir, 'examples/dfa-coverage-advanced.sysml'),
];

console.log('Generating DFA snapshot...');
console.log();

const t0 = Date.now();

for (const filePath of exampleFiles) {
    if (!fs.existsSync(filePath)) {
        console.log(`  SKIP (not found): ${path.relative(rootDir, filePath)}`);
        continue;
    }
    const fileT0 = Date.now();
    parseFile(filePath);
    const fileMs = Date.now() - fileT0;
    console.log(`  Parsed ${path.relative(rootDir, filePath)} (${fileMs} ms)`);
}

// Also parse the warmup text for additional DFA coverage
try {
    const warmupPath = path.join(rootDir, 'server/src/parser/warmupText.ts');
    if (fs.existsSync(warmupPath)) {
        const warmupModule = fs.readFileSync(warmupPath, 'utf-8');
        // Extract the template literal content
        const match = warmupModule.match(/export const WARMUP_TEXT\s*=\s*`([\s\S]*?)`;/);
        if (match) {
            const warmupText = match[1];
            const warmupT0 = Date.now();
            const input = CharStream.fromString(warmupText);
            const lexer = new SysMLv2Lexer(input);
            const tokens = new CommonTokenStream(lexer);
            tokens.fill();
            const parser = new SysMLv2Parser(tokens);
            parser.removeErrorListeners();
            parser.interpreter.predictionMode = PredictionMode.SLL;
            parser.errorHandler = new BailErrorStrategy();
            try {
                parser.rootNamespace();
            } catch {
                tokens.seek(0);
                parser.reset();
                parser.interpreter.predictionMode = PredictionMode.LL;
                parser.errorHandler = new DefaultErrorStrategy();
                parser.removeErrorListeners();
                try { parser.rootNamespace(); } catch { /* best effort */ }
            }
            console.log(`  Parsed warmup text (${Date.now() - warmupT0} ms)`);
        }
    }
} catch {
    // warmup text is optional
}

const totalMs = Date.now() - t0;
console.log();
console.log(`DFA populated in ${totalMs} ms`);

// Extract and write snapshot
const snapshots = extractSnapshot();
let totalStates = 0;
for (const snap of snapshots) totalStates += snap.s.length;

const outPath = path.join(rootDir, 'server/src/parser/dfaSnapshot.ts');
writeSnapshot(snapshots, outPath);

const fileSizeKB = (fs.statSync(outPath).size / 1024).toFixed(1);
console.log(`Wrote ${snapshots.length} decision DFAs (${totalStates} total states) to ${path.relative(rootDir, outPath)} (${fileSizeKB} KB)`);
console.log('Done.');
