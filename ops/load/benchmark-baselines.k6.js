/**
 * Benchmark baselines — isolated per-endpoint latency capture.
 *
 * Runs each hot path in strict isolation (1 VU, staggered start times)
 * so p95/p99 reflect pure endpoint cost without cross-contamination from
 * concurrent scenarios. Designed for:
 *   - Monthly baseline captures committed to ops/load/out/baseline-YYYY-MM.json
 *   - Pre/post optimization comparison via compare-runs.js
 *   - Detecting tail latency drift before it bleeds into p95
 *
 * Env: BASE_URL, JWT, BRANCH_ID
 * Optional: TABLE_LABEL (for write scenarios that create orders)
 *
 * Run:
 *   k6 run --summary-export=ops/load/out/benchmark.json ops/load/benchmark-baselines.k6.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  api,
  authHeaders,
  authHeadersBare,
  tagName,
  ok200,
  ok2xx,
  standardSetup,
  advanceAllTickets,
} from './lib/shared.js';

// Each scenario gets 30s warm, then 30s measurement, staggered to run one at a time.
// Write scenarios (order create, order close) run for 60s to accumulate enough samples.
export const options = {
  scenarios: {
    health_baseline: {
      executor: 'constant-vus',
      vus: 1,
      duration: '60s',
      startTime: '0s',
      exec: 'healthBaseline',
    },
    menu_baseline: {
      executor: 'constant-vus',
      vus: 1,
      duration: '60s',
      startTime: '65s',
      exec: 'menuBaseline',
    },
    orders_list_baseline: {
      executor: 'constant-vus',
      vus: 1,
      duration: '60s',
      startTime: '130s',
      exec: 'ordersListBaseline',
    },
    kitchen_baseline: {
      executor: 'constant-vus',
      vus: 1,
      duration: '60s',
      startTime: '195s',
      exec: 'kitchenBaseline',
    },
    reports_baseline: {
      executor: 'constant-vus',
      vus: 1,
      duration: '90s',
      startTime: '260s',
      exec: 'reportsBaseline',
    },
    order_create_baseline: {
      executor: 'constant-vus',
      vus: 1,
      duration: '90s',
      startTime: '355s',
      exec: 'orderCreateBaseline',
    },
    order_close_baseline: {
      executor: 'constant-vus',
      vus: 1,
      duration: '90s',
      startTime: '450s',
      exec: 'orderCloseBaseline',
    },
  },

  thresholds: {
    // Health — pure liveness, zero DB
    'http_req_duration{name:baseline-health}':        ['p(95)<50',   'p(99)<150'],
    // Menu — should benefit from menu cache
    'http_req_duration{name:baseline-menu}':          ['p(95)<200',  'p(99)<500'],
    // Open orders list — cursor-paginated, capped at 500
    'http_req_duration{name:baseline-orders-list}':   ['p(95)<300',  'p(99)<700'],
    // Kitchen tickets — station-filtered
    'http_req_duration{name:baseline-kitchen}':       ['p(95)<250',  'p(99)<600'],
    // Reports — 2-layer cache (in-process + Redis); cold hit < 3s, warm < 500ms
    'http_req_duration{name:baseline-reports}':       ['p(95)<2000', 'p(99)<5000'],
    // Single order create + 1 item (measures DB write + WS emit)
    'http_req_duration{name:baseline-order-create}':  ['p(95)<600',  'p(99)<1500'],
    // Full close-bill path under zero contention
    'http_req_duration{name:baseline-order-close}':   ['p(95)<1200', 'p(99)<2500'],
    // Overall error rate must stay near zero
    http_req_failed: ['rate<0.01'],
  },

  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

export function setup() {
  return standardSetup(2);
}

// ── Health ────────────────────────────────────────────────────────────────────

export function healthBaseline() {
  const live = http.get(api('/health/live'), tagName('baseline-health'));
  check(live, { 'health live 200': ok200 });

  sleep(0.5);

  const ready = http.get(api('/health/ready'), tagName('baseline-health'));
  check(ready, { 'health ready 200': ok200 });

  sleep(0.5);
}

// ── Menu categories ───────────────────────────────────────────────────────────

export function menuBaseline() {
  const r = http.get(
    api(`/branches/${__ENV.BRANCH_ID}/menu/categories`),
    { headers: authHeaders(), ...tagName('baseline-menu') },
  );
  check(r, { 'menu categories 200': ok200 });
  sleep(0.5);
}

// ── Open orders list ──────────────────────────────────────────────────────────

export function ordersListBaseline() {
  const r = http.get(
    api(`/branches/${__ENV.BRANCH_ID}/orders?limit=80`),
    { headers: authHeaders(), ...tagName('baseline-orders-list') },
  );
  check(r, { 'orders list 200': ok200 });
  sleep(0.5);
}

// ── Kitchen tickets ───────────────────────────────────────────────────────────

export function kitchenBaseline() {
  const k = http.get(
    api(`/branches/${__ENV.BRANCH_ID}/kitchen/tickets?station=KITCHEN`),
    { headers: authHeaders(), ...tagName('baseline-kitchen') },
  );
  check(k, { 'kitchen tickets 200': ok200 });

  sleep(0.3);

  const b = http.get(
    api(`/branches/${__ENV.BRANCH_ID}/bar/tickets`),
    { headers: authHeaders(), ...tagName('baseline-kitchen') },
  );
  check(b, { 'bar tickets 200': ok200 });

  sleep(0.5);
}

// ── Daily report (cache-hit + cold interleaved) ───────────────────────────────

export function reportsBaseline() {
  // First call within the 90s window may be cold; subsequent calls hit cache.
  // The p99 threshold (5000ms) accommodates the cold hit; p95 (2000ms) should
  // reflect the cached majority once the cache warms after the first iteration.
  const r = http.get(
    api(`/branches/${__ENV.BRANCH_ID}/reports/daily`),
    { headers: authHeaders(), ...tagName('baseline-reports') },
  );
  check(r, { 'reports daily 200': ok200 });
  // Sleep longer than cache TTL occasionally to test cold hits
  sleep(__ITER % 5 === 0 ? 15 : 3);
}

// ── Order create (isolated write: DINE_IN, no lifecycle completion) ────────────

export function orderCreateBaseline(data) {
  if (!data || !data.ok || !data.tables || data.tables.length === 0) {
    console.warn('orderCreateBaseline: no setup data, skip');
    return;
  }

  const branchId = __ENV.BRANCH_ID;
  const table = data.tables[__ITER % data.tables.length];

  // Open a session if needed
  let sessionId = table.sessions && table.sessions[0] && table.sessions[0].id;
  if (!sessionId) {
    const open = http.post(
      api(`/branches/${branchId}/tables/sessions`),
      JSON.stringify({ floorTableId: table.id, guestCount: 1 }),
      { headers: authHeaders(), ...tagName('baseline-order-create') },
    );
    if (!ok2xx(open)) { console.warn(`orderCreateBaseline: session open failed ${open.status}`); return; }
    sessionId = JSON.parse(open.body).id;
  }

  // Measure order creation in isolation
  const create = http.post(
    api(`/branches/${branchId}/orders`),
    JSON.stringify({ type: 'DINE_IN', tableSessionId: sessionId }),
    { headers: authHeaders(), ...tagName('baseline-order-create') },
  );
  check(create, { 'order create 2xx': ok2xx });

  if (ok2xx(create) && data.menuItemIds && data.menuItemIds.length > 0) {
    const orderId = JSON.parse(create.body).id;
    const add = http.post(
      api(`/branches/${branchId}/orders/${orderId}/items`),
      JSON.stringify({ menuItemId: data.menuItemIds[0], quantity: 1 }),
      { headers: authHeaders(), ...tagName('baseline-order-create') },
    );
    check(add, { 'order add item 2xx': ok2xx });

    // Cancel the draft — we only care about create latency, not full lifecycle
    http.post(
      api(`/branches/${branchId}/orders/${orderId}/cancel`),
      JSON.stringify({ reason: 'customer_request' }),
      { headers: authHeaders() },
    );
  }

  sleep(1);
}

// ── Order close (full lifecycle to SERVED, then measure close-bill) ───────────

export function orderCloseBaseline(data) {
  if (!data || !data.ok || !data.tables || data.tables.length === 0) {
    console.warn('orderCloseBaseline: no setup data, skip');
    return;
  }

  const branchId = __ENV.BRANCH_ID;
  const table = data.tables[__ITER % data.tables.length];

  let sessionId = table.sessions && table.sessions[0] && table.sessions[0].id;
  if (!sessionId) {
    const open = http.post(
      api(`/branches/${branchId}/tables/sessions`),
      JSON.stringify({ floorTableId: table.id, guestCount: 2 }),
      { headers: authHeaders() },
    );
    if (!ok2xx(open)) { console.warn(`orderCloseBaseline: session open failed ${open.status}`); return; }
    sessionId = JSON.parse(open.body).id;
  }

  const create = http.post(
    api(`/branches/${branchId}/orders`),
    JSON.stringify({ type: 'DINE_IN', tableSessionId: sessionId }),
    { headers: authHeaders() },
  );
  if (!ok2xx(create)) { console.warn(`orderCloseBaseline: create failed ${create.status}`); return; }
  const orderId = JSON.parse(create.body).id;

  if (data.menuItemIds && data.menuItemIds.length > 0) {
    http.post(
      api(`/branches/${branchId}/orders/${orderId}/items`),
      JSON.stringify({ menuItemId: data.menuItemIds[0], quantity: 1 }),
      { headers: authHeaders() },
    );
  }

  http.post(api(`/branches/${branchId}/orders/${orderId}/confirm`), null, { headers: authHeadersBare() });
  http.post(api(`/branches/${branchId}/orders/${orderId}/send-to-preparation`), null, { headers: authHeadersBare() });
  advanceAllTickets(orderId);
  http.post(api(`/branches/${branchId}/orders/${orderId}/served`), null, { headers: authHeadersBare() });

  // This is the measured operation — close-bill with unique idempotency key
  const idem = `k6-baseline-${orderId}-${Date.now()}-${__VU}-${__ITER}`;
  const close = http.post(
    api(`/branches/${branchId}/orders/${orderId}/close`),
    JSON.stringify({ method: 'CASH' }),
    { headers: { ...authHeaders(), 'idempotency-key': idem }, ...tagName('baseline-order-close') },
  );
  check(close, { 'order close 200': ok200 });

  sleep(1);
}
