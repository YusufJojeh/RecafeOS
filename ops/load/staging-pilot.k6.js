/**
 * Pilot-scale staging load: floor polling, kitchen/bar reads, optional full order write path.
 *
 * Env: BASE_URL, JWT, BRANCH_ID
 * Optional: SKIP_WRITES=1 (read-only), SKIP_REPORTS=1 (no GET reports/daily — use if JWT lacks reports.view),
 * TABLE_LABEL=T2 (prefer this table when opening sessions)
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const writeFailures = new Counter('pilot_write_failures');

const base = __ENV.BASE_URL || 'http://localhost:3000';
const token = __ENV.JWT || '';
const branchId = __ENV.BRANCH_ID || '';
const tableLabelPref = (__ENV.TABLE_LABEL || 'T2').trim();
const skipWrites = __ENV.SKIP_WRITES === '1';
const skipReports = __ENV.SKIP_REPORTS === '1';

const scenarios = {
  health_sustain: {
    executor: 'constant-vus',
    vus: 1,
    duration: '5m',
    exec: 'healthSustain',
    startTime: '0s',
  },
  floor_staff: {
    executor: 'constant-vus',
    vus: 12,
    duration: '5m',
    exec: 'floorStaff',
    startTime: '0s',
  },
  kitchen_bar: {
    executor: 'constant-vus',
    vus: 6,
    duration: '5m',
    exec: 'kitchenBar',
    startTime: '0s',
  },
};

if (!skipReports) {
  scenarios.report_pulse = {
    executor: 'constant-vus',
    vus: 2,
    duration: '5m',
    exec: 'reportPulse',
    startTime: '0s',
  };
}

if (!skipWrites) {
  scenarios.order_writes = {
    executor: 'shared-iterations',
    vus: 4,
    iterations: 24,
    maxDuration: '8m',
    exec: 'orderLifecycle',
    startTime: '10s',
  };
}

const thresholds = {
  http_req_failed: ['rate<0.02'],
  pilot_write_failures: ['count<8'],
  'http_req_duration{name:health}': ['p(95)<800'],
  'http_req_duration{name:read}': ['p(95)<2000'],
};

if (!skipWrites) {
  thresholds['http_req_duration{name:write}'] = ['p(95)<5000'];
}

export const options = {
  scenarios,
  thresholds,
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

/** Same auth without JSON content-type (empty-body POSTs). */
function authHeadersBare() {
  return {
    Authorization: `Bearer ${token}`,
    'X-Branch-Id': branchId,
  };
}

function tagName(name) {
  return { tags: { name } };
}

/** @param {import('k6/http').RefinedResponse<ResponseType | undefined>} r */
function ok200(r) {
  return r.status === 200;
}

function ok2xx(r) {
  return r.status >= 200 && r.status < 300;
}

export function setup() {
  if (!token || !branchId) {
    console.warn('Set JWT and BRANCH_ID for meaningful results.');
    return { ok: false };
  }

  const headers = authHeaders();
  const menuRes = http.get(
    api(`/branches/${branchId}/menu/categories`),
    { headers, ...tagName('read') },
  );
  if (menuRes.status !== 200) {
    console.error(`setup: menu/categories failed ${menuRes.status}`);
    return { ok: false, menuError: true };
  }

  const categories = JSON.parse(menuRes.body);
  const menuItemIds = [];
  for (const c of categories) {
    const items = c.items || [];
    for (const i of items) {
      if (menuItemIds.length < 2) {
        menuItemIds.push(i.id);
      }
      if (menuItemIds.length >= 2) break;
    }
    if (menuItemIds.length >= 2) break;
  }

  const tablesRes = http.get(api(`/branches/${branchId}/tables`), {
    headers,
    ...tagName('read'),
  });
  if (tablesRes.status !== 200) {
    console.error(`setup: tables failed ${tablesRes.status}`);
    return { ok: false, tablesError: true };
  }

  const tables = JSON.parse(tablesRes.body);
  return {
    ok: menuItemIds.length >= 1,
    menuItemIds,
    tables,
    tableLabelPref,
  };
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

  sleep(1 + Math.random() * 2);
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

  sleep(1 + Math.random() * 2);
}

export function reportPulse() {
  if (!token || !branchId) return;
  const headers = authHeaders();
  const r = http.get(api(`/branches/${branchId}/reports/daily`), {
    headers,
    ...tagName('read'),
  });
  check(r, { 'reports daily 200': ok200 });
  sleep(3 + Math.random() * 3);
}

const ticketNext = {
  NEW: 'ACCEPTED',
  ACCEPTED: 'PREPARING',
  PREPARING: 'READY',
  READY: 'DELIVERED',
};

function patchTicket(headers, ticketId, station, body) {
  const seg = station === 'BAR' ? 'bar' : 'kitchen';
  return http.patch(
    api(`/branches/${branchId}/${seg}/tickets/${ticketId}`),
    JSON.stringify(body),
    { headers, ...tagName('write') },
  );
}

function advanceAllTicketsForOrder(headers, orderId) {
  for (let round = 0; round < 30; round++) {
    const kRes = http.get(
      api(`/branches/${branchId}/kitchen/tickets?station=KITCHEN`),
      { headers, ...tagName('read') },
    );
    const bRes = http.get(api(`/branches/${branchId}/bar/tickets`), {
      headers,
      ...tagName('read'),
    });
    if (kRes.status !== 200 || bRes.status !== 200) {
      return false;
    }
    const kitchenTickets = JSON.parse(kRes.body);
    const barTickets = JSON.parse(bRes.body);
    const mine = [...kitchenTickets, ...barTickets].filter(
      (t) => t.order && t.order.id === orderId,
    );
    if (mine.length === 0) {
      sleep(0.3);
      continue;
    }
    const undelivered = mine.filter((t) => t.status !== 'DELIVERED');
    if (undelivered.length === 0) {
      return true;
    }
    const t = undelivered[0];
    const n = ticketNext[t.status];
    if (!n) {
      return false;
    }
    const pr = patchTicket(headers, t.id, t.station, { status: n });
    if (!ok2xx(pr)) {
      return false;
    }
  }
  return false;
}

function pickTable(tables, data) {
  if (!tables || tables.length === 0) return null;
  const pref = tables.find((t) => t.label === data.tableLabelPref);
  const idx = (Number(__VU) + Number(__ITER) * 13) % tables.length;
  return pref || tables[idx];
}

export function orderLifecycle(data) {
  if (!token || !branchId) {
    return;
  }
  if (!data || !data.ok || !data.menuItemIds || data.menuItemIds.length < 1) {
    console.warn('orderLifecycle: setup did not provide menu items; skip');
    return;
  }

  const headers = authHeaders();
  const tables = data.tables || [];
  const table = pickTable(tables, data);
  if (!table) {
    writeFailures.add(1);
    return;
  }

  let sessionId = table.sessions && table.sessions[0] && table.sessions[0].id;
  if (!sessionId) {
    const open = http.post(
      api(`/branches/${branchId}/tables/sessions`),
      JSON.stringify({
        floorTableId: table.id,
        guestCount: 2,
      }),
      { headers, ...tagName('write') },
    );
    if (!ok2xx(open)) {
      writeFailures.add(1);
      return;
    }
    sessionId = JSON.parse(open.body).id;
  }

  const create = http.post(
    api(`/branches/${branchId}/orders`),
    JSON.stringify({
      type: 'DINE_IN',
      tableSessionId: sessionId,
    }),
    { headers, ...tagName('write') },
  );
  if (!ok2xx(create)) {
    writeFailures.add(1);
    return;
  }
  const orderId = JSON.parse(create.body).id;

  for (const menuItemId of data.menuItemIds) {
    const add = http.post(
      api(`/branches/${branchId}/orders/${orderId}/items`),
      JSON.stringify({ menuItemId, quantity: 1 }),
      { headers, ...tagName('write') },
    );
    if (!ok2xx(add)) {
      writeFailures.add(1);
      return;
    }
  }

  const conf = http.post(
    api(`/branches/${branchId}/orders/${orderId}/confirm`),
    null,
    { headers: authHeadersBare(), ...tagName('write') },
  );
  if (!ok2xx(conf)) {
    writeFailures.add(1);
    return;
  }

  const prep = http.post(
    api(`/branches/${branchId}/orders/${orderId}/send-to-preparation`),
    null,
    { headers: authHeadersBare(), ...tagName('write') },
  );
  if (!ok2xx(prep)) {
    writeFailures.add(1);
    return;
  }

  const advanced = advanceAllTicketsForOrder(headers, orderId);
  if (!advanced) {
    writeFailures.add(1);
    return;
  }

  const served = http.post(
    api(`/branches/${branchId}/orders/${orderId}/served`),
    null,
    { headers: authHeadersBare(), ...tagName('write') },
  );
  if (!ok2xx(served)) {
    writeFailures.add(1);
    return;
  }

  const idem = `k6-pilot-${orderId}-${Date.now()}-${__VU}-${__ITER}`;
  const close = http.post(
    api(`/branches/${branchId}/orders/${orderId}/close`),
    JSON.stringify({ method: 'CASH' }),
    {
      headers: { ...authHeaders(), 'idempotency-key': idem },
      ...tagName('write'),
    },
  );
  if (!ok2xx(close)) {
    writeFailures.add(1);
    return;
  }

  check(close, { 'close bill 200': ok200 });
  sleep(1);
}
