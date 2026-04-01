import { Injectable, Logger } from '@nestjs/common';
import type { StaffPushDeliveryEnvelope } from '@restocafe/types';
import { StaffPushDispatchPort } from './staff-push-dispatch.port';

/** Opt-in for tests or environments that must not write `StaffPushOutbox` rows. */
@Injectable()
export class NoopStaffPushDispatchService extends StaffPushDispatchPort {
  private readonly logger = new Logger(NoopStaffPushDispatchService.name);

  async enqueueFromBranchEvent(
    envelope: StaffPushDeliveryEnvelope,
  ): Promise<void> {
    this.logger.debug(
      JSON.stringify({
        msg: 'staff_push_delivery_skipped',
        event: envelope.event,
        branchId: envelope.branchId,
        tenantId: envelope.tenantId,
      }),
    );
  }
}
