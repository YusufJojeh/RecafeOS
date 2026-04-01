import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { BranchesService } from '../branches/branches.service';
import { CommerceService } from '../../commerce/commerce.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  extractCommercialFromMetadata,
  extractPilotFromMetadata,
  parseBranchRolloutsFromMetadata,
} from './support-metadata.model';

@Injectable()
export class SupportTenantLookupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commerce: CommerceService,
    private readonly branches: BranchesService,
  ) {}

  async listBranchesForSupport(tenantId: string) {
    const t = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!t) {
      throw new NotFoundException('Tenant');
    }
    return this.branches.listBranchSummariesForTenant(tenantId);
  }

  getOnboardingStatusForSupport(tenantId: string, branchId: string) {
    return this.branches.getOnboardingStatus(tenantId, branchId);
  }

  async tenantBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        billingStatus: true,
        subscriptionPlan: true,
      },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant');
    }
    return {
      tenantId: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      billingStatus: tenant.billingStatus,
      subscriptionPlan: tenant.subscriptionPlan,
    };
  }

  async tenantSummary(tenantId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant');
    }
    const pilotBase = extractPilotFromMetadata(tenant.metadata);
    const commercialMeta = extractCommercialFromMetadata(tenant.metadata);
    const limits = this.commerce.getEffectiveLimits(tenant);
    const pilot = {
      ...pilotBase,
      modulesEffective: limits.features,
    };
    const access = this.commerce.describeTenantAccess(tenant);
    const tenantSafe = {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      createdAt: tenant.createdAt,
      subscriptionPlan: tenant.subscriptionPlan,
      billingStatus: tenant.billingStatus,
      trialEndsAt: tenant.trialEndsAt,
      currentPeriodEnd: tenant.currentPeriodEnd,
      maxBranches: tenant.maxBranches,
      maxUsers: tenant.maxUsers,
      stripeCustomerId: tenant.stripeCustomerId,
      stripeSubscriptionId: tenant.stripeSubscriptionId,
    };
    const [
      branchCount,
      memberCount,
      orderCount24h,
      menuItemCount,
      floorTableCount,
      lastOrder,
      onboardingRollup,
      feedbackCount,
      branchRows,
    ] = await Promise.all([
      this.prisma.branch.count({ where: { tenantId } }),
      this.prisma.tenantMember.count({ where: { tenantId } }),
      this.prisma.order.count({
        where: {
          tenantId,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.menuItem.count({
        where: { branch: { tenantId } },
      }),
      this.prisma.floorTable.count({
        where: { branch: { tenantId } },
      }),
      this.prisma.order.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, createdAt: true, branchId: true, status: true },
      }),
      this.buildOnboardingRollup(tenantId),
      this.prisma.pilotFeedbackItem.count({ where: { tenantId } }),
      this.prisma.branch.findMany({
        where: { tenantId },
        select: { id: true, name: true, slug: true },
      }),
    ]);

    const rolloutsRaw = parseBranchRolloutsFromMetadata(tenant.metadata);
    const branchNameById = new Map(branchRows.map((b) => [b.id, b] as const));
    const branchRollouts =
      rolloutsRaw?.map((r) => {
        const b = branchNameById.get(r.branchId);
        return {
          ...r,
          branchName: b?.name ?? null,
          branchSlug: b?.slug ?? null,
        };
      }) ?? null;

    return {
      tenant: tenantSafe,
      pilot,
      onboardingRollup,
      pilotFeedbackCount: feedbackCount,
      commercial: {
        metadata: commercialMeta,
        access,
        effectiveLimits: {
          maxBranches: limits.maxBranches,
          maxUsers: limits.maxUsers,
          branchesInUse: branchCount,
          usersInUse: memberCount,
          features: limits.features,
        },
        pastDueEnforced: this.commerce.isPastDueEnforced(),
      },
      expansion: {
        branchesRemaining: Math.max(0, limits.maxBranches - branchCount),
        seatsRemaining: Math.max(0, limits.maxUsers - memberCount),
      },
      branchRollouts,
      counts: {
        branches: branchCount,
        members: memberCount,
        ordersLast24h: orderCount24h,
        menuItems: menuItemCount,
        floorTables: floorTableCount,
      },
      lastOrder: lastOrder
        ? {
            id: lastOrder.id,
            createdAt: lastOrder.createdAt,
            branchId: lastOrder.branchId,
            status: lastOrder.status,
          }
        : null,
    };
  }

  /**
   * Automatable health lines for CS — see docs/growth/CUSTOMER_HEALTH_SIGNALS.md.
   * Suggestions only; does not overwrite metadata.
   */
  async tenantHealthSignals(tenantId: string): Promise<{
    level: 'green' | 'yellow' | 'red';
    suggestedLines: string[];
  }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      return { level: 'green', suggestedLines: [] };
    }
    const lines: string[] = [];
    const access = this.commerce.describeTenantAccess(tenant);
    if (!access.ok) {
      lines.push(
        `Billing/access: ${access.code ?? 'restricted'} — ${access.message ?? 'check commercial state'}.`,
      );
    }

    const weekAgo = new Date(Date.now() - 7 * 86_400_000);
    const lastPaid = await this.prisma.order.findFirst({
      where: { tenantId, status: OrderStatus.PAID },
      orderBy: { paidAt: 'desc' },
      select: { paidAt: true },
    });
    const paidInWeek = await this.prisma.order.count({
      where: {
        tenantId,
        status: OrderStatus.PAID,
        paidAt: { gte: weekAgo },
      },
    });

    if (!lastPaid?.paidAt) {
      lines.push('No paid orders recorded for this tenant yet.');
    } else if (paidInWeek === 0) {
      lines.push(
        `No paid orders in the last 7 days (last paid at ${lastPaid.paidAt.toISOString()}).`,
      );
    }

    const openCritical = await this.prisma.pilotFeedbackItem.count({
      where: {
        tenantId,
        status: 'open',
        businessCritical: true,
      },
    });
    if (openCritical > 0) {
      lines.push(
        `${openCritical} open pilot feedback item(s) marked business-critical.`,
      );
    }

    const rollup = await this.buildOnboardingRollup(tenantId);
    if (rollup.branchesWithBlocking > 0) {
      lines.push(
        `${rollup.branchesWithBlocking} branch(es) still have blocking onboarding steps.`,
      );
    }

    const limits = this.commerce.getEffectiveLimits(tenant);
    const branchCount = await this.prisma.branch.count({
      where: { tenantId },
    });
    const branchesRemaining = Math.max(0, limits.maxBranches - branchCount);
    if (branchesRemaining === 0 && branchCount > 0) {
      lines.push(
        'Branch limit reached for current plan — confirm contract/plan before promising another site (docs/growth/BRANCH_ROLLOUT_MODEL.md).',
      );
    }

    const menuItemCount = await this.prisma.menuItem.count({
      where: { branch: { tenantId } },
    });
    if (menuItemCount >= 80) {
      lines.push(
        `Large catalog (${menuItemCount} menu line items) — CSV/JSON bulk import is the default build trigger; align with product before manual-only changes at scale (docs/growth/RETENTION_BACKLOG.md).`,
      );
    }

    const branchRows = await this.prisma.branch.findMany({
      where: { tenantId },
      select: { id: true },
    });
    const rolloutEntries = parseBranchRolloutsFromMetadata(tenant.metadata);
    const rolloutIds = new Set((rolloutEntries ?? []).map((r) => r.branchId));
    const missingRolloutLedger = branchRows.filter(
      (b) => !rolloutIds.has(b.id),
    );
    if (missingRolloutLedger.length > 0 && branchRows.length > 0) {
      lines.push(
        `${missingRolloutLedger.length} branch(es) missing from Tenant.metadata.branchRollouts — update CS ledger stages (docs/growth/BRANCH_ROLLOUT_MODEL.md).`,
      );
    }

    const visitCount = await this.prisma.customerVisit.count({
      where: { branch: { tenantId }, visitedAt: { gte: weekAgo } },
    });
    if (visitCount > 0) {
      const byCustomer = await this.prisma.customerVisit.groupBy({
        by: ['customerId'],
        where: { branch: { tenantId }, visitedAt: { gte: weekAgo } },
        _count: { id: true },
      });
      const repeatCustomers = byCustomer.filter((g) => g._count.id >= 2).length;
      lines.push(
        `Recorded visits (7d): ${visitCount}; customers with 2+ visits in window: ${repeatCustomers}. Compare per-branch repeat share on ops Reports → visit signals.`,
      );
    }

    let level: 'green' | 'yellow' | 'red' = 'green';
    if (!access.ok || paidInWeek === 0) {
      level = 'red';
    } else if (
      openCritical > 0 ||
      rollup.branchesWithBlocking > 0 ||
      branchesRemaining === 0 ||
      missingRolloutLedger.length > 0
    ) {
      level = 'yellow';
    }

    return { level, suggestedLines: lines };
  }

  private async buildOnboardingRollup(tenantId: string) {
    const branches = await this.prisma.branch.findMany({
      where: { tenantId },
      select: { id: true },
    });
    if (branches.length === 0) {
      return {
        branchesTotal: 0,
        branchesReadyForGoLive: 0,
        branchesWithBlocking: 0,
        worstBlockingIncompleteCount: 0,
      };
    }
    const statuses = await Promise.all(
      branches.map((b) => this.getOnboardingStatusForSupport(tenantId, b.id)),
    );
    const ready = statuses.filter((s) => s.readyForGoLive).length;
    const blockingCounts = statuses.map((s) => s.blockingIncompleteCount);
    return {
      branchesTotal: branches.length,
      branchesReadyForGoLive: ready,
      branchesWithBlocking: statuses.length - ready,
      worstBlockingIncompleteCount: Math.max(0, ...blockingCounts),
    };
  }
}
