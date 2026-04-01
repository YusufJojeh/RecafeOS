import { randomUUID } from 'node:crypto';
import type { IdempotencyKeyStore } from './idempotency-key.store';

/**
 * Single-process store. Does not coordinate across Node replicas.
 */
export class MemoryIdempotencyKeyStore implements IdempotencyKeyStore {
  private readonly values = new Map<
    string,
    { expiresAt: number; value: string }
  >();
  private readonly locks = new Map<
    string,
    { token: string; expiresAt: number }
  >();

  get(key: string): Promise<string | undefined> {
    const row = this.values.get(key);
    if (!row) {
      return Promise.resolve(undefined);
    }
    if (Date.now() > row.expiresAt) {
      this.values.delete(key);
      return Promise.resolve(undefined);
    }
    return Promise.resolve(row.value);
  }

  set(key: string, value: string, ttlMs: number): Promise<void> {
    this.values.set(key, { expiresAt: Date.now() + ttlMs, value });
    return Promise.resolve();
  }

  acquireLock(key: string, lockTtlMs: number): Promise<string | null> {
    const now = Date.now();
    const row = this.locks.get(key);
    if (row && now < row.expiresAt) {
      return Promise.resolve(null);
    }
    if (row) {
      this.locks.delete(key);
    }
    const token = randomUUID();
    this.locks.set(key, { token, expiresAt: now + lockTtlMs });
    return Promise.resolve(token);
  }

  releaseLock(key: string, token: string): Promise<void> {
    const row = this.locks.get(key);
    if (row?.token === token) {
      this.locks.delete(key);
    }
    return Promise.resolve();
  }
}
