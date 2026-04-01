import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { OperationalHealthService } from '../../common/health/operational-health.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SupportDiagnosticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationalHealth: OperationalHealthService,
  ) {}

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

  invoiceExportReadiness(tenantId: string) {
    return {
      tenantId,
      status: 'manual_export',
      hint: 'Use Reports daily export and payment records until Stripe Billing is connected.',
      futureStripeFields: ['stripeCustomerId', 'stripeSubscriptionId'],
    };
  }

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
