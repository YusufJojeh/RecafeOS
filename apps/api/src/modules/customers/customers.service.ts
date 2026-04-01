import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerNoteCategory, OfferKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const MAX_TAGS = 5;
const NOTE_BODY_MAX = 500;
const VISIT_TAKE = 25;
const NOTES_TAKE = 40;

export type CustomerSegment = 'new' | 'occasional' | 'regular' | 'at_risk';

function computeSegment(args: {
  visitCount: number;
  lastVisitAt: Date | null;
  visitsLast90Days: number;
}): CustomerSegment {
  const { visitCount, lastVisitAt, visitsLast90Days } = args;
  const daysSince = lastVisitAt
    ? (Date.now() - lastVisitAt.getTime()) / 86_400_000
    : Number.POSITIVE_INFINITY;

  if (visitCount <= 1 && visitsLast90Days <= 1) {
    return 'new';
  }
  if (Number.isFinite(daysSince) && daysSince > 60 && visitCount >= 2) {
    return 'at_risk';
  }
  if (visitsLast90Days >= 6 || visitCount >= 10) {
    return 'regular';
  }
  if (visitsLast90Days >= 2) {
    return 'occasional';
  }
  return 'occasional';
}

function normalizeTags(raw: string[] | undefined): string[] {
  if (!raw?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw) {
    const s = t.trim().toLowerCase().replace(/\s+/g, '_');
    if (!s || s.length > 32) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

function readCustomerTags(
  tags: Array<{ value: string }> | null | undefined,
): string[] {
  if (!tags?.length) {
    return [];
  }
  return tags.map((entry) => entry.value);
}

function buildNameContainsFilter(
  provider: ReturnType<PrismaService['getDatabaseProvider']>,
  search: string,
): Prisma.StringNullableFilter<'Customer'> {
  const filter: Record<string, unknown> = { contains: search };
  if (provider === 'postgresql') {
    filter.mode = 'insensitive';
  }
  return filter as Prisma.StringNullableFilter<'Customer'>;
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  search(tenantId: string, q: string) {
    const s = q.trim();
    const nameFilter = buildNameContainsFilter(
      this.prisma.getDatabaseProvider(),
      s,
    );
    const where: Prisma.CustomerWhereInput = { tenantId };
    if (s) {
      where.OR = [{ phone: { contains: s } }, { name: nameFilter }];
    }
    return this.prisma.customer.findMany({
      where,
      take: 20,
      orderBy: { updatedAt: 'desc' },
      include: { offers: { where: { redeemed: false } } },
    });
  }

  /** Customers who have visited this branch at least once, optional phone/name filter. */
  searchAtBranch(tenantId: string, branchId: string, q: string) {
    const s = q.trim();
    const nameFilter = buildNameContainsFilter(
      this.prisma.getDatabaseProvider(),
      s,
    );
    const where: Prisma.CustomerWhereInput = {
      tenantId,
      visits: { some: { branchId } },
    };
    if (s) {
      where.AND = [
        {
          OR: [{ phone: { contains: s } }, { name: nameFilter }],
        },
      ];
    }
    return this.prisma.customer.findMany({
      where,
      take: 20,
      orderBy: { updatedAt: 'desc' },
      include: { offers: { where: { redeemed: false } } },
    });
  }

  async get(tenantId: string, id: string) {
    const c = await this.prisma.customer.findFirst({
      where: { id, tenantId },
      include: {
        tagEntries: {
          orderBy: { value: 'asc' },
        },
        offers: { orderBy: { createdAt: 'desc' } },
        noteEntries: {
          orderBy: { createdAt: 'desc' },
          take: NOTES_TAKE,
          include: {
            branch: { select: { id: true, name: true } },
            createdBy: { select: { id: true, displayName: true } },
          },
        },
        visits: {
          orderBy: { visitedAt: 'desc' },
          take: VISIT_TAKE,
          include: {
            branch: { select: { id: true, name: true, slug: true } },
            order: {
              select: {
                id: true,
                totalMinor: true,
                type: true,
                status: true,
                paidAt: true,
              },
            },
          },
        },
      },
    });
    if (!c) {
      throw new NotFoundException();
    }

    const now = new Date();
    const d90 = new Date(now.getTime() - 90 * 86_400_000);

    const [visitsLast90Days, lastVisitRow, branchCounts] = await Promise.all([
      this.prisma.customerVisit.count({
        where: { customerId: id, visitedAt: { gte: d90 } },
      }),
      this.prisma.customerVisit.findFirst({
        where: { customerId: id },
        orderBy: { visitedAt: 'desc' },
        select: { visitedAt: true },
      }),
      this.prisma.customerVisit.groupBy({
        by: ['branchId'],
        where: { customerId: id },
        _count: { id: true },
      }),
    ]);

    const lastVisitAt = lastVisitRow?.visitedAt ?? null;
    const daysSinceLastVisit =
      lastVisitAt != null
        ? Math.floor((now.getTime() - lastVisitAt.getTime()) / 86_400_000)
        : null;

    let primaryBranch: { id: string; name: string } | null = null;
    if (branchCounts.length > 0) {
      const top = branchCounts.reduce((a, b) =>
        b._count.id > a._count.id ? b : a,
      );
      const br = await this.prisma.branch.findFirst({
        where: { id: top.branchId, tenantId },
        select: { id: true, name: true },
      });
      primaryBranch = br;
    }

    const segment = computeSegment({
      visitCount: c.visitCount,
      lastVisitAt,
      visitsLast90Days,
    });

    const unredeemed = c.offers.filter((o) => !o.redeemed);
    const titleCounts = new Map<string, number>();
    for (const o of unredeemed) {
      const k = o.title.trim().toLowerCase();
      titleCounts.set(k, (titleCounts.get(k) ?? 0) + 1);
    }
    const suggestedActions: Array<{
      type: string;
      message: string;
      offerId?: string;
    }> = [];
    for (const [title, cnt] of titleCounts) {
      if (cnt >= 2) {
        suggestedActions.push({
          type: 'dedupe_offers',
          message: `Multiple unredeemed offers share a similar title (“${title}”). Review before adding another.`,
        });
        break;
      }
    }
    if (segment === 'at_risk' && unredeemed.length === 0) {
      suggestedActions.push({
        type: 'winback_offer',
        message:
          'Guest may be drifting — consider a simple win-back offer (reuse Offer API).',
      });
    }

    const offersEnriched = c.offers.map((o) => {
      const nowMs = now.getTime();
      const eligible =
        !o.redeemed &&
        (o.validUntil == null || o.validUntil.getTime() >= nowMs);
      let eligibilityMessage: string | undefined;
      if (o.redeemed) {
        eligibilityMessage = 'Already redeemed.';
      } else if (o.validUntil && o.validUntil.getTime() < nowMs) {
        eligibilityMessage = 'Past valid-until date.';
      } else if (eligible) {
        eligibilityMessage = 'Eligible to redeem.';
      }
      return { ...o, eligible, eligibilityMessage };
    });

    const visitsEnriched = c.visits.map((v) => ({
      id: v.id,
      visitedAt: v.visitedAt.toISOString(),
      branch: v.branch,
      order: v.order
        ? {
            id: v.order.id,
            totalMinor: v.order.totalMinor,
            type: v.order.type,
            status: v.order.status,
            paidAt: v.order.paidAt?.toISOString() ?? null,
          }
        : null,
    }));

    const { visits, noteEntries: notes, offers, tagEntries, ...rest } = c;
    void visits;
    void offers;
    void tagEntries;

    return {
      ...rest,
      tags: readCustomerTags(c.tagEntries),
      visits: visitsEnriched,
      noteEntries: notes,
      offers: offersEnriched,
      intelligence: {
        daysSinceLastVisit,
        visitsLast90Days,
        primaryBranch,
        segment,
      },
      suggestedActions,
    };
  }

  async create(
    tenantId: string,
    body: { phone: string; name?: string; notes?: string },
  ) {
    const phone = body.phone.replace(/\s+/g, '');
    return this.prisma.customer.upsert({
      where: { tenantId_phone: { tenantId, phone } },
      update: { name: body.name, notes: body.notes },
      create: { tenantId, phone, name: body.name, notes: body.notes },
    });
  }

  async patch(
    tenantId: string,
    customerId: string,
    body: { name?: string; notes?: string; tags?: string[] },
    actorId: string,
  ) {
    const existing = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException();
    }
    const tags = body.tags !== undefined ? normalizeTags(body.tags) : undefined;
    if (body.tags !== undefined && tags!.length > MAX_TAGS) {
      throw new BadRequestException(`At most ${MAX_TAGS} tags`);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.customer.update({
        where: { id: customerId },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
        },
      });

      if (tags !== undefined) {
        await tx.customerTag.deleteMany({ where: { customerId } });
        if (tags.length > 0) {
          await tx.customerTag.createMany({
            data: tags.map((value) => ({ customerId, value })),
          });
        }
      }

      return row;
    });
    await this.audit.log({
      tenantId,
      actorId,
      action: 'customer.updated',
      entity: 'Customer',
      entityId: customerId,
      metadata: { fields: Object.keys(body) },
    });
    return updated;
  }

  async addNote(
    tenantId: string,
    customerId: string,
    body: {
      body: string;
      category: CustomerNoteCategory;
      branchId?: string;
    },
    actorId: string,
  ) {
    const text = body.body.trim();
    if (!text.length) {
      throw new BadRequestException('Note body is required');
    }
    if (text.length > NOTE_BODY_MAX) {
      throw new BadRequestException(
        `Note must be at most ${NOTE_BODY_MAX} characters`,
      );
    }
    const c = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId },
    });
    if (!c) {
      throw new NotFoundException();
    }
    if (body.branchId) {
      const br = await this.prisma.branch.findFirst({
        where: { id: body.branchId, tenantId },
      });
      if (!br) {
        throw new BadRequestException('Invalid branch');
      }
    }
    const row = await this.prisma.customerNote.create({
      data: {
        customerId,
        branchId: body.branchId,
        category: body.category,
        body: text,
        createdByUserId: actorId,
      },
      include: {
        branch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, displayName: true } },
      },
    });
    await this.audit.log({
      tenantId,
      branchId: body.branchId,
      actorId,
      action: 'customer.note_added',
      entity: 'CustomerNote',
      entityId: row.id,
      metadata: { customerId, category: body.category },
    });
    return row;
  }

  /**
   * Aggregate visit / repeat signals for a branch (no PII).
   * Window: rolling `windowDays` (default 30) ending now.
   */
  async branchVisitSignals(tenantId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { id: true },
    });
    if (!branch) {
      throw new NotFoundException();
    }
    const windowDays = 30;
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const grouped = await this.prisma.customerVisit.groupBy({
      by: ['customerId'],
      where: { branchId, visitedAt: { gte: since } },
      _count: { id: true },
    });
    const uniqueVisitors = grouped.length;
    const visitsRecorded = grouped.reduce((s, g) => s + g._count.id, 0);
    const repeatVisitors = grouped.filter((g) => g._count.id >= 2).length;
    const singleVisitVisitors = grouped.filter((g) => g._count.id === 1).length;
    return {
      windowDays,
      since: since.toISOString(),
      branchId,
      visitsRecorded,
      uniqueVisitors,
      repeatVisitors,
      singleVisitVisitors,
    };
  }

  async addOffer(
    tenantId: string,
    customerId: string,
    body: {
      title: string;
      description?: string;
      validUntil?: string;
      kind?: OfferKind;
    },
  ) {
    const c = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId },
    });
    if (!c) {
      throw new NotFoundException();
    }
    return this.prisma.offer.create({
      data: {
        customerId,
        title: body.title,
        description: body.description,
        kind: body.kind ?? OfferKind.MANUAL,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
      },
    });
  }
}
