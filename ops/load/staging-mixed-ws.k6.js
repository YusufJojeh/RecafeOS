/**
 * Mixed HTTP + Engine.IO (Socket.IO) transport load — beyond pilot k6 scope.
 *
 * - Sustained branch-scoped reads (floor, kitchen/bar, optional reports) like staging-pilot.
 * - Parallel Engine.IO long-polling handshakes to `/socket.io/` to stress the realtime stack
 *   alongside REST (browser clients use polling+websocket; this exercises server-side polling).
 *
 * Full persistent WebSocket sessions with JWT auth require a dedicated client (e.g. k6 xk6
 * extensions or Artillery). This script still catches regressions when realtime + API compete.
 *
 * Env: BASE_URL, JWT, BRANCH_ID (same as staging-pilot.k6.js)
 * Optional: SKIP_REPORTS=1
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const base = __ENV.BASE_URL || 'http://localhost:3000';
const token = __ENV.JWT || '';
const branchId = __ENV.BRANCH_ID || '';
const skipReports = __ENV.SKIP_REPORTS === '1';

const scenarios = {
  health_sustain: {
    executor: 'constant-vus',
    vus: 1,
    duration: '5m',
    exec: 'healthSustain',
    startTime: '0s',
  },
  floor_staff_heavy: {
    executor: 'constant-vus',
    vus: 18,
    duration: '5m',
    exec: 'floorStaff',
    startTime: '0s',
  },
  kitchen_bar_heavy: {
    executor: 'constant-vus',
    vus: 10,
    duration: '5m',
    exec: 'kitchenBar',
    startTime: '0s',
  },
  engine_io_polling: {
    executor: 'constant-vus',
    vus: 12,
    duration: '5m',
    exec: 'engineIoPolling',
    startTime: '0s',
  },
};

if (!skipReports) {
  scenarios.report_pulse = {
    executor: 'constant-vus',
    vus: 3,
    duration: '5m',
    exec: 'reportPulse',
    startTime: '0s',
  };
}

export const options = {
  scenarios,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    'http_req_duration{name:health}': ['p(95)<1200'],
    'http_req_duration{name:read}': ['p(95)<3000'],
    'http_req_duration{name:realtime}': ['p(95)<2500'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

function api(path) {
  return `${base}/api/v1${path}`;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${token}`,
    'X-Branch-Id': branchId,
    'Content-Type': 'application/json',
  };
}

function tagName(name) {
  return { tags: { name } };
}

function ok200(r) {
  return r.status === 200;
}

export function healthSustain() {
  const live = http.get(api('/health/live'), tagName('health'));
  check(live, { 'health live 200': ok200 });
  const ready = http.get(api('/health/ready'), tagName('health'));
  check(ready, { 'health ready 200': ok200 });
  sleep(2);
}

export function floorStaff() {
  if (!token || !branchId) return;
  const headers = authHeaders();

  const tables = http.get(api(`/branches/${branchId}/tables`), {
    headers,
    ...tagName('read'),
  });
  check(tables, { 'floor tables 200': ok200 });

  const orders = http.get(api(`/branches/${branchId}/orders?limit=80`), {
    headers,
    ...tagName('read'),
  });
  check(orders, { 'open orders 200': ok200 });

  const menu = http.get(api(`/branches/${branchId}/menu/categories`), {
    headers,
    ...tagName('read'),
  });
  check(menu, { 'menu categories 200': ok200 });

  sleep(0.8 + Math.random() * 1.5);
}

export function kitchenBar() {
  if (!token || !branchId) return;
  const headers = authHeaders();

  const k = http.get(
    api(`/branches/${branchId}/kitchen/tickets?station=KITCHEN`),
    { headers, ...tagName('read') },
  );
  check(k, { 'kitchen tickets 200': ok200 });

  const b = http.get(api(`/branches/${branchId}/bar/tickets`), {
    headers,
    ...tagName('read'),
  });
  check(b, { 'bar tickets 200': ok200 });

  sleep(0.8 + Math.random() * 1.5);
}

export function reportPulse() {
  if (!token || !branchId) return;
  const headers = authHeaders();
  const r = http.get(api(`/branches/${branchId}/reports/daily`), {
    headers,
    ...tagName('read'),
  });
  check(r, { 'reports daily 200': ok200 });
  sleep(2 + Math.random() * 2);
}

/**
 * Engine.IO polling transport (Socket.IO). Opens new sessions repeatedly — server must parse
 * and respond; overlaps with REST scenarios to mimic busy branch + reconnect churn.
 */
export function engineIoPolling() {
  const url = `${base.replace(/\/$/, '')}/socket.io/?EIO=4&transport=polling`;
  const res = http.get(url, {
    ...tagName('realtime'),
    headers: {
      Accept: '*/*',
    },
  });
  check(res, {
    'engine.io poll 2xx': (r) => r.status >= 200 && r.status < 300,
  });
  sleep(0.25 + Math.random() * 0.75);
}
