import { Injectable } from '@nestjs/common';
import type { StaffPushDeliveryEnvelope } from '@restocafe/types';

/**
 * Maps a realtime-mirrored envelope to one or more provider sends (FCM / APNs / Web Push).
 * The noop implementation satisfies the port today; swap binding when wiring real SDKs.
 *
 * **Integration pattern:** Inject `StaffPushService`, call `listTargetsForTenantDelivery(envelope.tenantId)`,
 * batch-send with the platform SDK, map HTTP/SDK errors to `failed` (`retryable` / `message`).
 * Unregistered tokens → `invalid_tokens` so `StaffPushOutboxWorkerService` prunes `StaffPushDevice` rows.
 */
export type StaffPushProviderDeliveryResult =
  | { outcome: 'submitted' }
  | { outcome: 'failed'; retryable: boolean; message: string }
  | { outcome: 'invalid_tokens'; tokens: string[]; message?: string };

@Injectable()
export abstract class StaffPushProviderPort {
  /**
   * One outbox row ⇒ one `deliver` call. A real adapter typically fans out to N device tokens
   * (same envelope payload on each / collapsed notification per platform rules).
   */
  abstract deliver(
    envelope: StaffPushDeliveryEnvelope,
  ): Promise<StaffPushProviderDeliveryResult>;
}
