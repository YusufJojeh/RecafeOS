import { Injectable, Logger } from '@nestjs/common';
import { StaffPushOutboxStatus } from '@prisma/client';
import type { StaffPushDeliveryEnvelope } from '@restocafe/types';
import { PrismaService } from '../../prisma/prisma.service';
import { StaffPushDispatchPort } from './staff-push-dispatch.port';
import { StaffPushOutboxWorkerService } from './staff-push-outbox-worker.service';

/**
 * Persists `StaffPushDeliveryEnvelope` to `StaffPushOutbox`, then nudges the in-process worker.
 * Replaces fire-and-forget logging with durable prep for real provider workers.
 */
@Injectable()
export class OutboxStaffPushDispatchService extends StaffPushDispatchPort {
  private readonly logger = new Logger(OutboxStaffPushDispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly worker: StaffPushOutboxWorkerService,
  ) {
    super();
  }

  async enqueueFromBranchEvent(
    envelope: StaffPushDeliveryEnvelope,
  ): Promise<void> {
    await this.prisma.staffPushOutbox.create({
      data: {
        tenantId: envelope.tenantId,
        branchId: envelope.branchId,
        event: envelope.event,
        payload: envelope.payload as object,
        status: StaffPushOutboxStatus.PENDING,
      },
    });

    setImmediate(() => {
      void this.worker.drainBatch(32).catch((err: unknown) => {
        this.logger.error(
          JSON.stringify({
            msg: 'staff_push_outbox_immediate_drain_failed',
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      });
    });
  }
}
