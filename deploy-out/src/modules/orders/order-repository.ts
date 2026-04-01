import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const defaultInclude = {
  items: { include: { modifiers: true } },
  preparationTickets: true,
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findForBranchOrThrow(
    orderId: string,
    branchId: string,
    tenantId: string,
    include: Prisma.OrderInclude = defaultInclude,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId, tenantId },
      include,
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  /** Caps page size to protect DB and payloads. */
  static readonly OPEN_ORDERS_MAX = 500;

  async listOpen(
    branchId: string,
    tenantId: string,
    opts?: {
      limit?: number;
      cursor?: { createdAt: Date; id: string };
    },
  ) {
    const limit = Math.min(
      Math.max(opts?.limit ?? 100, 1),
      OrderRepository.OPEN_ORDERS_MAX,
    );
    const cursor = opts?.cursor;

    const baseWhere: Prisma.OrderWhereInput = {
      branchId,
      tenantId,
      status: { notIn: [OrderStatus.PAID, OrderStatus.CANCELLED] },
    };

    const where: Prisma.OrderWhereInput = cursor
      ? {
          AND: [
            baseWhere,
            {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                {
                  AND: [
                    { createdAt: cursor.createdAt },
                    { id: { lt: cursor.id } },
                  ],
                },
              ],
            },
          ],
        }
      : baseWhere;

    const rows = await this.prisma.order.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        id: true,
        tenantId: true,
        branchId: true,
        type: true,
        status: true,
        tableSessionId: true,
        customerId: true,
        createdAt: true,
        updatedAt: true,
        subtotalMinor: true,
        totalMinor: true,
        discountMinor: true,
        items: {
          select: {
            id: true,
            menuItemId: true,
            quantity: true,
            unitPriceMinor: true,
            lineTotalMinor: true,
            notes: true,
          },
        },
        tableSession: {
          select: {
            id: true,
            guestCount: true,
            status: true,
            floorTableId: true,
          },
        },
      },
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    return {
      items,
      nextCursor:
        hasMore && last
          ? { createdAt: last.createdAt.toISOString(), id: last.id }
          : null,
    };
  }
}
