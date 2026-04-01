import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { branchMenuCacheRedisKey } from './branch-menu-cache-key';

/**
 * Deletes the branch menu cache key when Redis is configured. Safe no-op when no cache is populated yet.
 * Call after any path that changes menu categories, items, modifiers, or bulk import/clone for that branch.
 */
@Injectable()
export class BranchMenuCacheInvalidationService implements OnModuleDestroy {
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

  async invalidateBranch(branchId: string): Promise<void> {
    if (!this.redis) {
      return;
    }
    try {
      await this.redis.del(branchMenuCacheRedisKey(branchId));
    } catch {
      // Best-effort; menu correctness does not depend on invalidation
    }
  }
}
