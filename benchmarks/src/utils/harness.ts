/**
 * Benchmark harness — runs a function N times, collects timing and memory.
 */

import { computeStats, type Stats } from './stats.js';
import { forceGC, memoryDelta, takeMemorySnapshot, type MemoryDelta } from './memory.js';

export interface BenchmarkOptions {
    /** Number of warmup iterations (not measured). Default: 2 */
    warmup?: number;
    /** Number of measured iterations. Default: 5 */
    runs?: number;
    /** Whether to track memory deltas. Default: false */
    trackMemory?: boolean;
}

export interface BenchmarkResult {
    name: string;
    timings: number[];
    stats: Stats;
    memoryDeltas: MemoryDelta[];
    meta?: Record<string, unknown>;
}

/**
 * Run a synchronous function repeatedly and collect performance data.
 *
 * @param name   Human-readable label for the benchmark
 * @param fn     The function to benchmark. May return metadata to attach to the result.
 * @param opts   Iteration and tracking options
 */
export function benchmarkFn(
    name: string,
    fn: () => Record<string, unknown> | void,
    opts: BenchmarkOptions = {},
): BenchmarkResult {
    const warmup = opts.warmup ?? 2;
    const runs = opts.runs ?? 5;
    const trackMemory = opts.trackMemory ?? false;

    // Warmup
    for (let i = 0; i < warmup; i++) {
        fn();
    }

    const timings: number[] = [];
    const memoryDeltas: MemoryDelta[] = [];
    let lastMeta: Record<string, unknown> | void;

    for (let i = 0; i < runs; i++) {
        if (trackMemory) forceGC();
        const memBefore = trackMemory ? takeMemorySnapshot() : undefined;

        const start = performance.now();
        lastMeta = fn();
        const elapsed = performance.now() - start;

        timings.push(elapsed);

        if (trackMemory && memBefore) {
            const memAfter = takeMemorySnapshot();
            memoryDeltas.push(memoryDelta(memBefore, memAfter));
        }
    }

    return {
        name,
        timings,
        stats: computeStats(timings),
        memoryDeltas,
        meta: lastMeta ?? undefined,
    };
}

/**
 * Run an async function repeatedly and collect performance data.
 */
export async function benchmarkFnAsync(
    name: string,
    fn: () => Promise<Record<string, unknown> | void>,
    opts: BenchmarkOptions = {},
): Promise<BenchmarkResult> {
    const warmup = opts.warmup ?? 2;
    const runs = opts.runs ?? 5;
    const trackMemory = opts.trackMemory ?? false;

    for (let i = 0; i < warmup; i++) {
        await fn();
    }

    const timings: number[] = [];
    const memoryDeltas: MemoryDelta[] = [];
    let lastMeta: Record<string, unknown> | void;

    for (let i = 0; i < runs; i++) {
        if (trackMemory) forceGC();
        const memBefore = trackMemory ? takeMemorySnapshot() : undefined;

        const start = performance.now();
        lastMeta = await fn();
        const elapsed = performance.now() - start;

        timings.push(elapsed);

        if (trackMemory && memBefore) {
            const memAfter = takeMemorySnapshot();
            memoryDeltas.push(memoryDelta(memBefore, memAfter));
        }
    }

    return {
        name,
        timings,
        stats: computeStats(timings),
        memoryDeltas,
        meta: lastMeta ?? undefined,
    };
}
