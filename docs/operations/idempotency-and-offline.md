# Idempotency and offline mutations

## Idempotency: create order (draft)

`POST /api/v1/branches/:branchId/orders` accepts an optional **`Idempotency-Key`** header.

- Key format (server-side): `createOrder:{tenantId}:{branchId}:{clientKey}`.
- TTL: **10 minutes** for the stored mapping (order id) after a successful create.
- **Replay:** If the key maps to an order that is still **`DRAFT`**, the same order row is returned. If the order advanced past draft, the API responds with **409** `idempotency_replay_order_advanced` so clients refetch instead of assuming a fresh draft.
- Uses the same Redis/memory store as close-bill when `REDIS_URL` / production rules apply.

## Idempotency: close bill

`POST /api/v1/branches/:branchId/orders/:orderId/close` accepts an optional **`Idempotency-Key`** header.

- Key format (server-side): `closeBill:{tenantId}:{orderId}:{clientKey}`.
- TTL: **10 minutes** for the stored mapping (order id) after a successful close.

### Redis (production / multi-replica)

When **`REDIS_URL`** is set (see [`apps/api/.env.example`](../../apps/api/.env.example)), idempotency state is stored in **Redis** so **all API replicas** share the same keys.

**`IDEMPOTENCY_REQUIRE_REDIS`:** In **production**, the API now treats this as effectively **always true** and **refuses to start** without `REDIS_URL`. An explicit `IDEMPOTENCY_REQUIRE_REDIS=false` is rejected in production. For a **single** Node process only (local dev or one replica), leave it `false` and you may omit `REDIS_URL` (memory store).

**Release gate:** Pilot gate **B1** in [`PILOT_RELEASE_GATE.md`](./PILOT_RELEASE_GATE.md) requires `REDIS_URL` wherever multiple API processes exist. Production startup now fails fast before serving traffic if Redis-backed idempotency is not available ([`idempotency.module.ts`](../../apps/api/src/common/idempotency/idempotency.module.ts), [`env.ts`](../../apps/api/src/config/env.ts)).

**Single-replica fallback:** One API pod + no Redis: memory idempotency is consistent within that process only; acceptable for local/dev only. It is no longer allowed in production. Concurrent requests with the same key coordinate with a short-lived lock (**90s** TTL, token-valued; see [`distributed-idempotency-design.md`](./distributed-idempotency-design.md)) so only one close runs; others wait for the result or receive **503** `idempotency_in_progress` if the wait times out.

**Redis availability:** With `Idempotency-Key`, close-bill depends on Redis for lock + replay. If Redis is unreachable, keyed requests may fail (fail closed is safer than per-replica memory for **multi-replica**). Run Redis with persistence/HA appropriate to your pilot; single-node Redis is common for adapter + idempotency state.

**Already paid:** If the order is already **`PAID`**, close returns **200** with the order (and refreshes the idempotency mapping when a key is sent) so clients can safely retry after timeouts or partial failures.

### Single process (no `REDIS_URL`)

Without Redis, the API uses a **process-local** store suitable for **one** Node instance only. This mode is for local/dev only and must not be used in production.

### Postgres (always): concurrent duplicate closes

Even without `Idempotency-Key`, the close handler uses an **atomic order transition** (`READY`/`SERVED` → `PAID`) inside one transaction before inserting `Payment`, so two concurrent requests cannot double-charge the same order. See [`distributed-idempotency-design.md`](./distributed-idempotency-design.md).

## Offline queue (`ops-web`)

[`apps/ops-web/src/lib/offline-queue.ts`](../../apps/ops-web/src/lib/offline-queue.ts) persists mutations in IndexedDB **only** when `assertEnqueueAllowed` passes:

- `kind` must be **`close-bill`**
- `POST` to `/branches/:branchId/orders/:orderId/close` (path relative to `/api/v1`)
- Headers must include **`Idempotency-Key`** and **`X-Branch-Id`** equal to the branch segment in the path

Anything else throws at enqueue time — this is intentional; the product **does not** offer a general offline mutation queue.

**Recommended policy**

| Eligible | Not eligible without server idempotency |
|----------|-------------------------------------------|
| Close bill with stable `Idempotency-Key` + branch match (queued as above) | Close bill without key, kitchen PATCH, inventory, menu writes, blind order creates |
| Idempotent GET retries (normal `apiFetch` retry policy when online) | Guest `call-waiter` spam replay, duplicate risky POSTs |

**Client contract**

1. Prefer **server-generated or known-safe** retries (same `Idempotency-Key` on close bill).
2. On reconnect, **drain** the queue in order; surface failures to the user instead of infinite retry.
3. Treat **queued** close as **unpaid server-side** until sync succeeds; toasts/copy on open orders + PWA explain this.

## Offline / replay policy map (staff routes)

Machine-readable: [`packages/types/src/mutation-safety.ts`](../../packages/types/src/mutation-safety.ts) — `OFFLINE_REPLAY_BY_OPERATION` (keys match `MUTATION_SAFETY_BY_OPERATION`).

| Policy | Meaning |
|--------|---------|
| `safe_to_queue` | Only operation permitted in Dexie today: close-bill with guards above. |
| `safe_to_retry` | Repeat when online is usually OK (FSM / optimistic guards); **not** auto-queued offline. |
| `unsafe_to_replay` | Do not replay blindly; may duplicate charges or corrupt data. |
| `requires_online_confirmation` | Need live server check or mandatory idempotency (e.g. optional key on draft create, guest order). |

**Validation:** `ops-web` Vitest asserts `OFFLINE_REPLAY_BY_OPERATION` keys stay aligned with the mutation-safety map and that exactly **one** route is `safe_to_queue`.

## Ordering guarantees

- HTTP mutations are **at-most-once** from the client’s perspective if idempotency keys are used where it matters.
- Without keys, retries may duplicate side effects; treat network failures as **unknown** and reconcile with server state (refetch order).

## CI and Redis

The **`api-integration`** job in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) sets **`REDIS_URL`** so integration tests exercise the Redis-backed idempotency path (close bill, locks) the same way as multi-replica deployments. Local runs of `npm run test:integration -w api` should also set `REDIS_URL` when testing payment idempotency; the workflow documents the expected pattern.

## Mutation safety matrix (staff REST)

Machine-readable map: [`packages/types/src/mutation-safety.ts`](../../packages/types/src/mutation-safety.ts) (`MUTATION_SAFETY_BY_OPERATION`, `STAFF_API_CONTRACT_NOTE`).

| Class | Meaning for clients / offline |
|-------|-------------------------------|
| `idempotency_key` | Send stable **`Idempotency-Key`** on retries (close-bill today). |
| `optimistic_or_versioned` | Server guards with status/version; duplicate may 409 or no-op — refetch on ambiguity. |
| `idempotent_by_state` | Safe to retry when the FSM rejects impossible transitions. |
| `at_least_once_risky` | **Do not** blindly replay from offline queue without server idempotency or user confirm. |

**Validation in CI:** `ops-web` Vitest imports the map (`apps/ops-web/src/lib/mutation-safety-contract.test.ts`) so renames to critical operations fail the web test suite.

**Not covered:** Support-console mutations, pilot/support-only POSTs — extend the map when mobile scope includes them.
