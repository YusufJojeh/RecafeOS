import { Injectable } from '@nestjs/common';
import type { StaffPushDeliveryEnvelope } from '@restocafe/types';
import {
  StaffPushProviderDeliveryResult,
  StaffPushProviderPort,
} from './staff-push-provider.port';

/** Placeholder until FCM/APNs/Web Push — always reports success without I/O. */
@Injectable()
export class NoopStaffPushProviderService extends StaffPushProviderPort {
  deliver(_envelope: StaffPushDeliveryEnvelope): Promise<StaffPushProviderDeliveryResult> {
    return Promise.resolve({ outcome: 'submitted' });
  }
}
