import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BranchRealtimeEvent } from '@restocafe/types';
import { PrepTicketStatus } from '@prisma/client';
import { whereUnderBranchTenant } from '../../common/persistence/branch-scope';
import { PrismaService } from '../../prisma/prisma.service';
import { OpsGateway } from '../../websocket/ops.gateway';
import { OrderLifecycleService } from '../orders/orders.facade';
import type { PatchTicketDto } from './dto/patch-ticket.dto';
import { assertTicketTransition } from './ticket-state';

@Injectable()
export class KitchenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ops: OpsGateway,
    private readonly orderLifecycle: OrderLifecycleService,
  ) {}

  async listTickets(
    branchId: string,
    tenantId: string,
    station: 'KITCHEN' | 'BAR',
  ) {
    return this.prisma.preparationTicket.findMany({
      where: {
        ...whereUnderBranchTenant(branchId, tenantId),
        station,
        status: { not: PrepTicketStatus.DELIVERED },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      include: {
        order: { select: { id: true, status: true } },
        orderItem: {
          include: {
            menuItem: { select: { id: true, name: true, prepStation: true } },
          },
        },
      },
    });
  }

  async updateTicket(
    branchId: string,
    tenantId: string,
    ticketId: string,
    body: PatchTicketDto,
  ) {
    const ticket = await this.prisma.preparationTicket.findFirst({
      where: {
        id: ticketId,
        ...whereUnderBranchTenant(branchId, tenantId),
        order: { tenantId },
      },
      include: { order: true },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.status === body.status) {
      return ticket;
    }

    assertTicketTransition(ticket.status, body.status);

    const prevStatus = ticket.status;
    const updatedCount = await this.prisma.preparationTicket.updateMany({
      where: {
        id: ticketId,
        branchId,
        status: prevStatus,
      },
      data: { status: body.status },
    });

    if (updatedCount.count === 0) {
      const fresh = await this.prisma.preparationTicket.findFirst({
        where: {
          id: ticketId,
          ...whereUnderBranchTenant(branchId, tenantId),
        },
      });
      if (fresh?.status === body.status) {
        return fresh;
      }
      throw new ConflictException('ticket_status_race');
    }

    const updated = await this.prisma.preparationTicket.findUniqueOrThrow({
      where: { id: ticketId },
    });
    await this.orderLifecycle.advanceToReadyWhenAllTicketsDelivered(
      ticket.orderId,
      branchId,
      tenantId,
    );
    const stationEmit =
      ticket.station === 'KITCHEN' || ticket.station === 'BAR'
        ? ticket.station === 'KITCHEN'
          ? ('KITCHEN' as const)
          : ('BAR' as const)
        : undefined;
    this.ops.emitBranchEvent(branchId, BranchRealtimeEvent.TICKET_UPDATED, {
      ticketId,
      status: updated.status,
      ...(stationEmit ? { station: stationEmit } : {}),
    });
    return updated;
  }
}
