# Notifications and mobile push readiness

## Implemented today

| Channel | Mechanism | Notes |
|---------|-----------|--------|
| Staff realtime | Socket.IO `/ws`, `joinBranch`, `BranchRealtimeEvent` | See [`socket-io-scaling.md`](./socket-io-scaling.md) |
| Guest → staff signal | `POST /api/v1/public/sessions/:token/call-waiter` + `waiter_call` event | Throttled; staff must be in branch room |

## Partial: device registration + durable outbox + optional FCM provider

| Piece | Status |
|-------|--------|
| **Token storage** | `POST /api/v1/tenants/push-devices` (JWT) upserts `{ platform, token }` per user+tenant (`StaffPushDevice`). |
| **List devices** | `GET` returns `id`, `platform`, `createdAt`, `updatedAt` — **raw token omitted**. |
| **Invalid token cleanup** | `StaffPushService.deleteDevicesWithTokens(tenantId, tokens)` — invoked when `StaffPushProviderPort` returns `invalid_tokens`. |
| **Bridge** | After each `OpsGateway.emitBranchEvent`, `BranchRealtimePushBridgeService` resolves `tenantId` from `branchId` and calls `StaffPushDispatchPort`. |
| **Dispatch default** | `OutboxStaffPushDispatchService` inserts **`StaffPushOutbox`** (`PENDING`) and triggers an in-process drain (`setImmediate` + 20s interval). |
| **Worker** | `StaffPushOutboxWorkerService`: optimistic lock (`PENDING` → `PROCESSING` + `processingStartedAt`), calls `StaffPushProviderPort.deliver`, retries with exponential backoff (cap 5 min), **`DEAD`** after 5 attempts; **`reclaimStaleProcessing`** before each drain (rows stuck in `PROCESSING` longer than `STAFF_PUSH_STALE_PROCESSING_SEC`, default 300s → `PENDING` or **`DEAD`** if attempts exhausted). |
| **Provider** | `STAFF_PUSH_PROVIDER=noop` (default): `NoopStaffPushProviderService`. **`STAFF_PUSH_PROVIDER=fcm`** + `FIREBASE_SERVICE_ACCOUNT_JSON`: `FcmStaffPushProviderService` — Firebase Admin **HTTP v1**, tenant-wide `sendEach`, maps envelope → notification + data; invalid registration tokens → `invalid_tokens` (DB prune). **`STAFF_PUSH_FCM_DRY_RUN=true`**: log only, no Firebase I/O. |
| **Test/no disk** | Bind `NoopStaffPushDispatchService` instead of outbox if you must avoid writing outbox rows. |
| **Unregister** | `DELETE /api/v1/tenants/push-devices` with same JSON body as `POST` (`platform`, `token`) — removes the row for the current user + tenant (call on logout / token rotation client-side). |
| **Fan-out (v1)** | `StaffPushService.listTargetsForTenantDelivery(tenantId)` returns `{ userId, platform, token }[]` for the tenant. Intended for real `StaffPushProviderPort` implementations; **not** called by the noop provider. |
| **Failure fields** | Outbox rows keep `lastError`, `attempts`, `nextAttemptAt`, `completedAt` (success), `processingStartedAt` (in-flight clock). |

### Targeting model (today vs next)

| Version | Scope | Notes |
|--------|--------|--------|
| **v1 (current)** | Tenant-wide | Bridge resolves `tenantId` from `branchId`; all registered devices for that tenant are eligible once a real provider fans out. `StaffPushDeliveryEnvelope.branchId` is payload context only. |
| **Next** | Branch- or role-scoped | Filter tokens by staff members “attached” to the branch, or by permission / preference — requires product rules + likely extra columns or join tables (not implemented). |

Provider adapters should map `StaffPushProviderDeliveryResult` precisely: **retryable** transient failures → backoff; **invalid_tokens** → DB prune (already wired); **submitted** → `COMPLETED`.

## Not implemented (blocks “native-grade” alerts)

| Gap | Why it matters for mobile |
|-----|---------------------------|
| **Verified OS background delivery** | Server FCM alone does not prove notifications on locked devices; physical device + analytics still required |
| **APNs (non-FCM) / Web Push VAPID** | Raw APNs device tokens are not FCM targets; web staff clients need VAPID if not using FCM web |
| **Provider batch send** | Collapse keys, per-role routing, delivery receipts beyond FCM batch responses |
| **Provider targeting** | Topics, collapse keys, per-role routing |
| **Horizontal worker** | Redis/Bull (or equivalent), `SKIP LOCKED`, poison-queue ops — in-process drain is **single-node** friendly only |
| Preference model | Per-role / per-channel mute (kitchen vs cashier) |
| Staff notification inbox | Audit trail + “missed alerts” when offline |

## Machine-readable checklist

[`packages/types/src/notification-readiness.ts`](../../packages/types/src/notification-readiness.ts) exports `NotificationReadiness` string literals — bump keys when shipping infrastructure.

Shared push envelope: [`packages/types/src/staff-push-delivery.ts`](../../packages/types/src/staff-push-delivery.ts).

## Suggested v1 product model (when prioritized)

1. **Registration:** authenticated `POST` with `{ platform, token }` scoped to tenant + user; **`DELETE`** with same body on logout / token rotation.
2. **Fan-out:** `listTargetsForTenantDelivery(tenantId)` (v1 tenant-wide); later branch/role filters; map envelope to provider messages.
3. **Provider:** implement `StaffPushProviderPort` with FCM/APNs/Web — **reuse** the outbox worker; optional second stage: enqueue to Redis from `StaffPushDispatchPort` for multi-instance APIs.
4. **Retry / failure:** keep worker backoff; map provider errors to `retryable`, `invalid_tokens`, or terminal `DEAD`.
5. **Compliance:** explicit opt-in copy for marketing vs operational pushes (verify with counsel).
