import { Injectable } from '@nestjs/common';
import type { StaffPushDeliveryEnvelope } from '@restocafe/types';

/**
 * Persists or forwards staff push work from realtime mirrors.
 * Default: `OutboxStaffPushDispatchService` → Postgres `StaffPushOutbox` + in-process drain.
 * For tests or diskless mode, bind `NoopStaffPushDispatchService`. Future: Redis/Bull producer here.
 */
@Injectable()
export abstract class StaffPushDispatchPort {
  abstract enqueueFromBranchEvent(
    envelope: StaffPushDeliveryEnvelope,
  ): Promise<void>;
}
