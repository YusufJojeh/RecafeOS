import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';

export type DependencyState = 'up' | 'down' | 'not_configured';
export type OperationalStatus = 'healthy' | 'degraded' | 'not_ready';

export type DependencySnapshot = {
  status: DependencyState;
  required: boolean;
  configured: boolean;
  latencyMs: number | null;
  detail: string;
};

export type OperationalHealthSnapshot = {
  status: OperationalStatus;
  summary: string;
  canServeTraffic: boolean;
  dependencies: {
    db: DependencySnapshot;
    redis: DependencySnapshot;
  };
  topology: {
    idempotencyMode:
      | 'redis_required'
      | 'redis_optional'
      | 'memory_single_process';
    websocketMode: 'redis_adapter' | 'in_memory';
  };
  checkedAt: string;
};

type RedisProbeResult = {
  status: 'up' | 'down';
  latencyMs: number;
  detail: string;
};

type RedisProbe = (redisUrl: string) => Promise<RedisProbeResult>;

async function defaultRedisProbe(redisUrl: string): Promise<RedisProbeResult> {
  const started = Date.now();
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    enableReadyCheck: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 1_000,
    retryStrategy: () => null,
  });

  try {
    await redis.connect();
    const pong = await redis.ping();
    return {
      status: 'up',
      latencyMs: Date.now() - started,
      detail:
        pong === 'PONG'
          ? 'Redis ping ok.'
          : `Unexpected Redis ping response: ${String(pong)}`,
    };
  } catch (error) {
    return {
      status: 'down',
      latencyMs: Date.now() - started,
      detail: `Redis ping failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  } finally {
    await redis.quit().catch(() => {
      redis.disconnect(false);
    });
  }
}

@Injectable()
export class OperationalHealthService {
  private redisProbe: RedisProbe = defaultRedisProbe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  setRedisProbeForTest(redisProbe: RedisProbe): this {
    this.redisProbe = redisProbe;
    return this;
  }

  async snapshot(): Promise<OperationalHealthSnapshot> {
    const [db, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const topology = {
      idempotencyMode: redis.required
        ? 'redis_required'
        : redis.configured
          ? 'redis_optional'
          : 'memory_single_process',
      websocketMode: redis.configured ? 'redis_adapter' : 'in_memory',
    } satisfies OperationalHealthSnapshot['topology'];

    let status: OperationalStatus = 'healthy';
    let summary = 'Core dependencies are healthy.';

    if (db.status !== 'up') {
      status = 'not_ready';
      summary =
        'Database is unavailable. The API is not ready to serve traffic.';
    } else if (redis.required && redis.status !== 'up') {
      status = 'not_ready';
      summary =
        'Redis is required in this environment and is unavailable. The API is not ready to serve payment/idempotency traffic.';
    } else if (redis.configured && redis.status !== 'up') {
      status = 'degraded';
      summary =
        'Database is healthy, but Redis is unavailable. Optional cross-replica capabilities are degraded.';
    } else if (!redis.configured) {
      summary =
        'Database is healthy. Redis is intentionally not configured for this single-process environment.';
    }

    return {
      status,
      summary,
      canServeTraffic: status !== 'not_ready',
      dependencies: { db, redis },
      topology,
      checkedAt: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<DependencySnapshot> {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'up',
        required: true,
        configured: true,
        latencyMs: Date.now() - started,
        detail: 'Prisma connectivity check succeeded.',
      };
    } catch (error) {
      return {
        status: 'down',
        required: true,
        configured: true,
        latencyMs: Date.now() - started,
        detail: `Database readiness check failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async checkRedis(): Promise<DependencySnapshot> {
    const redisUrl = this.config.get<string>('REDIS_URL')?.trim();
    const redisRequired =
      this.config.get<string>('IDEMPOTENCY_REQUIRE_REDIS') === 'true';

    if (!redisUrl) {
      return {
        status: 'not_configured',
        required: redisRequired,
        configured: false,
        latencyMs: null,
        detail: redisRequired
          ? 'REDIS_URL is missing even though Redis is required.'
          : 'Redis is not configured. Single-process/local mode only.',
      };
    }

    const result = await this.redisProbe(redisUrl);
    return {
      status: result.status,
      required: redisRequired,
      configured: true,
      latencyMs: result.latencyMs,
      detail: result.detail,
    };
  }
}
