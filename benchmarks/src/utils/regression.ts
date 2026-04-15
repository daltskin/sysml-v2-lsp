/**
 * Regression comparator — compare current results against a baseline.
 */

import type { BenchmarkReport, SuiteReport } from '../reporters/jsonReporter.js';

export interface RegressionResult {
    benchmark: string;
    suite: string;
    baselineMedian: number;
    currentMedian: number;
    changePercent: number;
    regressed: boolean;
}

export interface RegressionSummary {
    results: RegressionResult[];
    passed: boolean;
    threshold: number;
}

/**
 * Compare current report against baseline.
 * A benchmark is flagged as regressed if its median is worse by more than `threshold` percent.
 */
export function compareReports(
    current: BenchmarkReport,
    baseline: BenchmarkReport,
    threshold = 20,
): RegressionSummary {
    const results: RegressionResult[] = [];

    const baselineMap = new Map<string, { suite: string; median: number }>();
    for (const suite of baseline.suites) {
        for (const result of suite.results) {
            baselineMap.set(`${suite.name}::${result.name}`, {
                suite: suite.name,
                median: result.stats.median,
            });
        }
    }

    for (const suite of current.suites) {
        for (const result of suite.results) {
            const key = `${suite.name}::${result.name}`;
            const base = baselineMap.get(key);
            if (!base) continue; // new benchmark, skip

            const changePercent = base.median > 0
                ? ((result.stats.median - base.median) / base.median) * 100
                : 0;

            results.push({
                benchmark: result.name,
                suite: suite.name,
                baselineMedian: base.median,
                currentMedian: result.stats.median,
                changePercent,
                regressed: changePercent > threshold,
            });
        }
    }

    return {
        results,
        passed: results.every(r => !r.regressed),
        threshold,
    };
}

export function formatRegressionSummary(summary: RegressionSummary): string {
    const lines: string[] = [];
    lines.push(`\nRegression Check (threshold: ${summary.threshold}%)`);
    lines.push('─'.repeat(80));
    lines.push(
        padRight('Benchmark', 40) +
        padRight('Baseline', 12) +
        padRight('Current', 12) +
        padRight('Change', 10) +
        'Status'
    );
    lines.push('─'.repeat(80));

    for (const r of summary.results) {
        const status = r.regressed ? '❌ REGRESSED' : '✅ OK';
        const change = `${r.changePercent >= 0 ? '+' : ''}${r.changePercent.toFixed(1)}%`;
        lines.push(
            padRight(truncate(`${r.suite}/${r.benchmark}`, 38), 40) +
            padRight(`${r.baselineMedian.toFixed(2)}ms`, 12) +
            padRight(`${r.currentMedian.toFixed(2)}ms`, 12) +
            padRight(change, 10) +
            status
        );
    }

    lines.push('─'.repeat(80));
    lines.push(summary.passed ? '✅ All benchmarks within threshold' : '❌ Regression detected');
    return lines.join('\n');
}

function padRight(s: string, len: number): string {
    return s.length >= len ? s : s + ' '.repeat(len - s.length);
}

function truncate(s: string, len: number): string {
    return s.length <= len ? s : s.slice(0, len - 1) + '…';
}
