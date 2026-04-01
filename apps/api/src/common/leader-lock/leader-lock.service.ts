import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';

/**
 * Optional Redis SET NX leader election so only one API replica runs a periodic or admin job.
 * Without REDIS_URL, {@link tryRunExclusive} always runs the callback (same as single-process).
 */
@Injectable()
export class LeaderLockService implements OnModuleDestroy {
  private readonly logger = new Logger(LeaderLockService.name);
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

  /**
   * Runs `fn` if this instance holds the leader lock, or always when Redis is disabled.
   * @returns whether `fn` was executed
   */
  async tryRunExclusive(
    lockName: string,
    ttlSec: number,
    fn: () => Promise<void>,
  ): Promise<boolean> {
    if (!this.redis) {
      await fn();
      return true;
    }
    const token = randomUUID();
    const lockKey = `rc:leader:${lockName}`;
    const ok = await this.redis.set(
      lockKey,
      token,
      'EX',
      Math.max(1, ttlSec),
      'NX',
    );
    if (ok !== 'OK') {
      this.logger.debug(`leader_lock_skip name=${lockName}`);
      return false;
    }
    try {
      await fn();
    } finally {
      const RELEASE_LUA = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      try {
        await this.redis.eval(RELEASE_LUA, 1, lockKey, token);
      } catch (e) {
        this.logger.warn(
          `leader_lock_release_failed name=${lockName} ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }
    return true;
  }

  /**
   * Runs `fn` and returns its result when leader (or always without Redis).
   * If lock not acquired, returns `null`.
   */
  async tryRunExclusiveWithResult<T>(
    lockName: string,
    ttlSec: number,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    if (!this.redis) {
      return fn();
    }
    const token = randomUUID();
    const lockKey = `rc:leader:${lockName}`;
    const ok = await this.redis.set(
      lockKey,
      token,
      'EX',
      Math.max(1, ttlSec),
      'NX',
    );
    if (ok !== 'OK') {
      this.logger.debug(`leader_lock_skip name=${lockName}`);
      return null;
    }
    try {
      return await fn();
    } finally {
      const RELEASE_LUA = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      try {
        await this.redis.eval(RELEASE_LUA, 1, lockKey, token);
      } catch (e) {
        this.logger.warn(
          `leader_lock_release_failed name=${lockName} ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }
  }
}
