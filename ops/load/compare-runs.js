#!/usr/bin/env node
/**
 * compare-runs.js — Diff two k6 summary JSON exports and flag regressions.
 *
 * Usage:
 *   node ops/load/compare-runs.js \
 *     --baseline ops/load/out/baseline-2026-03.json \
 *     --current  ops/load/out/pilot-2026-03-23.json \
 *     --threshold 20
 *
 * Options:
 *   --baseline <path>    Path to the reference (older) summary.json
 *   --current  <path>    Path to the run being evaluated
 *   --threshold <n>      Percent degradation that triggers a non-zero exit (default: 20)
 *   --warn-only          Print warnings but always exit 0 (useful for early adoption)
 *   --json               Output machine-readable JSON instead of markdown table
 *
 * Exit codes:
 *   0  All metrics within threshold
 *   1  One or more metrics degraded beyond threshold
 *   2  Invalid arguments or file read error
 *
 * k6 summary.json structure:
 *   metrics["http_req_duration"].values["p(95)"]
 *   metrics["http_req_duration{name:read}"].values["p(95)"]
 *   metrics["http_req_failed"].values["rate"]
 *   metrics["pilot_write_failures"].values["count"]
 *   ... etc.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Argument parsing ───────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name, defaultVal) {
  const idx = args.indexOf(name);
  if (idx === -1) return defaultVal;
  return args[idx + 1];
}
const hasFlag = (f) => args.includes(f);

const baselinePath  = getArg('--baseline', null);
const currentPath   = getArg('--current',  null);
const thresholdPct  = parseFloat(getArg('--threshold', '20'));
const warnOnly      = hasFlag('--warn-only');
const jsonOutput    = hasFlag('--json');

if (!baselinePath || !currentPath) {
  console.error('Usage: node compare-runs.js --baseline <path> --current <path> [--threshold <n>] [--warn-only] [--json]');
  process.exit(2);
}

// ── Load files ─────────────────────────────────────────────────────────────────

function loadJson(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    console.error(`File not found: ${abs}`);
    process.exit(2);
  }
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (e) {
    console.error(`Failed to parse ${abs}: ${e.message}`);
    process.exit(2);
  }
}

const baseline = loadJson(baselinePath);
const current  = loadJson(currentPath);

// ── Metric extraction ──────────────────────────────────────────────────────────

/**
 * Extract a value from a k6 summary.json metrics object.
 * @param {object} summary - Parsed k6 summary JSON
 * @param {string} metricName - e.g. "http_req_duration{name:read}"
 * @param {string} stat - e.g. "p(95)", "rate", "count", "avg"
 * @returns {number|null}
 */
function extractMetric(summary, metricName, stat) {
  const m = summary.metrics && summary.metrics[metricName];
  if (!m) return null;
  const v = m.values && m.values[stat];
  return typeof v === 'number' ? v : null;
}

// ── Metrics to compare ─────────────────────────────────────────────────────────
// Each entry: { label, metric, stat, unit, higherIsBetter }

const COMPARISONS = [
  // Global error rate
  { label: 'Error rate (all)',             metric: 'http_req_failed',                          stat: 'rate',    unit: '%',   higherIsBetter: false, scale: 100 },

  // Tagged latencies — these only appear if the scripts used tagName()
  { label: 'Health p95',                   metric: 'http_req_duration{name:health}',            stat: 'p(95)',   unit: 'ms',  higherIsBetter: false },
  { label: 'Read p95',                     metric: 'http_req_duration{name:read}',              stat: 'p(95)',   unit: 'ms',  higherIsBetter: false },
  { label: 'Read p99',                     metric: 'http_req_duration{name:read}',              stat: 'p(99)',   unit: 'ms',  higherIsBetter: false },
  { label: 'Write p95',                    metric: 'http_req_duration{name:write}',             stat: 'p(95)',   unit: 'ms',  higherIsBetter: false },
  { label: 'Write p99',                    metric: 'http_req_duration{name:write}',             stat: 'p(99)',   unit: 'ms',  higherIsBetter: false },

  // Benchmark baselines
  { label: 'Baseline health p95',          metric: 'http_req_duration{name:baseline-health}',  stat: 'p(95)',   unit: 'ms',  higherIsBetter: false },
  { label: 'Baseline menu p95',            metric: 'http_req_duration{name:baseline-menu}',    stat: 'p(95)',   unit: 'ms',  higherIsBetter: false },
  { label: 'Baseline orders list p95',     metric: 'http_req_duration{name:baseline-orders-list}', stat: 'p(95)', unit: 'ms', higherIsBetter: false },
  { label: 'Baseline kitchen p95',         metric: 'http_req_duration{name:baseline-kitchen}', stat: 'p(95)',   unit: 'ms',  higherIsBetter: false },
  { label: 'Baseline reports p95',         metric: 'http_req_duration{name:baseline-reports}', stat: 'p(95)',   unit: 'ms',  higherIsBetter: false },
  { label: 'Baseline order create p95',    metric: 'http_req_duration{name:baseline-order-create}', stat: 'p(95)', unit: 'ms', higherIsBetter: false },
  { label: 'Baseline order close p95',     metric: 'http_req_duration{name:baseline-order-close}',  stat: 'p(95)', unit: 'ms', higherIsBetter: false },

  // Concurrency
  { label: 'Concurrent close p95',         metric: 'http_req_duration{name:concurrent-close}', stat: 'p(95)',   unit: 'ms',  higherIsBetter: false },
  { label: 'Concurrent close errors',      metric: 'concurrent_close_errors',                  stat: 'count',   unit: '',    higherIsBetter: false },

  // Custom counters
  { label: 'Pilot write failures',         metric: 'pilot_write_failures',                     stat: 'count',   unit: '',    higherIsBetter: false },
  { label: 'Growth write failures',        metric: 'growth_write_failures',                    stat: 'count',   unit: '',    higherIsBetter: false },
  { label: 'Soak late failures',           metric: 'soak_late_failures',                       stat: 'count',   unit: '',    higherIsBetter: false },
  { label: 'Soak early failures',          metric: 'soak_early_failures',                      stat: 'count',   unit: '',    higherIsBetter: false },

  // Overall duration (untagged)
  { label: 'All requests p95',             metric: 'http_req_duration',                        stat: 'p(95)',   unit: 'ms',  higherIsBetter: false },
  { label: 'All requests p99',             metric: 'http_req_duration',                        stat: 'p(99)',   unit: 'ms',  higherIsBetter: false },
];

// ── Comparison logic ───────────────────────────────────────────────────────────

const results = [];
let hasRegression = false;

for (const c of COMPARISONS) {
  const bv = extractMetric(baseline, c.metric, c.stat);
  const cv = extractMetric(current,  c.metric, c.stat);

  if (bv === null && cv === null) continue; // metric not present in either run

  const scale = c.scale || 1;
  const bScaled = bv !== null ? bv * scale : null;
  const cScaled = cv !== null ? cv * scale : null;

  let deltaPct = null;
  let status = 'OK';

  if (bScaled !== null && cScaled !== null && bScaled !== 0) {
    deltaPct = ((cScaled - bScaled) / bScaled) * 100;
    const improved = c.higherIsBetter ? deltaPct > 0 : deltaPct < 0;
    const degraded = c.higherIsBetter ? deltaPct < 0 : deltaPct > 0;

    if (degraded && Math.abs(deltaPct) >= thresholdPct) {
      status = 'FAIL';
      hasRegression = true;
    } else if (degraded && Math.abs(deltaPct) >= thresholdPct / 2) {
      status = 'WARN';
    } else if (improved) {
      status = 'IMPROVED';
    }
  } else if (bScaled === null) {
    status = 'NEW';
  } else if (cScaled === null) {
    status = 'MISSING';
  }

  results.push({
    label: c.label,
    baseline: bScaled,
    current: cScaled,
    deltaPct,
    unit: c.unit,
    status,
  });
}

// ── Output ─────────────────────────────────────────────────────────────────────

if (jsonOutput) {
  console.log(JSON.stringify({ threshold: thresholdPct, hasRegression, results }, null, 2));
} else {
  // Markdown table
  const fmt = (v, unit) => v === null ? 'N/A' : `${unit === '%' ? v.toFixed(2) : Math.round(v)}${unit}`;
  const fmtDelta = (d) => d === null ? 'N/A' : `${d > 0 ? '+' : ''}${d.toFixed(1)}%`;
  const statusIcon = (s) => ({ OK: '✓', IMPROVED: '↓', WARN: '⚠', FAIL: '✗', NEW: '~', MISSING: '?' }[s] || s);

  const col = (s, w) => s.toString().padEnd(w);
  const header = `| ${ col('Metric', 40) } | ${ col('Baseline', 12) } | ${ col('Current', 12) } | ${ col('Delta', 10) } | Status |`;
  const divider = `|${'-'.repeat(42)}|${'-'.repeat(14)}|${'-'.repeat(14)}|${'-'.repeat(12)}|--------|`;

  const filtered = results.filter((r) => r.status !== 'OK' || r.deltaPct !== null);

  console.log('');
  console.log(`## k6 Run Comparison (threshold: ±${thresholdPct}%)`);
  console.log(`Baseline: ${path.basename(baselinePath)}`);
  console.log(`Current:  ${path.basename(currentPath)}`);
  console.log('');
  console.log(header);
  console.log(divider);

  for (const r of filtered) {
    const icon = statusIcon(r.status);
    console.log(
      `| ${col(r.label, 40)} | ${col(fmt(r.baseline, r.unit), 12)} | ${col(fmt(r.current, r.unit), 12)} | ${col(fmtDelta(r.deltaPct), 10)} | ${icon} ${r.status.padEnd(5)} |`,
    );
  }

  console.log('');

  if (hasRegression) {
    console.log(`❌ REGRESSION DETECTED: one or more metrics degraded >${thresholdPct}% vs baseline.`);
    if (warnOnly) console.log('   (--warn-only: exiting 0 anyway)');
  } else {
    console.log(`✅ All metrics within ${thresholdPct}% of baseline.`);
  }
  console.log('');
}

process.exit(hasRegression && !warnOnly ? 1 : 0);
