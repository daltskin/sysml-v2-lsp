#!/usr/bin/env npx tsx
/**
 * Parse performance benchmark for sysml-v2-lsp.
 *
 * Measures cold-start (no DFA) vs DFA-pre-seeded parse times across
 * a range of SysML files of varying complexity.
 *
 * Usage:
 *   npx tsx scripts/benchmark-parse.ts                # run both modes
 *   npx tsx scripts/benchmark-parse.ts --no-dfa       # cold only
 *   npx tsx scripts/benchmark-parse.ts --dfa          # pre-seeded only
 */

import { BailErrorStrategy, CharStream, CommonTokenStream, DefaultErrorStrategy, PredictionMode } from 'antlr4ng';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SysMLv2Lexer } from '../server/src/generated/SysMLv2Lexer.js';
import { SysMLv2Parser } from '../server/src/generated/SysMLv2Parser.js';
import { isDfaPreSeeded, loadDFASnapshot, markDfaNotPreSeeded } from '../server/src/parser/dfaLoader.js';

// ── Benchmark files (ordered by complexity) ─────────────────────────
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(__dirname, '..');
const EXT_ROOT = path.resolve(ROOT, '../VSCode_SysML_Extension');

interface BenchFile {
    label: string;
    path: string;
}

const FILES: BenchFile[] = [
    { label: 'camera.sysml (tiny)',           path: path.join(ROOT, 'examples/camera.sysml') },
    { label: 'vehicle-model.sysml (small)',   path: path.join(ROOT, 'examples/vehicle-model.sysml') },
    { label: 'toaster-system.sysml (small)',  path: path.join(ROOT, 'examples/toaster-system.sysml') },
    { label: 'bike.sysml (medium)',           path: path.join(ROOT, 'examples/bike.sysml') },
    { label: 'batmobile.sysml (medium)',      path: path.join(ROOT, 'examples/temp/batmobile.sysml') },
    { label: 'complex-smart-home.sysml (lg)', path: path.join(ROOT, 'examples/temp/complex-smart-home.sysml') },
    { label: 'SysML v2 Spec Annex A (xl)',    path: path.join(ROOT, 'examples/temp/SysML v2 Spec Annex A SimpleVehicleModel.sysml') },
];

// Add Apollo-11 files from the extension repo if present
const apolloDir = path.join(EXT_ROOT, 'samples/temp/apollo-11-sysml-v2');
if (fs.existsSync(apolloDir)) {
    // Concatenate all Apollo-11 files as one "virtual" large file for throughput test
    FILES.push({
        label: 'Apollo-11 AstronautsPkg',
        path: path.join(apolloDir, 'Technical/AstronautsPackage.sysml'),
    });
    FILES.push({
        label: 'Apollo-11 SystemPkg (complex)',
        path: path.join(apolloDir, 'Technical/SystemPackage.sysml'),
    });
}

// ── Parsing helpers ─────────────────────────────────────────────────
interface ParseTiming {
    lexMs: number;
    parseMs: number;
    totalMs: number;
    errors: number;
    tokens: number;
    lines: number;
    mode: 'SLL' | 'SLL+LL';
}

function resetDFA(): void {
    // Fully clear all DFA tables (as if fresh process)
    const dfas = (SysMLv2Parser as any).decisionsToDFA as any[];
    for (const dfa of dfas) {
        if (!dfa) continue;
        if (dfa.isPrecedenceDfa) {
            dfa.s0 = undefined;
        } else {
            dfa.s0 = undefined;
        }
        if (dfa.states && typeof dfa.states.clear === 'function') {
            dfa.states.clear();
        }
    }
}

function parseOnce(text: string): ParseTiming {
    const totalStart = performance.now();

    const input = CharStream.fromString(text);
    const lexer = new SysMLv2Lexer(input);
    const tokenStream = new CommonTokenStream(lexer);

    const lexStart = performance.now();
    tokenStream.fill();
    const lexMs = performance.now() - lexStart;
    const tokenCount = tokenStream.getTokens().length;

    const parser = new SysMLv2Parser(tokenStream);
    parser.removeErrorListeners();

    let mode: 'SLL' | 'SLL+LL' = 'SLL';
    let errors = 0;

    // SLL first
    parser.interpreter.predictionMode = PredictionMode.SLL;
    parser.errorHandler = new BailErrorStrategy();

    const parseStart = performance.now();
    try {
        parser.rootNamespace();
    } catch {
        // SLL failed → LL fallback
        mode = 'SLL+LL';
        tokenStream.seek(0);
        parser.reset();
        parser.interpreter.predictionMode = PredictionMode.LL;
        parser.errorHandler = new DefaultErrorStrategy();
        parser.removeErrorListeners();
        // Count errors
        const errorCounter = {
            syntaxError: () => { errors++; },
            reportAmbiguity: () => {},
            reportAttemptingFullContext: () => {},
            reportContextSensitivity: () => {},
        };
        parser.addErrorListener(errorCounter as any);
        parser.rootNamespace();
    }
    const parseMs = performance.now() - parseStart;
    const totalMs = performance.now() - totalStart;

    return {
        lexMs,
        parseMs,
        totalMs,
        errors,
        tokens: tokenCount,
        lines: text.split('\n').length,
        mode,
    };
}

// ── Benchmark runner ────────────────────────────────────────────────
const WARMUP_RUNS = 1;
const BENCH_RUNS = 3;

interface FileResult {
    label: string;
    lines: number;
    tokens: number;
    cold: { avgMs: number; minMs: number; maxMs: number; mode: string };
    warm: { avgMs: number; minMs: number; maxMs: number; mode: string };
    speedup: string;
}

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function benchmarkFile(file: BenchFile, text: string): FileResult {
    // ── Cold DFA (no pre-seeding) ──
    const coldTimings: number[] = [];
    let coldMode = 'SLL';
    let tokens = 0;
    let lines = 0;

    for (let i = 0; i < WARMUP_RUNS + BENCH_RUNS; i++) {
        resetDFA();
        const t = parseOnce(text);
        tokens = t.tokens;
        lines = t.lines;
        coldMode = t.mode;
        if (i >= WARMUP_RUNS) {
            coldTimings.push(t.totalMs);
        }
    }

    // ── Warm DFA (pre-seeded) ──
    const warmTimings: number[] = [];
    let warmMode = 'SLL';

    for (let i = 0; i < WARMUP_RUNS + BENCH_RUNS; i++) {
        resetDFA();
        loadDFASnapshot();
        // Clear the pre-seeded flag (we just want the DFA states, not the retry logic)
        if (isDfaPreSeeded()) markDfaNotPreSeeded();
        const t = parseOnce(text);
        warmMode = t.mode;
        if (i >= WARMUP_RUNS) {
            warmTimings.push(t.totalMs);
        }
    }

    const coldAvg = median(coldTimings);
    const warmAvg = median(warmTimings);
    const speedup = coldAvg > 0 ? (coldAvg / warmAvg) : 1;

    return {
        label: file.label,
        lines,
        tokens,
        cold: {
            avgMs: coldAvg,
            minMs: Math.min(...coldTimings),
            maxMs: Math.max(...coldTimings),
            mode: coldMode,
        },
        warm: {
            avgMs: warmAvg,
            minMs: Math.min(...warmTimings),
            maxMs: Math.max(...warmTimings),
            mode: warmMode,
        },
        speedup: speedup.toFixed(2) + 'x',
    };
}

// ── Multi-file throughput benchmark ─────────────────────────────────
interface ThroughputResult {
    label: string;
    files: number;
    totalLines: number;
    coldMs: number;
    warmMs: number;
    speedup: string;
}

function benchmarkThroughput(files: { path: string; text: string }[]): ThroughputResult {
    // Cold: parse all files sequentially with fresh DFA each run
    const coldRuns: number[] = [];
    for (let r = 0; r < 1 + 2; r++) {
        resetDFA();
        const start = performance.now();
        for (const f of files) {
            parseOnce(f.text);
        }
        if (r >= 1) {
            coldRuns.push(performance.now() - start);
        }
    }

    // Warm: pre-seed DFA then parse all files
    const warmRuns: number[] = [];
    for (let r = 0; r < 1 + 2; r++) {
        resetDFA();
        loadDFASnapshot();
        if (isDfaPreSeeded()) markDfaNotPreSeeded();
        const start = performance.now();
        for (const f of files) {
            parseOnce(f.text);
        }
        if (r >= 1) {
            warmRuns.push(performance.now() - start);
        }
    }

    const coldMs = median(coldRuns);
    const warmMs = median(warmRuns);
    const totalLines = files.reduce((sum, f) => sum + f.text.split('\n').length, 0);

    return {
        label: 'All files sequential',
        files: files.length,
        totalLines,
        coldMs,
        warmMs,
        speedup: (coldMs / warmMs).toFixed(2) + 'x',
    };
}

// ── Main ────────────────────────────────────────────────────────────
function main() {
    const args = process.argv.slice(2);
    const runCold = !args.includes('--dfa');
    const runWarm = !args.includes('--no-dfa');

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('  SysML v2 Parser Benchmark — DFA Pre-Seeding Performance');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`  Runs: ${BENCH_RUNS} (+ ${WARMUP_RUNS} warmup) | Metric: median`);
    console.log();

    // Load all file texts
    const fileTexts: { file: BenchFile; text: string }[] = [];
    for (const file of FILES) {
        if (!fs.existsSync(file.path)) {
            console.log(`  ⚠ Skipping ${file.label} — file not found`);
            continue;
        }
        fileTexts.push({ file, text: fs.readFileSync(file.path, 'utf-8') });
    }

    // Per-file benchmarks
    console.log('──── Per-file Parse Performance ────────────────────────────────');
    console.log();
    console.log(
        padRight('File', 38) +
        padRight('Lines', 7) +
        padRight('Tokens', 8) +
        padRight('Cold (ms)', 12) +
        padRight('DFA (ms)', 12) +
        padRight('Speedup', 10) +
        'Mode'
    );
    console.log('─'.repeat(95));

    const results: FileResult[] = [];
    for (const { file, text } of fileTexts) {
        const r = benchmarkFile(file, text);
        results.push(r);
        console.log(
            padRight(r.label, 38) +
            padRight(String(r.lines), 7) +
            padRight(String(r.tokens), 8) +
            padRight(r.cold.avgMs.toFixed(1), 12) +
            padRight(r.warm.avgMs.toFixed(1), 12) +
            padRight(r.speedup, 10) +
            r.warm.mode
        );
    }

    // Throughput benchmark
    console.log();
    console.log('──── Aggregate Throughput ──────────────────────────────────────');
    console.log();

    const allTexts = fileTexts.map(ft => ({ path: ft.file.path, text: ft.text }));
    const tp = benchmarkThroughput(allTexts);
    console.log(`  Files:      ${tp.files}`);
    console.log(`  Lines:      ${tp.totalLines}`);
    console.log(`  Cold total: ${tp.coldMs.toFixed(1)} ms`);
    console.log(`  DFA total:  ${tp.warmMs.toFixed(1)} ms`);
    console.log(`  Speedup:    ${tp.speedup}`);

    // Summary
    console.log();
    console.log('──── Summary ──────────────────────────────────────────────────');
    const avgSpeedup = results.reduce((s, r) => s + parseFloat(r.speedup), 0) / results.length;
    console.log(`  Average per-file speedup: ${avgSpeedup.toFixed(2)}x`);
    console.log(`  Aggregate speedup:        ${tp.speedup}`);
    console.log();
}

function padRight(s: string, n: number): string {
    return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

main();
