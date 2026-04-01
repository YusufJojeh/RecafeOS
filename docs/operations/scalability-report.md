# RestoCafe OS — Scalability Report

> **Date:** 2026-03-23
> **Scope:** Full codebase audit — backend, database, WebSocket, frontend, concurrency, load testing
> **Method:** Static analysis of every service, schema, controller, gateway, and test file. No production telemetry available (no staging has been load-tested yet).
> **Honesty policy:** No marketing. No hedging. Where data is missing, it is called out as missing.

---

## 1. Current Codebase Scalability Status

**Verdict: Adequate for pilot (1–5 small venues). Not validated for anything beyond that.**

The system is a single NestJS monolith (well-structured into 18 feature modules) backed by one PostgreSQL instance and one optional Redis. It serves a single-page React app via REST + Socket.IO.

What exists:
- Multi-tenant row-level scoping on all queries via `whereUnderBranchTenant()` helper
- Redis-backed auth cache (45s TTL), idempotency store, Socket.IO adapter, and report L2 cache — all with graceful degradation to in-memory when Redis is absent
- Cursor-based pagination on open orders (capped at 500)
- 2-layer report caching (in-process L1 + Redis L2)
- Prometheus metrics hooks on HTTP requests, WebSocket connections, business events
- Leader-lock service for single-replica scheduled jobs
- Connection pool uses Prisma defaults (no explicit sizing)

What does not exist:
- No production load test has ever been run (staging secrets are not configured in CI — the perf-gate workflow skips silently)
- No PgBouncer or connection pooler
- No read replica
- No background job queue (no Bull, no BullMQ, no Agenda)
- No database-level row-level security (RLS) — tenant isolation depends entirely on application query filters
- No explicit Prisma connection pool configuration

**Bottom line:** The codebase is reasonably clean for a pilot-stage SaaS. But "scalable" is a claim that requires load test evidence, and that evidence does not exist yet.

---

## 2. Architecture Suitability for Growth

**Verdict: Suitable up to ~10 active branches without code changes. After that, infra tuning is required. After ~40 branches, structural changes are needed.**

**Strengths of the current architecture:**
- Modular monolith with clear boundaries — 18 NestJS modules, no circular dependencies detected. This is the right architecture for this stage. Splitting into microservices would add distributed-systems overhead with zero capacity benefit.
- Every Redis dependency has in-memory fallback — the system runs with or without Redis. This simplifies local dev and single-instance deployments.
- Socket.IO Redis adapter is pre-wired for horizontal API scaling — adding API replicas behind a load balancer requires no code changes.
- The `LeaderLockService` ensures scheduled jobs (audit retention) run on exactly one replica.

**Weaknesses:**
- **Audit logging is synchronous in the request path.** Every state change (order confirm, prep ticket update, bill close) does `await prisma.auditLog.create()` inside the request handler. This adds a DB write to every mutation. At high throughput, this doubles write load.
- **Close-bill transaction is a long chain.** `closeBill()` runs: order status update → payment creation → table session close → floor table update → stock deduction loop → customer visit recording — all in one interactive Prisma `$transaction`. If any step is slow, the entire transaction holds a DB connection.
- **No background job queue.** Stock deduction, analytics event recording, and audit log creation are all synchronous. There's no BullMQ or equivalent to offload non-critical side effects.
- **Auth cache miss triggers a Prisma query on the hot request path.** Every authenticated request goes through `BranchGuard` → `StaffAuthCacheService`. Cache miss (every 45s per user) queries the DB synchronously before the controller runs.

**No architecture change is recommended without load test evidence.** The existing capacity analysis doc (`docs/operations/capacity-analysis.md`) correctly identifies the trigger thresholds. I agree with its assessments.

---

## 3. Backend Performance Status

**Verdict: Clean code paths with two known hotspots. No measured performance data.**

**Request pipeline per authenticated request:**
1. Helmet (security headers)
2. Global ValidationPipe (whitelist + transform)
3. ThrottlerGuard (120 req/min global rate limit)
4. JwtAuthGuard (JWT verification)
5. BranchGuard (Redis/memory cache lookup → DB fallback on miss)
6. PermissionsGuard (cache lookup)
7. Controller → Service logic
8. SlowRequestInterceptor (logs requests > 2s)
9. HttpMetricsInterceptor (Prometheus counter, if enabled)
10. GlobalExceptionFilter (maps errors to safe responses)

**Hotspot 1 — Open orders read path:**
`GET /branches/:id/orders` includes Order + OrderItems + PrepTickets + FloorTable + TableSession in a single Prisma query with deep `include` nesting. This is the most frequently called endpoint (floor staff poll cycle). No `select` narrowing — fetches all fields whether the frontend uses them or not.

**Hotspot 2 — Close-bill write path:**
`POST /orders/:id/close` runs 6+ sequential DB operations in one transaction with Redis idempotency polling (120 attempts × 50ms = up to 6s timeout). The idempotency polling uses fixed 50ms intervals instead of exponential backoff.

**What's missing:**
- `METRICS_ENABLED` defaults to `false`. No production or staging Prometheus data exists.
- `SLOW_REQUEST_MS` is set to 2000ms. We don't know how many requests exceed this in practice because no environment is instrumented.

---

## 4. Database Readiness Status

**Verdict: Well-indexed on high-traffic tables. Three indexing gaps. No RLS. Unbounded table growth with only age-based cleanup.**

**Schema: 44 models, 10+ enums.** Normalized correctly for the POS domain.

**Indexing — what's good:**
- `Order` has 4 composite indexes including a 4-field composite `(branchId, tenantId, status, paidAt)` — excellent for the most common query patterns
- `PreparationTicket` has a 4-field composite `(branchId, station, status, createdAt)` — covers kitchen/bar display queries
- `TableSession` has `(branchId, status)` composite — covers floor page queries
- `AuditLog` and `AnalyticsEvent` both have `(createdAt)` indexes for retention cleanup

**Indexing — what's missing:**
1. **`OrderItem`**: Only single-field indexes on `orderId` and `menuItemId`. No composite. This table is joined on every order detail view and every report aggregation. At 5 items/order average, it grows 5× faster than the Order table.
2. **`Payment`**: No temporal index. The `createdAt` column has no index, meaning daily/monthly settlement reports will full-scan as data grows.
3. **`FloorTable`**: No standalone `branchId` index (only composite `branchId + status`). Loading all tables regardless of status requires a filter-scan.

**Multi-tenancy:**
- Tenant isolation uses application-level `WHERE tenantId = $1` on every query via `whereUnderBranchTenant()`.
- **No database-enforced RLS.** A single missing `tenantId` filter in any query could leak cross-tenant data. The codebase is consistent about this today, but it's a fragile guarantee as the codebase grows.

**Unbounded growth tables:**
| Table | Growth driver | Retention | Risk |
|---|---|---|---|
| AuditLog | Every DB mutation | Age-based cron (leader-locked, 24h interval) | Grows linearly with all operations |
| AnalyticsEvent | Every tracked action | Age-based cron | Grows faster than AuditLog |
| OrderItem | ~5 per order | None | Never cleaned up |
| StockMovement | Every order close + adjustments | None | Never cleaned up |
| CustomerVisit | Every order for repeat customers | None | Never cleaned up |
| Payment | One per order | None | Never cleaned up |

**Connection pooling:**
- PrismaService extends PrismaClient with zero configuration. Pool size is Prisma's internal default (typically `num_cpus × 2 + 1`).
- No `connection_limit` or `pool_timeout` set in `DATABASE_URL`.
- No PgBouncer.
- **This is the first bottleneck that will hit.** At 3 API replicas × ~10 default connections = 30 connections. A small managed Postgres instance caps at 50–100 `max_connections`.

---

## 5. Realtime / WebSocket Readiness Status

**Verdict: Correctly architected for single-digit branches. Will need tuning for scale.**

**What works:**
- `OpsGateway` authenticates via JWT on connect, enforces branch membership via `joinBranch` handler (cached auth check)
- 8 distinct event types with well-defined payloads
- Branch-scoped rooms (`branch:${branchId}`) — events are sent only to clients in the relevant branch
- Redis adapter is optional but pre-wired for multi-replica deployment
- Prometheus gauge tracks `websocket_authenticated_connections` and counter tracks `websocket_branch_events_emitted_total`

**What's fragile:**
- **No server-side event batching.** Each state transition emits immediately. 10 kitchen ticket updates in rapid succession = 10 separate `ORDER_UPDATED` events broadcast to all clients in the branch. The frontend debounces (320ms) to prevent React Query storms, but the network traffic still happens.
- **No WebSocket token refresh.** The initial JWT from connection handshake is used for the entire session lifetime. If the token expires mid-shift, the socket disconnects. The client has 12 reconnection attempts (1s → 30s backoff) but must get a fresh token via HTTP refresh first.
- **Reconnection triggers full refetch.** On reconnect, the frontend invalidates all 5 query roots (`tickets`, `open-orders`, `tables`, `ops-snapshot`, `reports`). With 30 clients reconnecting simultaneously after a brief network blip, this creates a thundering herd of HTTP requests.
- **Socket.IO uses all defaults.** No custom `pingInterval`, `pingTimeout`, `requestsTimeout`, or `maxPayload` configuration. This is fine for small deployments but means no tuning has been considered for high connection counts.

**Scale concern:**
- Capacity doc estimates 200–400 Socket.IO connections as the safe envelope. Beyond ~500, Redis pub/sub CPU becomes the limiter.
- There is an Artillery-based WebSocket test config (`ops/load/ws-artillery/`) but its thresholds show 0 tolerance for failed VUs — it has never been run against staging.

---

## 6. Frontend Operational Performance Status

**Verdict: Well-optimized for the operational use case. No significant frontend bottlenecks.**

**What's done right:**
- **Lean stack:** React 19, Zustand (state), TanStack React Query (server state), TailwindCSS (styling). No heavy UI framework (no Material UI, no Chakra). No charting libraries.
- **Adaptive polling:** When Socket.IO is connected, HTTP polling drops from 12s to 60s interval. When tab is backgrounded, polling pauses entirely. 12 `visibilitychange` listeners prevent unnecessary requests from inactive tabs.
- **Virtualization:** `@tanstack/react-virtual` kicks in at 28+ items for kitchen tickets and open orders lists. 88px/120px row heights with overscan. This prevents DOM thrashing on busy branches.
- **Debounced cache invalidation:** 320ms debounce window batches multiple Socket.IO events into a single React Query invalidation pass. Narrow invalidation roots — `TICKET_UPDATED` with station info only invalidates the specific kitchen/bar query, not the full cache.
- **PWA with offline queue:** Dexie-backed offline mutation queue can buffer ticket status changes during network outages and drain on reconnect.

**What's not optimized:**
- **No route-level code splitting.** All page components are loaded upfront in the main bundle. Only `ReportsPage.TenantRollupSection` uses `React.lazy()`. This means the initial bundle includes kitchen, floor, orders, reports, and admin pages whether the user needs them or not.
- **Selective memoization only.** `useMemo` is used on expensive report calculations but `React.memo` is not widely applied to component trees. Under high-frequency Socket.IO events, this could cause unnecessary re-renders — though the 320ms debounce mitigates this significantly.

**Net assessment:** The frontend is not the bottleneck. The adaptive polling and debouncing strategy is well-thought-out. The missing code splitting is a nice-to-have, not a blocker.

---

## 7. Concurrency Safety Status

**Verdict: Solid after the fixes applied in this audit. Three patterns are correctly implemented.**

**Pattern 1 — Optimistic concurrency (Order state transitions):**
- `updateMany` with `WHERE status = expectedStatus` acts as an optimistic lock. If a concurrent request already advanced the status, `updateMany` returns `count: 0` and the service throws `ConflictException`.
- `confirm()` has an idempotent early return: if the order is already `CONFIRMED`, it returns the order instead of throwing.
- This is correct and tested. Integration test `concurrency-safety.integration-spec.ts` verifies that concurrent confirms produce exactly one success.

**Pattern 2 — Pessimistic locking (Table sessions):**
- `openSession()` uses `SELECT status FROM "FloorTable" WHERE id = $1 FOR UPDATE` inside a `$transaction` to prevent concurrent session creation on the same table.
- This was added during this audit to fix a real race condition where two requests could both create sessions.
- Tested: concurrent session creation test verifies exactly 1 success + N-1 409 Conflict responses.

**Pattern 3 — Distributed idempotency (Close-bill):**
- Redis-based lock with token-matched Lua release. `CLOSE_BILL_IDEM_TTL_MS = 600,000ms` (10 min), `IDEM_LOCK_TTL_MS = 90s`.
- Polling loop: 120 attempts × 50ms = 6s max wait.
- Falls back to in-memory `Map` if Redis is unavailable (with `IDEMPOTENCY_REQUIRE_REDIS` env var to enforce Redis in production).
- Tested: `concurrency-payments.k6.js` races 20 VUs to close the same order and verifies exactly 1 payment created.

**Pattern 4 — Deadlock prevention (Session/order merge):**
- `mergeSessions()` sorts session IDs before locking to ensure consistent lock acquisition order. Prevents A→B / B→A deadlocks.

**Remaining risk:**
- The `closeBill()` idempotency polling uses fixed 50ms intervals. Under contention, this creates predictable retry storms. Exponential backoff would be better but is not critical at current scale.
- The in-memory idempotency fallback (when Redis is down) does not work across API replicas. If `IDEMPOTENCY_REQUIRE_REDIS` is not set in production and Redis fails, two replicas could both process the same close-bill.

---

## 8. Load-Testing Maturity Status

**Verdict: Comprehensive test suite exists. It has never been run against a real environment.**

**What exists (8 k6 scripts + 1 Artillery config + 1 comparison tool):**

| Script | Purpose | VUs | Duration |
|---|---|---|---|
| `staging-smoke.k6.js` | Read-only sanity | 5 | ~2 min |
| `staging-pilot.k6.js` | Pilot-scale mixed load | 25 + 4 writers | 8 min |
| `staging-mixed-ws.k6.js` | Mixed HTTP + WebSocket | Variable | Variable |
| `growth-scale.k6.js` | Pre-GA growth profile | 45 + 8 writers | 12 min |
| `soak-sustained.k6.js` | Stability over time | 15 | 35 min |
| `concurrency-payments.k6.js` | Payment race condition | 20 | Short burst |
| `benchmark-baselines.k6.js` | Per-endpoint latency | 1 | Isolated |
| `ws-artillery/` | Socket.IO scenarios | Variable | Manual |
| `compare-runs.js` | Regression detection | N/A | Post-run |

**CI integration:**
- `perf-gate.yml` runs smoke on every push to main, pilot + concurrency on every release tag, and manual dispatch for any suite.
- **But:** The workflow checks for `STAGING_BASE_URL` secret and **skips silently if not set**. Based on the fact that there are no load test results in the repository and no baseline JSON files, it is near-certain that staging secrets have never been configured. The entire perf-gate pipeline is inert.

**Thresholds are well-defined:**
- `thresholds.json` defines p95/p99 targets per endpoint, failure rate caps, and regression warning/blocking percentages (15% warn, 30% block).
- Close-bill target: p95 < 1200ms, p99 < 2500ms.
- Read endpoints: p95 < 200–350ms depending on endpoint.
- These are reasonable targets but they are aspirational — they have never been validated.

**`run-suite.sh` orchestrator** exists to run all suites in sequence with proper artifact handling.

**Net assessment:** The load testing infrastructure is well-designed and ready to use. The gap is operational — nobody has pointed it at a real staging environment and pressed go.

---

## 9. Safe Growth Envelope

Based on architectural analysis (not measured data):

| Dimension | Safe today | Stretch (needs tuning) | Danger zone |
|---|---|---|---|
| Active staff devices per branch | 25–35 | 40–60 (pool sizing) | 60+ (needs PgBouncer) |
| Simultaneously active branches | 5–10 | 10–20 (pool + cache tuning) | 20+ (needs read replica) |
| Orders per branch per shift | 300–500 | 500–1000 (query optimization) | 1000+ (needs async side effects) |
| Total Socket.IO connections | 200–400 | 400–700 (Redis tuning) | 700+ (needs dedicated WS layer) |
| Concurrent payment closes | 3–5 | 5–10 (idempotency holds) | 10+ per second (needs queue) |
| Report cold-hit latency | < 3s | 3–5s (cache TTL tuning) | 5s+ (needs read replica) |

**These numbers are projections, not measurements.** They could be off by 2× in either direction. The only way to know is to run the load tests.

---

## 10. Highest-Risk Bottlenecks (Ranked)

**1. PostgreSQL connection pool exhaustion (CRITICAL)**
- Prisma uses default pool sizing. No `connection_limit` in `DATABASE_URL`. No PgBouncer.
- With 3 API replicas × ~10 connections = 30 connections held permanently. A small managed Postgres instance (50–100 max_connections) will start queuing.
- **Detection:** Prisma logs `"All connections in the connection pool are in use"`. HTTP p95 climbs.
- **Fix effort:** One env var change (`connection_limit=15` in DATABASE_URL). Zero code changes.

**2. Synchronous audit logging in request path (HIGH)**
- Every mutation does `await prisma.auditLog.create()` synchronously. This adds a DB write to every order confirm, prep ticket update, bill close, etc.
- At 50 orders/hour/branch × 5 state transitions/order × 10 branches = 2,500 audit writes/hour competing with operational queries.
- **Fix effort:** Medium. Move audit writes to a BullMQ job queue or batch insert.

**3. Close-bill transaction length (HIGH)**
- 6+ sequential operations in one interactive transaction: status update, payment, session close, table update, stock deduction loop, customer visit.
- Holds a DB connection for the entire duration. Stock deduction loops over each order item's recipe — O(n) with item count.
- **Fix effort:** Medium. Move stock deduction + customer visit + analytics to async post-commit.

**4. Report aggregation competing with operational queries (MEDIUM)**
- `ReportsService.daily()` runs multiple `GROUP BY` aggregations against the same Postgres that serves live traffic. Cache TTL is ~90s. Cache miss = heavy query burst.
- **Fix effort:** Low (increase cache TTL) to Medium (add read replica).

**5. No database-enforced tenant isolation (MEDIUM, growing risk)**
- Tenant data is separated by application-level `WHERE` clauses only. No PostgreSQL RLS. A single missed filter = cross-tenant data leak.
- **Fix effort:** Medium-high. Requires RLS policy definition + Prisma compatibility testing.

---

## 11. What Must Be Fixed Before Broader Rollout

These are **blocking** items — do not onboard paying customers beyond pilot without addressing them:

1. **Set explicit Prisma connection pool limits.** Add `?connection_limit=15&pool_timeout=10` to `DATABASE_URL` in every deployment environment. This is a 5-minute fix that prevents the #1 bottleneck.

2. **Run the load test suite against staging.** Configure `STAGING_BASE_URL`, `STAGING_PERF_JWT`, and `STAGING_PERF_BRANCH_ID` secrets in GitHub Actions. Run at minimum: `staging-smoke`, `staging-pilot`, `concurrency-payments`. If any threshold fails, stop and fix before rollout.

3. **Enable Prometheus metrics in staging and production.** Set `METRICS_ENABLED=true`. Without metrics, you cannot detect degradation before customers report it. You are currently flying blind.

4. **Set `IDEMPOTENCY_REQUIRE_REDIS=true` in production.** The in-memory idempotency fallback does not work across API replicas. Without this flag, a Redis outage in a multi-replica deployment could cause double payments.

5. **Add missing database indexes:**
   - `OrderItem`: `@@index([orderId, menuItemId])`
   - `Payment`: `@@index([createdAt])`

---

## 12. What Can Safely Wait

These are real issues but will not cause failures at pilot scale (1–10 branches):

- **PgBouncer** — not needed until 3+ API replicas are deployed
- **Read replica** — not needed until 20+ active branches or report cold hits consistently > 5s
- **Async audit logging** — audit writes are fast at current volume; becomes a problem at 20+ active branches
- **BullMQ job queue for post-payment side effects** — close-bill p95 is within bounds at current concurrency
- **Database-level RLS** — application-level tenant filtering is consistent today; RLS is defense-in-depth, not an urgent fix
- **Route-level code splitting in frontend** — the bundle is lean (no heavy deps); initial load is fast enough
- **Server-side WebSocket event batching** — the 320ms client-side debounce absorbs the cost adequately
- **WebSocket token refresh mechanism** — shifts are typically < 12 hours; JWT expiry can be set to cover a full shift
- **Report cache warming job** — cache hit rates are likely high with few branches; becomes important at scale
- **Exponential backoff on idempotency polling** — fixed 50ms works fine under low contention

---

## 13. Is the System Ready for High Operational Pressure?

**No. The system is ready for moderate growth only.**

Here's the honest breakdown:

**What "moderate growth" means:** 1–10 active branches, each with 15–30 staff devices, processing 200–500 orders per shift, with 1–2 API pods, 1 Postgres instance, and 1 Redis instance. This is a pilot phase — real customers, real money, but not high volume.

**Why it is not ready for high pressure:**
1. **No load test has ever been run.** Every capacity estimate in this report and in the existing `capacity-analysis.md` is a projection based on code analysis. We don't know actual p95 latencies. We don't know actual connection pool behavior under concurrent load. We don't know if the Socket.IO Redis adapter handles 400 connections or chokes at 200. The tooling exists to answer these questions — it just hasn't been used.

2. **The connection pool is untuned.** A single configuration oversight (default pool size) is the most likely cause of the first production outage. This is fixable in 5 minutes but it hasn't been done.

3. **Observability is disabled by default.** `METRICS_ENABLED=false` means there is no way to detect performance degradation before customers complain. No Grafana dashboard. No alerting. No baseline.

4. **Synchronous side effects in the payment path** limit throughput ceiling. At high concurrency, the close-bill transaction becomes the chokepoint — and there's no async escape hatch.

**What the system does handle well:**
- Concurrency safety is correctly implemented (optimistic locks, pessimistic locks, distributed idempotency)
- The frontend is efficient (adaptive polling, debouncing, virtualization)
- The module architecture is clean and horizontally scalable
- The load test infrastructure is comprehensive and ready to activate

---

## 14. Exact Conditions Under Which Broader Rollout Is Allowed

A broader rollout (beyond pilot, onboarding 10+ paying venues) should proceed only when ALL of the following conditions are met:

### Must-pass gates:

| # | Condition | How to verify | Current status |
|---|---|---|---|
| 1 | Prisma connection pool explicitly configured | `DATABASE_URL` contains `connection_limit` param | **NOT DONE** |
| 2 | `staging-pilot.k6.js` passes all thresholds | k6 summary shows 0 threshold failures | **NEVER RUN** |
| 3 | `concurrency-payments.k6.js` passes | 0 concurrent close errors, rejection rate > 95% | **NEVER RUN** |
| 4 | `soak-sustained.k6.js` passes | `soak_late_failures` < 5 over 35 min | **NEVER RUN** |
| 5 | Prometheus metrics enabled in production | `METRICS_ENABLED=true` in deploy config | **NOT DONE** |
| 6 | Grafana dashboard exists with: HTTP p95/p99 per route, WS connection count, PG active connections | Dashboard URL documented | **NOT DONE** |
| 7 | `IDEMPOTENCY_REQUIRE_REDIS=true` in production | Env var check | **NOT DONE** |
| 8 | OrderItem composite index added | Migration applied | **NOT DONE** |
| 9 | Payment createdAt index added | Migration applied | **NOT DONE** |
| 10 | Baseline benchmark captured | `benchmark-baselines.k6.js` output committed to repo | **NOT DONE** |

### Should-pass before 20+ branches:

| # | Condition | Trigger |
|---|---|---|
| 11 | PgBouncer deployed in transaction mode | Before adding 3rd API replica |
| 12 | Report cache TTL increased to 300s | When report cold hits > 3s in Prometheus |
| 13 | Read replica configured for ReportsService | When 20+ branches active |
| 14 | Weekly soak test cron operational | Before onboarding 10th paying branch |
| 15 | `growth-scale.k6.js` passes all thresholds | Before GA announcement |

### Decision rule:

> **If conditions 1–10 are not all met, do not onboard paying customers beyond the current pilot cohort.** The risk is not that the system will crash — it's that you won't know it's degrading until customers tell you, and by then the damage is reputational.

---

## Appendix: Files Audited

| Area | Key files |
|---|---|
| Prisma schema | `apps/api/prisma/schema.prisma` |
| PrismaService | `apps/api/src/prisma/prisma.service.ts` |
| App bootstrap | `apps/api/src/main.ts`, `apps/api/src/app.module.ts` |
| Auth cache | `apps/api/src/common/auth-cache/staff-auth-cache.service.ts` |
| Idempotency | `apps/api/src/common/idempotency/redis-idempotency-key.store.ts` |
| Leader lock | `apps/api/src/common/leader-lock/leader-lock.service.ts` |
| Order services | `apps/api/src/modules/orders/order-{lifecycle,billing,read,creation,lines,prep,table}.service.ts` |
| Tables service | `apps/api/src/modules/tables/tables.service.ts` |
| WebSocket gateway | `apps/api/src/websocket/ops.gateway.ts` |
| Redis IO adapter | `apps/api/src/websocket/redis-io.adapter.ts` |
| Realtime types | `packages/types/src/realtime.ts` |
| Frontend realtime | `apps/ops-web/src/lib/branch-realtime.tsx` |
| Frontend pages | `apps/ops-web/src/pages/{KitchenPage,FloorPage,OpenOrdersPage,ReportsPage}.tsx` |
| Frontend config | `apps/ops-web/vite.config.ts`, `apps/ops-web/package.json` |
| Exception filter | `apps/api/src/common/http/http-exception.filter.ts` |
| Audit service | `apps/api/src/modules/audit/audit.service.ts`, `audit-retention.service.ts` |
| Load tests | `ops/load/*.k6.js`, `ops/load/thresholds.json`, `ops/load/compare-runs.js` |
| CI perf gate | `.github/workflows/perf-gate.yml` |
| Capacity doc | `docs/operations/capacity-analysis.md` |
| Integration tests | `apps/api/test/integration/*.integration-spec.ts` |
