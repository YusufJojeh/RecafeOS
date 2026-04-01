import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BranchRealtimeEvent } from '@restocafe/types';
import { Prisma } from '@prisma/client';
import { OrderStatus, OrderType, TableSessionStatus } from '@prisma/client';
import { whereUnderBranchTenant } from '../../common/persistence/branch-scope';
import { PrismaService } from '../../prisma/prisma.service';
import { OpsGateway } from '../../websocket/ops.gateway';
import { recalcOrderTotals } from './order-pricing';
import { OrderRepository } from './order-repository';

@Injectable()
export class OrderTableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrderRepository,
    private readonly ops: OpsGateway,
  ) {}

  async moveToTable(
    branchId: string,
    tenantId: string,
    orderId: string,
    targetTableSessionId: string,
  ) {
    await this.orders.findForBranchOrThrow(orderId, branchId, tenantId);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (!this.prisma.isMysqlLocalMode()) {
        await tx.$executeRaw(
          Prisma.sql`SELECT id FROM "Order" WHERE id = ${orderId} AND "branchId" = ${branchId} AND "tenantId" = ${tenantId} FOR UPDATE`,
        );
        await tx.$executeRaw(
          Prisma.sql`SELECT id FROM "TableSession" WHERE id = ${targetTableSessionId} AND "branchId" = ${branchId} FOR UPDATE`,
        );
      }

      const orderRow = await tx.order.findFirst({
        where: { id: orderId, branchId, tenantId },
      });
      if (!orderRow) {
        throw new NotFoundException('Order not found');
      }
      if (orderRow.type !== OrderType.DINE_IN) {
        throw new BadRequestException('Only dine-in orders');
      }
      if (
        orderRow.status === OrderStatus.PAID ||
        orderRow.status === OrderStatus.CANCELLED
      ) {
        throw new ConflictException('Cannot move');
      }

      const session = await tx.tableSession.findFirst({
        where: {
          id: targetTableSessionId,
          status: TableSessionStatus.OPEN,
          ...whereUnderBranchTenant(branchId, tenantId),
        },
      });
      if (!session) {
        throw new BadRequestException('Invalid session');
      }

      const claim = await tx.order.updateMany({
        where: {
          id: orderId,
          branchId,
          tenantId,
          type: OrderType.DINE_IN,
          status: { notIn: [OrderStatus.PAID, OrderStatus.CANCELLED] },
        },
        data: {
          tableSessionId: targetTableSessionId,
          version: { increment: 1 },
        },
      });

      if (claim.count === 0) {
        throw new ConflictException('Cannot move');
      }

      return tx.order.findUniqueOrThrow({ where: { id: orderId } });
    });

    this.ops.emitBranchEvent(branchId, BranchRealtimeEvent.ORDER_MOVED, {
      orderId,
    });
    return updated;
  }

  async mergeOrders(
    branchId: string,
    tenantId: string,
    targetOrderId: string,
    sourceOrderId: string,
  ) {
    if (targetOrderId === sourceOrderId) {
      throw new BadRequestException();
    }
    const [target, source] = await Promise.all([
      this.orders.findForBranchOrThrow(targetOrderId, branchId, tenantId),
      this.orders.findForBranchOrThrow(sourceOrderId, branchId, tenantId),
    ]);
    if (
      target.status !== OrderStatus.DRAFT ||
      source.status !== OrderStatus.DRAFT
    ) {
      throw new ConflictException('Both orders must be draft');
    }
    await this.prisma.$transaction(async (tx) => {
      if (!this.prisma.isMysqlLocalMode()) {
        const [lockFirst, lockSecond] = [sourceOrderId, targetOrderId].sort();
        await tx.$executeRaw(
          Prisma.sql`SELECT id FROM "Order" WHERE id = ${lockFirst} AND "branchId" = ${branchId} AND "tenantId" = ${tenantId} FOR UPDATE`,
        );
        await tx.$executeRaw(
          Prisma.sql`SELECT id FROM "Order" WHERE id = ${lockSecond} AND "branchId" = ${branchId} AND "tenantId" = ${tenantId} FOR UPDATE`,
        );
      }

      const targetLocked = await tx.order.findFirst({
        where: { id: targetOrderId, branchId, tenantId },
      });
      const sourceLocked = await tx.order.findFirst({
        where: { id: sourceOrderId, branchId, tenantId },
      });
      if (
        !targetLocked ||
        !sourceLocked ||
        targetLocked.status !== OrderStatus.DRAFT ||
        sourceLocked.status !== OrderStatus.DRAFT
      ) {
        throw new ConflictException('Both orders must be draft');
      }

      await tx.orderItem.updateMany({
        where: { orderId: sourceOrderId },
        data: { orderId: targetOrderId },
      });
      await tx.order.update({
        where: { id: sourceOrderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          version: { increment: 1 },
        },
      });
      await recalcOrderTotals(tx, targetOrderId);
    });
    return this.prisma.order.findUnique({
      where: { id: targetOrderId },
      include: { items: { include: { modifiers: true } } },
    });
  }
}
