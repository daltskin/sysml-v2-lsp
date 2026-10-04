#!/usr/bin/env npx tsx

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { BenchmarkReport } from './jsonReporter.js';
import { DEFAULT_FAIL_PERCENT, DEFAULT_WARN_PERCENT, NOISE_PERCENT, TREND_LEGEND, classifyChange, formatTrend, mermaidChart } from './visuals.js';

export interface StableMetric {
    suite: string;
    name: string;
    title: string;
}

export const STABLE_METRICS: StableMetric[] = [
    { suite: 'folderLoad', name: 'folder/all', title: 'Full Workspace Folder Load' },
    { suite: 'folderLoad', name: 'folder/sysml-library', title: 'Standard Library Folder Load' },
    { suite: 'symbolTable', name: 'build/workspace-all', title: 'Workspace Parse and Symbol Build' },
];

function loadReports(resultsDir: string): BenchmarkReport[] {
    if (!fs.existsSync(resultsDir)) return [];

    return fs.readdirSync(resultsDir)
        .filter(file => file.endsWith('.json'))
        .flatMap(file => {
            try {
                return [JSON.parse(fs.readFileSync(path.join(resultsDir, file), 'utf-8')) as BenchmarkReport];
            } catch {
                console.warn(`Skipping unreadable benchmark report: ${file}`);
                return [];
            }
        })
        .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

export function medianFor(report: BenchmarkReport, metric: StableMetric): number | undefined {
    return report.suites
        .find(suite => suite.name === metric.suite)
        ?.results.find(result => result.name === metric.name)
        ?.stats.median;
}

export function formatDuration(ms: number): string {
    return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms.toFixed(2)}ms`;
}

interface CommitPoint {
    label: string;
    date: string;
    values: number[];
    median: number;
    min: number;
    max: number;
}

function middle(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function environmentOf(report: BenchmarkReport): string {
    return `Node ${report.nodeVersion} ${report.platform}/${report.arch}`;
}

function groupByCommit(reports: BenchmarkReport[], metric: StableMetric, showEnvironment: boolean): CommitPoint[] {
    const groups = new Map<string, { label: string; date: string; values: number[] }>();
    for (const report of reports) {
        const median = medianFor(report, metric);
        if (median === undefined) continue;
        const commit = `${report.gitCommit}${report.gitDirty ? '*' : ''}`;
        const label = showEnvironment ? `${commit} (${report.nodeVersion})` : commit;
        const key = `${commit}|${environmentOf(report)}`;
        const group = groups.get(key) ?? { label, date: report.timestamp.slice(0, 10), values: [] };
        group.values.push(median);
        groups.set(key, group);
    }
    return [...groups.values()].map(({ label, date, values }) => ({
        label,
        date,
        values,
        median: middle(values),
        min: Math.min(...values),
        max: Math.max(...values),
    }));
}

function describeChange(current: CommitPoint, previous: CommitPoint): string {
    const change = ((current.median - previous.median) / previous.median) * 100;
    const overlaps = current.min <= previous.max && previous.min <= current.max;
    if (overlaps) return formatTrend('unclear', change);
    return formatTrend(classifyChange(change), change);
}

function formatRange(point: CommitPoint): string {
    return point.values.length > 1 ? `${formatDuration(point.min)} – ${formatDuration(point.max)}` : '-';
}

function renderChart(metric: StableMetric, points: CommitPoint[]): string[] {
    return mermaidChart(metric.title, points.map(p => `${p.date.slice(5)} ${p.label}`), 'line', points.map(p => p.median));
}

export function renderHistory(reports: BenchmarkReport[]): string {
    const environments = [...new Set(reports.map(environmentOf))];
    const sections = STABLE_METRICS
        .map(metric => ({ metric, points: groupByCommit(reports, metric, environments.length > 1) }))
        .filter(section => section.points.length > 0);

    if (sections.length === 0) return '# Benchmark History\n\nNo comparable benchmark observations found.\n';

    const lines = [
        '# Benchmark History',
        '',
        'Times are medians; **lower is better**. Runs of the same commit and environment are combined, and their spread is shown as the range.',
        `Faster by ${NOISE_PERCENT}%+ is 🟢; slower by ${DEFAULT_WARN_PERCENT}%+ is 🟡 and by ${DEFAULT_FAIL_PERCENT}%+ is 🔴. Smaller changes, or overlapping ranges, are no clear change.`,
        `Legend: ${TREND_LEGEND}.`,
        `Environment: ${environments.join(', ')}.`,
        '',
        '## Summary',
        '',
        '| Metric | First | Latest | Overall |',
        '| --- | ---: | ---: | --- |',
    ];

    for (const { metric, points } of sections) {
        const first = points[0];
        const latest = points[points.length - 1];
        const overall = points.length > 1 ? describeChange(latest, first) : '-';
        lines.push(`| ${metric.title} | ${formatDuration(first.median)} (\`${first.label}\`) | ${formatDuration(latest.median)} (\`${latest.label}\`) | ${overall} |`);
    }
    lines.push('');

    for (const { metric, points } of sections) {
        lines.push(`## ${metric.title}`, '', ...renderChart(metric, points), '');
        lines.push('| Date | Commit | Runs | Median | Range | vs previous commit |');
        lines.push('| --- | --- | ---: | ---: | --- | --- |');
        points.forEach((point, index) => {
            const change = index === 0 ? '-' : describeChange(point, points[index - 1]);
            lines.push(`| ${point.date} | \`${point.label}\` | ${point.values.length} | ${formatDuration(point.median)} | ${formatRange(point)} | ${change} |`);
        });
        lines.push('');
    }

    if (reports.some(report => report.gitDirty)) lines.push('`*` marks runs captured from a dirty worktree.', '');
    return lines.join('\n');
}

function main(): void {
    const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
    const resultsDir = path.resolve(process.argv[2] ?? path.join(root, 'benchmarks/results'));
    const outputPath = path.resolve(process.argv[3] ?? path.join(resultsDir, 'HISTORY.md'));
    const reports = loadReports(resultsDir);
    fs.writeFileSync(outputPath, renderHistory(reports));
    console.log(`Historical comparison written to: ${outputPath}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();