import { OrderStatus, PrepTicketStatus } from '@prisma/client';
import { OrderLifecycleService } from './order-lifecycle.service';

describe('OrderLifecycleService', () => {
  function createService() {
    const prisma = {
      $transaction: jest.fn(),
      order: {
        findUniqueOrThrow: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    const orders = {
      findForBranchOrThrow: jest.fn(),
    };
    const audit = {
      log: jest.fn().mockResolvedValue(undefined),
      logAsync: jest.fn(),
    };
    const ops = {
      emitBranchEvent: jest.fn(),
    };

    const service = new OrderLifecycleService(
      prisma as never,
      orders as never,
      audit as never,
      ops as never,
    );

    return { service, prisma, audit, ops };
  }

  it('waits for order.ready audit after advancing on last delivered ticket', async () => {
    const { service, prisma, audit, ops } = createService();
    const orderId = 'order_1';
    const branchId = 'branch_1';
    const tenantId = 'tenant_1';
    const tx = {
      preparationTicket: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { status: PrepTicketStatus.DELIVERED },
            { status: PrepTicketStatus.DELIVERED },
          ]),
      },
      order: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (txArg: typeof tx) => Promise<unknown>) => callback(tx),
    );
    prisma.order.findUniqueOrThrow.mockResolvedValue({
      id: orderId,
      status: OrderStatus.READY,
    });

    await service.advanceToReadyWhenAllTicketsDelivered(
      orderId,
      branchId,
      tenantId,
    );

    expect(audit.log).toHaveBeenCalledWith({
      tenantId,
      branchId,
      actorId: undefined,
      action: 'order.ready',
      entity: 'Order',
      entityId: orderId,
      metadata: { reason: 'all_prep_tickets_delivered' },
    });
    expect(ops.emitBranchEvent).toHaveBeenCalledWith(
      branchId,
      'order.updated',
      { orderId, status: OrderStatus.READY },
    );
  });

  it('does not write audit when another request already advanced the order', async () => {
    const { service, prisma, audit, ops } = createService();
    const tx = {
      preparationTicket: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ status: PrepTicketStatus.DELIVERED }]),
      },
      order: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue({ status: OrderStatus.READY }),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (txArg: typeof tx) => Promise<unknown>) => callback(tx),
    );

    await service.advanceToReadyWhenAllTicketsDelivered(
      'order_1',
      'branch_1',
      'tenant_1',
    );

    expect(audit.log).not.toHaveBeenCalled();
    expect(ops.emitBranchEvent).not.toHaveBeenCalled();
  });
});
