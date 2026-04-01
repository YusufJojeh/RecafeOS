import { ConflictException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { assertOrderTransition } from './order-state';

describe('assertOrderTransition', () => {
  it('allows draft to confirmed', () => {
    expect(() =>
      assertOrderTransition(OrderStatus.DRAFT, OrderStatus.CONFIRMED),
    ).not.toThrow();
  });

  it('blocks paid to draft', () => {
    expect(() =>
      assertOrderTransition(OrderStatus.PAID, OrderStatus.DRAFT),
    ).toThrow(ConflictException);
  });
});
