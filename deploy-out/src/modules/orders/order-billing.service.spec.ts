import { ServiceUnavailableException } from '@nestjs/common';
import {
  FloorTableStatus,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  TableSessionStatus,
} from '@prisma/client';
import { OrderBillingService } from './order-billing.service';

jest.mock('../../common/idempotency/sleep-ms', () => ({
  sleepMs: jest.fn().mockResolvedValue(undefined),
}));

describe('OrderBillingService', () => {
  const branchId = 'branch_1';
  const tenantId = 'tenant_1';
  const userId = 'user_1';
  const orderId = 'order_1';
  type OrderUpdateArg = {
    where: {
      id: string;
      branchId: string;
      tenantId: string;
      status: { in: OrderStatus[] };
    };
    data: {
      status: OrderStatus;
      paidAt: Date;
      version: { increment: number };
    };
  };
  type SessionUpdateArg = {
    where: { id: string };
    data: { status: TableSessionStatus; closedAt: Date };
  };

  function createService() {
    const prisma = {
      order: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    const orders = {
      findForBranchOrThrow: jest.fn(),
    };
    const audit = {
      logAsync: jest.fn(),
    };
    const ops = {
      emitBranchEvent: jest.fn(),
    };
    const stock = {
      deductForPaidOrder: jest.fn(),
      recordCustomerVisitPostCommit: jest.fn(),
    };
    const commerce = {
      recordAnalyticsEvent: jest.fn().mockResolvedValue(undefined),
    };
    const idempotency = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      acquireLock: jest.fn(),
      releaseLock: jest.fn().mockResolvedValue(undefined),
    };

    const service = new OrderBillingService(
      prisma as never,
      orders as never,
      audit as never,
      ops as never,
      stock as never,
      commerce as never,
      idempotency as never,
    );

    return {
      service,
      prisma,
      orders,
      audit,
      ops,
      stock,
      commerce,
      idempotency,
    };
  }

  it('returns cached paid order when idempotency key is already stored', async () => {
    const { service, prisma, idempotency, orders } = createService();
    const paidOrder = { id: orderId, status: OrderStatus.PAID };

    idempotency.get.mockResolvedValue(orderId);
    prisma.order.findUnique.mockResolvedValue(paidOrder);

    const result = await service.closeBill(
      branchId,
      tenantId,
      userId,
      orderId,
      { method: PaymentMethod.CASH },
      'dup-key',
    );

    expect(result).toBe(paidOrder);
    expect(idempotency.acquireLock).not.toHaveBeenCalled();
    expect(orders.findForBranchOrThrow).not.toHaveBeenCalled();
    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: orderId },
    });
  });

  it('fails with idempotency_in_progress when lock cannot be acquired or resolved', async () => {
    const { service, idempotency } = createService();

    idempotency.get.mockResolvedValue(undefined);
    idempotency.acquireLock.mockResolvedValue(null);

    await expect(
      service.closeBill(
        branchId,
        tenantId,
        userId,
        orderId,
        { method: PaymentMethod.CASH },
        'blocked-key',
      ),
    ).rejects.toThrow(ServiceUnavailableException);

    expect(idempotency.get).toHaveBeenCalledTimes(31);
    expect(idempotency.releaseLock).not.toHaveBeenCalled();
  });

  it('closes a served order, records payment, and releases the table session', async () => {
    const {
      service,
      prisma,
      orders,
      audit,
      ops,
      stock,
      commerce,
      idempotency,
    } = createService();
    const paidOrder = { id: orderId, status: OrderStatus.PAID };
    const orderUpdateMany = jest
      .fn<Promise<{ count: number }>, [OrderUpdateArg]>()
      .mockResolvedValue({ count: 1 });
    const sessionUpdate = jest
      .fn<
        Promise<{
          id: string;
          floorTableId: string;
          status: TableSessionStatus;
        }>,
        [SessionUpdateArg]
      >()
      .mockResolvedValue({
        id: 'session_1',
        floorTableId: 'table_1',
        status: TableSessionStatus.CLOSED,
      });
    const tx = {
      order: {
        updateMany: orderUpdateMany,
      },
      payment: {
        create: jest.fn().mockResolvedValue({
          orderId,
          amountMinor: 2400,
          method: PaymentMethod.CASH,
          status: PaymentStatus.COMPLETED,
        }),
      },
      tableSession: {
        update: sessionUpdate,
      },
      floorTable: {
        update: jest.fn().mockResolvedValue({
          id: 'table_1',
          status: FloorTableStatus.AVAILABLE,
        }),
      },
    };

    orders.findForBranchOrThrow.mockResolvedValue({
      id: orderId,
      branchId,
      tenantId,
      totalMinor: 2400,
      status: OrderStatus.SERVED,
      type: OrderType.DINE_IN,
      tableSessionId: 'session_1',
    });
    prisma.$transaction.mockImplementation(
      async (callback: (txArg: typeof tx) => Promise<void>) => callback(tx),
    );
    prisma.order.findUnique.mockResolvedValue(paidOrder);
    idempotency.get.mockResolvedValue(undefined);
    idempotency.acquireLock.mockResolvedValue('lock-token');

    const result = await service.closeBill(
      branchId,
      tenantId,
      userId,
      orderId,
      { method: PaymentMethod.CASH, customerPhone: '+15550001' },
      'pay-key',
    );
    await Promise.resolve();
    const orderUpdateArgs = orderUpdateMany.mock.calls[0]?.[0];
    const sessionUpdateArgs = sessionUpdate.mock.calls[0]?.[0];

    expect(result).toBe(paidOrder);
    expect(orderUpdateArgs).toBeDefined();
    expect(sessionUpdateArgs).toBeDefined();
    expect(orderUpdateArgs.where).toEqual({
      id: orderId,
      branchId,
      tenantId,
      status: { in: [OrderStatus.READY, OrderStatus.SERVED] },
    });
    expect(orderUpdateArgs.data.status).toBe(OrderStatus.PAID);
    expect(orderUpdateArgs.data.version).toEqual({ increment: 1 });
    expect(orderUpdateArgs.data.paidAt).toBeInstanceOf(Date);
    expect(tx.payment.create).toHaveBeenCalledWith({
      data: {
        orderId,
        amountMinor: 2400,
        method: PaymentMethod.CASH,
        status: PaymentStatus.COMPLETED,
        recordedByUserId: userId,
      },
    });
    expect(sessionUpdateArgs.where).toEqual({ id: 'session_1' });
    expect(sessionUpdateArgs.data.status).toBe(TableSessionStatus.CLOSED);
    expect(sessionUpdateArgs.data.closedAt).toBeInstanceOf(Date);
    expect(tx.floorTable.update).toHaveBeenCalledWith({
      where: { id: 'table_1' },
      data: { status: FloorTableStatus.AVAILABLE },
    });
    expect(stock.deductForPaidOrder).toHaveBeenCalledWith(
      tx,
      branchId,
      tenantId,
      orderId,
    );
    expect(stock.recordCustomerVisitPostCommit).toHaveBeenCalledWith(
      tenantId,
      branchId,
      '+15550001',
      orderId,
    );
    expect(audit.logAsync).toHaveBeenCalledWith({
      tenantId,
      branchId,
      actorId: userId,
      action: 'order.paid',
      entity: 'Order',
      entityId: orderId,
    });
    expect(ops.emitBranchEvent).toHaveBeenCalledWith(branchId, 'order.paid', {
      orderId,
    });
    expect(commerce.recordAnalyticsEvent).toHaveBeenCalledWith(
      'order.paid',
      tenantId,
      {
        orderId,
        branchId,
        totalMinor: 2400,
      },
    );
    expect(idempotency.set).toHaveBeenCalledWith(
      `closeBill:${tenantId}:${orderId}:pay-key`,
      orderId,
      10 * 60 * 1000,
    );
    expect(idempotency.releaseLock).toHaveBeenCalledWith(
      `closeBill:${tenantId}:${orderId}:pay-key`,
      'lock-token',
    );
  });
});
