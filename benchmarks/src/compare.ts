#!/usr/bin/env npx tsx
/**
 * Compare stable benchmark metrics between a base and head report.
 *
 * Usage:
 *   npm run bench:compare -- --base <file|dir> --head <file|dir> [--warn 15] [--fail 35] [--summary <file>]
 *
 * Writes a Markdown table to --summary (default: $GITHUB_STEP_SUMMARY, else stdout),
 * emits GitHub Actions annotations, and exits 1 when any metric regresses beyond --fail.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { BenchmarkReport } from './reporters/jsonReporter.js';
import { STABLE_METRICS, formatDuration, medianFor } from './reporters/historyReporter.js';
import { DEFAULT_FAIL_PERCENT, DEFAULT_WARN_PERCENT, TREND_LEGEND, classifyChange, formatTrend } from './reporters/visuals.js';

type Status = 'ok' | 'warn' | 'fail' | 'missing';

export interface ComparisonRow {
    title: string;
    base?: number;
    head?: number;
    changePercent?: number;
    status: Status;
}

export function compareStableMetrics(
    base: BenchmarkReport,
    head: BenchmarkReport,
    warnPercent: number,
    failPercent: number,
): ComparisonRow[] {
    return STABLE_METRICS.map(metric => {
        const baseMedian = medianFor(base, metric);
        const headMedian = medianFor(head, metric);
        if (baseMedian === undefined || headMedian === undefined || baseMedian === 0) {
            return { title: metric.title, base: baseMedian, head: headMedian, status: 'missing' };
        }
        const changePercent = ((headMedian - baseMedian) / baseMedian) * 100;
        const trend = classifyChange(changePercent, warnPercent, failPercent);
        const status: Status = trend === 'regressed' ? 'fail' : trend === 'slower' ? 'warn' : 'ok';
        return { title: metric.title, base: baseMedian, head: headMedian, changePercent, status };
    });
}

function formatResult(row: ComparisonRow, warnPercent: number, failPercent: number): string {
    if (row.status === 'missing' || row.changePercent === undefined) return '➖ not measured';
    return formatTrend(classifyChange(row.changePercent, warnPercent, failPercent), row.changePercent);
}

export function renderComparison(
    rows: ComparisonRow[],
    base: BenchmarkReport,
    head: BenchmarkReport,
    warnPercent: number,
    failPercent: number,
): string {
    const lines = [
        '## Performance Comparison',
        '',
        `Base \`${base.gitCommit}\` vs head \`${head.gitCommit}\`, measured on the same runner (${head.nodeVersion} ${head.platform}/${head.arch}).`,
        'Times are medians; **lower is better**.',
        '',
        '| Metric | Base | Head | Result |',
        '| --- | ---: | ---: | --- |',
    ];
    for (const row of rows) {
        lines.push(
            `| ${row.title} | ${row.base === undefined ? '-' : formatDuration(row.base)} ` +
            `| ${row.head === undefined ? '-' : formatDuration(row.head)} | ${formatResult(row, warnPercent, failPercent)} |`,
        );
    }
    lines.push(
        '',
        `Legend: ${TREND_LEGEND}. 🟡 warns above +${warnPercent}%; 🔴 fails the check above +${failPercent}%.`,
        'Shared CI runners are noisy; re-run the job before investigating a single warning.',
        '',
    );
    return lines.join('\n');
}

function loadReport(target: string): BenchmarkReport | undefined {
    if (!fs.existsSync(target)) return undefined;
    let file = target;
    if (fs.statSync(target).isDirectory()) {
        const latest = fs.readdirSync(target).filter(f => f.endsWith('.json')).sort().pop();
        if (!latest) return undefined;
        file = path.join(target, latest);
    }
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as BenchmarkReport;
}

function parseArgs(argv: string[]): { base?: string; head?: string; warn: number; fail: number; summary?: string } {
    const opts: { base?: string; head?: string; warn: number; fail: number; summary?: string } = {
        warn: DEFAULT_WARN_PERCENT,
        fail: DEFAULT_FAIL_PERCENT,
        summary: process.env.GITHUB_STEP_SUMMARY,
    };
    for (let i = 0; i < argv.length; i++) {
        const value = argv[i + 1];
        switch (argv[i]) {
            case '--base': opts.base = value; i++; break;
            case '--head': opts.head = value; i++; break;
            case '--warn': opts.warn = Number(value); i++; break;
            case '--fail': opts.fail = Number(value); i++; break;
            case '--summary': opts.summary = value; i++; break;
            default:
                console.error(`Unknown option: ${argv[i]}`);
                process.exit(2);
        }
    }
    if (!opts.base || !opts.head || !Number.isFinite(opts.warn) || !Number.isFinite(opts.fail)) {
        console.error('Usage: compare.ts --base <file|dir> --head <file|dir> [--warn 15] [--fail 35] [--summary <file>]');
        process.exit(2);
    }
    return opts;
}

function emit(markdown: string, summary?: string): void {
    if (summary) fs.appendFileSync(summary, markdown + '\n');
    else console.log(markdown);
}

function main(): void {
    const opts = parseArgs(process.argv.slice(2));
    const head = loadReport(opts.head!);
    if (!head) {
        console.error(`::error::No head benchmark report found at ${opts.head}`);
        process.exit(1);
    }

    const base = loadReport(opts.base!);
    if (!base) {
        console.log(`::warning::No base benchmark report found at ${opts.base}; skipping performance comparison.`);
        emit('## Performance Comparison\n\nBase benchmark unavailable; comparison skipped.\n', opts.summary);
        return;
    }

    const rows = compareStableMetrics(base, head, opts.warn, opts.fail);
    emit(renderComparison(rows, base, head, opts.warn, opts.fail), opts.summary);

    for (const row of rows) {
        const change = row.changePercent?.toFixed(1);
        if (row.status === 'fail') console.log(`::error title=Performance regression::${row.title} is ${change}% slower than base`);
        if (row.status === 'warn') console.log(`::warning title=Performance slowdown::${row.title} is ${change}% slower than base`);
    }

    if (rows.some(row => row.status === 'fail')) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
