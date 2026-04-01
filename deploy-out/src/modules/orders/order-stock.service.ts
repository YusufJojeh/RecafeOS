import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Prisma as PrismaTypes } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type Tx = PrismaTypes.TransactionClient;

@Injectable()
export class OrderStockService {
  private readonly logger = new Logger(OrderStockService.name);

  constructor(private readonly prisma: PrismaService) {}
  async deductForPaidOrder(
    tx: Tx,
    branchId: string,
    tenantId: string,
    orderId: string,
  ): Promise<void> {
    const items = await tx.orderItem.findMany({
      where: { orderId, order: { branchId, tenantId } },
      include: { menuItem: { include: { recipes: true } } },
    });
    const deltas = new Map<string, Prisma.Decimal>();
    for (const line of items) {
      for (const r of line.menuItem.recipes) {
        const qty = r.qtyPerUnit.mul(line.quantity);
        const sid = r.stockItemId;
        const prev = deltas.get(sid) ?? new Prisma.Decimal(0);
        deltas.set(sid, prev.add(qty));
      }
    }
    const stockIds = [...deltas.keys()].sort();
    for (const stockItemId of stockIds) {
      const qty = deltas.get(stockItemId)!;
      await tx.stockMovement.create({
        data: {
          branchId,
          stockItemId,
          orderId,
          type: 'SALE_DEDUCTION',
          delta: qty.negated(),
        },
      });
      const updated = await tx.stockItem.updateMany({
        where: { id: stockItemId, branchId },
        data: { quantity: { decrement: qty } },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'Stock item is not on this branch or recipe points to invalid stock',
        );
      }
    }
  }

  /**
   * Record a customer visit linked to a paid order.
   * Called post-commit (outside the close-bill transaction) so that a
   * CRM failure never rolls back a successful payment.
   * Fire-and-forget: failures are logged but do not propagate.
   */
  async recordCustomerVisitPostCommit(
    tenantId: string,
    branchId: string,
    phone: string,
    orderId: string,
  ): Promise<void> {
    const normalized = phone.replace(/\s+/g, '');
    await this.prisma.customer
      .upsert({
        where: { tenantId_phone: { tenantId, phone: normalized } },
        update: { visitCount: { increment: 1 } },
        create: { tenantId, phone: normalized, visitCount: 1 },
      })
      .then((customer) =>
        this.prisma.customerVisit.create({
          data: { customerId: customer.id, branchId, orderId },
        }),
      )
      .catch((err: unknown) => {
        this.logger.warn(
          `customer_visit_failed orderId=${orderId} phone=${normalized} ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
  }
}
