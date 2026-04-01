import { MemoryIdempotencyKeyStore } from './memory-idempotency-key.store';

describe('MemoryIdempotencyKeyStore', () => {
  it('acquireLock returns a token and blocks second holder until TTL', async () => {
    const s = new MemoryIdempotencyKeyStore();
    const k = 'idem:mem:1';
    const a = await s.acquireLock(k, 500);
    const b = await s.acquireLock(k, 500);
    expect(a).toBeTruthy();
    expect(b).toBeNull();
    await s.releaseLock(k, a!);
    const c = await s.acquireLock(k, 500);
    expect(c).toBeTruthy();
    await s.releaseLock(k, c!);
  });

  it('releaseLock with wrong token does not release the lock', async () => {
    const s = new MemoryIdempotencyKeyStore();
    const k = 'idem:mem:2';
    const token = await s.acquireLock(k, 60_000);
    expect(token).toBeTruthy();
    await s.releaseLock(k, 'wrong-token');
    const again = await s.acquireLock(k, 60_000);
    expect(again).toBeNull();
    await s.releaseLock(k, token!);
    const free = await s.acquireLock(k, 60_000);
    expect(free).toBeTruthy();
    await s.releaseLock(k, free!);
  });

  it('set and get honor TTL for values', async () => {
    const s = new MemoryIdempotencyKeyStore();
    const k = 'idem:mem:3';
    await s.set(k, 'order-1', 100);
    expect(await s.get(k)).toBe('order-1');
    await new Promise((r) => setTimeout(r, 150));
    expect(await s.get(k)).toBeUndefined();
  });
});
