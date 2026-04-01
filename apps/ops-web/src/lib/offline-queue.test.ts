import 'fake-indexeddb/auto';
import { STAFF_HTTP_HEADER, staffHttpHeaderLower } from '@restocafe/types';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertEnqueueAllowed,
  countQueuedMutations,
  drainMutationQueue,
  enqueueMutation,
  offlineDb,
} from './offline-queue';

const closeHeaders = (branchId: string, idemKey: string) => ({
  [STAFF_HTTP_HEADER.IDEMPOTENCY_KEY]: idemKey,
  [STAFF_HTTP_HEADER.BRANCH_ID]: branchId,
});

describe('offline queue', () => {
  afterEach(async () => {
    await offlineDb.mutations.clear();
  });

  it('enqueue then drain invokes runner in FIFO order and clears queue', async () => {
    const seen: string[] = [];
    await enqueueMutation({
      path: '/branches/b1/orders/o1/close',
      method: 'POST',
      body: '{"method":"CASH"}',
      headers: closeHeaders('b1', 'key-a'),
      kind: 'close-bill',
    });
    await enqueueMutation({
      path: '/branches/b1/orders/o2/close',
      method: 'POST',
      body: '{"method":"CARD"}',
      headers: closeHeaders('b1', 'key-b'),
      kind: 'close-bill',
    });

    await drainMutationQueue(async (m) => {
      seen.push(m.path);
    });

    expect(seen).toEqual(['/branches/b1/orders/o1/close', '/branches/b1/orders/o2/close']);
    const remaining = await offlineDb.mutations.toArray();
    expect(remaining).toHaveLength(0);
  });

  it('rejects enqueue without idempotency key or branch mismatch', () => {
    expect(() =>
      assertEnqueueAllowed({
        kind: 'close-bill',
        method: 'POST',
        path: '/branches/b1/orders/o1/close',
        headers: { [STAFF_HTTP_HEADER.BRANCH_ID]: 'b1' },
      }),
    ).toThrow(/Idempotency-Key/);

    expect(() =>
      assertEnqueueAllowed({
        kind: 'close-bill',
        method: 'POST',
        path: '/branches/b1/orders/o1/close',
        body: '{}',
        headers: closeHeaders('b2', 'k'),
      }),
    ).toThrow(/X-Branch-Id/);

    expect(() =>
      assertEnqueueAllowed({
        kind: 'close-bill',
        method: 'POST',
        path: '/branches/b1/kitchen/tickets/t1',
        body: '{}',
        headers: closeHeaders('b1', 'k'),
      }),
    ).toThrow(/path must be/);
  });

  it('counts queued mutations and preserves optional metadata', async () => {
    await enqueueMutation({
      path: '/branches/b1/orders/o1/close',
      method: 'POST',
      body: '{"method":"CASH"}',
      headers: {
        [staffHttpHeaderLower(STAFF_HTTP_HEADER.IDEMPOTENCY_KEY)]: 'abc',
        [STAFF_HTTP_HEADER.BRANCH_ID]: 'b1',
      },
      kind: 'close-bill',
      label: 'Cashier 1234',
    });

    expect(await countQueuedMutations()).toBe(1);
    const rows = await offlineDb.mutations.toArray();
    const h = rows[0]?.headers;
    expect(
      h?.[STAFF_HTTP_HEADER.BRANCH_ID] ?? h?.[staffHttpHeaderLower(STAFF_HTTP_HEADER.BRANCH_ID)],
    ).toBe('b1');
    expect(rows[0]?.kind).toBe('close-bill');
  });
});
