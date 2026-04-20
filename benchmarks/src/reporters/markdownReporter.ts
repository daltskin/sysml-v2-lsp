/**
 * Markdown reporter — converts a benchmark JSON report to a readable Markdown file.
 *
 * Usage (standalone):
 *   npx tsx benchmarks/src/reporters/markdownReporter.ts <results-file.json>
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { BenchmarkReport, SuiteReport } from './jsonReporter.js';
import type { BenchmarkResult } from '../utils/harness.js';

// ── Formatting helpers ──────────────────────────────────────────────

function fmt(ms: number): string {
    if (ms < 0.01) return `${(ms * 1000).toFixed(1)}µs`;
    if (ms < 1) return `${ms.toFixed(3)}ms`;
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

function pctBar(ratio: number, width = 20): string {
    const filled = Math.round(ratio * width);
    return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function coefficient(result: BenchmarkResult): string {
    if (result.stats.mean === 0) return '0%';
    return `${((result.stats.stdDev / result.stats.mean) * 100).toFixed(1)}%`;
}

// ── Section renderers ───────────────────────────────────────────────

function renderHeader(report: BenchmarkReport): string {
    const date = new Date(report.timestamp).toLocaleString();
    return [
        `# Benchmark Report`,
        '',
        `| Property | Value |`,
        `| --- | --- |`,
        `| Date | ${date} |`,
        `| Commit | \`${report.gitCommit}\` (${report.gitBranch}) |`,
        `| Node | ${report.nodeVersion} |`,
        `| Platform | ${report.platform}/${report.arch} |`,
        '',
    ].join('\n');
}

function renderParseSuite(suite: SuiteReport): string {
    const cold = suite.results.filter(r => r.name.startsWith('cold/'));
    const warm = suite.results.filter(r => r.name.startsWith('warm/'));

    const lines: string[] = [
        `## Parse`,
        '',
        'Measures raw ANTLR4 parse time. **Cold** = no DFA cache; **Warm** = DFA snapshot pre-loaded.',
        '',
        `| File | Lines | Tokens | Cold (median) | Warm (median) | Speedup | Mode |`,
        `| --- | ---: | ---: | ---: | ---: | ---: | --- |`,
    ];

    for (const c of cold) {
        const label = c.name.replace('cold/', '');
        const w = warm.find(r => r.name === `warm/${label}`);
        const wMedian = w ? w.stats.median : 0;
        const speedup = wMedian > 0 ? (c.stats.median / wMedian).toFixed(1) : '–';
        const mode = (w?.meta?.mode ?? c.meta?.mode ?? '') as string;
        lines.push(
            `| ${label} | ${c.meta?.lines ?? '–'} | ${c.meta?.tokens ?? '–'} ` +
            `| ${fmt(c.stats.median)} | ${w ? fmt(wMedian) : '–'} | ${speedup}× | ${mode} |`
        );
    }

    lines.push('');
    return lines.join('\n');
}

function renderSymbolTableSuite(suite: SuiteReport): string {
    const builds = suite.results.filter(r => r.name.startsWith('build/'));
    const lookups = suite.results.filter(r => r.name.startsWith('lookup/'));

    const lines: string[] = [
        `## Symbol Table`,
        '',
        '### Build',
        '',
        `| Scope | Symbols | Median | p95 | CV |`,
        `| --- | ---: | ---: | ---: | ---: |`,
    ];

    for (const b of builds) {
        const symbols = b.meta?.symbolCount ?? (b.meta?.fileCount ? `${b.meta.fileCount} files` : '–');
        lines.push(
            `| ${b.name.replace('build/', '')} | ${symbols} | ${fmt(b.stats.median)} | ${fmt(b.stats.p95)} | ${coefficient(b)} |`
        );
    }

    if (lookups.length > 0) {
        lines.push('', '### Lookup', '');
        lines.push(`| Type | Median | p95 | CV |`);
        lines.push(`| --- | ---: | ---: | ---: |`);
        for (const l of lookups) {
            lines.push(
                `| ${l.name.replace('lookup/', '')} | ${fmt(l.stats.median)} | ${fmt(l.stats.p95)} | ${coefficient(l)} |`
            );
        }
    }

    lines.push('');
    return lines.join('\n');
}

function renderProviderSuite(suite: SuiteReport): string {
    const lines: string[] = [
        `## LSP Providers`,
        '',
        `| Provider | Median | p95 | CV | Detail |`,
        `| --- | ---: | ---: | ---: | --- |`,
    ];

    for (const r of suite.results) {
        const detail = renderMetaDetail(r);
        lines.push(
            `| ${r.name} | ${fmt(r.stats.median)} | ${fmt(r.stats.p95)} | ${coefficient(r)} | ${detail} |`
        );
    }

    lines.push('');
    return lines.join('\n');
}

function renderMemorySuite(suite: SuiteReport): string {
    const primary = suite.results.filter(r => !r.name.startsWith('scaling/'));
    const scaling = suite.results.filter(r => r.name.startsWith('scaling/'));

    const lines: string[] = [
        `## Memory`,
        '',
        `| Benchmark | Median | Heap Δ | Files |`,
        `| --- | ---: | ---: | ---: |`,
    ];

    for (const r of primary) {
        lines.push(
            `| ${r.name} | ${fmt(r.stats.median)} | ${r.meta?.heapDeltaFormatted ?? '–'} | ${r.meta?.fileCount ?? '–'} |`
        );
    }

    if (scaling.length > 0) {
        lines.push('', '### Scaling', '');
        lines.push(`| Files | Median | Heap Δ |`);
        lines.push(`| ---: | ---: | ---: |`);
        for (const r of scaling) {
            lines.push(
                `| ${r.meta?.fileCount ?? '–'} | ${fmt(r.stats.median)} | ${r.meta?.heapDeltaFormatted ?? '–'} |`
            );
        }
    }

    lines.push('');
    return lines.join('\n');
}

function renderThroughputSuite(suite: SuiteReport): string {
    const lines: string[] = [
        `## Throughput`,
        '',
        `| Mode | Median | Lines/sec | Tokens/sec | Files |`,
        `| --- | ---: | ---: | ---: | ---: |`,
    ];

    for (const r of suite.results) {
        const lps = r.meta?.linesPerSec ? Number(r.meta.linesPerSec).toLocaleString() : '–';
        const tps = r.meta?.tokensPerSec ? Number(r.meta.tokensPerSec).toLocaleString() : '–';
        lines.push(
            `| ${r.name.replace('throughput/', '')} | ${fmt(r.stats.median)} | ${lps} | ${tps} | ${r.meta?.fileCount ?? '–'} |`
        );
    }

    lines.push('');
    return lines.join('\n');
}

function renderFolderLoadSuite(suite: SuiteReport): string {
    // Find the max median to scale the bars
    const maxMedian = Math.max(...suite.results.map(r => r.stats.median));

    const lines: string[] = [
        `## Folder Load`,
        '',
        `| Folder | Files | Symbols | Median | p95 | |`,
        `| --- | ---: | ---: | ---: | ---: | --- |`,
    ];

    for (const r of suite.results) {
        const bar = pctBar(r.stats.median / maxMedian, 15);
        lines.push(
            `| ${r.name.replace('folder/', '')} | ${r.meta?.fileCount ?? '–'} | ${r.meta?.symbolCount ?? '–'} ` +
            `| ${fmt(r.stats.median)} | ${fmt(r.stats.p95)} | \`${bar}\` |`
        );
    }

    lines.push('');
    return lines.join('\n');
}

function renderGenericSuite(suite: SuiteReport): string {
    const lines: string[] = [
        `## ${suite.name}`,
        '',
        `| Benchmark | Median | p95 | Std Dev | CV |`,
        `| --- | ---: | ---: | ---: | ---: |`,
    ];

    for (const r of suite.results) {
        lines.push(
            `| ${r.name} | ${fmt(r.stats.median)} | ${fmt(r.stats.p95)} | ${fmt(r.stats.stdDev)} | ${coefficient(r)} |`
        );
    }

    lines.push('');
    return lines.join('\n');
}

function renderMetaDetail(r: BenchmarkResult): string {
    if (!r.meta) return '';
    const parts: string[] = [];
    if ('count' in r.meta) parts.push(`n=${r.meta.count}`);
    if ('dataLength' in r.meta) parts.push(`len=${r.meta.dataLength}`);
    if ('hasResult' in r.meta) parts.push(r.meta.hasResult ? '✓' : '∅');
    return parts.join(', ');
}

// ── Suite dispatch ──────────────────────────────────────────────────

const SUITE_RENDERERS: Record<string, (suite: SuiteReport) => string> = {
    parse: renderParseSuite,
    symbolTable: renderSymbolTableSuite,
    providers: renderProviderSuite,
    memory: renderMemorySuite,
    throughput: renderThroughputSuite,
    folderLoad: renderFolderLoadSuite,
};

// ── Public API ──────────────────────────────────────────────────────

export function renderMarkdown(report: BenchmarkReport): string {
    const sections: string[] = [renderHeader(report)];

    for (const suite of report.suites) {
        const renderer = SUITE_RENDERERS[suite.name] ?? renderGenericSuite;
        sections.push(renderer(suite));
    }

    return sections.join('\n');
}

export function writeMarkdownReport(report: BenchmarkReport, outputDir: string): string {
    fs.mkdirSync(outputDir, { recursive: true });
    const filename = `${report.timestamp.replace(/[:.]/g, '-')}-${report.gitCommit}.md`;
    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, renderMarkdown(report));
    return filepath;
}

// ── Standalone CLI ──────────────────────────────────────────────────

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
    const file = process.argv[2];
    if (!file) {
        console.error('Usage: npx tsx benchmarks/src/reporters/markdownReporter.ts <results.json>');
        process.exit(1);
    }
    const report: BenchmarkReport = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const md = renderMarkdown(report);
    const outPath = file.replace(/\.json$/, '.md');
    fs.writeFileSync(outPath, md);
    console.log(`Written to ${outPath}`);
}
