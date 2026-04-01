import type { ConfigService } from '@nestjs/config';
import { OperationalHealthService } from './operational-health.service';

function config(values: Record<string, string | undefined>) {
  return {
    get: (key: string) => values[key],
  } as Pick<ConfigService, 'get'> as ConfigService;
}

function prisma(queryImpl: () => Promise<unknown>) {
  return {
    $queryRaw: queryImpl,
  };
}

describe('OperationalHealthService', () => {
  it('returns healthy when DB is up and Redis is intentionally not configured', async () => {
    const service = new OperationalHealthService(
      prisma(() => Promise.resolve(1)) as never,
      config({
        NODE_ENV: 'development',
        IDEMPOTENCY_REQUIRE_REDIS: 'false',
      }),
    ).setRedisProbeForTest(() => {
      throw new Error('redis probe must not run without REDIS_URL');
    });

    await expect(service.snapshot()).resolves.toMatchObject({
      status: 'healthy',
      canServeTraffic: true,
      dependencies: {
        db: { status: 'up', required: true },
        redis: { status: 'not_configured', configured: false, required: false },
      },
      topology: {
        idempotencyMode: 'memory_single_process',
        websocketMode: 'in_memory',
      },
    });
  });

  it('returns degraded when Redis is configured but unavailable in optional mode', async () => {
    const service = new OperationalHealthService(
      prisma(() => Promise.resolve(1)) as never,
      config({
        NODE_ENV: 'development',
        REDIS_URL: 'redis://127.0.0.1:6379',
        IDEMPOTENCY_REQUIRE_REDIS: 'false',
      }),
    ).setRedisProbeForTest(() =>
      Promise.resolve({
        status: 'down',
        latencyMs: 42,
        detail: 'Redis ping failed: ECONNREFUSED',
      }),
    );

    await expect(service.snapshot()).resolves.toMatchObject({
      status: 'degraded',
      canServeTraffic: true,
      dependencies: {
        db: { status: 'up' },
        redis: {
          status: 'down',
          configured: true,
          required: false,
          latencyMs: 42,
        },
      },
      topology: {
        idempotencyMode: 'redis_optional',
        websocketMode: 'redis_adapter',
      },
    });
  });

  it('returns not_ready when required Redis is unavailable', async () => {
    const service = new OperationalHealthService(
      prisma(() => Promise.resolve(1)) as never,
      config({
        NODE_ENV: 'production',
        REDIS_URL: 'redis://redis:6379',
        IDEMPOTENCY_REQUIRE_REDIS: 'true',
      }),
    ).setRedisProbeForTest(() =>
      Promise.resolve({
        status: 'down',
        latencyMs: 12,
        detail: 'Redis ping failed: timeout',
      }),
    );

    await expect(service.snapshot()).resolves.toMatchObject({
      status: 'not_ready',
      canServeTraffic: false,
      dependencies: {
        db: { status: 'up' },
        redis: { status: 'down', required: true, configured: true },
      },
      topology: {
        idempotencyMode: 'redis_required',
        websocketMode: 'redis_adapter',
      },
    });
  });

  it('returns not_ready when the database is unavailable', async () => {
    const service = new OperationalHealthService(
      prisma(() => Promise.reject(new Error('db unavailable'))) as never,
      config({
        NODE_ENV: 'development',
      }),
    ).setRedisProbeForTest(() =>
      Promise.resolve({
        status: 'up',
        latencyMs: 5,
        detail: 'Redis ping ok.',
      }),
    );

    await expect(service.snapshot()).resolves.toMatchObject({
      status: 'not_ready',
      canServeTraffic: false,
      dependencies: {
        db: { status: 'down' },
      },
    });
  });
});
