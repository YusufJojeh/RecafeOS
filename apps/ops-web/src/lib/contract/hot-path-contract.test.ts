/**
 * Locks shared enum cardinalities and guest-status literals to Prisma / API behavior.
 * If server adds a value, update `@restocafe/types` and this test in the same PR.
 */
import { describe, expect, it } from 'vitest';
import {
  OrderStatus,
  OrderType,
  PaymentStatus,
  PrepTicketStatus,
  PublicGuestCustomerStatus,
  TableSessionStatus,
} from '@restocafe/types';

describe('hot-path contract enums (@restocafe/types)', () => {
  it('OrderStatus matches order FSM (7 states)', () => {
    expect(Object.keys(OrderStatus)).toHaveLength(7);
  });

  it('OrderType covers staff + guest dine-in sources', () => {
    expect(Object.keys(OrderType)).toContain('DINE_IN');
    expect(Object.keys(OrderType)).toContain('QR_REQUEST');
  });

  it('TableSessionStatus is OPEN | CLOSED', () => {
    expect(Object.keys(TableSessionStatus)).toEqual(['OPEN', 'CLOSED']);
  });

  it('PaymentStatus matches payment row lifecycle', () => {
    expect(Object.keys(PaymentStatus)).toEqual(['PENDING', 'COMPLETED', 'FAILED']);
  });

  it('PrepTicketStatus matches kitchen ticket FSM', () => {
    expect(Object.keys(PrepTicketStatus)).toHaveLength(5);
  });

  it('PublicGuestCustomerStatus matches mapCustomerStatus branch keys', () => {
    expect(new Set(Object.values(PublicGuestCustomerStatus))).toEqual(
      new Set(['pending', 'preparing', 'ready', 'done', 'cancelled']),
    );
  });
});
