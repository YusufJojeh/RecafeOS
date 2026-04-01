/**
 * Sustained soak test — 35-minute stability validation.
 *
 * Purpose: Catch resource leaks that only surface over time:
 *   - Postgres connection pool exhaustion (Prisma queueing / "too many clients")
 *   - Redis idle connection accumulation (Socket.IO adapter, idempotency TTL drift)
 *   - pino log buffer growth
 *   - Node.js heap creep under sustained request load
 *
 * Profile: 5-min ramp → 25-min steady at 15 VUs → 5-min ramp-down.
 * Write intensity is deliberately lighter than staging-pilot (8 order lifecycles
 * spread over 25 min vs 24 in 8 min) — the goal is sustained stability, not throughput.
 *
 * How to interpret:
 *   - Compare soak_early_failures vs soak_late_failures.
 *     Late >> Early → resource leak pattern.
 *   - Compare p95 in the first 5 min vs the last 5 min in the k6 JSON output.
 *     Degradation > 30% → leak or GC pressure.
 *   - Any soak_late_failures > 5 → do not release.
 *
 * Env: BASE_URL, JWT, BRANCH_ID
 * Optional: SKIP_WRITES=1, SKIP_REPORTS=1, TABLE_LABEL
 *
 * Run:
 *   k6 run --summary-export=ops/load/out/soak.json ops/load/soak-sustained.k6.js
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

// ── Phase-aware failure counters ───────────────────────────────────────────────
// Soak test is 35 min. Phases:
//   early:  0–10 min  (start + ramp)
//   mid:   10–25 min  (steady state)
//   late:  25–35 min  (late steady + ramp-down)
// If late >> early → degradation over time.

const soakEarlyFailures = new Counter('soak_early_failures');
const soakMidFailures   = new Counter('soak_mid_failures');
const soakLateFailures  = new Counter('soak_late_failures');
const soakWriteFailures = new Counter('soak_write_failures');

// Scenario start time in ms — set once at k6 init.
// k6 doesn't expose absolute time, so we track relative seconds via __ENV.
const PHASE_MID_S  = 600;   // 10 min
const PHASE_LATE_S = 1500;  // 25 min

function recordFailure(elapsedSeconds) {
  if (elapsedSeconds < PHASE_MID_S)       soakEarlyFailures.add(1);
  else if (elapsedSeconds < PHASE_LATE_S) soakMidFailures.add(1);
  else                                     soakLateFailures.add(1);
}

// k6 provides __VU iteration start via Date.now() relative to scenario start.
// We approximate elapsed time using a global variable set per VU on first call.
let _scenarioStartMs = null;
function elapsedSeconds() {
  if (_scenarioStartMs === null) _scenarioStartMs = Date.now();
  return (Date.now() - _scenarioStartMs) / 1000;
}

// ── Options ────────────────────────────────────────────────────────────────────

const scenarios = {
  health_sustain: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '5m', target: 1 },
      { duration: '25m', target: 1 },
      { duration: '5m', target: 0 },
    ],
    exec: 'healthSustain',
    startTime: '0s',
  },
  floor_staff: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '5m', target: 8 },
      { duration: '25m', target: 8 },
      { duration: '5m', target: 0 },
    ],
    exec: 'floorStaff',
    startTime: '0s',
  },
  kitchen_bar: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '5m', target: 4 },
      { duration: '25m', target: 4 },
      { duration: '5m', target: 0 },
    ],
    exec: 'kitchenBar',
    startTime: '0s',
  },
};

if (!skipReports) {
  scenarios.report_pulse = {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '5m', target: 2 },
      { duration: '25m', target: 2 },
      { duration: '5m', target: 0 },
    ],
    exec: 'reportPulse',
    startTime: '0s',
  };
}

if (!skipWrites) {
  // 8 order lifecycles spread across the 25-min steady window.
  scenarios.order_writes = {
    executor: 'shared-iterations',
    vus: 2,
    iterations: 8,
    maxDuration: '28m',
    exec: 'orderLifecycle',
    startTime: '7m',  // start after ramp is complete
  };
}

export const options = {
  scenarios,
  thresholds: {
    http_req_failed: ['rate<0.02'],
    // 25% looser than pilot — longer runtime means occasional slow outliers
    'http_req_duration{name:read}':  ['p(95)<2500'],
    'http_req_duration{name:write}': ['p(95)<6000'],
    'http_req_duration{name:health}':['p(95)<1000'],
    // Late failures > 5 indicates leak or saturation over time
    soak_late_failures: ['count<5'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// ── Setup ──────────────────────────────────────────────────────────────────────

export function setup() {
  return standardSetup(2);
}

// ── VU functions ───────────────────────────────────────────────────────────────

export function healthSustain() {
  const elapsed = elapsedSeconds();

  const live = http.get(api('/health/live'), tagName('health'));
  const liveOk = check(live, { 'health live 200': ok200 });
  if (!liveOk) recordFailure(elapsed);

  sleep(2);

  const ready = http.get(api('/health/ready'), tagName('health'));
  const readyOk = check(ready, { 'health ready 200': ok200 });
  if (!readyOk) recordFailure(elapsed);

  sleep(2);
}

export function floorStaff() {
  const elapsed = elapsedSeconds();
  const branchId = __ENV.BRANCH_ID;
  const headers = authHeaders();

  const tables = http.get(api(`/branches/${branchId}/tables`), { headers, ...tagName('read') });
  if (!check(tables, { 'floor tables 200': ok200 })) recordFailure(elapsed);

  const orders = http.get(api(`/branches/${branchId}/orders?limit=80`), { headers, ...tagName('read') });
  if (!check(orders, { 'open orders 200': ok200 })) recordFailure(elapsed);

  const menu = http.get(api(`/branches/${branchId}/menu/categories`), { headers, ...tagName('read') });
  if (!check(menu, { 'menu categories 200': ok200 })) recordFailure(elapsed);

  sleep(2 + Math.random() * 3);
}

export function kitchenBar() {
  const elapsed = elapsedSeconds();
  const branchId = __ENV.BRANCH_ID;
  const headers = authHeaders();

  const k = http.get(
    api(`/branches/${branchId}/kitchen/tickets?station=KITCHEN`),
    { headers, ...tagName('read') },
  );
  if (!check(k, { 'kitchen tickets 200': ok200 })) recordFailure(elapsed);

  const b = http.get(api(`/branches/${branchId}/bar/tickets`), { headers, ...tagName('read') });
  if (!check(b, { 'bar tickets 200': ok200 })) recordFailure(elapsed);

  sleep(2 + Math.random() * 3);
}

export function reportPulse() {
  const elapsed = elapsedSeconds();
  const branchId = __ENV.BRANCH_ID;

  const r = http.get(
    api(`/branches/${branchId}/reports/daily`),
    { headers: authHeaders(), ...tagName('read') },
  );
  if (!check(r, { 'reports daily 200': ok200 })) recordFailure(elapsed);

  // Sleep long enough to let cache TTL expire occasionally (tests cold path)
  sleep(5 + Math.random() * 10);
}

export function orderLifecycle(data) {
  const elapsed = elapsedSeconds();
  const success = runOrderLifecycle(data, null);
  if (!success) {
    soakWriteFailures.add(1);
    recordFailure(elapsed);
  }
  sleep(2);
}
