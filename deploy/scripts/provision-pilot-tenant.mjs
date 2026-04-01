#!/usr/bin/env node
/**
 * Calls POST /api/v1/support/tenants/provision with sensible defaults.
 *
 * Required env:
 *   API_BASE_URL   — e.g. https://api.example.com  (no trailing slash)
 *   SUPPORT_API_KEY — same as server SUPPORT_API_KEY
 *
 * Required args (or env):
 *   --tenant-name, --tenant-slug, --owner-email
 *
 * Optional:
 *   --branch-name (default Main), --branch-slug (default main)
 *   --timezone (default Europe/Istanbul), --currency (default TRY)
 *   --trial / --no-trial, --trial-days N
 *   --tables N (default 2), --no-sample-menu
 *   --owner-password (otherwise server generates one)
 *
 * Example:
 *   API_BASE_URL=http://localhost:3000 SUPPORT_API_KEY=secret node deploy/scripts/provision-pilot-tenant.mjs \\
 *     --tenant-name "Pilot Cafe" --tenant-slug pilot-cafe --owner-email owner@venue.com --trial
 */

import process from 'node:process';

function arg(name, def) {
  const i = process.argv.indexOf(name);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  if (v === undefined || v.startsWith('--')) return def;
  return v;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

const apiBase = (process.env.API_BASE_URL ?? '').replace(/\/$/, '');
const supportKey = process.env.SUPPORT_API_KEY ?? '';

const tenantName = arg('--tenant-name', process.env.TENANT_NAME);
const tenantSlug = arg('--tenant-slug', process.env.TENANT_SLUG);
const ownerEmail = arg('--owner-email', process.env.OWNER_EMAIL);
const branchName = arg('--branch-name', 'Main');
const branchSlug = arg('--branch-slug', 'main');
const timezone = arg('--timezone', 'Europe/Istanbul');
const currency = arg('--currency', 'TRY');
const tableCount = parseInt(arg('--tables', '2'), 10) || 2;
const trialDays = parseInt(arg('--trial-days', ''), 10);

if (!apiBase || !supportKey) {
  console.error('Set API_BASE_URL and SUPPORT_API_KEY.');
  process.exit(1);
}
if (!tenantName || !tenantSlug || !ownerEmail) {
  console.error(
    'Provide --tenant-name, --tenant-slug, --owner-email (or TENANT_NAME / TENANT_SLUG / OWNER_EMAIL).',
  );
  process.exit(1);
}

const body = {
  tenantName,
  tenantSlug,
  branchName,
  branchSlug,
  timezone,
  currency,
  ownerEmail,
  includeSampleMenu: !hasFlag('--no-sample-menu'),
  tableCount,
  trial: hasFlag('--trial') || process.env.TRIAL === '1',
};

const pw = arg('--owner-password', undefined);
if (pw) body.ownerPassword = pw;
if (Number.isFinite(trialDays) && trialDays > 0) body.trialDays = trialDays;

const url = `${apiBase}/api/v1/support/tenants/provision`;

async function main() {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-support-api-key': supportKey,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (!res.ok) {
    console.error('Provision failed:', res.status, json);
    process.exit(1);
  }
  console.log(JSON.stringify(json, null, 2));
  if (json.generatedPassword) {
    console.error(
      '\n[security] generatedPassword was returned once — store in your password manager and share via a secure channel.',
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
