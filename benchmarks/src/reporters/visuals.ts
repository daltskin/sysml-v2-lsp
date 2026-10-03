/**
 * Shared Markdown visuals for benchmark reports: change verdicts and Mermaid charts.
 */

// Changes smaller than this are treated as run-to-run noise.
export const NOISE_PERCENT = 10;
export const DEFAULT_WARN_PERCENT = 15;
export const DEFAULT_FAIL_PERCENT = 35;

export type Trend = 'faster' | 'unclear' | 'slower' | 'regressed';

export function classifyChange(
    changePercent: number,
    warnPercent = DEFAULT_WARN_PERCENT,
    failPercent = DEFAULT_FAIL_PERCENT,
): Trend {
    if (changePercent <= -NOISE_PERCENT) return 'faster';
    if (changePercent > failPercent) return 'regressed';
    if (changePercent > warnPercent) return 'slower';
    return 'unclear';
}

const ICON: Record<Trend, string> = { faster: '🟢', unclear: '⚪', slower: '🟡', regressed: '🔴' };

export const TREND_LEGEND = '🟢 faster · ⚪ no clear change · 🟡 slower · 🔴 significantly slower';

export function formatTrend(trend: Trend, changePercent: number): string {
    if (trend === 'unclear') return `${ICON.unclear} no clear change (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(0)}%)`;
    return `${ICON[trend]} ${Math.abs(changePercent).toFixed(0)}% ${changePercent < 0 ? 'faster' : 'slower'}`;
}

/** Render a single-series Mermaid xychart; values are milliseconds and auto-scaled to seconds when large. */
export function mermaidChart(title: string, labels: string[], type: 'line' | 'bar', valuesMs: number[]): string[] {
    const seconds = Math.max(...valuesMs) >= 1000;
    const scaled = valuesMs.map(ms => Number((seconds ? ms / 1000 : ms).toFixed(2)));
    const top = Math.max(1, Math.ceil(Math.max(...scaled) * 1.1));
    return [
        '```mermaid',
        // Horizontal bars give long category labels their own row instead of overlapping.
        type === 'bar' ? 'xychart-beta horizontal' : 'xychart-beta',
        `    title "${title} (lower is better)"`,
        `    x-axis [${labels.map(label => `"${label.replace(/"/g, "'")}"`).join(', ')}]`,
        `    y-axis "${seconds ? 'Seconds' : 'Milliseconds'}" 0 --> ${top}`,
        `    ${type} [${scaled.join(', ')}]`,
        '```',
    ];
}
