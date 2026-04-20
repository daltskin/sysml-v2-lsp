#!/usr/bin/env npx tsx
/**
 * SysML v2 LSP Benchmark Runner
 *
 * Usage:
 *   npx tsx benchmarks/src/runner.ts                          # run all suites
 *   npx tsx benchmarks/src/runner.ts --suite parse            # specific suite
 *   npx tsx benchmarks/src/runner.ts --suite providers        # specific suite
 *   npx tsx benchmarks/src/runner.ts --baseline               # save baseline
 *   npx tsx benchmarks/src/runner.ts --compare                # compare vs baseline
 *   npx tsx benchmarks/src/runner.ts --runs 10 --warmup 3     # custom iterations
 *   npx tsx benchmarks/src/runner.ts --threshold 15           # regression threshold %
 *   npx tsx benchmarks/src/runner.ts --output ./my-results    # custom output dir
 */

import * as path from 'node:path';
import { runParseSuite } from './suites/parse.bench.js';
import { runSymbolTableSuite } from './suites/symbolTable.bench.js';
import { runProviderSuite } from './suites/providers.bench.js';
import { runMemorySuite } from './suites/memory.bench.js';
import { runThroughputSuite } from './suites/throughput.bench.js';
import { runFolderLoadSuite } from './suites/folderLoad.bench.js';
import { buildReport, writeReport, writeBaseline, loadBaseline, type SuiteReport } from './reporters/jsonReporter.js';
import { writeMarkdownReport } from './reporters/markdownReporter.js';
import { compareReports, formatRegressionSummary } from './utils/regression.js';
import type { BenchmarkOptions } from './utils/harness.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

// ── CLI argument parsing ────────────────────────────────────────────
interface CliOptions {
    suites: string[];
    baseline: boolean;
    compare: boolean;
    runs: number;
    warmup: number;
    threshold: number;
    outputDir: string;
    baselineDir: string;
}

function parseArgs(): CliOptions {
    const args = process.argv.slice(2);
    const opts: CliOptions = {
        suites: [],
        baseline: false,
        compare: false,
        runs: 5,
        warmup: 2,
        threshold: 20,
        outputDir: path.join(ROOT, 'benchmarks/results'),
        baselineDir: path.join(ROOT, 'benchmarks/baselines'),
    };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--suite':
                if (args[i + 1]) opts.suites.push(args[++i]);
                break;
            case '--baseline':
                opts.baseline = true;
                break;
            case '--compare':
                opts.compare = true;
                break;
            case '--runs':
                opts.runs = parseInt(args[++i], 10);
                break;
            case '--warmup':
                opts.warmup = parseInt(args[++i], 10);
                break;
            case '--threshold':
                opts.threshold = parseInt(args[++i], 10);
                break;
            case '--output':
                opts.outputDir = path.resolve(args[++i]);
                break;
            case '--help':
            case '-h':
                printHelp();
                process.exit(0);
                break;
            default:
                console.error(`Unknown option: ${args[i]}`);
                process.exit(1);
        }
    }

    return opts;
}

function printHelp(): void {
    console.log(`
SysML v2 LSP Benchmark Runner

Options:
  --suite <name>     Run specific suite (parse|symbolTable|providers|memory|throughput|folderLoad)
                     Can be repeated. Default: all suites.
  --baseline         Save current results as the baseline for regression comparison.
  --compare          Compare against saved baseline and exit 1 on regression.
  --runs <n>         Number of measured iterations per benchmark (default: 5).
  --warmup <n>       Number of warmup iterations (default: 2).
  --threshold <n>    Regression threshold percentage (default: 20).
  --output <path>    Custom output directory for JSON results.
  -h, --help         Show this help message.
`);
}

// ── Suite registry ──────────────────────────────────────────────────
type SuiteRunner = (opts: BenchmarkOptions) => SuiteReport | Promise<SuiteReport>;

const SUITE_RUNNERS: Record<string, SuiteRunner> = {
    parse: runParseSuite,
    symbolTable: runSymbolTableSuite,
    providers: runProviderSuite,
    memory: runMemorySuite,
    throughput: runThroughputSuite,
    folderLoad: runFolderLoadSuite,
};

const ALL_SUITES = Object.keys(SUITE_RUNNERS);

// ── Main ────────────────────────────────────────────────────────────
async function main(): Promise<void> {
    const cli = parseArgs();
    const suitesToRun = cli.suites.length > 0 ? cli.suites : ALL_SUITES;
    const benchOpts: BenchmarkOptions = { runs: cli.runs, warmup: cli.warmup };

    // Validate suite names
    for (const name of suitesToRun) {
        if (!SUITE_RUNNERS[name]) {
            console.error(`Unknown suite: ${name}. Available: ${ALL_SUITES.join(', ')}`);
            process.exit(1);
        }
    }

    console.log('═'.repeat(70));
    console.log('  SysML v2 LSP Performance Benchmark');
    console.log('═'.repeat(70));
    console.log(`  Suites:  ${suitesToRun.join(', ')}`);
    console.log(`  Runs:    ${cli.runs} (+ ${cli.warmup} warmup)`);
    console.log(`  Metric:  median`);
    console.log('═'.repeat(70));
    console.log();

    const suiteReports: SuiteReport[] = [];

    for (const name of suitesToRun) {
        console.log(`── Running suite: ${name} ${'─'.repeat(50 - name.length)}`);
        const start = performance.now();
        const report = await SUITE_RUNNERS[name](benchOpts);
        const elapsed = performance.now() - start;

        suiteReports.push(report);

        // Print summary
        for (const result of report.results) {
            const meta = result.meta ? ` ${JSON.stringify(result.meta)}` : '';
            console.log(
                `  ${padRight(result.name, 35)} ` +
                `median=${result.stats.median.toFixed(2)}ms  ` +
                `p95=${result.stats.p95.toFixed(2)}ms  ` +
                `stddev=${result.stats.stdDev.toFixed(2)}ms` +
                meta
            );
        }
        console.log(`  (suite completed in ${(elapsed / 1000).toFixed(1)}s)\n`);
    }

    // Build and write report
    const report = buildReport(suiteReports);
    const reportPath = writeReport(report, cli.outputDir);
    const mdPath = writeMarkdownReport(report, cli.outputDir);
    console.log(`\nResults written to: ${reportPath}`);
    console.log(`Markdown report:   ${mdPath}`);

    // Baseline handling
    if (cli.baseline) {
        const baselinePath = writeBaseline(report, cli.baselineDir);
        console.log(`Baseline saved to: ${baselinePath}`);
    }

    // Regression comparison
    if (cli.compare) {
        const baseline = loadBaseline(cli.baselineDir);
        if (!baseline) {
            console.error('\nNo baseline found. Run with --baseline first.');
            process.exit(1);
        }

        const summary = compareReports(report, baseline, cli.threshold);
        console.log(formatRegressionSummary(summary));

        if (!summary.passed) {
            process.exit(1);
        }
    }

    console.log('\nDone.');
}

function padRight(s: string, len: number): string {
    return s.length >= len ? s : s + ' '.repeat(len - s.length);
}

main();
