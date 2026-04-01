/**
 * Shared helpers for RestoCafe OS k6 load tests.
 *
 * Import in any script:
 *   import { api, authHeaders, authHeadersBare, tagName, ok200, ok2xx, pickTable } from './lib/shared.js';
 *
 * All env vars are read once at module load — k6 freezes __ENV at init time.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const base = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
export const token = __ENV.JWT || '';
export const branchId = __ENV.BRANCH_ID || '';

/** Build a full API URL. */
export function api(path) {
  return `${base}/api/v1${path}`;
}

/** Standard authenticated JSON headers. */
export function authHeaders() {
  return {
    Authorization: `Bearer ${token}`,
    'X-Branch-Id': branchId,
    'Content-Type': 'application/json',
  };
}

/** Auth headers without Content-Type (empty-body POSTs). */
export function authHeadersBare() {
  return {
    Authorization: `Bearer ${token}`,
    'X-Branch-Id': branchId,
  };
}

/** k6 tag object for named duration tracking. */
export function tagName(name) {
  return { tags: { name } };
}

export const ok200 = (r) => r.status === 200;
export const ok2xx = (r) => r.status >= 200 && r.status < 300;

/**
 * Pick a floor table from the setup data.
 * Spreads VU+ITER across tables to reduce contention;
 * prefers the TABLE_LABEL env var table if present.
 */
export function pickTable(tables, tableLabelPref) {
  if (!tables || tables.length === 0) return null;
  const pref = tableLabelPref && tables.find((t) => t.label === tableLabelPref);
  const idx = (Number(__VU) + Number(__ITER) * 13) % tables.length;
  return pref || tables[idx];
}

/**
 * Open a table session if the table has none.
 * Returns sessionId or null on failure.
 */
export function ensureTableSession(table) {
  if (!table) return null;
  if (table.sessions && table.sessions[0] && table.sessions[0].id) {
    return table.sessions[0].id;
  }
  const res = http.post(
    api(`/branches/${branchId}/tables/sessions`),
    JSON.stringify({ floorTableId: table.id, guestCount: 2 }),
    { headers: authHeaders(), ...tagName('write') },
  );
  if (!ok2xx(res)) return null;
  return JSON.parse(res.body).id;
}

/**
 * Full order lifecycle: create → add items → confirm → send-to-prep →
 * advance all tickets → served → close.
 *
 * Returns true on success, false on any failure.
 * Accepts optional writeFailures Counter to increment on failure.
 */
export function runOrderLifecycle(data, writeFailures) {
  const fail = () => {
    if (writeFailures) writeFailures.add(1);
    return false;
  };

  if (!token || !branchId) return fail();
  if (!data || !data.ok || !data.menuItemIds || data.menuItemIds.length < 1) {
    console.warn('runOrderLifecycle: setup data missing menu items; skip');
    return fail();
  }

  const table = pickTable(data.tables || [], data.tableLabelPref);
  if (!table) return fail();

  const sessionId = ensureTableSession(table);
  if (!sessionId) return fail();

  const create = http.post(
    api(`/branches/${branchId}/orders`),
    JSON.stringify({ type: 'DINE_IN', tableSessionId: sessionId }),
    { headers: authHeaders(), ...tagName('write') },
  );
  if (!ok2xx(create)) return fail();
  const orderId = JSON.parse(create.body).id;

  for (const menuItemId of data.menuItemIds) {
    const add = http.post(
      api(`/branches/${branchId}/orders/${orderId}/items`),
      JSON.stringify({ menuItemId, quantity: 1 }),
      { headers: authHeaders(), ...tagName('write') },
    );
    if (!ok2xx(add)) return fail();
  }

  const conf = http.post(
    api(`/branches/${branchId}/orders/${orderId}/confirm`),
    null,
    { headers: authHeadersBare(), ...tagName('write') },
  );
  if (!ok2xx(conf)) return fail();

  const prep = http.post(
    api(`/branches/${branchId}/orders/${orderId}/send-to-preparation`),
    null,
    { headers: authHeadersBare(), ...tagName('write') },
  );
  if (!ok2xx(prep)) return fail();

  if (!advanceAllTickets(orderId)) return fail();

  const served = http.post(
    api(`/branches/${branchId}/orders/${orderId}/served`),
    null,
    { headers: authHeadersBare(), ...tagName('write') },
  );
  if (!ok2xx(served)) return fail();

  const idem = `k6-${orderId}-${Date.now()}-${__VU}-${__ITER}`;
  const close = http.post(
    api(`/branches/${branchId}/orders/${orderId}/close`),
    JSON.stringify({ method: 'CASH' }),
    { headers: { ...authHeaders(), 'idempotency-key': idem }, ...tagName('write') },
  );
  if (!ok2xx(close)) return fail();

  check(close, { 'close bill 200': ok200 });
  return true;
}

const ticketNext = { NEW: 'ACCEPTED', ACCEPTED: 'PREPARING', PREPARING: 'READY', READY: 'DELIVERED' };

/** Advance all prep tickets for an order to DELIVERED. Returns true when done. */
export function advanceAllTickets(orderId) {
  const headers = authHeaders();
  for (let round = 0; round < 30; round++) {
    const kRes = http.get(
      api(`/branches/${branchId}/kitchen/tickets?station=KITCHEN`),
      { headers, ...tagName('read') },
    );
    const bRes = http.get(
      api(`/branches/${branchId}/bar/tickets`),
      { headers, ...tagName('read') },
    );
    if (kRes.status !== 200 || bRes.status !== 200) return false;

    const all = [...JSON.parse(kRes.body), ...JSON.parse(bRes.body)].filter(
      (t) => t.order && t.order.id === orderId,
    );
    if (all.length === 0) { sleep(0.3); continue; }

    const undelivered = all.filter((t) => t.status !== 'DELIVERED');
    if (undelivered.length === 0) return true;

    const t = undelivered[0];
    const next = ticketNext[t.status];
    if (!next) return false;

    const seg = t.station === 'BAR' ? 'bar' : 'kitchen';
    const pr = http.patch(
      api(`/branches/${branchId}/${seg}/tickets/${t.id}`),
      JSON.stringify({ status: next }),
      { headers, ...tagName('write') },
    );
    if (!ok2xx(pr)) return false;
  }
  return false;
}

/**
 * Standard setup() helper: fetches menu items and tables from the API.
 * Returns { ok, menuItemIds, tables, tableLabelPref } for use in VU functions.
 */
export function standardSetup(maxItems = 2, tableLabelPref = __ENV.TABLE_LABEL || 'T2') {
  if (!token || !branchId) {
    console.warn('standardSetup: JWT and BRANCH_ID are required for meaningful results.');
    return { ok: false };
  }

  const headers = authHeaders();

  const menuRes = http.get(api(`/branches/${branchId}/menu/categories`), {
    headers,
    ...tagName('read'),
  });
  if (menuRes.status !== 200) {
    console.error(`standardSetup: menu/categories failed ${menuRes.status}`);
    return { ok: false };
  }

  const categories = JSON.parse(menuRes.body);
  const menuItemIds = [];
  for (const c of categories) {
    for (const i of (c.items || [])) {
      if (menuItemIds.length >= maxItems) break;
      menuItemIds.push(i.id);
    }
    if (menuItemIds.length >= maxItems) break;
  }

  const tablesRes = http.get(api(`/branches/${branchId}/tables`), { headers, ...tagName('read') });
  if (tablesRes.status !== 200) {
    console.error(`standardSetup: tables failed ${tablesRes.status}`);
    return { ok: false };
  }

  return {
    ok: menuItemIds.length >= 1,
    menuItemIds,
    tables: JSON.parse(tablesRes.body),
    tableLabelPref,
  };
}
