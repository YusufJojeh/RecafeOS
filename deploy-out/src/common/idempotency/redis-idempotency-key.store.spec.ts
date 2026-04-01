import Redis from 'ioredis';
import { RedisIdempotencyKeyStore } from './redis-idempotency-key.store';

const redisUrl = process.env.REDIS_URL?.trim();

(redisUrl ? describe : describe.skip)('RedisIdempotencyKeyStore', () => {
  let raw: Redis;

  beforeAll(() => {
    raw = new Redis(redisUrl!);
  });

  afterAll(async () => {
    await raw.quit();
  });

  it('second acquireLock returns null until lock released or expired', async () => {
    const store = new RedisIdempotencyKeyStore(redisUrl!);
    const logicalKey = `closeBill:test:${Date.now()}:a`;
    const t1 = await store.acquireLock(logicalKey, 30_000);
    const t2 = await store.acquireLock(logicalKey, 30_000);
    expect(t1).toBeTruthy();
    expect(t2).toBeNull();
    await store.releaseLock(logicalKey, t1!);
    const t3 = await store.acquireLock(logicalKey, 30_000);
    expect(t3).toBeTruthy();
    await store.releaseLock(logicalKey, t3!);
    await store.onModuleDestroy();
  });

  it('releaseLock with wrong token leaves lock in place', async () => {
    const store = new RedisIdempotencyKeyStore(redisUrl!);
    const logicalKey = `closeBill:test:${Date.now()}:b`;
    const token = await store.acquireLock(logicalKey, 60_000);
    expect(token).toBeTruthy();
    await store.releaseLock(logicalKey, 'not-the-token');
    const lockKey = `${logicalKey}:lock`;
    expect(await raw.get(lockKey)).toBe(token);
    await store.releaseLock(logicalKey, token!);
    expect(await raw.get(lockKey)).toBeNull();
    await store.onModuleDestroy();
  });

  it('set stores value with approximate TTL', async () => {
    const store = new RedisIdempotencyKeyStore(redisUrl!);
    const k = `closeBill:test:${Date.now()}:val`;
    await store.set(k, 'oid', 3000);
    expect(await raw.get(k)).toBe('oid');
    const ttl = await raw.ttl(k);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(4);
    await raw.del(k);
    await store.onModuleDestroy();
  });
});
