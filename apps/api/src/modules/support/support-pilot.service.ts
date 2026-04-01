import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  PilotFeedbackStatus,
  PilotFeedbackType,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreatePilotFeedbackDto } from './dto/create-pilot-feedback.dto';
import type { CreatePilotWeeklySnapshotDto } from './dto/create-pilot-weekly-snapshot.dto';
import type { PatchPilotFeedbackDto } from './dto/patch-pilot-feedback.dto';
import { mergeSupportAuditMetadata } from './support-operator.util';
import { extractPilotFromMetadata } from './support-metadata.model';
import { SupportTenantLookupService } from './support-tenant-lookup.service';

@Injectable()
export class SupportPilotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tenantLookup: SupportTenantLookupService,
  ) {}

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
        const summary = await this.tenantLookup.tenantSummary(tid);
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
        const healthSignals = await this.tenantLookup.tenantHealthSignals(tid);
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
}
