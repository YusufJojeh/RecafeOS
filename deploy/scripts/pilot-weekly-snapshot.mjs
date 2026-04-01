#!/usr/bin/env node
/**
 * Weekly pilot health snapshot — calls support APIs and prints JSON or Markdown.
 *
 * Required env:
 *   API_BASE_URL    — e.g. https://api.example.com (no trailing slash)
 *   SUPPORT_API_KEY — read key (GET only)
 *
 * Optional:
 *   --format json|md   (default json)
 *   SLACK_WEBHOOK_URL  — if set with --format md, POSTs summary text to Slack Incoming Webhook
 *
 * Example:
 *   API_BASE_URL=http://localhost:3000 SUPPORT_API_KEY=secret node deploy/scripts/pilot-weekly-snapshot.mjs --format md
 */

import process from 'node:process';

function arg(name, def) {
  const i = process.argv.indexOf(name);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  if (v === undefined || v.startsWith('--')) return def;
  return v;
}

const apiBase = (process.env.API_BASE_URL ?? '').replace(/\/$/, '');
const supportKey = process.env.SUPPORT_API_KEY ?? '';
const format = (arg('--format', 'json') || 'json').toLowerCase();
const slackWebhookUrl = (process.env.SLACK_WEBHOOK_URL ?? '').trim();

if (!apiBase || !supportKey) {
  console.error('Set API_BASE_URL and SUPPORT_API_KEY.');
  process.exit(1);
}

async function supportGet(path) {
  const res = await fetch(`${apiBase}/api/v1${path}`, {
    headers: { 'x-support-api-key': supportKey },
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(
      typeof json === 'object' && json && json.message
        ? String(json.message)
        : `HTTP ${res.status}: ${text}`,
    );
  }
  return json;
}

function mdEscape(s) {
  if (s == null) return '';
  return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

try {
  const generatedAt = new Date().toISOString();
  const report = await supportGet('/support/pilots/weekly-report');

  const payload = {
    generatedAt,
    since: report.since,
    until: report.until,
    pilotCount: report.tenants?.length ?? 0,
    weeklyReport: report,
  };

  if (format === 'md') {
    const lines = [];
    lines.push(`# Pilot weekly snapshot`);
    lines.push('');
    lines.push(`Generated: ${generatedAt}`);
    lines.push(`Window: ${report.since} → ${report.until}`);
    lines.push('');
    lines.push(
      `| Venue | Health | Orders24h | New FB | Blockers | Support audits | Top themes |`,
    );
    lines.push(`| --- | --- | --- | --- | --- | --- | --- |`);
    const tenants = report.tenants ?? [];
    for (const t of tenants) {
      const themes = Object.entries(t.window?.feedbackByTheme ?? {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k, v]) => `${k}:${v}`)
        .join(', ');
      lines.push(
        `| ${mdEscape(t.name)} | ${mdEscape(t.pilot?.pilotHealth ?? '')} | ${mdEscape(t.summary?.ordersLast24h ?? '')} | ${t.window?.feedbackNewCount ?? 0} | ${t.window?.openBlockersCount ?? 0} | ${t.window?.supportAuditActionsCount ?? 0} | ${mdEscape(themes)} |`,
      );
    }
    lines.push('');
    lines.push('## Suggested health lines (automated)');
    for (const t of tenants) {
      const hs = t.healthSignals;
      if (!hs?.suggestedLines?.length) continue;
      lines.push('');
      lines.push(
        `### ${mdEscape(t.name)} (${mdEscape(hs.level)})`,
      );
      for (const line of hs.suggestedLines) {
        lines.push(`- ${mdEscape(line)}`);
      }
    }
    const md = lines.join('\n');
    console.log(md);

    if (slackWebhookUrl) {
      const slackRes = await fetch(slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Pilot weekly snapshot (${report.since} → ${report.until})\n${tenants.length} pilot tenant(s). See CI artifact or run script with --format md for full table.`,
        }),
      });
      if (!slackRes.ok) {
        const t = await slackRes.text();
        console.error('Slack webhook failed:', slackRes.status, t);
        process.exit(1);
      }
    }
  } else {
    console.log(JSON.stringify(payload, null, 2));
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
