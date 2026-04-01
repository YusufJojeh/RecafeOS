# Scale Envelope and Capacity Analysis — RestoCafe OS

> This document provides an honest forecast of the system's current operating limits,
> which layer fails first, what can be tuned vs what requires structural change, and
> what complexity is explicitly not justified yet.
>
> All estimates are architectural projections based on the current codebase.
> Validate each threshold with the load tests in `ops/load/` before acting on them.

---

## 1 · Current Safe Operating Envelope

### What the architecture looks like today

```
Browser / PWA (ops-web)
    ↓  HTTP + Socket.IO / WebSocket
NestJS API (single pod or small N replicas)
    ├── PostgreSQL 16 (1 primary, Prisma ORM, default connection pool)
    ├── Redis 7 (auth cache, idempotency, Socket.IO Redis adapter, reports L2 cache)
    └── MinIO / S3 (menu images — not on hot paths)
```

### Safe envelope at current architecture

| Dimension | Safe today | Rationale |
|---|---|---|
| Concurrent active staff devices | **25–35** per branch | Matches pilot-gate VU count with comfortable margin. Beyond ~40 the Prisma default pool (typically 10 connections) starts queuing. |
| Simultaneous branches under load | **5–10** | Each branch is tenant-scoped but shares the same DB and Redis. 10 busy branches × 25 staff = ~250 concurrent requests — within reach of a well-tuned single Postgres instance. |
| Orders per shift (per branch) | **300–500** | Open-orders list is capped at 500; beyond this, cursor pagination kicks in but the aggregation queries in reports get heavier. |
| Socket.IO connections total | **200–400** | Redis adapter pub/sub overhead scales with connection count × branches × events/s. Beyond ~500 connections watch Redis CPU. |
| Report generation latency | **< 500ms warm / < 3s cold** | The 2-layer cache (in-process Map + Redis L2) handles repeated reads. The cold path queries multiple aggregations in parallel; it's fast now but degrades as order volume grows. |
| Payment close p95 | **< 1200ms** | Includes Prisma transaction + Redis idempotency lock + stock deduction + Socket.IO emit. Stable under < 5 concurrent payment operations. |

**Summary:** The system is comfortably safe for 1–5 active pilot venues (small-medium cafés) on a
single API pod + one Postgres + one Redis. No infra changes are needed before acquiring paying
pilot customers. The first growing pains will appear around the **10–20 active branch** mark.

---

## 2 · First Bottleneck Forecast

**Layer: PostgreSQL connection pool (Prisma default)**

**When:** ~10 simultaneously active branches, each with 20+ devices polling at 1–3s intervals.

**Why this layer, not another:**

The Prisma client opens a connection pool at startup. The default pool size is derived from
`DATABASE_URL` params (or Prisma's built-in default, often `num_cpus × 2 + 1`). With multiple
API replicas, each pod has its own pool — so with 3 replicas × 10 connections = 30 connections
held constantly. Postgres `max_connections` defaults to 100 and is typically lowered on managed
databases (e.g. 50 on a small RDS/Cloud SQL instance).

**Hot paths that stress the pool most:**
1. `GET /branches/:id/orders` — runs on every floor-staff poll cycle; includes Order + OrderItems + PrepTickets + FloorTable + TableSession in a single query via `include`. Heavy join graph.
2. `GET /branches/:id/kitchen/tickets` — same pattern with PreparationTicket + Order + MenuItem includes.
3. `POST /orders/:id/close` — runs a Prisma transaction that updates Order, creates Payment, closes TableSession, updates FloorTable status, and creates StockMovements — all in sequence.

**Symptoms:**
- Prisma starts logging `"All connections in the connection pool are in use"`.
- `http_req_duration{name:write}` p95 climbs first (transactions wait for connections).
- `http_req_duration{name:read}` follows as polling queries start queuing.
- Health checks may still return 200 (health check uses a lightweight `SELECT 1` that often gets a connection first).

**Detection:**
- Prometheus: `http_request_duration_seconds{route="/branches/:branchId/orders"}` p95 trending up.
- Postgres: `SELECT count(*) FROM pg_stat_activity WHERE state='active'` approaches `max_connections`.
- k6 soak: `soak_late_failures` starts creeping; write p95 degrades over the 35-min window.

---

## 3 · Second Bottleneck Forecast

**Layer: Daily report aggregation (synchronous, shared DB)**

**When:** 20–40 active branches, each with at least one back-office user pulling reports during
shift. As order volume grows (500+ orders/branch/day), the `reports/daily` query group takes longer.

**Why this is the second bottleneck:**

The `ReportsService.daily()` method runs many parallel aggregations against the same Postgres
instance that serves live order traffic. Specifically:
- Top items by revenue (GROUP BY across OrderItem for today's window)
- Hourly sales pattern (timezone-aware aggregation)
- Cancellation reason breakdown
- Discount aggregations
- Same-weekday comparison (rolling 4-week window — potentially thousands of rows)
- Customer visit signals

The 2-layer cache (in-process L1 + Redis L2 with `REPORTS_DAILY_CACHE_TTL_MS`, default likely 90s)
absorbs repeat reads from the same branch within the TTL window. But with 20+ branches and partial
cache misses, the concurrent aggregation queries can saturate Postgres query throughput even when
individual connection counts look fine.

**Symptoms:**
- Reports p95 exceeds 3s consistently, not just on cache misses.
- Postgres `pg_stat_activity` shows long-running `SELECT` queries during report pulls.
- Live order writes start seeing p95 increases (shared query executor).

**A third bottleneck (likely close behind): Redis connection churn under multi-replica Socket.IO**

With 3+ API replicas each with their own Socket.IO Redis adapter pub/sub connections, Redis starts
managing N replica × M branches of pub/sub channels. Under heavy event emission (many orders moving
through states quickly), Redis becomes the fan-out serialization point. The `staging-mixed-ws.k6.js`
test surfaces early symptoms of this.

---

## 4 · Infra Tuning Opportunities

These are configuration or deployment changes that defer architectural work. Apply them in order of effort-to-impact ratio.

### 4.1 Prisma connection pool sizing (highest impact, near zero effort)

Set `connection_limit` and `pool_timeout` explicitly in `DATABASE_URL`:

```
DATABASE_URL="postgresql://...?connection_limit=15&pool_timeout=10"
```

With 3 API replicas × 15 connections = 45 Postgres connections. Set Postgres `max_connections` to
at least 75 (adds headroom for admin tools and migrations). This alone extends the connection pool
ceiling significantly.

**When:** Before adding more than 2 API replicas.

### 4.2 PgBouncer in transaction mode (medium effort, high impact at scale)

Add PgBouncer between Prisma and Postgres. Each API replica's pool of 15 becomes a virtual pool;
PgBouncer multiplexes 50+ Prisma connections onto 20 Postgres connections. Prisma supports
PgBouncer with `pgbouncer=true` in the connection URL and requires disabling prepared statements.

**When:** When Prisma pool queuing shows up in Prometheus p95 trending and you have 3+ API replicas.
Do this before vertical DB scaling — it's cheaper and more elastic.

### 4.3 Report cache TTL tuning

Increase `REPORTS_DAILY_CACHE_TTL_MS` from default (90s) to 300s (5 min) for branches that aren't
in active service. For large branches in active service, the cache should already be hitting frequently.

Add a cache warming job (using the existing `LeaderLockService`) to pre-generate reports for all
active branches at 5-minute intervals, so the first user of each branch never hits the cold path.

**When:** When report cold hits regularly exceed 3s in Prometheus.

### 4.4 `include` depth reduction on hot read paths

The open-orders list and kitchen tickets endpoints include deeply nested objects. Profile which
fields are actually used by the frontend and replace unbounded `include` with `select` to return
only required fields. This reduces Postgres data transfer and serialization CPU on the API.

**When:** When read p95 is high but DB query count looks fine (serialization is the bottleneck).

### 4.5 Horizontal API scaling (zero-config)

The Socket.IO Redis adapter already supports multi-replica. Adding API replicas behind a load
balancer is ready to go with no code changes. Each replica adds CPU for JSON serialization and
Prisma pool connections.

**When:** When API CPU is sustained > 70% during peak on a single pod. Add 1 replica at a time
and re-run the soak test to confirm Redis pub/sub overhead is acceptable.

### 4.6 Auth cache TTL tuning

`StaffAuthCacheService` caches branch membership to reduce DB lookups on the hot request path.
Verify the TTL is long enough to survive the busiest poll cycle (the floor-staff 1-3s loop) but
short enough that permission changes propagate within a reasonable SLA (suggest: 2–5 min).

**When:** If Prometheus shows high DB query rate from auth cache misses per request.

---

## 5 · Architecture-Change Thresholds

These are the trigger points where tuning alone is insufficient and structural changes must be planned.

### 5.1 Read replica for reports

**Trigger:** 40+ active branches, or report cold hit p95 consistently > 5s despite cache tuning, or
report queries materially affecting write p95 (can confirm with `pg_stat_activity` correlation).

**Change:** Add a PostgreSQL read replica. Route all `ReportsService` queries (and other read-only
aggregations: `demand-profile`, `weekly-digest`, AI insights) to the replica. Prisma supports
multiple datasource URLs; a simple routing layer or separate PrismaClient pointing at `DATABASE_URL_REPLICA`
is sufficient.

**Not yet needed:** Report volume is low (one report type, cached at 90s TTL). Vertical DB scaling
(bigger instance) is cheaper and simpler than replication until report query count is consistently high.

### 5.2 Async report generation (background job)

**Trigger:** Reports take > 5s cold even with a read replica, AND back-office users are consistently
waiting.

**Change:** Replace synchronous `ReportsService.daily()` with a background job triggered by the
`LeaderLockService`. Store the result in Redis with a longer TTL (10–30 min). The controller
serves the cached result immediately; a background tick refreshes it. This trades freshness for
latency — acceptable for daily reports, not for real-time order views.

**Not yet needed:** The existing 2-layer cache handles current report volume. Async generation
adds operational complexity (stale-result handling, cache invalidation triggers) that isn't justified
until cold hits are a genuine user complaint.

### 5.3 Queue-based order event processing

**Trigger:** Order volume causes `POST /orders/:id/close` to consistently exceed 2s p95 due to
the synchronous post-payment chain: stock deduction + customer visit recording + analytics event +
audit log + Socket.IO emit — all blocking the HTTP response.

**Change:** Offload stock deduction, analytics event recording, and audit log creation to a
BullMQ job queue (Redis-backed). The payment transaction itself stays synchronous (it must be
atomic); only the downstream side effects become async. The HTTP response returns as soon as the
payment is committed; a worker processes the rest.

**Not yet needed:** The close-bill path is fast today (< 1200ms p95 under no contention). The
existing idempotency layer handles retries correctly. Adding a queue before it's needed introduces
observability complexity (job monitoring, retry dead-letter handling) without a commensurate benefit.

### 5.4 Multi-region / edge deployment

**Trigger:** Customers in geographic regions with > 150ms round-trip to the single API region,
AND latency-sensitive operations (real-time kitchen display, POS close) are materially affected.

**Change:** Deploy API replicas in additional regions with a read replica in each region. Write
operations (payments, order mutations) still route to the primary region. The Socket.IO Redis
adapter would need to be replaced with a region-aware pub/sub topology.

**Not yet needed:** The current system is a single-region deployment serving pilot customers.
Geographic distribution is premature until customer distribution data justifies it.

---

## 6 · Explicit "Not Yet Needed" List

The following are common scaling solutions that would add complexity without addressing any
current or near-term bottleneck. Do not introduce these until the triggers in section 5 are met.

| Solution | Why it is premature |
|---|---|
| **Microservices / service decomposition** | The monorepo is well-structured with clear module boundaries. Splitting into separate services would require distributed tracing, inter-service auth, and network overhead with no capacity benefit. The bottleneck is DB connections and query performance — not module coupling. |
| **Apache Kafka / event streaming** | No current use case requires guaranteed event delivery at high throughput. The existing Socket.IO + Redis pub/sub model is appropriate for < 500 simultaneous connections. BullMQ (Redis-backed) suffices when async processing eventually becomes necessary. |
| **CQRS + separate read models** | The current read/write imbalance (many reads, fewer writes) is handled by Prisma `select` optimisation and caching. CQRS adds significant modelling and synchronisation complexity for a marginal benefit at current scale. |
| **Elasticsearch for order search** | Order search is scoped to a single branch (tenantId + branchId + status), with a hard cap of 500 rows. Postgres indexed queries are fast enough. Elasticsearch would add an entire infrastructure dependency for a feature that isn't a customer pain point. |
| **Redis Cluster** | Single Redis with sufficient memory handles the current load (auth cache, idempotency, Socket.IO adapter, report cache). Redis Cluster adds slot management complexity with no throughput benefit at this scale. |
| **Sharding / horizontal DB partitioning** | Multi-tenancy is implemented via `tenantId` scoping on every query, not table partitioning. Sharding is not warranted until a single tenant's data volume is large enough to cause full-table scan problems despite indexing. This is years away for a pilot SaaS. |
| **GraphQL API** | The REST API surface is clearly defined and already versioned (`/api/v1`). The overhead of a GraphQL layer (schema, resolvers, N+1 protection, query depth limiting) is not justified by current requirements. |
| **Dedicated metrics/OLAP database** | Prometheus + the existing Prisma aggregations handle current reporting needs. ClickHouse or BigQuery would be justified when report queries become the primary Postgres load — see section 5.1 trigger. |

---

## 7 · Practical Recommendation for Next Growth Stage

### Immediate (before GA, during active pilot)

1. **Set explicit Prisma pool limits** in `DATABASE_URL` for each deployment environment.
   Tune per replica count. This is one environment variable change.

2. **Run the soak test** (`soak-sustained.k6.js`) before every major pilot milestone.
   If `soak_late_failures` starts climbing, investigate before adding new customers.

3. **Enable `METRICS_ENABLED=true`** in staging and production. Add a Grafana dashboard
   with at least: `http_request_duration_seconds` p95/p99 per route, `websocket_authenticated_connections`,
   `pg_stat_activity` active connections count. Without visibility you cannot correlate customer
   complaints to infrastructure state.

4. **Add the `REPORTS_DAILY_CACHE_TTL_MS` environment variable** to your deployment config and
   increase it to 300s. Monitor whether report cold hits appear in Prometheus.

### Short term (5–15 active branches)

5. **Add PgBouncer** in transaction mode when API replicas are added. Configure it before the
   second API pod is deployed, not after connection pool queuing is already happening.

6. **Add a Postgres read replica** and route `ReportsService`, `AiInsightsService`, and
   `DemandProfileService` to it. This is a single `DATABASE_URL_REPLICA` env var + routing in
   those services.

7. **Set up the weekly soak cron** and assign an operator to review the comparison output
   (`compare-runs.js`) weekly. Latency drift is easier to address gradually than acutely.

### Medium term (20+ active branches)

8. **Evaluate BullMQ** for post-payment side effects if `POST /orders/:id/close` p95 exceeds 2s
   under normal concurrent load. Scope it to: stock deduction, analytics event recording, and
   audit log writes. The payment transaction core stays synchronous.

9. **Evaluate report cache warming** via `LeaderLockService`. Pre-generate reports for all
   active branches every 5 minutes so no user ever hits the cold path.

10. **Re-run `growth-scale.k6.js`** after each infrastructure tier change (bigger DB instance,
    more API replicas, Redis tier upgrade). The growth profile is the leading indicator —
    if it starts failing before you hit the trigger thresholds, adjust the plan.

### What to not do prematurely

- Do not split the API into microservices. The module structure in the NestJS app is clean; keep it that way.
- Do not add Kafka. Redis-backed queues are adequate for this scale.
- Do not add Elasticsearch. Postgres with proper indexing handles order search at this volume.
- Do not add a dedicated OLAP database until Postgres read replica + query optimization has been tried and failed.

---

*See also:*
- [`performance-validation-strategy.md`](./performance-validation-strategy.md) — test strategy and gate definitions
- [`database-performance.md`](./database-performance.md) — Prisma, connection pooling, indexing principles
- [`staging-performance-gate.md`](./staging-performance-gate.md) — RC gate procedure
