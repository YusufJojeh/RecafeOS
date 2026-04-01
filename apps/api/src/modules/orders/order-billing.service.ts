import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BranchRealtimeEvent } from '@restocafe/types';
import {
  FloorTableStatus,
  OrderStatus,
  PaymentStatus,
  TableSessionStatus,
} from '@prisma/client';
import { IDEMPOTENCY_KEY_STORE } from '../../common/idempotency/idempotency.constants';
import type { IdempotencyKeyStore } from '../../common/idempotency/idempotency-key.store';
import { sleepMs } from '../../common/idempotency/sleep-ms';
import {
  incBusinessEvent,
  incContention,
} from '../../common/metrics/prometheus';
import { CommerceService } from '../../commerce/commerce.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OpsGateway } from '../../websocket/ops.gateway';
import type { CloseBillDto } from './dto/close-bill.dto';
import { assertOrderTransition } from './order-state';
import { OrderRepository } from './order-repository';
import { OrderStockService } from './order-stock.service';

const CLOSE_BILL_IDEM_TTL_MS = 10 * 60 * 1000;
/** Short exclusive section around claim+pay; must expire if process dies (no permanent lock). */
const IDEM_LOCK_TTL_MS = 90_000;
/** Backoff polling: starts at 50ms, doubles each attempt, caps at 500ms. Total budget ~6.3s over 30 attempts. */
const IDEM_POLL_ATTEMPTS = 30;
const IDEM_POLL_BASE_MS = 50;
const IDEM_POLL_MAX_MS = 500;

/** Statuses allowed to transition to PAID in one step (see order-state FSM). */
const PAYABLE_STATUSES: OrderStatus[] = [OrderStatus.READY, OrderStatus.SERVED];

@Injectable()
export class OrderBillingService {
  private readonly logger = new Logger(OrderBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrderRepository,
    private readonly audit: AuditService,
    private readonly ops: OpsGateway,
    private readonly stock: OrderStockService,
    private readonly commerce: CommerceService,
    @Inject(IDEMPOTENCY_KEY_STORE)
    private readonly idempotency: IdempotencyKeyStore,
  ) {}

  async closeBill(
    branchId: string,
    tenantId: string,
    userId: string,
    orderId: string,
    body: CloseBillDto,
    idempotencyKey?: string,
  ) {
    const trimmedKey = idempotencyKey?.trim();
    const idemFull = trimmedKey
      ? `closeBill:${tenantId}:${orderId}:${trimmedKey}`
      : null;

    if (idemFull) {
      let cachedOrderId = await this.idempotency.get(idemFull);
      if (cachedOrderId) {
        incContention('idempotency_cache_hit');
        return this.prisma.order.findUnique({ where: { id: cachedOrderId } });
      }

      const lockToken = await this.idempotency.acquireLock(
        idemFull,
        IDEM_LOCK_TTL_MS,
      );
      if (!lockToken) {
        incContention('idempotency_lock_wait');
        for (let i = 0; i < IDEM_POLL_ATTEMPTS; i++) {
          const delay = Math.min(IDEM_POLL_BASE_MS * 2 ** i, IDEM_POLL_MAX_MS);
          await sleepMs(delay);
          cachedOrderId = await this.idempotency.get(idemFull);
          if (cachedOrderId) {
            incContention('idempotency_cache_hit');
            return this.prisma.order.findUnique({
              where: { id: cachedOrderId },
            });
          }
        }
        incContention('idempotency_lock_timeout');
        throw new ServiceUnavailableException('idempotency_in_progress');
      }

      try {
        cachedOrderId = await this.idempotency.get(idemFull);
        if (cachedOrderId) {
          return this.prisma.order.findUnique({
            where: { id: cachedOrderId },
          });
        }

        return await this.executeCloseBill(
          branchId,
          tenantId,
          userId,
          orderId,
          body,
          idemFull,
        );
      } finally {
        await this.idempotency.releaseLock(idemFull, lockToken);
      }
    }

    return this.executeCloseBill(
      branchId,
      tenantId,
      userId,
      orderId,
      body,
      null,
    );
  }

  private async executeCloseBill(
    branchId: string,
    tenantId: string,
    userId: string,
    orderId: string,
    body: CloseBillDto,
    idemFull: string | null,
  ) {
    const order = await this.orders.findForBranchOrThrow(
      orderId,
      branchId,
      tenantId,
    );
    if (order.status === OrderStatus.PAID) {
      const result = await this.prisma.order.findUnique({
        where: { id: orderId },
      });
      if (idemFull && result) {
        await this.idempotency.set(idemFull, orderId, CLOSE_BILL_IDEM_TTL_MS);
      }
      return result;
    }
    assertOrderTransition(order.status, OrderStatus.PAID);

    let alreadyPaidConcurrent = false;
    await this.prisma.$transaction(async (tx) => {
      const claim = await tx.order.updateMany({
        where: {
          id: orderId,
          branchId,
          tenantId,
          status: { in: PAYABLE_STATUSES },
        },
        data: {
          status: OrderStatus.PAID,
          paidAt: new Date(),
          version: { increment: 1 },
        },
      });

      if (claim.count === 0) {
        incContention('optimistic_conflict');
        const current = await tx.order.findFirst({
          where: { id: orderId, branchId, tenantId },
        });
        if (current?.status === OrderStatus.PAID) {
          alreadyPaidConcurrent = true;
          return;
        }
        throw new ConflictException('order_cannot_be_paid');
      }

      await tx.payment.create({
        data: {
          orderId,
          amountMinor: order.totalMinor,
          method: body.method,
          status: PaymentStatus.COMPLETED,
          recordedByUserId: userId,
        },
      });
      if (order.tableSessionId) {
        const sess = await tx.tableSession.update({
          where: { id: order.tableSessionId },
          data: { status: TableSessionStatus.CLOSED, closedAt: new Date() },
        });
        await tx.floorTable.update({
          where: { id: sess.floorTableId },
          data: { status: FloorTableStatus.AVAILABLE },
        });
      }
      await this.stock.deductForPaidOrder(tx, branchId, tenantId, orderId);
    });

    const result = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (alreadyPaidConcurrent) {
      if (idemFull && result) {
        await this.idempotency.set(idemFull, orderId, CLOSE_BILL_IDEM_TTL_MS);
      }
      return result;
    }

    this.audit.logAsync({
      tenantId,
      branchId,
      actorId: userId,
      action: 'order.paid',
      entity: 'Order',
      entityId: orderId,
    });
    incBusinessEvent('order_paid');
    if (body.customerPhone) {
      await this.stock.recordCustomerVisitPostCommit(
        tenantId,
        branchId,
        body.customerPhone,
        orderId,
      );
    }
    void this.commerce
      .recordAnalyticsEvent('order.paid', tenantId, {
        orderId,
        branchId,
        totalMinor: order.totalMinor,
      })
      .catch((err: unknown) => {
        this.logger.warn(
          `order_paid_analytics_failed orderId=${orderId} tenantId=${tenantId} ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
    this.ops.emitBranchEvent(branchId, BranchRealtimeEvent.ORDER_PAID, {
      orderId,
    });
    if (idemFull && result) {
      void this.idempotency
        .set(idemFull, orderId, CLOSE_BILL_IDEM_TTL_MS)
        .catch((err: unknown) => {
          this.logger.warn(
            `idempotency_set_failed key=${idemFull} ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        });
    }
    return result;
  }
}
