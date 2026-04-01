import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const PREFIX = 'rc:auth:v1';

type TenantStaffSlice = {
  billingStatus: string;
  trialEndsAt: string | null;
  metadata: unknown;
};

type MemoryEntry<T> = { value: T; expiresAt: number };

/**
 * Short-TTL cache for JWT validation (permissions, tenant commerce slice) and
 * BranchGuard branch membership. Reduces Postgres QPS on hot paths when REDIS_URL
 * is set; falls back to in-process Map otherwise.
 */
@Injectable()
export class StaffAuthCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(StaffAuthCacheService.name);
  private readonly redis: Redis | null;
  private readonly ttlSec: number;
  private readonly memPerm = new Map<string, MemoryEntry<string[]>>();
  private readonly memTenant = new Map<string, MemoryEntry<TenantStaffSlice>>();
  private readonly memBranch = new Map<string, MemoryEntry<boolean>>();

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('REDIS_URL')?.trim();
    this.redis = url ? new Redis(url, { maxRetriesPerRequest: 2 }) : null;
    const raw = this.config.get<string>('AUTH_CACHE_TTL_SECONDS');
    const n = raw ? parseInt(raw, 10) : 45;
    this.ttlSec = Number.isFinite(n) && n >= 5 && n <= 300 ? n : 45;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  private now(): number {
    return Date.now();
  }

  private memGet<T>(m: Map<string, MemoryEntry<T>>, key: string): T | null {
    const e = m.get(key);
    if (!e) {
      return null;
    }
    if (e.expiresAt <= this.now()) {
      m.delete(key);
      return null;
    }
    return e.value;
  }

  private memSet<T>(
    m: Map<string, MemoryEntry<T>>,
    key: string,
    value: T,
  ): void {
    m.set(key, { value, expiresAt: this.now() + this.ttlSec * 1000 });
  }

  async getPermissions(
    userId: string,
    tenantId: string,
  ): Promise<string[] | null> {
    const key = `${PREFIX}:perm:${userId}:${tenantId}`;
    if (this.redis) {
      try {
        const raw = await this.redis.get(key);
        if (raw === null) {
          return null;
        }
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) {
          return null;
        }
        return parsed as string[];
      } catch (e) {
        this.logger.warn(
          `redis_perm_get_failed ${e instanceof Error ? e.message : String(e)}`,
        );
        return null;
      }
    }
    const v = this.memGet(this.memPerm, key);
    return v;
  }

  async setPermissions(
    userId: string,
    tenantId: string,
    codes: string[],
  ): Promise<void> {
    const key = `${PREFIX}:perm:${userId}:${tenantId}`;
    if (this.redis) {
      try {
        await this.redis.set(key, JSON.stringify(codes), 'EX', this.ttlSec);
      } catch (e) {
        this.logger.warn(
          `redis_perm_set_failed ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      return;
    }
    this.memSet(this.memPerm, key, codes);
  }

  async getTenantStaff(tenantId: string): Promise<TenantStaffSlice | null> {
    const key = `${PREFIX}:tenant:${tenantId}`;
    if (this.redis) {
      try {
        const raw = await this.redis.get(key);
        if (raw === null) {
          return null;
        }
        return JSON.parse(raw) as TenantStaffSlice;
      } catch (e) {
        this.logger.warn(
          `redis_tenant_get_failed ${e instanceof Error ? e.message : String(e)}`,
        );
        return null;
      }
    }
    return this.memGet(this.memTenant, key);
  }

  async setTenantStaff(
    tenantId: string,
    slice: TenantStaffSlice,
  ): Promise<void> {
    const key = `${PREFIX}:tenant:${tenantId}`;
    if (this.redis) {
      try {
        await this.redis.set(key, JSON.stringify(slice), 'EX', this.ttlSec);
      } catch (e) {
        this.logger.warn(
          `redis_tenant_set_failed ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      return;
    }
    this.memSet(this.memTenant, key, slice);
  }

  /**
   * Returns true/false when cached, null on miss.
   */
  async getBranchInTenant(
    tenantId: string,
    branchId: string,
  ): Promise<boolean | null> {
    const key = `${PREFIX}:branch:${tenantId}:${branchId}`;
    if (this.redis) {
      try {
        const raw = await this.redis.get(key);
        if (raw === null) {
          return null;
        }
        return raw === '1';
      } catch (e) {
        this.logger.warn(
          `redis_branch_get_failed ${e instanceof Error ? e.message : String(e)}`,
        );
        return null;
      }
    }
    const v = this.memGet(this.memBranch, key);
    return v === null ? null : v;
  }

  async setBranchInTenant(
    tenantId: string,
    branchId: string,
    ok: boolean,
  ): Promise<void> {
    const key = `${PREFIX}:branch:${tenantId}:${branchId}`;
    if (this.redis) {
      try {
        await this.redis.set(key, ok ? '1' : '0', 'EX', this.ttlSec);
      } catch (e) {
        this.logger.warn(
          `redis_branch_set_failed ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      return;
    }
    this.memSet(this.memBranch, key, ok);
  }
}
