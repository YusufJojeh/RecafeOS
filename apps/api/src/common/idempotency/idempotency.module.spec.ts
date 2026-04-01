import { resolveIdempotencyStoreMode } from './idempotency.module';

function config(values: Record<string, string | undefined>) {
  return {
    get: (key: string) => values[key],
  };
}

describe('resolveIdempotencyStoreMode', () => {
  it('uses in-memory store for local development when Redis is omitted', () => {
    expect(
      resolveIdempotencyStoreMode(
        config({
          NODE_ENV: 'development',
        }),
      ),
    ).toEqual({
      store: 'memory',
      requireRedis: false,
    });
  });

  it('uses Redis in development when REDIS_URL is configured', () => {
    expect(
      resolveIdempotencyStoreMode(
        config({
          NODE_ENV: 'development',
          REDIS_URL: 'redis://127.0.0.1:6379',
        }),
      ),
    ).toEqual({
      store: 'redis',
      redisUrl: 'redis://127.0.0.1:6379',
      requireRedis: false,
    });
  });

  it('fails closed in production when REDIS_URL is missing', () => {
    expect(() =>
      resolveIdempotencyStoreMode(
        config({
          NODE_ENV: 'production',
          IDEMPOTENCY_REQUIRE_REDIS: 'true',
        }),
      ),
    ).toThrow(/Redis-backed idempotency is required but REDIS_URL is not set/);
  });

  it('rejects explicit IDEMPOTENCY_REQUIRE_REDIS=false in production', () => {
    expect(() =>
      resolveIdempotencyStoreMode(
        config({
          NODE_ENV: 'production',
          IDEMPOTENCY_REQUIRE_REDIS: 'false',
          REDIS_URL: 'redis://redis:6379',
        }),
      ),
    ).toThrow(/IDEMPOTENCY_REQUIRE_REDIS=false is not allowed in production/);
  });

  it('requires Redis by default in production', () => {
    expect(
      resolveIdempotencyStoreMode(
        config({
          NODE_ENV: 'production',
          REDIS_URL: 'redis://redis:6379',
        }),
      ),
    ).toEqual({
      store: 'redis',
      redisUrl: 'redis://redis:6379',
      requireRedis: true,
    });
  });
});
