import { ConflictException } from '@nestjs/common';
import { PrepTicketStatus } from '@prisma/client';
import { assertTicketTransition } from './ticket-state';

describe('AC: preparation ticket state machine', () => {
  it('allows NEW to ACCEPTED', () => {
    expect(() =>
      assertTicketTransition(PrepTicketStatus.NEW, PrepTicketStatus.ACCEPTED),
    ).not.toThrow();
  });

  it('blocks DELIVERED to NEW', () => {
    expect(() =>
      assertTicketTransition(PrepTicketStatus.DELIVERED, PrepTicketStatus.NEW),
    ).toThrow(ConflictException);
  });
});
