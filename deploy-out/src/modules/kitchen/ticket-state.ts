import { ConflictException } from '@nestjs/common';
import { PrepTicketStatus } from '@prisma/client';

const allowed: Record<PrepTicketStatus, PrepTicketStatus[]> = {
  NEW: ['ACCEPTED'],
  ACCEPTED: ['PREPARING'],
  PREPARING: ['READY'],
  READY: ['DELIVERED'],
  DELIVERED: [],
};

export function assertTicketTransition(
  from: PrepTicketStatus,
  to: PrepTicketStatus,
): void {
  if (!allowed[from]?.includes(to)) {
    throw new ConflictException(`Invalid ticket transition ${from} -> ${to}`);
  }
}
