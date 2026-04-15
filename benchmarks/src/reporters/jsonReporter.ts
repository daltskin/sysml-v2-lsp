/**
 * JSON reporter — writes benchmark results to a structured JSON file.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import type { BenchmarkResult } from '../utils/harness.js';

export interface SuiteReport {
    name: string;
    results: BenchmarkResult[];
}

export interface BenchmarkReport {
    timestamp: string;
    gitCommit: string;
    gitBranch: string;
    nodeVersion: string;
    platform: string;
    arch: string;
    suites: SuiteReport[];
}

function gitInfo(): { commit: string; branch: string } {
    try {
        const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
        const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
        return { commit, branch };
    } catch {
        return { commit: 'unknown', branch: 'unknown' };
    }
}

export function buildReport(suites: SuiteReport[]): BenchmarkReport {
    const git = gitInfo();
    return {
        timestamp: new Date().toISOString(),
        gitCommit: git.commit,
        gitBranch: git.branch,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        suites,
    };
}

export function writeReport(report: BenchmarkReport, outputDir: string): string {
    fs.mkdirSync(outputDir, { recursive: true });
    const filename = `${report.timestamp.replace(/[:.]/g, '-')}-${report.gitCommit}.json`;
    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    return filepath;
}

export function writeBaseline(report: BenchmarkReport, baselineDir: string): string {
    fs.mkdirSync(baselineDir, { recursive: true });
    const filepath = path.join(baselineDir, 'baseline.json');
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    return filepath;
}

export function loadBaseline(baselineDir: string): BenchmarkReport | null {
    const filepath = path.join(baselineDir, 'baseline.json');
    if (!fs.existsSync(filepath)) return null;
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}
