/**
 * Memory measurement utilities.
 */

export interface MemorySnapshot {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
}

export function takeMemorySnapshot(): MemorySnapshot {
    const m = process.memoryUsage();
    return {
        rss: m.rss,
        heapUsed: m.heapUsed,
        heapTotal: m.heapTotal,
        external: m.external,
    };
}

export interface MemoryDelta {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
}

export function memoryDelta(before: MemorySnapshot, after: MemorySnapshot): MemoryDelta {
    return {
        rss: after.rss - before.rss,
        heapUsed: after.heapUsed - before.heapUsed,
        heapTotal: after.heapTotal - before.heapTotal,
        external: after.external - before.external,
    };
}

/** Force garbage collection if --expose-gc is enabled. */
export function forceGC(): void {
    if (typeof globalThis.gc === 'function') {
        globalThis.gc();
    }
}

/** Format bytes to human-readable string. */
export function formatBytes(bytes: number): string {
    const abs = Math.abs(bytes);
    if (abs < 1024) return `${bytes} B`;
    if (abs < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
