import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Cross-replica JSON cache for expensive report payloads when REDIS_URL is set.
 * Complements the in-process Map in {@link ReportsService}.
 */
@Injectable()
export class ReportsRedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(ReportsRedisCacheService.name);
  private readonly redis: Redis | null;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('REDIS_URL')?.trim();
    this.redis = url
      ? new Redis(url, { maxRetriesPerRequest: 2, enableReadyCheck: true })
      : null;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  async getDailyJson(cacheKey: string): Promise<unknown> {
    if (!this.redis) {
      return null;
    }
    const redisKey = `rc:reports:daily:v1:${cacheKey}`;
    try {
      const raw = await this.redis.get(redisKey);
      if (raw == null) {
        return null;
      }
      return JSON.parse(raw) as unknown;
    } catch (e) {
      this.logger.warn(
        `reports_redis_cache_get_failed ${e instanceof Error ? e.message : String(e)}`,
      );
      return null;
    }
  }

  async setDailyJson(
    cacheKey: string,
    value: unknown,
    ttlMs: number,
  ): Promise<void> {
    if (!this.redis || ttlMs <= 0) {
      return;
    }
    const redisKey = `rc:reports:daily:v1:${cacheKey}`;
    const sec = Math.max(1, Math.ceil(ttlMs / 1000));
    try {
      await this.redis.set(redisKey, JSON.stringify(value), 'EX', sec);
    } catch (e) {
      this.logger.warn(
        `reports_redis_cache_set_failed ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
