/**
 * Statistical utility functions for benchmark analysis.
 */

export interface Stats {
    min: number;
    max: number;
    mean: number;
    median: number;
    p95: number;
    p99: number;
    stdDev: number;
    runs: number;
}

export function computeStats(values: number[]): Stats {
    if (values.length === 0) {
        return { min: 0, max: 0, mean: 0, median: 0, p95: 0, p99: 0, stdDev: 0, runs: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / n;

    const mid = Math.floor(n / 2);
    const median = n % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    const variance = sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);

    return {
        min: sorted[0],
        max: sorted[n - 1],
        mean,
        median,
        p95: percentile(sorted, 0.95),
        p99: percentile(sorted, 0.99),
        stdDev,
        runs: n,
    };
}

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 1) return sorted[0];
    const idx = p * (sorted.length - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

/** Remove outliers using IQR method. Returns filtered values. */
export function removeOutliers(values: number[], factor = 1.5): number[] {
    if (values.length < 4) return values;
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = percentile(sorted, 0.25);
    const q3 = percentile(sorted, 0.75);
    const iqr = q3 - q1;
    const lower = q1 - factor * iqr;
    const upper = q3 + factor * iqr;
    return values.filter(v => v >= lower && v <= upper);
}
