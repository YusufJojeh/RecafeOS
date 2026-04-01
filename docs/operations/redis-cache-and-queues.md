# Redis usage, cache discipline, and background work — RestoCafe OS

Operational companion to the cache / Redis / queue audit. See also [`DEPLOYMENT_DEVOPS.md`](./DEPLOYMENT_DEVOPS.md) §2d for connection budgeting.

## Redis connections per API process

When `REDIS_URL` is set, **one Node API process** typically opens **seven** TCP connections to Redis:

| Client library | Role | Count |
|----------------|------|------:|
| `redis` (node-redis) | Socket.IO adapter — **pub** + **sub** | 2 |
| `ioredis` | Close-bill idempotency (`RedisIdempotencyKeyStore`) | 1 |
| `ioredis` | Staff JWT / permissions cache (`StaffAuthCacheService`) | 1 |
| `ioredis` | Reports `daily()` JSON cache (`ReportsRedisCacheService`) | 1 |
| `ioredis` | Leader election (`LeaderLockService`) | 1 |
| `ioredis` | Branch menu cache invalidation (`BranchMenuCacheInvalidationService`) | 1 |

**Capacity planning:** multiply **7 × number of API replicas** (plus any workers or sidecars that share the same URL) and compare to your Redis `maxclients` and hosting limits.

### Consolidation backlog (optional refactor)

Several features each construct their own `ioredis` instance from `REDIS_URL`. Functionally this is fine; operationally it increases connection count. A future refactor can expose a **single shared `ioredis` client** (or a small pool) from a Nest global module and inject it into idempotency, staff cache, reports cache, leader lock, and menu invalidation—without changing Redis key semantics. **Prioritize** this refactor when measured connection count or `maxclients` pressure becomes an operational issue—not preemptively.

There is **no** BullMQ or `@nestjs/bull` job runner in this repo; background work uses in-process timers and support-triggered HTTP handlers.

## Branch menu Redis cache key and invalidation

If you add a cross-replica **read** cache for branch menu payloads, use the canonical key:

`rc:menu:branch:v1:<branchId>`

(see `apps/api/src/common/menu-cache/branch-menu-cache-key.ts`.)

**Invalidation is wired in the API:** `BranchMenuCacheInvalidationService.invalidateBranch` runs after:

- `MenuService`: `createCategory`, `createItem`, `patchItem`, `createModifierGroup`, `addModifierOption`, `linkModifierToItem`, `importApply`
- `SupportService.cloneBranchMenu` (target branch)
- `ProvisioningService.provisionTenant` (provisioned branch)

Any **new** menu write path must call the same invalidation or stale price/availability is possible.

**Dangerous caching (do not without a design):** volatile order lists, open tickets, or computed order totals in Redis—prefer realtime and per-request server truth.

## BullMQ / worker queue — deferred

Introduce **BullMQ** (or an external scheduler + worker process) only when metrics show **report generation, AI, or admin bulk work** competing with HTTP/WebSocket latency SLOs. Until then, keep heavy work in the API with leader locks and monitoring ([`SlowRequestInterceptor`](../../apps/api/src/common/observability/slow-request.interceptor.ts)), and isolate later via a dedicated worker deployment with its own DB pool if needed.
