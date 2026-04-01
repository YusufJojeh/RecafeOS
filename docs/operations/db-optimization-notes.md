# Database Optimization Notes

Practical index and growth analysis for RestoCafe OS, based on actual query patterns in production code.

---

## 1. Index Inventory — What Exists and Why

### Order (hottest table)

| Index | Covers |
|-------|--------|
| `(branchId, status, createdAt)` | Active orders list, kitchen feed |
| `(branchId, tenantId, status, paidAt)` | Daily sales report — all revenue queries filter on PAID + paidAt range |
| `(branchId, tenantId, status, cancelledAt)` | Cancellation reports |
| `(tenantId)` | Tenant-scoped admin queries |
| `(tenantId, branchId)` | Multi-branch tenant rollup |
| `(tableSessionId)` | Order-to-session lookups |
| Partial: `(branchId, tenantId, createdAt DESC, id DESC) WHERE status NOT IN (PAID, CANCELLED)` | Open orders keyset pagination |

**Verdict:** Fully covered. No gaps.

### OrderItem

| Index | Covers |
|-------|--------|
| `(orderId)` | FK join from Order → items |
| `(menuItemId)` | Top-items report join |
| `(orderId, menuItemId)` | Report aggregations grouping by both |

**Verdict:** Fully covered after previous migration.

### Payment

| Index | Covers |
|-------|--------|
| `UNIQUE(orderId)` | 1:1 order-payment lookup |
| `(recordedByUserId)` | Cashier sales report |
| `(createdAt)` | Temporal settlement queries |
| Partial: `UNIQUE(orderId) WHERE status = COMPLETED` | One-completed-per-order constraint |

**Verdict:** Fully covered after previous migration.

### PreparationTicket (kitchen)

| Index | Covers |
|-------|--------|
| `(branchId, station, status, createdAt)` | Kitchen board query: filter by station+status, sort by createdAt |
| `(orderId)` | Ticket lookup by order |
| `UNIQUE(orderId, orderItemId, station)` | Dedup constraint |

**Verdict:** Fully covered. The `priority` sort column is not indexed but the filtered result set per branch is small (< 100 rows).

### FloorTable

| Index | Covers |
|-------|--------|
| `(branchId, status)` | Table list by branch — leftmost prefix also covers branchId-only scans |

**Verdict:** No standalone `branchId` index needed. Postgres uses the leftmost prefix of `(branchId, status)` for any query filtering only on `branchId`.

### CustomerVisit

| Index | Covers |
|-------|--------|
| `(customerId)` | Visit lookup by customer |
| `(orderId)` | FK join |
| `(branchId, visitedAt)` | Outer query of returning-customers report |
| `(customerId, branchId, visitedAt)` | **NEW** — EXISTS subquery in returning-customers report |

**Verdict:** The new composite closes the last report-path gap.

### AuditLog

| Index | Covers |
|-------|--------|
| `(tenantId, createdAt)` | Tenant-scoped audit browsing |
| `(branchId)` | Branch-scoped filtering |
| `(createdAt)` | Retention pruning `WHERE createdAt < cutoff` |

**Verdict:** Fully covered. Retention job uses `(createdAt)` index for efficient range deletes.

### AnalyticsEvent

| Index | Covers |
|-------|--------|
| `(tenantId, createdAt)` | Tenant-scoped analytics queries |
| `(name, createdAt)` | Event-type filtering |
| `(createdAt)` | Future retention pruning |

**Verdict:** Fully covered. See `analytics-events-retention.md` for growth plan.

---

## 2. Indexes Evaluated and Rejected

| Candidate | Why rejected |
|-----------|-------------|
| `FloorTable(branchId)` standalone | Redundant — `(branchId, status)` leftmost prefix already serves branchId-only queries |
| `Order(customerId)` | Report top-customers query enters via `(branchId, tenantId, status, paidAt)` index; customerId is joined to Customer.id (PK) |
| `AuditLog(tenantId, branchId, createdAt)` three-column | No findMany query uses all three columns simultaneously; existing two indexes cover actual access patterns |
| `Payment(method)` | Payment-methods report enters via Order → Payment join (Payment.orderId UNIQUE); no standalone method filter exists |
| `StockMovement(type)` | Only filtered by `stockItemId` or `orderId`; `type` appears only in INSERT data, never in WHERE |
| `OrderItemModifier(modifierOptionId)` | Only accessed via `orderItemId` parent; low cardinality, small table |

---

## 3. Growth Risk by Table

Estimates assume a moderately busy venue: 200 orders/day, avg 4 items/order, 10 state mutations/order.

| Table | Rows/day/venue | Rows/year (10 venues) | Has retention? | Risk level |
|-------|---------------|----------------------|----------------|------------|
| **AuditLog** | ~2,000 | 7.3M | Yes (`AUDIT_LOG_RETENTION_DAYS`) | **Low** if retention set; **High** if not |
| **AnalyticsEvent** | ~500 | 1.8M | No (documented, not yet implemented) | **Medium** — implement before 20+ venues |
| **OrderItem** | ~800 | 2.9M | No (business data — keep) | **Low** — well-indexed, row size small |
| **StockMovement** | ~800 | 2.9M | No (audit trail — keep) | **Low** — append-only, narrow rows |
| **CustomerVisit** | ~200 | 730K | No (analytics — keep) | **Low** — small rows, well-indexed |
| **Payment** | ~200 | 730K | No (financial — keep forever) | **Low** — 1:1 with Order, tiny table |
| **Order** | ~200 | 730K | No (business data — keep) | **Low** — partial index isolates active orders from historical |

### Recommended retention policies

| Table | Policy | When to implement |
|-------|--------|-------------------|
| **AuditLog** | Set `AUDIT_LOG_RETENTION_DAYS=365` in production | Now (env var, no code change) |
| **AnalyticsEvent** | Implement pruning service mirroring AuditRetentionService, 13-month window | Before 20 active venues |
| **StockMovement** | Archive rows older than 24 months to cold storage/CSV export | Before 50 active venues |
| **Order + OrderItem** | No deletion. Partition by year if table exceeds 10M rows | Before 100 active venues |
| **CustomerVisit** | No deletion. Lightweight rows. Monitor. | Only if > 5M rows |
| **Payment** | Never delete (financial compliance). Archive to read-only table at scale. | Only if > 5M rows |

---

## 4. PgBouncer: When It Becomes Mandatory

**Current state:** Prisma connects directly to Postgres with its built-in connection pool.

**When PgBouncer becomes mandatory:**

| Trigger | Why |
|---------|-----|
| **3+ API replicas** | 3 replicas × 15 connections = 45 Postgres connections. Postgres default `max_connections = 100`. Each replica opening its own pool fragments the budget. |
| **Connection exhaustion alerts** | `pg_stat_activity` shows connections near `max_connections`. Wait events appear in Postgres logs. |
| **Serverless/edge deployment** | Functions spin up/down rapidly, creating connection storms that Prisma's pool cannot absorb. |

**How to add PgBouncer:**

1. Deploy PgBouncer in `transaction` mode (required for Prisma)
2. Point `DATABASE_URL` at PgBouncer (`?pgbouncer=true&connection_limit=5`)
3. Add a second `DIRECT_DATABASE_URL` pointing directly at Postgres (required for `prisma migrate`)
4. Set PgBouncer `default_pool_size` to Postgres `max_connections × 0.7 / number_of_services`
5. Set Prisma `connection_limit` low (3-5) since PgBouncer handles pooling

**Not needed yet if:** Running 1-2 API replicas with `connection_limit=15` and Postgres `max_connections >= 50`.

---

## 5. Read Replica: When It Becomes Justified

**Current state:** All reads and writes hit a single Postgres primary.

**When a read replica is justified:**

| Trigger | Measurement |
|---------|-------------|
| Daily report cold-hit p95 exceeds 5 seconds | Prometheus: `http_request_duration_seconds{route="/api/v1/reports/daily"}` |
| Tenant rollup p95 exceeds 8 seconds | Same metric, route `"/api/v1/reports/tenant-rollup"` |
| CPU on Postgres primary sustained > 70% during report hours | Cloud monitoring / `pg_stat_activity` |
| 40+ simultaneously active branches | Operational count |

**How to add a read replica:**

1. Create a Postgres streaming replica (managed services: AWS RDS, GCP Cloud SQL, or Neon)
2. Add `READ_DATABASE_URL` env var
3. Create a `PrismaReadService` that connects to the replica (read-only)
4. Route report queries (`reports.service.ts`) to the read service
5. Keep all write paths on the primary `PrismaService`
6. Accept replication lag (typically < 1s for streaming replicas)

**Not needed yet if:** Report p95 < 3s and Postgres CPU < 50%.

---

## 6. Query-Shape Coverage Verification

High-frequency queries and their index coverage:

| Query | File | Index used |
|-------|------|-----------|
| Open orders (keyset pagination) | `order-repository.ts:73` | Partial index `(branchId, tenantId, createdAt, id) WHERE status NOT IN (PAID, CANCELLED)` |
| Order findFirst by id+branch+tenant | `order-repository.ts:21` | PK (`id`) |
| Kitchen tickets by station | `kitchen.service.ts:28` | `(branchId, station, status, createdAt)` |
| Floor tables by branch | `tables.service.ts:21` | `(branchId, status)` leftmost prefix |
| Daily report: revenue by type | `reports.service.ts:135` | `(branchId, tenantId, status, paidAt)` |
| Daily report: top items | `reports.service.ts:149` | Order index → OrderItem `(orderId)` join |
| Daily report: payment methods | `reports.service.ts:170` | Order index → Payment `UNIQUE(orderId)` join |
| Daily report: cancellations | `reports.service.ts:194` | `(branchId, tenantId, status, cancelledAt)` |
| Daily report: returning customers | `reports.service.ts:296` | Outer: `(branchId, visitedAt)`, EXISTS: `(customerId, branchId, visitedAt)` **NEW** |
| Daily report: category revenue | `reports.service.ts:309` | Order index → OrderItem → MenuItem (PKs) |
| Audit retention prune | `audit-retention.service.ts:53` | `(createdAt)` |
| Customer search | `customers.service.ts:73` | `(tenantId)` + text filter in app |
| Tenant rollup | `reports.service.ts:1430` | `(tenantId, branchId)` prefix of `(branchId, tenantId, status, paidAt)` — may use `(tenantId)` depending on planner |

No sequential scans on large tables for any hot path.
