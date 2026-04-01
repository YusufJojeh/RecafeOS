/**
 * Declarative mutation-safety classification for staff REST operations.
 * Source of truth for product/docs; keep in sync with Nest controllers and ops-web callers.
 *
 * Path patterns are logical keys (method + route template under global prefix `/api/v1`).
 * See `docs/operations/idempotency-and-offline.md` and IdempotencyModule for close-bill.
 */
export const MutationSafetyClass = {
  /** Caller must send Idempotency-Key; server dedupes (e.g. close-bill). */
  IDEMPOTENCY_KEY: 'idempotency_key',
  /** Server uses row/version/status guards; duplicate call may 409 or no-op safely. */
  OPTIMISTIC_OR_VERSIONED: 'optimistic_or_versioned',
  /** Idempotent by nature for the current state machine or low blast radius. */
  IDEMPOTENT_BY_STATE: 'idempotent_by_state',
  /** Retrying the same payload may duplicate side effects without a client key. */
  AT_LEAST_ONCE_RISKY: 'at_least_once_risky',
  GET: 'safe_read',
} as const;

export type MutationSafetyKind =
  (typeof MutationSafetyClass)[keyof typeof MutationSafetyClass];

/**
 * Client-facing offline / replay boundary (honest UX + Dexie policy).
 * - **safe_to_queue** — may be persisted to the staff PWA offline queue (still subject to `offline-queue.ts` allowlist).
 * - **safe_to_retry** — user or client may repeat the same request when online; server usually dedupes or 409s safely.
 * - **unsafe_to_replay** — do not auto-retry or enqueue; duplicates may charge, duplicate rows, or corrupt state.
 * - **requires_online_confirmation** — verify server state (or send required idempotency header) before relying on outcome.
 */
export const OfflineReplayPolicy = {
  SAFE_TO_QUEUE: 'safe_to_queue',
  SAFE_TO_RETRY: 'safe_to_retry',
  UNSAFE_TO_REPLAY: 'unsafe_to_replay',
  REQUIRES_ONLINE_CONFIRMATION: 'requires_online_confirmation',
} as const;

export type OfflineReplayPolicyKind =
  (typeof OfflineReplayPolicy)[keyof typeof OfflineReplayPolicy];

/**
 * Logical operation keys (HTTP method + normalized path pattern).
 * Not exhaustive for support/internal routes — extend as mobile scope grows.
 */
export const MUTATION_SAFETY_BY_OPERATION: Record<string, MutationSafetyKind> = {
  // --- Tables (`TablesController`) ---
  'POST /branches/:branchId/tables': MutationSafetyClass.AT_LEAST_ONCE_RISKY,
  'PATCH /branches/:branchId/tables/:tableId':
    MutationSafetyClass.OPTIMISTIC_OR_VERSIONED,
  'POST /branches/:branchId/tables/sessions':
    MutationSafetyClass.AT_LEAST_ONCE_RISKY,
  'POST /branches/:branchId/tables/sessions/merge':
    MutationSafetyClass.AT_LEAST_ONCE_RISKY,

  // --- Orders (`OrdersController`) ---
  /** Optional `Idempotency-Key` — when set, server dedupes draft creation (see OrderCreationService). */
  'POST /branches/:branchId/orders': MutationSafetyClass.IDEMPOTENCY_KEY,
  'POST /branches/:branchId/orders/:orderId/items':
    MutationSafetyClass.AT_LEAST_ONCE_RISKY,
  'POST /branches/:branchId/orders/:orderId/items/:itemId/qty':
    MutationSafetyClass.OPTIMISTIC_OR_VERSIONED,
  'POST /branches/:branchId/orders/:orderId/confirm':
    MutationSafetyClass.OPTIMISTIC_OR_VERSIONED,
  'POST /branches/:branchId/orders/:orderId/send-to-preparation':
    MutationSafetyClass.OPTIMISTIC_OR_VERSIONED,
  'POST /branches/:branchId/orders/:orderId/discount':
    MutationSafetyClass.AT_LEAST_ONCE_RISKY,
  'POST /branches/:branchId/orders/:orderId/move-table':
    MutationSafetyClass.OPTIMISTIC_OR_VERSIONED,
  'POST /branches/:branchId/orders/merge':
    MutationSafetyClass.AT_LEAST_ONCE_RISKY,
  'POST /branches/:branchId/orders/:orderId/served':
    MutationSafetyClass.IDEMPOTENT_BY_STATE,
  'POST /branches/:branchId/orders/:orderId/close':
    MutationSafetyClass.IDEMPOTENCY_KEY,
  'POST /branches/:branchId/orders/:orderId/cancel':
    MutationSafetyClass.OPTIMISTIC_OR_VERSIONED,

  // --- Kitchen / bar ticket transitions (`KitchenController`, `BarController`) ---
  'PATCH /branches/:branchId/kitchen/tickets/:ticketId':
    MutationSafetyClass.OPTIMISTIC_OR_VERSIONED,
  'PATCH /branches/:branchId/bar/tickets/:ticketId':
    MutationSafetyClass.OPTIMISTIC_OR_VERSIONED,

  // --- Menu (`MenuController`) ---
  'POST /branches/:branchId/menu/categories':
    MutationSafetyClass.AT_LEAST_ONCE_RISKY,
  'POST /branches/:branchId/menu/items': MutationSafetyClass.AT_LEAST_ONCE_RISKY,
  'POST /branches/:branchId/menu/modifier-groups':
    MutationSafetyClass.AT_LEAST_ONCE_RISKY,
  'POST /branches/:branchId/menu/modifier-groups/:groupId/options':
    MutationSafetyClass.AT_LEAST_ONCE_RISKY,
  'POST /branches/:branchId/menu/items/:itemId/modifier-groups/:groupId':
    MutationSafetyClass.OPTIMISTIC_OR_VERSIONED,
  'POST /branches/:branchId/menu/import/dry-run':
    MutationSafetyClass.IDEMPOTENT_BY_STATE,
  'POST /branches/:branchId/menu/import/apply':
    MutationSafetyClass.AT_LEAST_ONCE_RISKY,

  // --- Inventory (`InventoryController`) ---
  'POST /branches/:branchId/inventory/adjust':
    MutationSafetyClass.AT_LEAST_ONCE_RISKY,
  'POST /branches/:branchId/inventory/recipes':
    MutationSafetyClass.AT_LEAST_ONCE_RISKY,

  // --- Tenant-scoped CRM (`CustomersController`, no branch prefix) ---
  'POST /customers': MutationSafetyClass.AT_LEAST_ONCE_RISKY,
  'POST /customers/:id/notes': MutationSafetyClass.AT_LEAST_ONCE_RISKY,
  'POST /customers/:id/offers': MutationSafetyClass.AT_LEAST_ONCE_RISKY,

  // --- Push device registration (upsert) ---
  'POST /tenants/push-devices': MutationSafetyClass.IDEMPOTENT_BY_STATE,

  // --- Invites ---
  'POST /tenants/invites': MutationSafetyClass.AT_LEAST_ONCE_RISKY,

  // --- Branch onboarding ---
  'POST /tenants/branches/:branchId/go-live-ack':
    MutationSafetyClass.OPTIMISTIC_OR_VERSIONED,

  // --- Guest public (throttled; not staff JWT) ---
  'POST /public/sessions/:token/call-waiter':
    MutationSafetyClass.AT_LEAST_ONCE_RISKY,
  /** Optional `Idempotency-Key` — dedupes full guest checkout per table session (see PublicGuestOrderService). */
  'POST /public/tenants/:tenantSlug/branches/:branchSlug/sessions/:token/order':
    MutationSafetyClass.IDEMPOTENCY_KEY,
  'GET /public/tenants/:tenantSlug/branches/:branchSlug/sessions/:token/orders/:orderId':
    MutationSafetyClass.GET,
};

/**
 * Offline/replay stance per operation — complements `MUTATION_SAFETY_BY_OPERATION`.
 * **Today** Dexie only allows `POST …/close` with `Idempotency-Key` + matching `X-Branch-Id` (see ops-web `offline-queue.ts`).
 */
export const OFFLINE_REPLAY_BY_OPERATION: Record<string, OfflineReplayPolicyKind> = {
  'POST /branches/:branchId/tables': OfflineReplayPolicy.UNSAFE_TO_REPLAY,
  'PATCH /branches/:branchId/tables/:tableId':
    OfflineReplayPolicy.REQUIRES_ONLINE_CONFIRMATION,
  'POST /branches/:branchId/tables/sessions':
    OfflineReplayPolicy.UNSAFE_TO_REPLAY,
  'POST /branches/:branchId/tables/sessions/merge':
    OfflineReplayPolicy.UNSAFE_TO_REPLAY,

  'POST /branches/:branchId/orders':
    OfflineReplayPolicy.REQUIRES_ONLINE_CONFIRMATION,
  'POST /branches/:branchId/orders/:orderId/items':
    OfflineReplayPolicy.UNSAFE_TO_REPLAY,
  'POST /branches/:branchId/orders/:orderId/items/:itemId/qty':
    OfflineReplayPolicy.SAFE_TO_RETRY,
  'POST /branches/:branchId/orders/:orderId/confirm':
    OfflineReplayPolicy.SAFE_TO_RETRY,
  'POST /branches/:branchId/orders/:orderId/send-to-preparation':
    OfflineReplayPolicy.SAFE_TO_RETRY,
  'POST /branches/:branchId/orders/:orderId/discount':
    OfflineReplayPolicy.UNSAFE_TO_REPLAY,
  'POST /branches/:branchId/orders/:orderId/move-table':
    OfflineReplayPolicy.SAFE_TO_RETRY,
  'POST /branches/:branchId/orders/merge': OfflineReplayPolicy.UNSAFE_TO_REPLAY,
  'POST /branches/:branchId/orders/:orderId/served':
    OfflineReplayPolicy.SAFE_TO_RETRY,
  'POST /branches/:branchId/orders/:orderId/close':
    OfflineReplayPolicy.SAFE_TO_QUEUE,
  'POST /branches/:branchId/orders/:orderId/cancel':
    OfflineReplayPolicy.SAFE_TO_RETRY,

  'PATCH /branches/:branchId/kitchen/tickets/:ticketId':
    OfflineReplayPolicy.SAFE_TO_RETRY,
  'PATCH /branches/:branchId/bar/tickets/:ticketId':
    OfflineReplayPolicy.SAFE_TO_RETRY,

  'POST /branches/:branchId/menu/categories':
    OfflineReplayPolicy.UNSAFE_TO_REPLAY,
  'POST /branches/:branchId/menu/items': OfflineReplayPolicy.UNSAFE_TO_REPLAY,
  'POST /branches/:branchId/menu/modifier-groups':
    OfflineReplayPolicy.UNSAFE_TO_REPLAY,
  'POST /branches/:branchId/menu/modifier-groups/:groupId/options':
    OfflineReplayPolicy.UNSAFE_TO_REPLAY,
  'POST /branches/:branchId/menu/items/:itemId/modifier-groups/:groupId':
    OfflineReplayPolicy.SAFE_TO_RETRY,
  'POST /branches/:branchId/menu/import/dry-run':
    OfflineReplayPolicy.SAFE_TO_RETRY,
  'POST /branches/:branchId/menu/import/apply':
    OfflineReplayPolicy.UNSAFE_TO_REPLAY,

  'POST /branches/:branchId/inventory/adjust':
    OfflineReplayPolicy.UNSAFE_TO_REPLAY,
  'POST /branches/:branchId/inventory/recipes':
    OfflineReplayPolicy.UNSAFE_TO_REPLAY,

  'POST /customers': OfflineReplayPolicy.UNSAFE_TO_REPLAY,
  'POST /customers/:id/notes': OfflineReplayPolicy.UNSAFE_TO_REPLAY,
  'POST /customers/:id/offers': OfflineReplayPolicy.UNSAFE_TO_REPLAY,

  'POST /tenants/push-devices': OfflineReplayPolicy.SAFE_TO_RETRY,
  'POST /tenants/invites': OfflineReplayPolicy.UNSAFE_TO_REPLAY,

  'POST /tenants/branches/:branchId/go-live-ack':
    OfflineReplayPolicy.SAFE_TO_RETRY,

  'POST /public/sessions/:token/call-waiter':
    OfflineReplayPolicy.UNSAFE_TO_REPLAY,
  'POST /public/tenants/:tenantSlug/branches/:branchSlug/sessions/:token/order':
    OfflineReplayPolicy.REQUIRES_ONLINE_CONFIRMATION,
  'GET /public/tenants/:tenantSlug/branches/:branchSlug/sessions/:token/orders/:orderId':
    OfflineReplayPolicy.SAFE_TO_RETRY,
};

/** Bump when adding/changing REST mutation-safety rows (not OpenAPI version). */
export const STAFF_API_CONTRACT_NOTE = 'rest_staff_api_mutation_safety_v5' as const;
