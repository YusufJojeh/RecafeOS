import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';

export type OrderPricingTx = Prisma.TransactionClient | PrismaService;

export async function recalcOrderTotals(
  tx: OrderPricingTx,
  orderId: string,
): Promise<void> {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  const subtotal = items.reduce((s, i) => s + i.lineTotalMinor, 0);
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) {
    return;
  }
  let discount = order.discountMinor;
  if (order.discountPercent > 0) {
    discount = Math.round((subtotal * order.discountPercent) / 100);
  }
  const total = Math.max(0, subtotal - discount);
  await tx.order.update({
    where: { id: orderId },
    data: {
      subtotalMinor: subtotal,
      totalMinor: total,
      version: { increment: 1 },
    },
  });
}
