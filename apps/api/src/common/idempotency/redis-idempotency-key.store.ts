import { randomUUID } from 'node:crypto';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import type { IdempotencyKeyStore } from './idempotency-key.store';

const LOCK_SUFFIX = ':lock';

/** Delete lock key only if value matches token (avoids deleting another holder's lock after TTL expiry). */
const RELEASE_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

@Injectable()
export class RedisIdempotencyKeyStore
  implements IdempotencyKeyStore, OnModuleDestroy
{
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  async get(key: string): Promise<string | undefined> {
    const v = await this.redis.get(key);
    return v ?? undefined;
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    const sec = Math.max(1, Math.ceil(ttlMs / 1000));
    await this.redis.set(key, value, 'EX', sec);
  }

  async acquireLock(key: string, lockTtlMs: number): Promise<string | null> {
    const lockKey = `${key}${LOCK_SUFFIX}`;
    const token = randomUUID();
    const res = await this.redis.set(lockKey, token, 'PX', lockTtlMs, 'NX');
    return res === 'OK' ? token : null;
  }

  async releaseLock(key: string, token: string): Promise<void> {
    const lockKey = `${key}${LOCK_SUFFIX}`;
    await this.redis.eval(RELEASE_LOCK_LUA, 1, lockKey, token);
  }
}
