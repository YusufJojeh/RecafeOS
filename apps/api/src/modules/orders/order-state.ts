import { ConflictException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

const allowed: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PREPARATION', 'CANCELLED'],
  IN_PREPARATION: ['READY', 'CANCELLED'],
  READY: ['SERVED', 'PAID', 'CANCELLED'],
  SERVED: ['PAID', 'CANCELLED'],
  PAID: [],
  CANCELLED: [],
};

export function assertOrderTransition(
  from: OrderStatus,
  to: OrderStatus,
): void {
  if (!allowed[from]?.includes(to)) {
    throw new ConflictException(`Invalid order transition ${from} -> ${to}`);
  }
}
