#!/usr/bin/env node
/**
 * Guarded PATCH to support tenant commerce or metadata (server audit trail unchanged).
 *
 * Required env:
 *   API_BASE_URL     — e.g. https://api.example.com (no trailing slash)
 *   SUPPORT_API_KEY  — write key when using SUPPORT_API_KEY_READ/WRITE split
 *
 * Usage (note: use a space after --tenant-id and --file, or our argv parser may not see values):
 *   node deploy/scripts/support-guarded-patch.mjs commerce --tenant-id CUID --file commerce.json --confirm
 *   node deploy/scripts/support-guarded-patch.mjs metadata --tenant-id CUID --file metadata.json --confirm
 *   node deploy/scripts/support-guarded-patch.mjs plan --tenant-id CUID --file plan.json --confirm
 *     (plan.json: {"subscriptionPlan":"growth"} only)
 *
 * commerce.json — top-level fields only, e.g.
 *   {"subscriptionPlan":"growth","billingStatus":"active","maxBranches":3}
 *
 * metadata.json — shallow merge payload:
 *   {"metadata":{"commercialEngagement":"pilot","pilotPhase":"live"}}
 *
 * Optional: SUPPORT_OPERATOR env → sent as x-support-operator (audit trace).
 */

import fs from 'node:fs';
import process from 'node:process';

const ALLOWED_COMMERCE = new Set([
  'subscriptionPlan',
  'billingStatus',
  'trialEndsAt',
  'currentPeriodEnd',
  'maxBranches',
  'maxUsers',
  'stripeCustomerId',
  'stripeSubscriptionId',
]);

function arg(name, def) {
  const i = process.argv.indexOf(name);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  if (v === undefined || v.startsWith('--')) return def;
  return v;
}

const mode = process.argv[2];
const tenantId = arg('--tenant-id', '');
const file = arg('--file', '');
const confirm = process.argv.includes('--confirm');

const apiBase = (process.env.API_BASE_URL ?? '').replace(/\/$/, '');
const supportKey = process.env.SUPPORT_API_KEY ?? '';

if (!apiBase || !supportKey) {
  console.error('Set API_BASE_URL and SUPPORT_API_KEY.');
  process.exit(1);
}
if (!tenantId || !file) {
  console.error(
    'Usage: node deploy/scripts/support-guarded-patch.mjs <commerce|metadata> --tenant-id=... --file=...json [--confirm]',
  );
  process.exit(1);
}
if (!confirm) {
  console.warn(
    'Dry-run only. Review the output, then re-run with --confirm to PATCH.',
  );
}

let raw;
try {
  raw = fs.readFileSync(file, 'utf8');
} catch (e) {
  console.error('Could not read file:', e?.message ?? e);
  process.exit(1);
}
let body;
try {
  body = JSON.parse(raw);
} catch (e) {
  console.error('Invalid JSON:', e?.message ?? e);
  process.exit(1);
}

let patchBody = body;

if (mode === 'commerce') {
  for (const k of Object.keys(body)) {
    if (!ALLOWED_COMMERCE.has(k)) {
      console.error(`Disallowed commerce key: ${k}`);
      process.exit(1);
    }
  }
} else if (mode === 'metadata') {
  if (!body.metadata || typeof body.metadata !== 'object' || Array.isArray(body.metadata)) {
    console.error('metadata file must be JSON with a top-level "metadata" object.');
    process.exit(1);
  }
} else if (mode === 'plan') {
  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== 'subscriptionPlan') {
    console.error('plan mode: JSON must be exactly {"subscriptionPlan":"trial"|"starter"|"growth"|"scale"}');
    process.exit(1);
  }
  const allowedPlans = new Set(['trial', 'starter', 'growth', 'scale']);
  if (!allowedPlans.has(body.subscriptionPlan)) {
    console.error('Invalid subscriptionPlan value.');
    process.exit(1);
  }
  patchBody = { subscriptionPlan: body.subscriptionPlan };
} else {
  console.error('First argument must be: commerce | metadata | plan');
  process.exit(1);
}

const path =
  mode === 'commerce' || mode === 'plan'
    ? `${apiBase}/api/v1/support/tenants/${tenantId}/commerce`
    : `${apiBase}/api/v1/support/tenants/${tenantId}/metadata`;

console.log('Target:', path);
console.log('Body:', JSON.stringify(patchBody, null, 2));

if (!confirm) {
  process.exit(0);
}

const res = await fetch(path, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'x-support-api-key': supportKey,
    ...(process.env.SUPPORT_OPERATOR
      ? { 'x-support-operator': process.env.SUPPORT_OPERATOR }
      : {}),
  },
  body: JSON.stringify(patchBody),
});

const text = await res.text();
console.log(res.status, text);
if (!res.ok) process.exit(1);
