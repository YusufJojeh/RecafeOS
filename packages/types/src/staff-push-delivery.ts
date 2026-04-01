import type { BranchRealtimeEventName, BranchRealtimePayloads } from './realtime';

/**
 * One registered device row for provider fan-out (FCM multicast, per-device APNs, etc.).
 * Resolved server-side from `StaffPushDevice`; not embedded in the outbox row (tokens rotate).
 */
export type StaffPushDeviceTarget = {
  userId: string;
  platform: string;
  token: string;
};

/**
 * Payload sent from the API through the staff push outbox toward `StaffPushProviderPort`
 * (noop or FCM when `STAFF_PUSH_PROVIDER=fcm`).
 *
 * **Rule:** reuse `BranchRealtimeEvent` names and payload shapes; push is a side-channel
 * mirroring Socket.IO, not a second source of truth.
 *
 * **Targeting (v1):** `tenantId` scopes device registration (tenant-wide token list today).
 * `branchId` carries route context in the payload until branch- or role-scoped fan-out exists.
 */
export type StaffPushDeliveryEnvelope = {
  tenantId: string;
  branchId: string;
  event: BranchRealtimeEventName;
  /** Same object emitted on `/ws` for this event (JSON-serializable). */
  payload: BranchRealtimePayloads[keyof BranchRealtimePayloads];
};
