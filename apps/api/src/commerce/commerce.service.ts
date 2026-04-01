import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma, Tenant } from '@prisma/client';
import { BillingStatus } from '@prisma/client';
import { AuditService } from '../modules/audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  PLAN_LIMITS,
  type PlanFeatures,
  type PlanLimitRow,
} from './plan-limits.config';

export type EffectiveLimits = PlanLimitRow & {
  maxBranches: number;
  maxUsers: number;
};

export type TenantAccessDescription = {
  ok: boolean;
  code?: string;
  message?: string;
};

const TENANT_ACCESS_MESSAGES: Record<string, string> = {
  TENANT_SUSPENDED:
    'This account is suspended. Contact your administrator or support.',
  TENANT_CANCELED: 'This account is closed. Contact support if you need help.',
  TENANT_TRIAL_EXPIRED:
    'Your trial has ended. Contact support to continue using RestoCafe OS.',
  TENANT_PAST_DUE:
    'This account has a billing issue. Contact support to restore full access.',
};

@Injectable()
export class CommerceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  getDefaultTrialDays(): number {
    const raw = this.config.get<string>('COMMERCE_DEFAULT_TRIAL_DAYS');
    const n = raw ? parseInt(raw, 10) : 14;
    return Number.isFinite(n) && n > 0 && n <= 365 ? n : 14;
  }

  isPastDueEnforced(): boolean {
    return this.config.get<string>('COMMERCE_ENFORCE_PAST_DUE') === 'true';
  }

  getEffectiveLimits(
    tenant: Pick<Tenant, 'subscriptionPlan' | 'maxBranches' | 'maxUsers'>,
  ): EffectiveLimits {
    const base = PLAN_LIMITS[tenant.subscriptionPlan];
    const maxBranches = tenant.maxBranches ?? base.maxBranches;
    const maxUsers = tenant.maxUsers ?? base.maxUsers;
    return {
      ...base,
      maxBranches,
      maxUsers,
    };
  }

  /**
   * Whether the tenant's effective plan includes a product flag (read-only gating; e.g. AI advisory).
   */
  isPlanFeatureEnabled(
    tenant: Pick<Tenant, 'subscriptionPlan' | 'maxBranches' | 'maxUsers'>,
    feature: keyof PlanFeatures,
  ): boolean {
    return this.getEffectiveLimits(tenant).features[feature];
  }

  /**
   * Explain why staff/guest access is allowed or blocked (stable `code` for UI and support).
   */
  describeTenantAccess(
    tenant: Pick<Tenant, 'billingStatus' | 'trialEndsAt' | 'metadata'>,
  ): TenantAccessDescription {
    if (tenant.billingStatus === BillingStatus.suspended) {
      return {
        ok: false,
        code: 'TENANT_SUSPENDED',
        message: TENANT_ACCESS_MESSAGES.TENANT_SUSPENDED,
      };
    }
    if (tenant.billingStatus === BillingStatus.canceled) {
      return {
        ok: false,
        code: 'TENANT_CANCELED',
        message: TENANT_ACCESS_MESSAGES.TENANT_CANCELED,
      };
    }
    if (
      this.isPastDueEnforced() &&
      tenant.billingStatus === BillingStatus.past_due
    ) {
      return {
        ok: false,
        code: 'TENANT_PAST_DUE',
        message: TENANT_ACCESS_MESSAGES.TENANT_PAST_DUE,
      };
    }
    if (tenant.billingStatus === BillingStatus.trialing) {
      if (tenant.trialEndsAt && tenant.trialEndsAt.getTime() < Date.now()) {
        return {
          ok: false,
          code: 'TENANT_TRIAL_EXPIRED',
          message: TENANT_ACCESS_MESSAGES.TENANT_TRIAL_EXPIRED,
        };
      }
    }
    return { ok: true };
  }

  private throwTenantAccessDenied(desc: TenantAccessDescription): never {
    if (!desc.code || !desc.message) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Access denied',
        code: 'TENANT_ACCESS_DENIED',
      });
    }
    throw new ForbiddenException({
      statusCode: 403,
      message: desc.message,
      code: desc.code,
    });
  }

  /**
   * Staff JWT and login: block suspended/canceled, expired trials, and optionally past_due.
   */
  assertStaffTenantAccess(
    tenant: Pick<Tenant, 'billingStatus' | 'trialEndsAt' | 'metadata'>,
  ): void {
    const desc = this.describeTenantAccess(tenant);
    if (!desc.ok) {
      this.throwTenantAccessDenied(desc);
    }
  }

  /**
   * Public guest routes: same enforcement (no ordering on blocked tenants).
   */
  assertPublicTenantAccess(
    tenant: Pick<Tenant, 'billingStatus' | 'trialEndsAt' | 'metadata'>,
  ): void {
    this.assertStaffTenantAccess(tenant);
  }

  async getCommerceReadModel(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    const limits = this.getEffectiveLimits(tenant);
    const [branchCount, userCount, menuItemCount] = await Promise.all([
      this.prisma.branch.count({ where: { tenantId } }),
      this.prisma.tenantMember.count({ where: { tenantId } }),
      this.prisma.menuItem.count({
        where: { branch: { tenantId } },
      }),
    ]);
    const access = this.describeTenantAccess(tenant);
    const meta = (tenant.metadata as Record<string, unknown> | null) ?? {};
    const engagement =
      typeof meta.commercialEngagement === 'string'
        ? meta.commercialEngagement
        : undefined;
    return {
      tenantId: tenant.id,
      slug: tenant.slug,
      subscriptionPlan: tenant.subscriptionPlan,
      billingStatus: tenant.billingStatus,
      trialEndsAt: tenant.trialEndsAt,
      currentPeriodEnd: tenant.currentPeriodEnd,
      maxBranches: limits.maxBranches,
      branchesInUse: branchCount,
      maxUsers: limits.maxUsers,
      usersInUse: userCount,
      features: limits.features,
      hasStripeCustomer: Boolean(tenant.stripeCustomerId),
      access,
      limits: {
        maxBranches: limits.maxBranches,
        branchesInUse: branchCount,
        maxUsers: limits.maxUsers,
        usersInUse: userCount,
      },
      /** Line items across all branches — used for menu-import trigger UX (see docs/growth/RETENTION_BACKLOG.md). */
      menuItemsInCatalog: menuItemCount,
      engagement: engagement ? { commercialEngagement: engagement } : {},
    };
  }

  async recordAnalyticsEvent(
    name: string,
    tenantId: string | undefined,
    payload?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.analyticsEvent.create({
      data: {
        name,
        tenantId: tenantId ?? null,
        payload: payload === undefined ? undefined : (payload as object),
      },
    });
  }

  /**
   * Enforce plan feature flags (e.g. inventory) for branch-scoped product routes.
   */
  async assertPlanFeatureForTenant(
    tenantId: string,
    feature: keyof PlanFeatures,
  ): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    const limits = this.getEffectiveLimits(tenant);
    if (!limits.features[feature]) {
      const code = `PLAN_FEATURE_${feature.toUpperCase()}`;
      throw new ForbiddenException({
        statusCode: 403,
        message: `This plan does not include ${feature}.`,
        code,
      });
    }
  }

  /**
   * Support/cron: expire trials that are past `trialEndsAt` while still `trialing`.
   * Sets metadata for auditability; logs per tenant.
   */
  async expireDueTrials(): Promise<{ updated: number }> {
    const now = new Date();
    const due = await this.prisma.tenant.findMany({
      where: {
        billingStatus: BillingStatus.trialing,
        trialEndsAt: { lt: now },
      },
    });
    let updated = 0;
    for (const t of due) {
      const prev = (t.metadata as Record<string, unknown> | null) ?? {};
      await this.prisma.tenant.update({
        where: { id: t.id },
        data: {
          billingStatus: BillingStatus.suspended,
          metadata: {
            ...prev,
            trialExpiredAt: now.toISOString(),
            blockReasonCode: 'trial_end',
            blockDetail: 'Trial period ended',
          } as object,
        },
      });
      await this.audit.log({
        tenantId: t.id,
        action: 'commerce.trial_expired',
        entity: 'tenant',
        entityId: t.id,
        metadata: {
          trialEndsAt: t.trialEndsAt?.toISOString(),
        },
      });
      await this.recordAnalyticsEvent('tenant.trial_expired', t.id, {
        trialEndsAt: t.trialEndsAt?.toISOString(),
      });
      updated++;
    }
    return { updated };
  }
}
