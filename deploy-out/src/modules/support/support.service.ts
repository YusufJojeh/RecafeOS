import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  BillingStatus,
  OrderStatus,
  type PilotFeedbackStatus,
  type PilotFeedbackType,
  type Tenant,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { BranchesService } from '../branches/branches.service';
import { CommerceService } from '../../commerce/commerce.service';
import {
  ensureGlobalPermissions,
  ensureRoleTemplatesForTenant,
  hashPassword,
} from '../../provisioning/provisioning.helpers';
import { BranchMenuCacheInvalidationService } from '../../common/menu-cache/branch-menu-cache-invalidation.service';
import { LeaderLockService } from '../../common/leader-lock/leader-lock.service';
import { OperationalHealthService } from '../../common/health/operational-health.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { PatchSupportCommerceDto } from './dto/patch-support-commerce.dto';
import type { PatchSupportMetadataDto } from './dto/patch-support-metadata.dto';
import type { SuspendTenantDto } from './dto/suspend-tenant.dto';
import { mergeSupportAuditMetadata } from './support-operator.util';
import type { CreatePilotFeedbackDto } from './dto/create-pilot-feedback.dto';
import type { CreatePilotWeeklySnapshotDto } from './dto/create-pilot-weekly-snapshot.dto';
import type { PatchPilotFeedbackDto } from './dto/patch-pilot-feedback.dto';
import type { CreateSupportTenantMemberDto } from './dto/create-support-tenant-member.dto';
import type { CloneMenuDto } from './dto/clone-menu.dto';

/** Acknowledged limitation row in Tenant.metadata — see docs/operations/PILOT_METADATA_SCHEMA.md */
export type PilotLimitationAck = {
  id?: string;
  description: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  venueSignoff?: boolean | string;
};

function parseLimitationsAck(raw: unknown): PilotLimitationAck[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const out: PilotLimitationAck[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const o = item as Record<string, unknown>;
    const description =
      typeof o.description === 'string' ? o.description.trim() : '';
    if (!description) {
      continue;
    }
    out.push({
      id: typeof o.id === 'string' ? o.id : undefined,
      description,
      acknowledgedAt:
        typeof o.acknowledgedAt === 'string' ? o.acknowledgedAt : undefined,
      acknowledgedBy:
        typeof o.acknowledgedBy === 'string' ? o.acknowledgedBy : undefined,
      venueSignoff:
        typeof o.venueSignoff === 'boolean'
          ? o.venueSignoff
          : typeof o.venueSignoff === 'string'
            ? o.venueSignoff
            : undefined,
    });
  }
  return out.length ? out : undefined;
}

function parseStringArray(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const out = raw.filter(
    (x): x is string => typeof x === 'string' && x.length > 0,
  );
  return out.length ? out : undefined;
}

/** `Tenant.metadata.branchRollouts` — see docs/growth/BRANCH_ROLLOUT_MODEL.md */
export type BranchRolloutEntry = {
  branchId: string;
  stage: string;
  updatedAt: string;
  owner?: string;
  notes?: string;
};

function parseBranchRolloutsFromMetadata(
  metadata: unknown,
): BranchRolloutEntry[] | undefined {
  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }
  const raw = (metadata as Record<string, unknown>).branchRollouts;
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const out: BranchRolloutEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const o = item as Record<string, unknown>;
    const branchId = typeof o.branchId === 'string' ? o.branchId.trim() : '';
    const stage = typeof o.stage === 'string' ? o.stage.trim() : '';
    const updatedAt = typeof o.updatedAt === 'string' ? o.updatedAt.trim() : '';
    if (!branchId || !stage || !updatedAt) {
      continue;
    }
    out.push({
      branchId,
      stage,
      updatedAt,
      owner: typeof o.owner === 'string' ? o.owner : undefined,
      notes: typeof o.notes === 'string' ? o.notes : undefined,
    });
  }
  return out.length ? out : undefined;
}

function parseEnabledModulesSnapshot(
  raw: unknown,
): Record<string, boolean> | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const o = raw as Record<string, unknown>;
  const entries = Object.entries(o).filter(
    (e): e is [string, boolean] => typeof e[1] === 'boolean',
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
}

/** Keys in Tenant.metadata used for pilots / demos — see docs/operations/PILOT_METADATA_SCHEMA.md */
export function extractPilotFromMetadata(metadata: unknown): {
  demo: boolean;
  commercialEngagement?: string;
  pilotPhase?: string;
  csOwner?: string;
  goLiveDate?: string;
  pilotNotes?: string;
  venueStatus?: string;
  goLiveDateActual?: string;
  engineeringLiaison?: string;
  pilotHealth?: string;
  limitationsAcknowledged?: PilotLimitationAck[];
  externalIncidentIds?: string[];
  enabledModulesSnapshot?: Record<string, boolean>;
  branchCountSnapshot?: number;
} {
  const m = (
    metadata && typeof metadata === 'object' ? metadata : {}
  ) as Record<string, unknown>;
  const branchSnap = m.branchCountSnapshot;
  return {
    demo: m.demo === true,
    commercialEngagement:
      typeof m.commercialEngagement === 'string'
        ? m.commercialEngagement
        : undefined,
    pilotPhase: typeof m.pilotPhase === 'string' ? m.pilotPhase : undefined,
    csOwner: typeof m.csOwner === 'string' ? m.csOwner : undefined,
    goLiveDate: typeof m.goLiveDate === 'string' ? m.goLiveDate : undefined,
    pilotNotes: typeof m.pilotNotes === 'string' ? m.pilotNotes : undefined,
    venueStatus: typeof m.venueStatus === 'string' ? m.venueStatus : undefined,
    goLiveDateActual:
      typeof m.goLiveDateActual === 'string' ? m.goLiveDateActual : undefined,
    engineeringLiaison:
      typeof m.engineeringLiaison === 'string'
        ? m.engineeringLiaison
        : undefined,
    pilotHealth: typeof m.pilotHealth === 'string' ? m.pilotHealth : undefined,
    limitationsAcknowledged: parseLimitationsAck(m.limitationsAcknowledged),
    externalIncidentIds: parseStringArray(m.externalIncidentIds),
    enabledModulesSnapshot: parseEnabledModulesSnapshot(
      m.enabledModulesSnapshot,
    ),
    branchCountSnapshot:
      typeof branchSnap === 'number' && Number.isFinite(branchSnap)
        ? branchSnap
        : undefined,
  };
}

/** Commercial / block context from metadata — see docs/operations/PILOT_METADATA_SCHEMA.md */
export function extractCommercialFromMetadata(metadata: unknown): {
  commercialEngagement?: string;
  blockReasonCode?: string;
  blockDetail?: string;
  trialExpiredAt?: string;
  suspensionReasonCode?: string;
  suspensionNote?: string;
  suspendedAt?: string;
  previousBillingStatus?: string;
} {
  const m = (
    metadata && typeof metadata === 'object' ? metadata : {}
  ) as Record<string, unknown>;
  const str = (k: string) => (typeof m[k] === 'string' ? m[k] : undefined);
  return {
    commercialEngagement: str('commercialEngagement'),
    blockReasonCode: str('blockReasonCode'),
    blockDetail: str('blockDetail'),
    trialExpiredAt: str('trialExpiredAt'),
    suspensionReasonCode: str('suspensionReasonCode'),
    suspensionNote: str('suspensionNote'),
    suspendedAt: str('suspendedAt'),
    previousBillingStatus: str('previousBillingStatus'),
  };
}

/** Read-only operational views for support (no PII beyond what is required to resolve tickets). */
@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationalHealth: OperationalHealthService,
    private readonly audit: AuditService,
    private readonly commerce: CommerceService,
    private readonly branches: BranchesService,
    private readonly leaderLock: LeaderLockService,
    private readonly branchMenuCache: BranchMenuCacheInvalidationService,
  ) {}

  /** Branch id/slug list for support console; 404 if tenant missing. */
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

  /** Same payload as staff onboarding-status; support API key only. */
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
  private async computeTenantHealthSignals(tenantId: string): Promise<{
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

  /** Aggregate onboarding across all branches (pilot health). */
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

  /** Paid pilots: `metadata.commercialEngagement` = `pilot`. */
  async listPilotPortfolio() {
    const tenantRows = await this.prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        metadata: true,
      },
      orderBy: { name: 'asc' },
    });
    const rows = tenantRows.filter((row) => {
      const metadata =
        row.metadata &&
        typeof row.metadata === 'object' &&
        !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null;
      return metadata?.commercialEngagement === 'pilot';
    });
    if (rows.length === 0) {
      return { items: [] };
    }
    const ids = rows.map((r) => r.id);
    const feedbackCounts = await this.prisma.pilotFeedbackItem.groupBy({
      by: ['tenantId'],
      where: { tenantId: { in: ids } },
      _count: { id: true },
    });
    const countMap = new Map(
      feedbackCounts.map(
        (c: { tenantId: string; _count: { id: number } }) =>
          [c.tenantId, c._count.id] as const,
      ),
    );
    const items = await Promise.all(
      rows.map(async (r) => {
        const branchCount = await this.prisma.branch.count({
          where: { tenantId: r.id },
        });
        const pilot = extractPilotFromMetadata(r.metadata);
        return {
          tenantId: r.id,
          name: r.name,
          slug: r.slug,
          pilot,
          branchCount,
          pilotFeedbackCount: countMap.get(r.id) ?? 0,
        };
      }),
    );
    return { items };
  }

  async createPilotFeedback(
    tenantId: string,
    dto: CreatePilotFeedbackDto,
    createdByOperator?: string,
  ) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant');
    }
    let branchId: string | null | undefined = dto.branchId?.trim() || undefined;
    if (branchId) {
      const b = await this.prisma.branch.findFirst({
        where: { id: branchId, tenantId },
        select: { id: true },
      });
      if (!b) {
        throw new BadRequestException('branchId does not belong to tenant');
      }
    } else {
      branchId = undefined;
    }
    const row = await this.prisma.pilotFeedbackItem.create({
      data: {
        tenantId,
        branchId: branchId ?? null,
        feedbackType: dto.feedbackType,
        severity: dto.severity,
        moduleTag: dto.moduleTag?.trim() || null,
        blastRadius: dto.blastRadius?.trim() || null,
        evidenceQuality: dto.evidenceQuality ?? 'verbal_only',
        title: dto.title.trim(),
        description: dto.description.trim(),
        requestId: dto.requestId?.trim() || null,
        externalIncidentUrl: dto.externalIncidentUrl?.trim() || null,
        promotedToEngineering: dto.promotedToEngineering === true,
        createdByOperator: createdByOperator?.trim() || null,
        status: dto.status ?? 'open',
        themeKey: dto.themeKey?.trim() || null,
        businessCritical: dto.businessCritical === true,
        triageNotes: dto.triageNotes?.trim() || null,
      },
    });
    await this.audit.log({
      tenantId,
      action: 'support.pilot_feedback_create',
      entity: 'pilot_feedback',
      entityId: row.id,
      metadata: mergeSupportAuditMetadata(
        { feedbackType: dto.feedbackType, title: dto.title },
        createdByOperator,
      ),
    });
    return row;
  }

  async listPilotFeedback(
    tenantId: string,
    query: {
      limit?: number;
      feedbackType?: PilotFeedbackType;
      status?: PilotFeedbackStatus;
      promotedToEngineering?: boolean;
    },
  ) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant');
    }
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const where: Prisma.PilotFeedbackItemWhereInput = { tenantId };
    if (query.feedbackType) {
      where.feedbackType = query.feedbackType;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.promotedToEngineering !== undefined) {
      where.promotedToEngineering = query.promotedToEngineering;
    }
    const items = await this.prisma.pilotFeedbackItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return { items, limit };
  }

  async patchPilotFeedback(
    tenantId: string,
    feedbackId: string,
    dto: PatchPilotFeedbackDto,
    supportOperator?: string,
  ) {
    const existing = await this.prisma.pilotFeedbackItem.findFirst({
      where: { id: feedbackId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('PilotFeedbackItem');
    }
    const data: Prisma.PilotFeedbackItemUpdateInput = {};
    if (dto.feedbackType !== undefined) {
      data.feedbackType = dto.feedbackType;
    }
    if (dto.severity !== undefined) {
      data.severity = dto.severity;
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
    }
    if (dto.themeKey !== undefined) {
      data.themeKey = dto.themeKey.trim() || null;
    }
    if (dto.businessCritical !== undefined) {
      data.businessCritical = dto.businessCritical;
    }
    if (dto.triageNotes !== undefined) {
      data.triageNotes = dto.triageNotes.trim() || null;
    }
    if (dto.promotedToEngineering !== undefined) {
      data.promotedToEngineering = dto.promotedToEngineering;
    }
    const updated = await this.prisma.pilotFeedbackItem.update({
      where: { id: feedbackId },
      data,
    });
    await this.audit.log({
      tenantId,
      action: 'support.pilot_feedback_patch',
      entity: 'pilot_feedback',
      entityId: feedbackId,
      metadata: mergeSupportAuditMetadata({ patch: dto }, supportOperator),
    });
    return updated;
  }

  /** Aggregated weekly health: pilot tenants, feedback in window, support audit counts. */
  async weeklyPilotReport(sinceRaw?: string) {
    const until = new Date();
    let since: Date;
    if (sinceRaw?.trim()) {
      since = new Date(sinceRaw.trim());
      if (Number.isNaN(since.getTime())) {
        throw new BadRequestException(
          'Invalid since (use ISO date or datetime)',
        );
      }
    } else {
      since = new Date(until.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const portfolio = await this.listPilotPortfolio();
    const tenants = await Promise.all(
      portfolio.items.map(async (p) => {
        const tid = p.tenantId;
        const summary = await this.tenantSummary(tid);
        const feedbackRows = await this.prisma.pilotFeedbackItem.findMany({
          where: {
            tenantId: tid,
            createdAt: { gte: since },
          },
          select: {
            id: true,
            feedbackType: true,
            themeKey: true,
            status: true,
            businessCritical: true,
            title: true,
            createdAt: true,
          },
        });
        const supportAuditActionsCount = await this.prisma.auditLog.count({
          where: {
            tenantId: tid,
            createdAt: { gte: since },
            action: { startsWith: 'support.' },
          },
        });
        const byTheme: Record<string, number> = {};
        const byType: Record<string, number> = {};
        for (const f of feedbackRows) {
          const tk = f.themeKey?.trim() || '(untagged)';
          byTheme[tk] = (byTheme[tk] ?? 0) + 1;
          const ft = f.feedbackType;
          byType[ft] = (byType[ft] ?? 0) + 1;
        }
        const openBlockersCount = await this.prisma.pilotFeedbackItem.count({
          where: {
            tenantId: tid,
            status: { in: ['open', 'triaged'] },
            OR: [
              { businessCritical: true },
              { feedbackType: 'product_gap' },
              { severity: { in: ['sev1', 'sev2'] } },
            ],
          },
        });
        const healthSignals = await this.computeTenantHealthSignals(tid);
        return {
          tenantId: tid,
          name: p.name,
          slug: p.slug,
          pilot: p.pilot,
          summary: {
            ordersLast24h: summary.counts.ordersLast24h,
            onboardingRollup: summary.onboardingRollup,
            pilotFeedbackCount: summary.pilotFeedbackCount,
          },
          window: {
            feedbackNewCount: feedbackRows.length,
            feedbackByTheme: byTheme,
            feedbackByType: byType,
            supportAuditActionsCount,
            openBlockersCount,
          },
          healthSignals,
        };
      }),
    );

    return {
      since: since.toISOString(),
      until: until.toISOString(),
      tenants,
    };
  }

  async upsertPilotWeeklySnapshot(
    tenantId: string,
    dto: CreatePilotWeeklySnapshotDto,
    supportOperator?: string,
  ) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant');
    }
    const weekStart = new Date(`${dto.weekStart}T00:00:00.000Z`);
    if (Number.isNaN(weekStart.getTime())) {
      throw new BadRequestException('Invalid weekStart');
    }
    const payload = (dto.jsonPayload ?? {}) as object;
    const row = await this.prisma.pilotWeeklySnapshot.upsert({
      where: {
        tenantId_weekStart: { tenantId, weekStart },
      },
      create: {
        tenantId,
        weekStart,
        pilotHealth: dto.pilotHealth?.trim() || null,
        jsonPayload: payload,
      },
      update: {
        pilotHealth: dto.pilotHealth?.trim() || null,
        jsonPayload: payload,
      },
    });
    await this.audit.log({
      tenantId,
      action: 'support.pilot_weekly_snapshot_upsert',
      entity: 'pilot_weekly_snapshot',
      entityId: row.id,
      metadata: mergeSupportAuditMetadata(
        { weekStart: dto.weekStart },
        supportOperator,
      ),
    });
    return row;
  }

  async listPilotWeeklySnapshots(query: {
    tenantId?: string;
    weekStart?: string;
  }) {
    const where: Prisma.PilotWeeklySnapshotWhereInput = {};
    if (query.tenantId?.trim()) {
      where.tenantId = query.tenantId.trim();
    }
    if (query.weekStart?.trim()) {
      const d = new Date(`${query.weekStart.trim()}T00:00:00.000Z`);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('Invalid weekStart');
      }
      where.weekStart = d;
    }
    const items = await this.prisma.pilotWeeklySnapshot.findMany({
      where,
      orderBy: [{ weekStart: 'desc' }, { tenantId: 'asc' }],
      take: 500,
    });
    return { items, limit: 500 };
  }

  async patchCommerce(
    tenantId: string,
    dto: PatchSupportCommerceDto,
    supportOperator?: string,
  ) {
    const existing = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Tenant');
    }
    const data: Prisma.TenantUpdateInput = {};
    if (dto.subscriptionPlan !== undefined) {
      data.subscriptionPlan = dto.subscriptionPlan;
    }
    if (dto.billingStatus !== undefined) {
      data.billingStatus = dto.billingStatus;
    }
    if (dto.trialEndsAt !== undefined) {
      data.trialEndsAt =
        dto.trialEndsAt === null || dto.trialEndsAt === ''
          ? null
          : new Date(dto.trialEndsAt);
    }
    if (dto.currentPeriodEnd !== undefined) {
      data.currentPeriodEnd =
        dto.currentPeriodEnd === null || dto.currentPeriodEnd === ''
          ? null
          : new Date(dto.currentPeriodEnd);
    }
    if (dto.maxBranches !== undefined) {
      data.maxBranches = dto.maxBranches;
    }
    if (dto.maxUsers !== undefined) {
      data.maxUsers = dto.maxUsers;
    }
    if (dto.stripeCustomerId !== undefined) {
      data.stripeCustomerId = dto.stripeCustomerId;
    }
    if (dto.stripeSubscriptionId !== undefined) {
      data.stripeSubscriptionId = dto.stripeSubscriptionId;
    }
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data,
    });
    await this.audit.log({
      tenantId,
      action: 'support.commerce_patch',
      entity: 'tenant',
      entityId: tenantId,
      metadata: mergeSupportAuditMetadata({ patch: dto }, supportOperator),
    });
    await this.commerce.recordAnalyticsEvent(
      'tenant.commerce_updated',
      tenantId,
      {
        keys: Object.keys(dto),
      },
    );
    return updated;
  }

  async suspendTenant(
    tenantId: string,
    dto: SuspendTenantDto,
    supportOperator?: string,
  ) {
    const existing = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Tenant');
    }
    const prev = (existing.metadata as Record<string, unknown> | null) ?? {};
    const merged: Record<string, unknown> = {
      ...prev,
      previousBillingStatus: existing.billingStatus,
      suspensionReasonCode: dto.reasonCode,
      suspensionNote: dto.note?.trim() || undefined,
      suspendedAt: new Date().toISOString(),
    };
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        billingStatus: BillingStatus.suspended,
        metadata: merged as object,
      },
    });
    await this.audit.log({
      tenantId,
      action: 'support.suspend',
      entity: 'tenant',
      entityId: tenantId,
      metadata: mergeSupportAuditMetadata(
        {
          reasonCode: dto.reasonCode,
          note: dto.note,
          previousBillingStatus: existing.billingStatus,
        },
        supportOperator,
      ),
    });
    await this.commerce.recordAnalyticsEvent('tenant.suspended', tenantId, {
      reasonCode: dto.reasonCode,
    });
    return updated;
  }

  private resolveReactivateBillingStatus(existing: Tenant): BillingStatus {
    const meta = (existing.metadata as Record<string, unknown> | null) ?? {};
    const raw = meta.previousBillingStatus;
    const statuses = Object.values(BillingStatus) as string[];
    let next: BillingStatus = BillingStatus.active;
    if (typeof raw === 'string' && statuses.includes(raw)) {
      next = raw as BillingStatus;
    }
    if (next === BillingStatus.trialing) {
      const trialEnd = existing.trialEndsAt;
      if (trialEnd && trialEnd.getTime() < Date.now()) {
        next = BillingStatus.active;
      }
    }
    return next;
  }

  private stripReactivationKeys(
    metadata: Record<string, unknown>,
  ): Record<string, unknown> {
    const next = { ...metadata };
    delete next.previousBillingStatus;
    delete next.suspensionReasonCode;
    delete next.suspensionNote;
    delete next.suspendedAt;
    delete next.blockReasonCode;
    delete next.blockDetail;
    return next;
  }

  async reactivateTenant(tenantId: string, supportOperator?: string) {
    const existing = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Tenant');
    }
    const nextStatus = this.resolveReactivateBillingStatus(existing);
    const meta = (existing.metadata as Record<string, unknown> | null) ?? {};
    const cleaned = this.stripReactivationKeys(meta);
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        billingStatus: nextStatus,
        metadata: cleaned as object,
      },
    });
    await this.audit.log({
      tenantId,
      action: 'support.reactivate',
      entity: 'tenant',
      entityId: tenantId,
      metadata: mergeSupportAuditMetadata(
        {
          restoredBillingStatus: nextStatus,
        },
        supportOperator,
      ),
    });
    await this.commerce.recordAnalyticsEvent('tenant.reactivated', tenantId, {
      billingStatus: nextStatus,
    });
    return updated;
  }

  async patchMetadata(
    tenantId: string,
    dto: PatchSupportMetadataDto,
    supportOperator?: string,
  ) {
    const existing = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Tenant');
    }
    const prev = (existing.metadata as Record<string, unknown> | null) ?? {};
    const merged = { ...prev, ...dto.metadata };
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { metadata: merged as object },
    });
    await this.audit.log({
      tenantId,
      action: 'support.metadata_patch',
      entity: 'tenant',
      entityId: tenantId,
      metadata: mergeSupportAuditMetadata(
        { keys: Object.keys(dto.metadata) },
        supportOperator,
      ),
    });
    return updated;
  }

  /** Placeholder until Stripe-hosted invoices or PDF export ships. */
  invoiceExportReadiness(tenantId: string) {
    return {
      tenantId,
      status: 'manual_export',
      hint: 'Use Reports daily export and payment records until Stripe Billing is connected.',
      futureStripeFields: ['stripeCustomerId', 'stripeSubscriptionId'],
    };
  }

  async runExpireTrialsJob() {
    const result = await this.leaderLock.tryRunExclusiveWithResult(
      'commerce_expire_due_trials',
      900,
      () => this.commerce.expireDueTrials(),
    );
    if (result === null) {
      return { updated: 0 };
    }
    return result;
  }

  /** Safe process snapshot for on-call (requires x-support-api-key). */
  async diagnostics() {
    const snapshot = await this.operationalHealth.snapshot();
    const mem = process.memoryUsage();
    return {
      service: 'restocafe-api',
      version:
        process.env.APP_VERSION ?? process.env.npm_package_version ?? 'unknown',
      gitSha: process.env.GIT_SHA ?? null,
      node: process.version,
      uptimeSec: Math.floor(process.uptime()),
      status: snapshot.status,
      ready: snapshot.canServeTraffic,
      summary: snapshot.summary,
      db: snapshot.dependencies.db.status,
      redis: snapshot.dependencies.redis.status,
      health: snapshot,
      dependencies: snapshot.dependencies,
      topology: snapshot.topology,
      metricsEnabled: process.env.METRICS_ENABLED === 'true',
      env: process.env.NODE_ENV ?? 'development',
      memoryMb: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      },
      checkedAt: snapshot.checkedAt,
    };
  }

  async orderLookup(tenantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: {
        id: true,
        branchId: true,
        status: true,
        type: true,
        totalMinor: true,
        createdAt: true,
        updatedAt: true,
        paidAt: true,
        cancelledAt: true,
        version: true,
      },
    });
    if (!order) {
      throw new NotFoundException('Order');
    }
    return order;
  }

  /**
   * Support-only: add a staff user to a tenant (manager / cashier / kitchen).
   * Idempotent when the email already has membership for this tenant.
   */
  async addTenantMember(
    tenantId: string,
    dto: CreateSupportTenantMemberDto,
    supportOperator?: string,
  ) {
    const email = dto.email.toLowerCase().trim();
    const roleName = dto.role ?? 'cashier';

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant');
    }
    this.commerce.assertStaffTenantAccess(tenant);

    if (dto.defaultBranchId?.trim()) {
      const b = await this.prisma.branch.findFirst({
        where: { id: dto.defaultBranchId.trim(), tenantId },
        select: { id: true },
      });
      if (!b) {
        throw new BadRequestException(
          'defaultBranchId does not belong to tenant',
        );
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await ensureGlobalPermissions(tx);
      await ensureRoleTemplatesForTenant(tx, tenantId);

      const role = await tx.role.findFirst({
        where: { tenantId, name: roleName },
      });
      if (!role) {
        throw new BadRequestException('ROLE_NOT_FOUND');
      }

      const existingMember = await tx.tenantMember.findFirst({
        where: { tenantId, user: { email } },
        include: {
          user: { select: { id: true, email: true, displayName: true } },
        },
      });
      if (existingMember) {
        return {
          idempotent: true as const,
          tenantMemberId: existingMember.id,
          userId: existingMember.userId,
          email: existingMember.user.email,
          displayName: existingMember.user.displayName,
          generatedPassword: undefined as string | undefined,
        };
      }

      const tenantForLimits = await tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
      });
      const limits = this.commerce.getEffectiveLimits(tenantForLimits);
      const memberCount = await tx.tenantMember.count({ where: { tenantId } });
      if (memberCount >= limits.maxUsers) {
        throw new BadRequestException('SEAT_LIMIT_REACHED');
      }

      const existingUser = await tx.user.findUnique({ where: { email } });
      let userId: string;
      let generatedPassword: string | undefined;

      if (existingUser) {
        userId = existingUser.id;
      } else {
        const plain =
          dto.password?.trim() ||
          crypto.randomBytes(12).toString('base64url').slice(0, 16);
        if (!dto.password?.trim()) {
          generatedPassword = plain;
        }
        const passwordHash = await hashPassword(plain);
        const created = await tx.user.create({
          data: {
            email,
            passwordHash,
            displayName:
              dto.displayName?.trim() || email.split('@')[0] || 'User',
          },
        });
        userId = created.id;
      }

      const member = await tx.tenantMember.create({
        data: {
          userId,
          tenantId,
          roleId: role.id,
          defaultBranchId: dto.defaultBranchId?.trim() || null,
        },
      });

      return {
        idempotent: false as const,
        tenantMemberId: member.id,
        userId,
        email,
        displayName: (
          await tx.user.findUniqueOrThrow({ where: { id: userId } })
        ).displayName,
        generatedPassword,
      };
    });

    if (!result.idempotent) {
      await this.audit.log({
        tenantId,
        branchId: dto.defaultBranchId?.trim() || undefined,
        action: 'support.tenant_member_create',
        entity: 'tenant_member',
        entityId: result.tenantMemberId,
        metadata: mergeSupportAuditMetadata(
          { email, role: roleName },
          supportOperator,
        ),
      });
    }

    return result;
  }

  /**
   * Support-only: copy menu catalog (categories, items, modifiers, stock defs) to an empty branch.
   */
  async cloneBranchMenu(
    tenantId: string,
    targetBranchId: string,
    dto: CloneMenuDto,
    supportOperator?: string,
  ) {
    const sourceBranchId = dto.sourceBranchId.trim();
    if (sourceBranchId === targetBranchId) {
      throw new BadRequestException('SOURCE_EQUALS_TARGET');
    }
    const [src, tgt] = await Promise.all([
      this.prisma.branch.findFirst({
        where: { id: sourceBranchId, tenantId },
      }),
      this.prisma.branch.findFirst({
        where: { id: targetBranchId, tenantId },
      }),
    ]);
    if (!src || !tgt) {
      throw new NotFoundException('Branch');
    }
    if (dto.mode !== 'replace_empty') {
      throw new BadRequestException('UNSUPPORTED_MODE');
    }

    const targetMenuCount = await this.prisma.menuItem.count({
      where: { branchId: targetBranchId },
    });
    if (targetMenuCount > 0) {
      throw new BadRequestException('TARGET_BRANCH_NOT_EMPTY');
    }

    const summary = await this.prisma.$transaction(async (tx) => {
      const groups = await tx.modifierGroup.findMany({
        where: { branchId: sourceBranchId },
        include: { options: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { sortOrder: 'asc' },
      });
      const groupMap = new Map<string, string>();
      for (const g of groups) {
        const ng = await tx.modifierGroup.create({
          data: {
            branchId: targetBranchId,
            name: g.name,
            minSelect: g.minSelect,
            maxSelect: g.maxSelect,
            required: g.required,
            sortOrder: g.sortOrder,
          },
        });
        groupMap.set(g.id, ng.id);
        for (const o of g.options) {
          await tx.modifierOption.create({
            data: {
              groupId: ng.id,
              name: o.name,
              priceDelta: o.priceDelta,
              sortOrder: o.sortOrder,
            },
          });
        }
      }

      const categories = await tx.menuCategory.findMany({
        where: { branchId: sourceBranchId },
        orderBy: { sortOrder: 'asc' },
        include: {
          items: { orderBy: { sortOrder: 'asc' } },
        },
      });

      const itemMap = new Map<string, string>();

      for (const c of categories) {
        const nc = await tx.menuCategory.create({
          data: {
            branchId: targetBranchId,
            name: c.name,
            sortOrder: c.sortOrder,
          },
        });
        for (const it of c.items) {
          const ni = await tx.menuItem.create({
            data: {
              branchId: targetBranchId,
              categoryId: nc.id,
              name: it.name,
              description: it.description,
              priceMinor: it.priceMinor,
              imageUrl: it.imageUrl,
              visible: it.visible,
              available: it.available,
              prepStation: it.prepStation,
              sortOrder: it.sortOrder,
            },
          });
          itemMap.set(it.id, ni.id);
        }
      }

      const sourceItems = await tx.menuItem.findMany({
        where: { branchId: sourceBranchId },
        include: { modifierGroups: true },
      });
      let modLinks = 0;
      for (const it of sourceItems) {
        const newItemId = itemMap.get(it.id);
        if (!newItemId) {
          continue;
        }
        for (const link of it.modifierGroups) {
          const newGroupId = groupMap.get(link.modifierGroupId);
          if (!newGroupId) {
            continue;
          }
          await tx.menuItemModifierGroup.create({
            data: {
              menuItemId: newItemId,
              modifierGroupId: newGroupId,
            },
          });
          modLinks += 1;
        }
      }

      const stocks = await tx.stockItem.findMany({
        where: { branchId: sourceBranchId },
        include: { recipes: true },
      });
      const stockMap = new Map<string, string>();
      for (const s of stocks) {
        const ns = await tx.stockItem.create({
          data: {
            branchId: targetBranchId,
            name: s.name,
            unit: s.unit,
            quantity: s.quantity,
            lowThreshold: s.lowThreshold,
          },
        });
        stockMap.set(s.id, ns.id);
      }
      let recipes = 0;
      for (const s of stocks) {
        for (const r of s.recipes) {
          const newItemId = itemMap.get(r.menuItemId);
          const newStockId = stockMap.get(r.stockItemId);
          if (!newItemId || !newStockId) {
            continue;
          }
          await tx.itemRecipe.create({
            data: {
              menuItemId: newItemId,
              stockItemId: newStockId,
              qtyPerUnit: r.qtyPerUnit,
            },
          });
          recipes += 1;
        }
      }

      return {
        categoriesCopied: categories.length,
        itemsCopied: itemMap.size,
        modifierGroupsCopied: groups.length,
        modifierLinksCopied: modLinks,
        stockItemsCopied: stocks.length,
        recipesCopied: recipes,
      };
    });

    await this.audit.log({
      tenantId,
      branchId: targetBranchId,
      action: 'support.clone_menu',
      entity: 'branch',
      entityId: targetBranchId,
      metadata: mergeSupportAuditMetadata(
        {
          sourceBranchId,
          ...summary,
        },
        supportOperator,
      ),
    });

    await this.branchMenuCache.invalidateBranch(targetBranchId);

    return { ok: true as const, ...summary };
  }

  /** Read-only audit tail for support (incidents, support action history). */
  async listAuditLog(
    tenantId: string,
    query: {
      limit?: number;
      cursor?: string;
      actionPrefix?: string;
      branchId?: string;
    },
  ) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant');
    }
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const where: Prisma.AuditLogWhereInput = { tenantId };
    if (query.branchId?.trim()) {
      where.branchId = query.branchId.trim();
    }
    if (query.actionPrefix?.trim()) {
      where.action = { startsWith: query.actionPrefix.trim() };
    }
    const take = limit + 1;
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      ...(query.cursor?.trim()
        ? { cursor: { id: query.cursor.trim() }, skip: 1 }
        : {}),
      select: {
        id: true,
        tenantId: true,
        branchId: true,
        actorId: true,
        action: true,
        entity: true,
        entityId: true,
        metadata: true,
        createdAt: true,
      },
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;
    return { items, nextCursor, limit };
  }
}
