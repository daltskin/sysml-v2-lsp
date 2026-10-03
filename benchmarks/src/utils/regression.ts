/**
 * Baseline regression check — compares a run against the saved baseline using the
 * same stable metrics and verdicts as the pull request comparison.
 */

import type { BenchmarkReport } from '../reporters/jsonReporter.js';
import { compareStableMetrics, renderComparison, type ComparisonRow } from '../compare.js';
import { DEFAULT_FAIL_PERCENT, DEFAULT_WARN_PERCENT } from '../reporters/visuals.js';

export interface RegressionSummary {
    rows: ComparisonRow[];
    passed: boolean;
    markdown: string;
}

export function compareReports(
    current: BenchmarkReport,
    baseline: BenchmarkReport,
    failPercent = DEFAULT_FAIL_PERCENT,
): RegressionSummary {
    const currentEnvironment = `${current.nodeVersion} ${current.platform}/${current.arch}`;
    const baselineEnvironment = `${baseline.nodeVersion} ${baseline.platform}/${baseline.arch}`;
    if (currentEnvironment !== baselineEnvironment) {
        return {
            rows: [],
            passed: false,
            markdown: `Environment mismatch: current ${currentEnvironment}, baseline ${baselineEnvironment}. Compare results from the same runtime and platform.`,
        };
    }

    const warnPercent = Math.min(DEFAULT_WARN_PERCENT, failPercent);
    const rows = compareStableMetrics(baseline, current, warnPercent, failPercent);
    return {
        rows,
        passed: !rows.some(row => row.status === 'fail'),
        markdown: renderComparison(rows, baseline, current, warnPercent, failPercent),
    };
}

export function formatRegressionSummary(summary: RegressionSummary): string {
    return `\n${summary.markdown}`;
}
