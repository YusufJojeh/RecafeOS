/**
 * Staff / guest notification surface readiness.
 * Update when adding FCM/APNs, Web Push VAPID, inbox, or replacing the noop push bridge.
 *
 * Realtime today: `BranchRealtimeEvent` + Socket.IO `/ws`.
 * Partial push today: device registration + durable `StaffPushOutbox` + in-process worker;
 * **Provider:** optional `StaffPushProviderPort` FCM (Firebase HTTP v1) when configured; APNs native adapter and Web Push VAPID still outstanding.
 */
export const NotificationReadiness = {
  branchRealtimeSocketIo: 'implemented',
  waiterCallEvent: 'implemented',
  waiterCallPersistence: 'implemented',
  /**
   * After each `OpsGateway.emitBranchEvent`, `BranchRealtimePushBridgeService` resolves
   * `tenantId` and forwards a `StaffPushDeliveryEnvelope` to `StaffPushDispatchPort`.
   * Default: **outbox persist** (`StaffPushOutbox`); not a provider pipeline.
   */
  realtimeToPushDispatchBridge: 'outbox_enqueue',
  /** Vite PWA plugin only; no Web Push VAPID / subscription API in product. */
  webPush: 'not_implemented',
  /** Server-side FCM HTTP v1 multicast when `STAFF_PUSH_PROVIDER=fcm` + service account; client/OS proof separate. */
  fcmAndroid: 'server_fcm_http_v1_optional',
  apnsIos: 'not_implemented',
  /** FCM server path exists; APNs direct + Web Push + verified background delivery on physical devices still missing. */
  mobilePush: 'partial_fcm_server_only',
  staffNotificationInbox: 'not_implemented',
  /** `POST/GET /tenants/push-devices` persists tokens; responses omit raw token on list. */
  deviceRegistrationApi: 'storage_only_no_delivery',
  /** Topic / branch / user routing in FCM/APNs — not implemented (bridge has envelope only). */
  providerTopicAndTargeting: 'not_implemented',
  /**
   * Postgres outbox + in-process drain, exponential backoff, DEAD state, invalid-token prune hook.
   * **Not** a dedicated Redis/Bull worker fleet; **not** horizontal outbox locking.
   */
  deliveryWorker: 'inprocess_outbox_retries',
  /** PROCESSING rows older than `STAFF_PUSH_STALE_PROCESSING_SEC` reset to PENDING (crash reclaim). */
  outboxStaleProcessingReclaim: 'implemented',
  /** `DELETE /tenants/push-devices` — body matches register; removes one device row (logout / token rotate). */
  deviceUnregisterApi: 'implemented',
  /**
   * Tenant-scoped device token list for provider fan-out (v1: all devices in tenant).
   * Real `StaffPushProviderPort` should load targets + envelope to build FCM/APNs sends.
   */
  pushFanoutTenantTokens: 'resolver_implemented',
  notificationPreferenceModel: 'not_implemented',
  emailTransactional: 'not_implemented',
} as const;

export type NotificationReadinessKey = keyof typeof NotificationReadiness;
