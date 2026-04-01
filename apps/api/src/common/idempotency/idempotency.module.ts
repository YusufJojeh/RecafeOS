import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IDEMPOTENCY_KEY_STORE } from './idempotency.constants';
import { MemoryIdempotencyKeyStore } from './memory-idempotency-key.store';
import { RedisIdempotencyKeyStore } from './redis-idempotency-key.store';
import type { IdempotencyKeyStore } from './idempotency-key.store';

const logger = new Logger('IdempotencyModule');

type ConfigLike = Pick<ConfigService, 'get'>;

type IdempotencyStoreMode =
  | {
      store: 'redis';
      redisUrl: string;
      requireRedis: boolean;
    }
  | {
      store: 'memory';
      requireRedis: false;
    };

function isTrueFlag(value: string | undefined): boolean {
  return value?.trim() === 'true';
}

export function resolveIdempotencyStoreMode(
  config: ConfigLike,
): IdempotencyStoreMode {
  const redisUrl = config.get<string>('REDIS_URL')?.trim();
  const rawRequireRedis = config.get<string>('IDEMPOTENCY_REQUIRE_REDIS');
  const isProd = config.get<string>('NODE_ENV') === 'production';

  if (isProd && rawRequireRedis?.trim() === 'false') {
    throw new Error(
      'IDEMPOTENCY_REQUIRE_REDIS=false is not allowed in production. ' +
        'RestoCafe OS fail-closes payment idempotency in production and requires REDIS_URL.',
    );
  }

  const requireRedis = isProd || isTrueFlag(rawRequireRedis);

  if (requireRedis && !redisUrl) {
    throw new Error(
      'Redis-backed idempotency is required but REDIS_URL is not set. ' +
        'Production and rollout-grade environments must not start with the in-memory idempotency store. ' +
        'Set REDIS_URL and keep IDEMPOTENCY_REQUIRE_REDIS=true.',
    );
  }

  if (redisUrl) {
    return { store: 'redis', redisUrl, requireRedis };
  }

  return { store: 'memory', requireRedis: false };
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: IDEMPOTENCY_KEY_STORE,
      useFactory: (config: ConfigService): IdempotencyKeyStore => {
        const mode = resolveIdempotencyStoreMode(config);
        if (mode.store === 'redis') {
          logger.log(
            mode.requireRedis
              ? 'Idempotency store: Redis (required, fail-closed enabled)'
              : 'Idempotency store: Redis',
          );
          return new RedisIdempotencyKeyStore(mode.redisUrl);
        }

        logger.warn(
          'Idempotency store: in-memory (local/dev single-process only). ' +
            'Production startup must never reach this mode.',
        );
        return new MemoryIdempotencyKeyStore();
      },
      inject: [ConfigService],
    },
  ],
  exports: [IDEMPOTENCY_KEY_STORE],
})
export class IdempotencyModule {}
