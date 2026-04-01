import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, OrderType } from '@prisma/client';
import { IDEMPOTENCY_KEY_STORE } from '../../common/idempotency/idempotency.constants';
import type { IdempotencyKeyStore } from '../../common/idempotency/idempotency-key.store';
import { sleepMs } from '../../common/idempotency/sleep-ms';
import { incContention } from '../../common/metrics/prometheus';
import { PrismaService } from '../../prisma/prisma.service';
import { CommerceService } from '../../commerce/commerce.service';
import { OrderCreationService } from '../orders/order-creation.service';
import { OrderLinesService } from '../orders/order-lines.service';
import { OrderLifecycleService } from '../orders/order-lifecycle.service';
import { OrderPrepService } from '../orders/order-prep.service';
import {
  assertModifierSelectionsMatchGroups,
  loadMenuItemForGuestOrderLine,
} from '../orders/order-modifiers';
import type { PublicCreateOrderDto } from './dto/public-create-order.dto';

const GUEST_ORDER_ACTOR = 'guest:qr-self-order';
const PUBLIC_ORDER_IDEM_TTL_MS = 30 * 60 * 1000;
const PUBLIC_ORDER_LOCK_TTL_MS = 90_000;
const PUBLIC_ORDER_LOCK_POLL_ATTEMPTS = 30;
const PUBLIC_ORDER_LOCK_POLL_BASE_MS = 50;
const PUBLIC_ORDER_LOCK_POLL_MAX_MS = 500;
const IDEMPOTENCY_KEY_MAX_LEN = 200;

@Injectable()
export class PublicGuestOrderService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly commerce: CommerceService,
    private readonly creation: OrderCreationService,
    private readonly lines: OrderLinesService,
    private readonly lifecycle: OrderLifecycleService,
    private readonly prep: OrderPrepService,
    @Inject(IDEMPOTENCY_KEY_STORE)
    private readonly idempotency: IdempotencyKeyStore,
  ) {}

  private async resolveOpenSession(
    tenantSlug: string,
    branchSlug: string,
    token: string,
  ) {
    const session = await this.prisma.tableSession.findUnique({
      where: { publicToken: token },
      include: {
        branch: { include: { tenant: true } },
      },
    });
    if (!session || session.status !== 'OPEN') {
      throw new NotFoundException();
    }
    this.commerce.assertPublicTenantAccess(session.branch.tenant);
    if (
      session.branch.slug !== branchSlug ||
      session.branch.tenant.slug !== tenantSlug
    ) {
      throw new NotFoundException();
    }
    return session;
  }

  private assertQrOrderingEnabled(settings: Record<string, unknown> | null) {
    if (settings?.['qrOrderingEnabled'] !== true) {
      throw new ForbiddenException('QR ordering is disabled for this branch');
    }
  }

  async createOrderFromSession(
    tenantSlug: string,
    branchSlug: string,
    token: string,
    body: PublicCreateOrderDto,
    idempotencyKey?: string,
  ) {
    const session = await this.resolveOpenSession(
      tenantSlug,
      branchSlug,
      token,
    );
    const settings = session.branch.settings as Record<string, unknown> | null;
    this.assertQrOrderingEnabled(settings);

    if (!body.items?.length) {
      throw new BadRequestException('Cart is empty');
    }

    const trimmedKey = idempotencyKey?.trim() ?? '';
    const requireIdem =
      this.config.get<string>('PUBLIC_GUEST_ORDER_REQUIRE_IDEMPOTENCY_KEY') ===
      'true';
    if (requireIdem && !trimmedKey) {
      throw new BadRequestException(
        'Idempotency-Key header is required for guest orders',
      );
    }
    if (trimmedKey.length > IDEMPOTENCY_KEY_MAX_LEN) {
      throw new BadRequestException('Idempotency-Key is too long');
    }

    const branchId = session.branchId;
    const tenantId = session.branch.tenantId;

    for (const line of body.items) {
      const item = await loadMenuItemForGuestOrderLine(
        this.prisma,
        line.menuItemId,
        branchId,
        tenantId,
      );
      const groups = item.modifierGroups.map((mg) => mg.modifierGroup);
      assertModifierSelectionsMatchGroups(
        groups,
        line.modifierOptionIds ?? [],
      );
    }

    const idemFull = trimmedKey
      ? `publicGuestOrder:${session.id}:${trimmedKey}`
      : null;

    if (idemFull) {
      const cached = await this.idempotency.get(idemFull);
      if (cached) {
        return this.buildSummary(cached, branchId, tenantId);
      }
      const lockToken = await this.idempotency.acquireLock(
        `lock:${idemFull}`,
        PUBLIC_ORDER_LOCK_TTL_MS,
      );
      if (!lockToken) {
        incContention('idempotency_lock_wait');
        for (let i = 0; i < PUBLIC_ORDER_LOCK_POLL_ATTEMPTS; i++) {
          const delay = Math.min(
            PUBLIC_ORDER_LOCK_POLL_BASE_MS * 2 ** i,
            PUBLIC_ORDER_LOCK_POLL_MAX_MS,
          );
          await sleepMs(delay);
          const hit = await this.idempotency.get(idemFull);
          if (hit) {
            return this.buildSummary(hit, branchId, tenantId);
          }
        }
        throw new ServiceUnavailableException('idempotency_in_progress');
      }
      try {
        const hitAgain = await this.idempotency.get(idemFull);
        if (hitAgain) {
          return this.buildSummary(hitAgain, branchId, tenantId);
        }
        const summary = await this.placeGuestOrderCore(
          branchId,
          tenantId,
          session.id,
          body,
        );
        await this.idempotency.set(
          idemFull,
          summary.orderId,
          PUBLIC_ORDER_IDEM_TTL_MS,
        );
        return summary;
      } finally {
        await this.idempotency.releaseLock(`lock:${idemFull}`, lockToken);
      }
    }

    return this.placeGuestOrderCore(branchId, tenantId, session.id, body);
  }

  private async placeGuestOrderCore(
    branchId: string,
    tenantId: string,
    tableSessionId: string,
    body: PublicCreateOrderDto,
  ) {
    let orderId: string | null = null;
    try {
      const order = await this.creation.createOrder(branchId, tenantId, {
        type: OrderType.DINE_IN,
        tableSessionId,
        sourceNote: 'Guest QR self-order',
      });
      orderId = order.id;

      for (const line of body.items) {
        await this.lines.addItem(
          branchId,
          tenantId,
          orderId,
          {
            menuItemId: line.menuItemId,
            quantity: line.quantity,
            notes: line.notes,
            modifierOptionIds: line.modifierOptionIds,
          },
          { guestVisibleMenu: true },
        );
      }

      await this.lifecycle.confirm(
        branchId,
        tenantId,
        GUEST_ORDER_ACTOR,
        orderId,
      );
      await this.prep.sendToPreparation(branchId, tenantId, orderId);

      return this.buildSummary(orderId, branchId, tenantId);
    } catch (err) {
      if (orderId) {
        await this.cleanupDraftOrder(orderId, branchId, tenantId);
      }
      throw err;
    }
  }

  private async cleanupDraftOrder(
    orderId: string,
    branchId: string,
    tenantId: string,
  ) {
    const o = await this.prisma.order.findFirst({
      where: { id: orderId, branchId, tenantId },
    });
    if (o?.status === OrderStatus.DRAFT) {
      await this.prisma.orderItem.deleteMany({ where: { orderId } });
      await this.prisma.order.delete({ where: { id: orderId } });
    }
  }

  private async buildSummary(
    orderId: string,
    branchId: string,
    tenantId: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId, tenantId },
      include: {
        items: { include: { menuItem: { select: { name: true } } } },
      },
    });
    if (!order) {
      throw new NotFoundException();
    }
    return {
      orderId: order.id,
      /** Short display handle for guests (not sequential). */
      orderRef: order.id.slice(-8).toUpperCase(),
      status: order.status,
      customerStatus: mapCustomerStatus(order.status),
      totalMinor: order.totalMinor,
      itemCount: order.items.reduce((s, i) => s + i.quantity, 0),
      lines: order.items.map((i) => ({
        name: i.menuItem.name,
        quantity: i.quantity,
        lineTotalMinor: i.lineTotalMinor,
      })),
    };
  }

  async getOrderStatusForSession(
    tenantSlug: string,
    branchSlug: string,
    token: string,
    orderId: string,
  ) {
    const session = await this.resolveOpenSession(
      tenantSlug,
      branchSlug,
      token,
    );
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        branchId: session.branchId,
        tenantId: session.branch.tenantId,
        tableSessionId: session.id,
      },
    });
    if (!order) {
      throw new NotFoundException();
    }
    return {
      orderId: order.id,
      orderRef: order.id.slice(-8).toUpperCase(),
      status: order.status,
      customerStatus: mapCustomerStatus(order.status),
      totalMinor: order.totalMinor,
    };
  }
}

function mapCustomerStatus(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.DRAFT:
    case OrderStatus.CONFIRMED:
      return 'pending';
    case OrderStatus.IN_PREPARATION:
      return 'preparing';
    case OrderStatus.READY:
      return 'ready';
    case OrderStatus.SERVED:
    case OrderStatus.PAID:
      return 'done';
    case OrderStatus.CANCELLED:
      return 'cancelled';
    default:
      return 'pending';
  }
}
