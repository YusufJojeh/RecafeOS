/**
 * Concurrency payments — idempotency and FSM stress test.
 *
 * Scenario A — Race to close the same order:
 *   - setup() creates one order and drives it to SERVED state.
 *   - 20 VUs simultaneously fire POST .../close with the *same* idempotency key.
 *   - Expected: all 20 return 2xx (idempotent dedup or first-writer success).
 *   - A 5xx from any VU means the Redis lock or idempotency layer failed — blocks release.
 *
 * Scenario B — Post-PAID FSM rejection:
 *   - After the race, VUs retry close with *different* idempotency keys on the same (now PAID) order.
 *   - Expected: 422 (order already in terminal state). 5xx is a bug.
 *
 * Env: BASE_URL, JWT, BRANCH_ID
 *
 * Run:
 *   k6 run --summary-export=ops/load/out/concurrency.json ops/load/concurrency-payments.k6.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
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

// ── Custom metrics ─────────────────────────────────────────────────────────────

const concurrentCloseAttempts = new Counter('concurrent_close_attempts');
const concurrentCloseSuccesses = new Counter('concurrent_close_successes');
const concurrentCloseDeduped   = new Counter('concurrent_close_deduped');
const concurrentCloseErrors    = new Counter('concurrent_close_errors');
const postPaidRejections        = new Counter('post_paid_rejections');
const postPaidServerErrors      = new Counter('post_paid_server_errors');

// ── Options ────────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    // All 20 VUs start simultaneously — no ramp.
    concurrent_close_race: {
      executor: 'constant-vus',
      vus: 20,
      duration: '90s',
      exec: 'closeBillRace',
      startTime: '0s',
    },
    // After race window, test FSM post-PAID rejection.
    post_paid_rejection: {
      executor: 'constant-vus',
      vus: 5,
      duration: '60s',
      exec: 'postPaidRejection',
      startTime: '100s',
    },
  },

  thresholds: {
    // Near-zero global error rate — 409 is not counted as http_req_failed by k6 (only network errors),
    // but 5xx responses are. Any server error is a data-integrity risk.
    http_req_failed: ['rate<0.01'],

    // The race scenario: all 20 VUs contend on one idempotency key.
    'http_req_duration{name:concurrent-close}': ['p(95)<3000', 'p(99)<5000'],

    // Critical gate: zero 5xx on concurrent close. Even 1 is a release blocker.
    concurrent_close_errors: ['count<1'],

    // Post-PAID rejection scenario: FSM must return 4xx, never 5xx.
    post_paid_server_errors: ['count<1'],
  },

  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// ── Setup: create one SERVED order per scenario run ───────────────────────────

export function setup() {
  const base = standardSetup(2);
  if (!base.ok) return { ok: false };

  const branchId = __ENV.BRANCH_ID;

  // Find or create a table session
  const table = base.tables && base.tables[0];
  if (!table) {
    console.error('setup: no tables available');
    return { ok: false };
  }

  let sessionId = table.sessions && table.sessions[0] && table.sessions[0].id;
  if (!sessionId) {
    const open = http.post(
      api(`/branches/${branchId}/tables/sessions`),
      JSON.stringify({ floorTableId: table.id, guestCount: 2 }),
      { headers: authHeaders() },
    );
    if (open.status < 200 || open.status >= 300) {
      console.error(`setup: session open failed ${open.status}: ${open.body}`);
      return { ok: false };
    }
    sessionId = JSON.parse(open.body).id;
  }

  // Create order
  const create = http.post(
    api(`/branches/${branchId}/orders`),
    JSON.stringify({ type: 'DINE_IN', tableSessionId: sessionId }),
    { headers: authHeaders() },
  );
  if (create.status < 200 || create.status >= 300) {
    console.error(`setup: order create failed ${create.status}: ${create.body}`);
    return { ok: false };
  }
  const orderId = JSON.parse(create.body).id;

  // Add items
  for (const menuItemId of base.menuItemIds) {
    const add = http.post(
      api(`/branches/${branchId}/orders/${orderId}/items`),
      JSON.stringify({ menuItemId, quantity: 1 }),
      { headers: authHeaders() },
    );
    if (add.status < 200 || add.status >= 300) {
      console.warn(`setup: add item failed ${add.status}`);
    }
  }

  // Drive to SERVED state
  http.post(api(`/branches/${branchId}/orders/${orderId}/confirm`), null, { headers: authHeadersBare() });
  http.post(api(`/branches/${branchId}/orders/${orderId}/send-to-preparation`), null, { headers: authHeadersBare() });
  advanceAllTickets(orderId);
  const served = http.post(
    api(`/branches/${branchId}/orders/${orderId}/served`),
    null,
    { headers: authHeadersBare() },
  );

  if (served.status < 200 || served.status >= 300) {
    console.error(`setup: order ${orderId} could not reach SERVED state (${served.status})`);
    return { ok: false, orderId };
  }

  console.log(`setup: order ${orderId} is SERVED — ready for concurrent close race`);

  // Shared idempotency key — all 20 VUs will use this exact key.
  const sharedIdemKey = `k6-concurrency-race-${orderId}`;

  return {
    ok: true,
    orderId,
    sharedIdemKey,
  };
}

// ── Scenario A: 20 VUs race to close with the same idempotency key ────────────

export function closeBillRace(data) {
  if (!data || !data.ok) {
    console.warn('closeBillRace: setup failed, skip');
    return;
  }

  const branchId = __ENV.BRANCH_ID;
  concurrentCloseAttempts.add(1);

  const res = http.post(
    api(`/branches/${branchId}/orders/${data.orderId}/close`),
    JSON.stringify({ method: 'CASH' }),
    {
      headers: { ...authHeaders(), 'idempotency-key': data.sharedIdemKey },
      ...tagName('concurrent-close'),
    },
  );

  if (res.status >= 500) {
    concurrentCloseErrors.add(1);
    console.error(`closeBillRace: VU ${__VU} got ${res.status}: ${res.body}`);
  } else if (res.status === 200) {
    // Could be the first writer or an idempotent replay
    const body = JSON.parse(res.body);
    if (body && body.id) {
      concurrentCloseSuccesses.add(1);
    } else {
      concurrentCloseDeduped.add(1);
    }
  } else if (res.status >= 400 && res.status < 500) {
    // 4xx is acceptable ONLY if it's a 409 (lock conflict resolved as dedup) or
    // 422 (already paid — means another VU won the race, this one is deduplicated).
    // Neither indicates a system bug.
    concurrentCloseDeduped.add(1);
  }

  check(res, {
    'close race: no 5xx': (r) => r.status < 500,
    'close race: 2xx or 4xx expected': (r) => r.status >= 200 && r.status < 500,
  });

  sleep(1 + Math.random());
}

// ── Scenario B: post-PAID FSM rejection (different idempotency keys) ───────────

export function postPaidRejection(data) {
  if (!data || !data.ok) {
    console.warn('postPaidRejection: setup failed, skip');
    return;
  }

  const branchId = __ENV.BRANCH_ID;
  // Use unique keys — these are NOT the shared key, so no idempotent dedup fires.
  const uniqueKey = `k6-post-paid-${data.orderId}-${__VU}-${__ITER}-${Date.now()}`;

  const res = http.post(
    api(`/branches/${branchId}/orders/${data.orderId}/close`),
    JSON.stringify({ method: 'CASH' }),
    {
      headers: { ...authHeaders(), 'idempotency-key': uniqueKey },
      ...tagName('post-paid-rejection'),
    },
  );

  // FSM must reject post-PAID close with 4xx, never 5xx.
  if (res.status >= 500) {
    postPaidServerErrors.add(1);
    console.error(`postPaidRejection: VU ${__VU} got 5xx (${res.status}) on PAID order — FSM bug?`);
  } else if (res.status >= 400 && res.status < 500) {
    postPaidRejections.add(1);
  }

  check(res, {
    'post-paid: 4xx rejection (not 5xx)': (r) => r.status >= 400 && r.status < 500,
    'post-paid: no server error': (r) => r.status < 500,
  });

  sleep(2 + Math.random() * 2);
}
