/**
 * DFA Snapshot Loader — pre-populates the ANTLR4 parser's static DFA
 * tables from a build-time snapshot for near-instant startup (~20 ms).
 *
 * Pre-seeded states use empty ATNConfigSets as a safety fallback.
 * When the parser encounters a token sequence not in the snapshot,
 * the SLL fast path bails out and the LL fallback computes correct
 * transitions from the ATN.  This means the DFA self-heals:
 *   - Covered paths → instant (pre-seeded edges)
 *   - Uncovered paths → one-time LL computation (~50-200 ms per decision)
 *   - Subsequent parses → all paths fast
 *
 * The "pre-seeded" flag is cleared after the first self-heal event
 * to prevent redundant retry loops.
 */

import { ATNConfigSet, ATNSimulator, DFAState } from 'antlr4ng';
import { SysMLv2Parser } from '../generated/SysMLv2Parser.js';
import { DFA_SNAPSHOT, type DecisionSnapshot } from './dfaSnapshot.js';

/** Sentinel: set to true after loadDFASnapshot() succeeds. */
let _loaded = false;
/** Sticky flag: true if loadDFASnapshot() was ever called successfully. */
let _everLoaded = false;

/** Returns true if the DFA has been pre-seeded from a snapshot. */
export function isDfaPreSeeded(): boolean {
    return _loaded;
}

/** Returns true if a DFA snapshot was ever loaded in this session. */
export function wasDfaEverPreSeeded(): boolean {
    return _everLoaded;
}

/**
 * Mark the DFA as no longer pre-seeded WITHOUT destroying states.
 *
 * Called after the first file parse to prevent redundant retry checks.
 * DFA states (both pre-seeded and ATN-computed) are preserved.
 */
export function markDfaNotPreSeeded(): void {
    _loaded = false;
}

/**
 * Clear pre-seeded DFA states that have empty ATNConfigSets.
 *
 * Pre-seeded states use a shared empty ATNConfigSet as a fallback.
 * When the parser hits an uncovered token transition on these states,
 * it produces ERROR edges instead of computing from the ATN.  This
 * function removes those problematic states while preserving any
 * states that were correctly built from the ATN during parsing.
 *
 * After clearing, the parser will lazily rebuild transitions from
 * the ATN for the affected decisions (~50-200 ms per decision).
 */
export function clearPreSeededDFAStates(): void {
    const dfas = (SysMLv2Parser as any).decisionsToDFA as any[];
    for (const dfa of dfas) {
        if (!dfa.s0) continue;

        // Check if s0 has an empty ATNConfigSet (pre-seeded marker)
        const configs = (dfa.s0 as any).configs;
        if (configs && configs.length === 0) {
            // This decision was entirely pre-seeded — clear it so
            // the ATN rebuilds it correctly on next use.
            if (dfa.isPrecedenceDfa) {
                dfa.s0 = DFAState.fromState(-1);
            } else {
                dfa.s0 = undefined;
            }
            if (dfa.states && typeof dfa.states.clear === 'function') {
                dfa.states.clear();
            }
        }
    }
}

/**
 * Unconditionally clear ALL DFA states for every decision.
 *
 * Used when parse errors occur after the pre-seeded flag has been
 * cleared — child states deeper in the DFA graph may still hold
 * pre-seeded ERROR edges even though s0 was rebuilt by LL.
 * The ATN will lazily recompute correct states on the next parse.
 */
export function clearAllDFAStates(): void {
    const dfas = (SysMLv2Parser as any).decisionsToDFA as any[];
    for (const dfa of dfas) {
        if (!dfa.s0) continue;
        if (dfa.isPrecedenceDfa) {
            dfa.s0 = DFAState.fromState(-1);
        } else {
            dfa.s0 = undefined;
        }
        if (dfa.states && typeof dfa.states.clear === 'function') {
            dfa.states.clear();
        }
    }
}

/**
 * Pre-populate the parser's static DFA tables from the build-time snapshot.
 *
 * Must be called once at server startup, before any parsing occurs.
 * Accesses `SysMLv2Parser._ATN` (triggers ATN deserialization if needed)
 * and writes directly to the shared `decisionsToDFA` array.
 *
 * @returns The number of DFA states loaded.
 */
export function loadDFASnapshot(): number {
    if (_loaded) return 0;

    // Trigger ATN initialisation (idempotent)
    void SysMLv2Parser._ATN;

    const dfas = (SysMLv2Parser as any).decisionsToDFA as any[];
    let totalStates = 0;

    for (const snap of DFA_SNAPSHOT) {
        loadDecision(dfas, snap);
        totalStates += snap.s.length;
    }

    _loaded = true;
    _everLoaded = true;
    return totalStates;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function loadDecision(dfas: any[], snap: DecisionSnapshot): void {
    const dfa = dfas[snap.d];
    if (!dfa) return;

    const emptyConfigs = new ATNConfigSet();

    const states: any[] = new Array(snap.s.length);
    for (let i = 0; i < snap.s.length; i++) {
        const ss = snap.s[i];
        const state = DFAState.fromState(i);
        (state as any).configs = emptyConfigs;
        state.isAcceptState = ss.a === 1;
        if (ss.p !== undefined) {
            state.prediction = ss.p;
        }
        state.requiresFullContext = ss.r === 1;
        states[i] = state;
    }

    const errorState = (ATNSimulator as any).ERROR;
    for (let i = 0; i < snap.s.length; i++) {
        const ss = snap.s[i];
        const state = states[i];
        const e = ss.e;
        for (let j = 0; j < e.length; j += 2) {
            const tokenIndex = e[j];
            const targetIdx = e[j + 1];
            state.edges[tokenIndex] = targetIdx === -1 ? errorState : states[targetIdx];
        }
    }

    if (snap.prec) {
        if (!dfa.s0) {
            dfa.s0 = DFAState.fromState(-1);
        }
        if (snap.precEdges) {
            const pe = snap.precEdges;
            for (let j = 0; j < pe.length; j += 2) {
                const precedence = pe[j];
                const stateIdx = pe[j + 1];
                dfa.s0.edges[precedence] = states[stateIdx];
            }
        }
    } else {
        dfa.s0 = states[snap.s0];
    }
}
