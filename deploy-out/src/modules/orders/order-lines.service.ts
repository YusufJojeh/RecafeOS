import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AddOrderItemDto } from './dto/add-order-item.dto';
import type { OrderItemQtyDto } from './dto/order-item-qty.dto';
import {
  loadMenuItemForGuestOrderLine,
  loadMenuItemForOrderLine,
  resolveModifierSelections,
} from './order-modifiers';
import { recalcOrderTotals } from './order-pricing';
import { OrderRepository } from './order-repository';

@Injectable()
export class OrderLinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrderRepository,
  ) {}

  async addItem(
    branchId: string,
    tenantId: string,
    orderId: string,
    body: AddOrderItemDto,
    opts?: { guestVisibleMenu?: boolean },
  ) {
    const order = await this.orders.findForBranchOrThrow(
      orderId,
      branchId,
      tenantId,
    );
    if (order.status !== OrderStatus.DRAFT) {
      throw new ConflictException('Order is not editable');
    }
    if (
      body.expectedVersion !== undefined &&
      body.expectedVersion !== order.version
    ) {
      throw new ConflictException('order_version_conflict');
    }
    const item = opts?.guestVisibleMenu
      ? await loadMenuItemForGuestOrderLine(
          this.prisma,
          body.menuItemId,
          branchId,
          tenantId,
        )
      : await loadMenuItemForOrderLine(
          this.prisma,
          body.menuItemId,
          branchId,
          tenantId,
        );
    const mods = await resolveModifierSelections(
      this.prisma,
      branchId,
      tenantId,
      body.modifierOptionIds,
    );
    let unit = item.priceMinor;
    for (const m of mods) {
      unit += m.priceDeltaMinor;
    }
    const qty = body.quantity;
    const lineTotal = unit * qty;
    await this.prisma.$transaction(async (tx) => {
      const line = await tx.orderItem.create({
        data: {
          orderId,
          menuItemId: item.id,
          quantity: qty,
          unitPriceMinor: unit,
          lineTotalMinor: lineTotal,
          notes: body.notes,
        },
      });
      for (const m of mods) {
        await tx.orderItemModifier.create({
          data: {
            orderItemId: line.id,
            modifierOptionId: m.modifierOptionId,
            priceDeltaMinor: m.priceDeltaMinor,
          },
        });
      }
      await recalcOrderTotals(tx, orderId);
    });
    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { modifiers: true } } },
    });
  }

  async updateItemQty(
    branchId: string,
    tenantId: string,
    orderId: string,
    itemId: string,
    body: OrderItemQtyDto,
  ) {
    const order = await this.orders.findForBranchOrThrow(
      orderId,
      branchId,
      tenantId,
    );
    if (order.status !== OrderStatus.DRAFT) {
      throw new ConflictException('Order is not editable');
    }
    if (
      body.expectedVersion !== undefined &&
      body.expectedVersion !== order.version
    ) {
      throw new ConflictException('order_version_conflict');
    }
    const quantity = body.quantity;
    await this.prisma.$transaction(async (tx) => {
      if (quantity <= 0) {
        await tx.orderItem.deleteMany({
          where: { id: itemId, orderId },
        });
      } else {
        const line = await tx.orderItem.findFirst({
          where: { id: itemId, orderId },
        });
        if (!line) {
          throw new NotFoundException();
        }
        const unit = Math.round(line.lineTotalMinor / line.quantity);
        await tx.orderItem.update({
          where: { id: itemId },
          data: { quantity, lineTotalMinor: unit * quantity },
        });
      }
      await recalcOrderTotals(tx, orderId);
    });
    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { modifiers: true } } },
    });
  }
}
