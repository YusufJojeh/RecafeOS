import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BranchRealtimeEvent } from '@restocafe/types';
import { OrderStatus, OrderType, TableSessionStatus } from '@prisma/client';
import { IDEMPOTENCY_KEY_STORE } from '../../common/idempotency/idempotency.constants';
import type { IdempotencyKeyStore } from '../../common/idempotency/idempotency-key.store';
import { sleepMs } from '../../common/idempotency/sleep-ms';
import { incContention } from '../../common/metrics/prometheus';
import { whereUnderBranchTenant } from '../../common/persistence/branch-scope';
import { PrismaService } from '../../prisma/prisma.service';
import { OpsGateway } from '../../websocket/ops.gateway';
import type { CreateOrderDto } from './dto/create-order.dto';

const CREATE_ORDER_IDEM_TTL_MS = 10 * 60 * 1000;
const IDEM_LOCK_TTL_MS = 90_000;
const IDEM_POLL_ATTEMPTS = 30;
const IDEM_POLL_BASE_MS = 50;
const IDEM_POLL_MAX_MS = 500;

@Injectable()
export class OrderCreationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ops: OpsGateway,
    @Inject(IDEMPOTENCY_KEY_STORE)
    private readonly idempotency: IdempotencyKeyStore,
  ) {}

  async createOrder(
    branchId: string,
    tenantId: string,
    body: CreateOrderDto,
    idempotencyKey?: string,
  ) {
    const trimmedKey = idempotencyKey?.trim();
    const idemFull = trimmedKey
      ? `createOrder:${tenantId}:${branchId}:${trimmedKey}`
      : null;

    if (idemFull) {
      let cachedOrderId = await this.idempotency.get(idemFull);
      if (cachedOrderId) {
        incContention('idempotency_cache_hit');
        const hit = await this.prisma.order.findFirst({
          where: {
            id: cachedOrderId,
            branchId,
            tenantId,
          },
        });
        if (hit) {
          if (hit.status !== OrderStatus.DRAFT) {
            throw new ConflictException('idempotency_replay_order_advanced');
          }
          return hit;
        }
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
            const hit = await this.prisma.order.findFirst({
              where: { id: cachedOrderId, branchId, tenantId },
            });
            if (hit) {
              if (hit.status !== OrderStatus.DRAFT) {
                throw new ConflictException('idempotency_replay_order_advanced');
              }
              return hit;
            }
          }
        }
        incContention('idempotency_lock_timeout');
        throw new ServiceUnavailableException('idempotency_in_progress');
      }

      try {
        cachedOrderId = await this.idempotency.get(idemFull);
        if (cachedOrderId) {
          const hit = await this.prisma.order.findFirst({
            where: { id: cachedOrderId, branchId, tenantId },
          });
          if (hit) {
            if (hit.status !== OrderStatus.DRAFT) {
              throw new ConflictException('idempotency_replay_order_advanced');
            }
            return hit;
          }
        }

        const order = await this.createOrderCore(branchId, tenantId, body);
        await this.idempotency.set(idemFull, order.id, CREATE_ORDER_IDEM_TTL_MS);
        return order;
      } finally {
        await this.idempotency.releaseLock(idemFull, lockToken);
      }
    }

    return this.createOrderCore(branchId, tenantId, body);
  }

  private async createOrderCore(
    branchId: string,
    tenantId: string,
    body: CreateOrderDto,
  ) {
    if (body.type === OrderType.DINE_IN && !body.tableSessionId) {
      throw new BadRequestException('tableSessionId required for dine-in');
    }
    if (body.tableSessionId) {
      const session = await this.prisma.tableSession.findFirst({
        where: {
          id: body.tableSessionId,
          status: TableSessionStatus.OPEN,
          ...whereUnderBranchTenant(branchId, tenantId),
        },
      });
      if (!session) {
        throw new BadRequestException('Invalid table session');
      }
    }
    let customerId: string | undefined;
    if (body.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: body.customerId, tenantId },
      });
      if (!customer) {
        throw new BadRequestException('Invalid customer for this tenant');
      }
      customerId = customer.id;
    }
    const order = await this.prisma.order.create({
      data: {
        branchId,
        tenantId,
        type: body.type,
        status: OrderStatus.DRAFT,
        tableSessionId: body.tableSessionId,
        customerId,
        sourceNote: body.sourceNote,
      },
    });
    this.ops.emitBranchEvent(branchId, BranchRealtimeEvent.ORDER_CREATED, {
      orderId: order.id,
    });
    return order;
  }
}
