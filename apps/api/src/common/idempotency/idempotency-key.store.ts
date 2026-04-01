/**
 * Redis-backed coordination for **close-bill** idempotency keys (`REDIS_URL`).
 * Process-local memory is for single-instance dev/tests only.
 * Duplicate protection without a key relies on **Postgres** (see `OrderBillingService`).
 */
export interface IdempotencyKeyStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string, ttlMs: number): Promise<void>;
  /**
   * Try to acquire an exclusive lock for this logical key (separate Redis key).
   * Returns an opaque token on success; releaseLock must be called with the same token.
   */
  acquireLock(key: string, lockTtlMs: number): Promise<string | null>;
  /** Only removes the lock if it still matches token (safe if lock expired and another holder acquired). */
  releaseLock(key: string, token: string): Promise<void>;
}
