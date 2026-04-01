import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderRepository } from './order-repository';
import type { OpenOrdersQueryDto } from './dto/open-orders.query';

const cashierDetailInclude = {
  items: {
    include: {
      modifiers: true,
      menuItem: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  preparationTickets: true,
  payments: {
    select: {
      id: true,
      amountMinor: true,
      method: true,
      status: true,
      createdAt: true,
    },
  },
  tableSession: {
    include: {
      floorTable: {
        select: {
          id: true,
          label: true,
        },
      },
    },
  },
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrderReadService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly prisma: PrismaService,
  ) {}

  async listOpen(
    branchId: string,
    tenantId: string,
    query?: OpenOrdersQueryDto,
  ) {
    const hasA = query?.cursorCreatedAt != null && query.cursorCreatedAt !== '';
    const hasB = query?.cursorId != null && query.cursorId !== '';
    if (hasA !== hasB) {
      throw new BadRequestException(
        'cursorCreatedAt and cursorId must be provided together',
      );
    }
    let cursor: { createdAt: Date; id: string } | undefined;
    if (hasA && hasB) {
      const createdAt = new Date(query.cursorCreatedAt!);
      if (Number.isNaN(createdAt.getTime())) {
        throw new BadRequestException('Invalid cursorCreatedAt');
      }
      cursor = { createdAt, id: query.cursorId! };
    }
    return this.enrichOpenOrdersWithReturning(
      branchId,
      await this.orders.listOpen(branchId, tenantId, {
        limit: query?.limit,
        cursor,
      }),
    );
  }

  async getOne(branchId: string, tenantId: string, orderId: string) {
    const order = await this.orders.findForBranchOrThrow(
      orderId,
      branchId,
      tenantId,
      cashierDetailInclude,
    );
    const returningGuest = await this.returningAtBranch(
      order.customerId,
      branchId,
    );
    return { ...order, returningGuest };
  }

  /** Prior recorded visits at this branch (paid flows) — staff-only recognition signal. */
  private async returningAtBranch(
    customerId: string | null,
    branchId: string,
  ): Promise<boolean> {
    if (!customerId) return false;
    const n = await this.prisma.customerVisit.count({
      where: { customerId, branchId },
    });
    return n >= 1;
  }

  private async enrichOpenOrdersWithReturning(
    branchId: string,
    result: Awaited<ReturnType<OrderRepository['listOpen']>>,
  ) {
    const ids = result.items
      .map((o) => o.customerId)
      .filter((x): x is string => x != null && x !== '');
    if (ids.length === 0) {
      return {
        ...result,
        items: result.items.map((o) => ({ ...o, returningGuest: false })),
      };
    }
    const grouped = await this.prisma.customerVisit.groupBy({
      by: ['customerId'],
      where: { branchId, customerId: { in: [...new Set(ids)] } },
      _count: { _all: true },
    });
    const map = new Map(grouped.map((g) => [g.customerId, g._count._all]));
    return {
      ...result,
      items: result.items.map((o) => ({
        ...o,
        returningGuest: o.customerId
          ? (map.get(o.customerId) ?? 0) >= 1
          : false,
      })),
    };
  }
}
