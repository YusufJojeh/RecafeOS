import { ConflictException, Injectable } from '@nestjs/common';
import { BranchRealtimeEvent } from '@restocafe/types';
import { OrderStatus, PrepStation, PrepTicketStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OpsGateway } from '../../websocket/ops.gateway';
import { assertOrderTransition } from './order-state';
import { OrderRepository } from './order-repository';

function buildPrepTicketRows(
  branchId: string,
  orderId: string,
  items: Array<{
    id: string;
    menuItem: { prepStation: PrepStation };
  }>,
): Array<{
  branchId: string;
  orderId: string;
  orderItemId: string;
  station: PrepStation;
  status: PrepTicketStatus;
}> {
  const rows: Array<{
    branchId: string;
    orderId: string;
    orderItemId: string;
    station: PrepStation;
    status: PrepTicketStatus;
  }> = [];
  for (const line of items) {
    const station = line.menuItem.prepStation;
    const stations: PrepStation[] =
      station === PrepStation.BOTH
        ? [PrepStation.KITCHEN, PrepStation.BAR]
        : [station];
    for (const st of stations) {
      rows.push({
        branchId,
        orderId,
        orderItemId: line.id,
        station: st,
        status: PrepTicketStatus.NEW,
      });
    }
  }
  return rows;
}

@Injectable()
export class OrderPrepService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrderRepository,
    private readonly ops: OpsGateway,
  ) {}

  async sendToPreparation(branchId: string, tenantId: string, orderId: string) {
    const order = await this.orders.findForBranchOrThrow(
      orderId,
      branchId,
      tenantId,
    );
    assertOrderTransition(order.status, OrderStatus.IN_PREPARATION);

    let shouldEmit = false;

    await this.prisma.$transaction(async (tx) => {
      const claim = await tx.order.updateMany({
        where: {
          id: orderId,
          branchId,
          tenantId,
          status: OrderStatus.CONFIRMED,
        },
        data: {
          status: OrderStatus.IN_PREPARATION,
          version: { increment: 1 },
        },
      });

      const items = await tx.orderItem.findMany({
        where: { orderId },
        include: { menuItem: true },
      });

      const createTickets = async () => {
        const rows = buildPrepTicketRows(branchId, orderId, items);
        if (rows.length === 0) {
          return;
        }
        await tx.preparationTicket.createMany({
          data: rows,
          skipDuplicates: true,
        });
      };

      if (claim.count === 1) {
        await createTickets();
        shouldEmit = true;
        return;
      }

      const current = await tx.order.findFirst({
        where: { id: orderId, branchId, tenantId },
      });
      if (current?.status !== OrderStatus.IN_PREPARATION) {
        throw new ConflictException('order_cannot_send_to_preparation');
      }

      const ticketCount = await tx.preparationTicket.count({
        where: { orderId },
      });
      if (ticketCount > 0) {
        return;
      }

      await createTickets();
      shouldEmit = true;
    });

    if (shouldEmit) {
      // Single emit: invalidation map matches ticket.updated for kitchen/floor data; avoids duplicate Redis/pub-sub fan-out.
      this.ops.emitBranchEvent(
        branchId,
        BranchRealtimeEvent.ORDER_SENT_TO_PREPARATION,
        {
          orderId,
        },
      );
    }

    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: { preparationTickets: true },
    });
  }
}
