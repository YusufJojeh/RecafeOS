/**
 * Growth-scale load — medium venue at peak dinner service.
 *
 * Models a busy ~25-table venue with 2 floors:
 *   - 24 floor/waiter staff devices polling simultaneously
 *   - 12 kitchen + bar screens at rapid poll interval
 *   - 4 cashier/manager devices pulling reports concurrently with writes
 *   - 8 write-path workers completing 48 full dine-in order lifecycles
 *
 * This is the "next tier" gate — run it before general availability and
 * after major infra changes (DB tier, API replica count, Redis sizing).
 * It is *not* a daily CI gate — use staging-pilot for that.
 *
 * Why thresholds are looser on write p95 (8s vs pilot's 5s):
 *   At 48 concurrent order lifecycles each polling the kitchen ticket queue,
 *   ticket advance naturally serialises somewhat. The important gate is
 *   growth_write_failures (< 16 of 48) and error rate (< 2%),
 *   not the raw write p95.
 *
 * Env: BASE_URL, JWT, BRANCH_ID
 * Optional: SKIP_REPORTS=1, SKIP_WRITES=1, TABLE_LABEL
 *
 * Run:
 *   k6 run --summary-export=ops/load/out/growth.json ops/load/growth-scale.k6.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import {
  api,
  authHeaders,
  tagName,
  ok200,
  runOrderLifecycle,
  standardSetup,
} from './lib/shared.js';

const skipWrites  = __ENV.SKIP_WRITES === '1';
const skipReports = __ENV.SKIP_REPORTS === '1';

const growthWriteFailures = new Counter('growth_write_failures');

// ── Options ────────────────────────────────────────────────────────────────────

const scenarios = {
  health_sustain: {
    executor: 'constant-vus',
    vus: 1,
    duration: '12m',
    exec: 'healthSustain',
    startTime: '0s',
  },
  floor_staff_heavy: {
    executor: 'constant-vus',
    vus: 24,
    duration: '10m',
    exec: 'floorStaff',
    startTime: '60s',  // let health run first
  },
  kitchen_bar_heavy: {
    executor: 'constant-vus',
    vus: 12,
    duration: '10m',
    exec: 'kitchenBar',
    startTime: '60s',
  },
};

if (!skipReports) {
  scenarios.report_concurrent = {
    executor: 'constant-vus',
    vus: 4,
    duration: '10m',
    exec: 'reportPulse',
    startTime: '60s',
  };
}

if (!skipWrites) {
  scenarios.order_writes = {
    executor: 'shared-iterations',
    vus: 8,
    iterations: 48,
    maxDuration: '11m',
    exec: 'orderLifecycle',
    startTime: '90s',  // start 30s after reads to warm the stack
  };
}

const thresholds = {
  http_req_failed: ['rate<0.02'],
  growth_write_failures: ['count<16'],  // max 1/3 of 48 iterations may fail
  'http_req_duration{name:health}': ['p(95)<500'],
  'http_req_duration{name:read}':   ['p(95)<1500', 'p(99)<4000'],
};

if (!skipWrites) {
  thresholds['http_req_duration{name:write}'] = ['p(95)<8000'];
}

export const options = {
  scenarios,
  thresholds,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// ── Setup ──────────────────────────────────────────────────────────────────────

export function setup() {
  return standardSetup(2);
}

// ── VU functions ───────────────────────────────────────────────────────────────

export function healthSustain() {
  const live = http.get(api('/health/live'), tagName('health'));
  check(live, { 'health live 200': ok200 });

  const ready = http.get(api('/health/ready'), tagName('health'));
  check(ready, { 'health ready 200': ok200 });

  sleep(2);
}

export function floorStaff() {
  const branchId = __ENV.BRANCH_ID;
  const headers = authHeaders();

  const tables = http.get(api(`/branches/${branchId}/tables`), { headers, ...tagName('read') });
  check(tables, { 'floor tables 200': ok200 });

  const orders = http.get(api(`/branches/${branchId}/orders?limit=80`), { headers, ...tagName('read') });
  check(orders, { 'open orders 200': ok200 });

  const menu = http.get(api(`/branches/${branchId}/menu/categories`), { headers, ...tagName('read') });
  check(menu, { 'menu categories 200': ok200 });

  // Tighter think time than pilot — simulates busier floor staff
  sleep(0.8 + Math.random() * 1.5);
}

export function kitchenBar() {
  const branchId = __ENV.BRANCH_ID;
  const headers = authHeaders();

  const k = http.get(
    api(`/branches/${branchId}/kitchen/tickets?station=KITCHEN`),
    { headers, ...tagName('read') },
  );
  check(k, { 'kitchen tickets 200': ok200 });

  const b = http.get(api(`/branches/${branchId}/bar/tickets`), { headers, ...tagName('read') });
  check(b, { 'bar tickets 200': ok200 });

  // Kitchen screens poll aggressively
  sleep(0.5 + Math.random() * 1);
}

export function reportPulse() {
  const branchId = __ENV.BRANCH_ID;

  // 4 VUs concurrently pulling reports while heavy write load is active.
  // Exercises the 2-layer cache (in-process Map + Redis L2).
  // Cache-hit requests should stay < 500ms; cold hits < 3s.
  const r = http.get(
    api(`/branches/${branchId}/reports/daily`),
    { headers: authHeaders(), ...tagName('read') },
  );
  check(r, { 'reports daily 200': ok200 });

  sleep(2 + Math.random() * 3);
}

export function orderLifecycle(data) {
  const success = runOrderLifecycle(data, growthWriteFailures);
  if (!success) return;
  sleep(1);
}
