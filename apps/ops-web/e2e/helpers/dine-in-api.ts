import type { APIRequestContext } from '@playwright/test';
import { apiV1Base, authHeaders } from './api-base';

type FloorTable = {
  id: string;
  label: string;
  sessions: { id: string; guestCount: number }[];
};

type MenuCategory = {
  items: { id: string; name: string }[];
};

/**
 * Creates a dine-in order on table T2 with Classic Burger + Cola, confirmed and sent to prep.
 * Matches integration flow in apps/api/test/integration/order-critical-flows.integration-spec.ts
 */
export async function seedDineInOrderForE2E(
  request: APIRequestContext,
  token: string,
  branchId: string,
): Promise<{ orderId: string }> {
  const base = apiV1Base();
  const h = authHeaders(token, branchId);

  const tablesRes = await request.get(`${base}/branches/${branchId}/tables`, {
    headers: h,
  });
  if (!tablesRes.ok()) {
    throw new Error(`GET tables failed: ${tablesRes.status()}`);
  }
  const tables = (await tablesRes.json()) as FloorTable[];
  const t2 = tables.find((t) => t.label === 'T2');
  if (!t2) {
    throw new Error('E2E requires seeded floor table T2 (see prisma seed / createFloorTables)');
  }

  let sessionId = t2.sessions[0]?.id;
  if (!sessionId) {
    const open = await request.post(`${base}/branches/${branchId}/tables/sessions`, {
      headers: h,
      data: JSON.stringify({ floorTableId: t2.id, guestCount: 2 }),
    });
    if (!open.ok()) {
      throw new Error(`Open table session failed: ${open.status()} ${await open.text()}`);
    }
    const opened = (await open.json()) as { id: string };
    sessionId = opened.id;
  }

  const menuRes = await request.get(`${base}/branches/${branchId}/menu/categories`, {
    headers: h,
  });
  if (!menuRes.ok()) {
    throw new Error(`GET menu categories failed: ${menuRes.status()}`);
  }
  const categories = (await menuRes.json()) as MenuCategory[];
  let burgerId = '';
  let drinkId = '';
  for (const c of categories) {
    for (const i of c.items) {
      if (i.name === 'Classic Burger') {
        burgerId = i.id;
      }
      if (i.name === 'Cola') {
        drinkId = i.id;
      }
    }
  }
  if (!burgerId || !drinkId) {
    throw new Error('Classic Burger and Cola must exist in seed menu');
  }

  const create = await request.post(`${base}/branches/${branchId}/orders`, {
    headers: h,
    data: JSON.stringify({
      type: 'DINE_IN',
      tableSessionId: sessionId,
    }),
  });
  if (!create.ok()) {
    throw new Error(`Create order failed: ${create.status()} ${await create.text()}`);
  }
  const orderId = (await create.json()) as { id: string };
  const oid = orderId.id;

  for (const body of [
    { menuItemId: burgerId, quantity: 1 },
    { menuItemId: drinkId, quantity: 1 },
  ]) {
    const add = await request.post(
      `${base}/branches/${branchId}/orders/${oid}/items`,
      { headers: h, data: JSON.stringify(body) },
    );
    if (!add.ok()) {
      throw new Error(`Add item failed: ${add.status()} ${await add.text()}`);
    }
  }

  const conf = await request.post(`${base}/branches/${branchId}/orders/${oid}/confirm`, {
    headers: h,
  });
  if (!conf.ok()) {
    throw new Error(`Confirm failed: ${conf.status()}`);
  }

  const prep = await request.post(
    `${base}/branches/${branchId}/orders/${oid}/send-to-preparation`,
    { headers: h },
  );
  if (!prep.ok()) {
    throw new Error(`Send to prep failed: ${prep.status()}`);
  }

  return { orderId: oid };
}
