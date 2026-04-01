import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { BranchRealtimeEvent } from '@restocafe/types';
import { OrderStatus, PrepTicketStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  incBusinessEvent,
  incContention,
} from '../../common/metrics/prometheus';
import { AuditService } from '../audit/audit.service';
import { OpsGateway } from '../../websocket/ops.gateway';
import type { DiscountDto } from './dto/discount.dto';
import { assertOrderTransition } from './order-state';
import { recalcOrderTotals } from './order-pricing';
import { OrderRepository } from './order-repository';
import {
  CancelOrderDto,
  CANCELLATION_REASON_CODES,
} from './dto/cancel-order.dto';

const CANCELLABLE_STATUSES: OrderStatus[] = [
  OrderStatus.DRAFT,
  OrderStatus.CONFIRMED,
  OrderStatus.IN_PREPARATION,
  OrderStatus.READY,
  OrderStatus.SERVED,
];

@Injectable()
export class OrderLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrderRepository,
    private readonly audit: AuditService,
    private readonly ops: OpsGateway,
  ) {}

  async confirm(
    branchId: string,
    tenantId: string,
    userId: string,
    orderId: string,
  ) {
    const order = await this.orders.findForBranchOrThrow(
      orderId,
      branchId,
      tenantId,
    );
    // Idempotent: concurrent confirm races may arrive after the order is already confirmed.
    if (order.status === OrderStatus.CONFIRMED) {
      return order;
    }
    assertOrderTransition(order.status, OrderStatus.CONFIRMED);
    if (order.items.length === 0) {
      throw new BadRequestException('Order is empty');
    }

    const claim = await this.prisma.order.updateMany({
      where: {
        id: orderId,
        branchId,
        tenantId,
        status: OrderStatus.DRAFT,
      },
      data: { status: OrderStatus.CONFIRMED, version: { increment: 1 } },
    });

    if (claim.count === 0) {
      incContention('optimistic_conflict');
      const cur = await this.prisma.order.findFirst({
        where: { id: orderId, branchId, tenantId },
      });
      if (cur?.status === OrderStatus.CONFIRMED) {
        return cur;
      }
      throw new ConflictException('order_cannot_be_confirmed');
    }

    const updated = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    this.audit.logAsync({
      tenantId,
      branchId,
      actorId: userId,
      action: 'order.confirmed',
      entity: 'Order',
      entityId: orderId,
    });
    this.ops.emitBranchEvent(branchId, BranchRealtimeEvent.ORDER_UPDATED, {
      orderId,
      status: updated.status,
    });
    return updated;
  }

  async applyDiscount(
    branchId: string,
    tenantId: string,
    userId: string,
    orderId: string,
    body: DiscountDto,
  ) {
    const order = await this.orders.findForBranchOrThrow(
      orderId,
      branchId,
      tenantId,
    );
    if (
      order.status !== OrderStatus.DRAFT &&
      order.status !== OrderStatus.CONFIRMED
    ) {
      throw new ConflictException('Cannot discount this order state');
    }

    const discountMinor = body.discountMinor ?? 0;
    const discountPercent = body.discountPercent ?? 0;
    const discountReason = body.reason;

    const result = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.order.updateMany({
        where: {
          id: orderId,
          branchId,
          tenantId,
          status: { in: [OrderStatus.DRAFT, OrderStatus.CONFIRMED] },
        },
        data: {
          discountMinor,
          discountPercent,
          discountReason,
          version: { increment: 1 },
        },
      });

      if (claim.count === 0) {
        const cur = await tx.order.findFirst({
          where: { id: orderId, branchId, tenantId },
        });
        if (
          cur &&
          (cur.status === OrderStatus.DRAFT ||
            cur.status === OrderStatus.CONFIRMED) &&
          cur.discountMinor === discountMinor &&
          cur.discountPercent === discountPercent &&
          cur.discountReason === discountReason
        ) {
          return { idempotent: true as const, orderId };
        }
        if (
          cur &&
          (cur.status === OrderStatus.DRAFT ||
            cur.status === OrderStatus.CONFIRMED)
        ) {
          throw new ConflictException('order_discount_race');
        }
        throw new ConflictException('Cannot discount this order state');
      }

      await recalcOrderTotals(tx, orderId);
      return { idempotent: false as const, orderId };
    });

    const updated = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });

    if (!result.idempotent) {
      this.audit.logAsync({
        tenantId,
        branchId,
        actorId: userId,
        action: 'order.discount',
        entity: 'Order',
        entityId: orderId,
        metadata: body as Record<string, unknown>,
      });
    }
    return updated;
  }

  async markServed(
    branchId: string,
    tenantId: string,
    userId: string,
    orderId: string,
  ) {
    const order = await this.orders.findForBranchOrThrow(
      orderId,
      branchId,
      tenantId,
    );
    assertOrderTransition(order.status, OrderStatus.SERVED);

    const claim = await this.prisma.order.updateMany({
      where: {
        id: orderId,
        branchId,
        tenantId,
        status: OrderStatus.READY,
      },
      data: { status: OrderStatus.SERVED, version: { increment: 1 } },
    });

    if (claim.count === 0) {
      incContention('optimistic_conflict');
      const cur = await this.prisma.order.findFirst({
        where: { id: orderId, branchId, tenantId },
      });
      if (cur?.status === OrderStatus.SERVED) {
        return cur;
      }
      throw new ConflictException('order_cannot_be_served');
    }

    const updated = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    this.audit.logAsync({
      tenantId,
      branchId,
      actorId: userId,
      action: 'order.served',
      entity: 'Order',
      entityId: orderId,
    });
    this.ops.emitBranchEvent(branchId, BranchRealtimeEvent.ORDER_UPDATED, {
      orderId,
      status: updated.status,
    });
    return updated;
  }

  /**
   * When all prep tickets for an order are DELIVERED, advance order IN_PREPARATION → READY.
   * Single choke point for this transition (e.g. called from kitchen after ticket updates).
   */
  async advanceToReadyWhenAllTicketsDelivered(
    orderId: string,
    branchId: string,
    tenantId: string,
  ): Promise<void> {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const tickets = await tx.preparationTicket.findMany({
        where: { orderId, branchId },
      });
      const allDelivered =
        tickets.length > 0 &&
        tickets.every((t) => t.status === PrepTicketStatus.DELIVERED);
      if (!allDelivered) {
        return { advanced: false as const };
      }

      const claim = await tx.order.updateMany({
        where: {
          id: orderId,
          branchId,
          tenantId,
          status: OrderStatus.IN_PREPARATION,
        },
        data: { status: OrderStatus.READY, version: { increment: 1 } },
      });

      if (claim.count === 0) {
        const o = await tx.order.findFirst({
          where: { id: orderId, branchId, tenantId },
        });
        if (o?.status === OrderStatus.READY) {
          return { advanced: false as const };
        }
        return { advanced: false as const };
      }
      return { advanced: true as const };
    });

    if (!outcome.advanced) {
      return;
    }

    const updated = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    await this.audit.log({
      tenantId,
      branchId,
      actorId: undefined,
      action: 'order.ready',
      entity: 'Order',
      entityId: orderId,
      metadata: { reason: 'all_prep_tickets_delivered' },
    });
    this.ops.emitBranchEvent(branchId, BranchRealtimeEvent.ORDER_UPDATED, {
      orderId,
      status: updated.status,
    });
  }

  async cancel(
    branchId: string,
    tenantId: string,
    userId: string,
    orderId: string,
    dto?: CancelOrderDto,
  ) {
    const order = await this.orders.findForBranchOrThrow(
      orderId,
      branchId,
      tenantId,
    );
    if (order.status === OrderStatus.PAID) {
      throw new ForbiddenException(
        'Paid orders cannot be cancelled without correction',
      );
    }
    assertOrderTransition(order.status, OrderStatus.CANCELLED);

    let cancellationReason: string | null = null;
    const rawReason = dto?.cancellationReason?.trim();
    if (rawReason) {
      if (
        !CANCELLATION_REASON_CODES.includes(
          rawReason as (typeof CANCELLATION_REASON_CODES)[number],
        )
      ) {
        throw new BadRequestException('Invalid cancellationReason');
      }
      cancellationReason = rawReason;
    }
    const cancellationNote = dto?.cancellationNote?.trim() || null;

    const claim = await this.prisma.order.updateMany({
      where: {
        id: orderId,
        branchId,
        tenantId,
        status: { in: CANCELLABLE_STATUSES },
      },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason,
        cancellationNote,
        version: { increment: 1 },
      },
    });

    if (claim.count === 0) {
      incContention('optimistic_conflict');
      const cur = await this.prisma.order.findFirst({
        where: { id: orderId, branchId, tenantId },
      });
      if (cur?.status === OrderStatus.CANCELLED) {
        return cur;
      }
      throw new ConflictException('order_cannot_be_cancelled');
    }

    const updated = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    this.audit.logAsync({
      tenantId,
      branchId,
      actorId: userId,
      action: 'order.cancelled',
      entity: 'Order',
      entityId: orderId,
    });
    incBusinessEvent('order_cancelled');
    this.ops.emitBranchEvent(branchId, BranchRealtimeEvent.ORDER_CANCELLED, {
      orderId,
    });
    return updated;
  }
}
