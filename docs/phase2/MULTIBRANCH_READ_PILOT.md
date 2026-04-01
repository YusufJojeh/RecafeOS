# Phase-2 pilot: read-only multi-branch KPI set

Feature **I** from the roadmap: tenant-level visibility **without** write paths, stock transfers, or relaxed `BranchGuard` semantics.

## Principles

1. **Read-only** — HTTP GET (or POST body only for complex filters with explicit CSRF/API design); no mutations to orders, inventory, or branches from this surface.
2. **Tenant scope** — Queries filter `tenantId = :tenantId` and `branchId IN (:allowedBranchIds)`. Never accept arbitrary branch lists from the client without membership checks.
3. **Permission gate** — New permission code(s), e.g. `reports.tenant_rollups` (name TBD), assigned only to owner/manager roles; default deny.
4. **Same numbers as branch reports** — Rollups must be **sums / weighted averages** of the same definitions used in [`ReportsService`](apps/api/src/modules/reports/reports.service.ts) for a calendar day in each branch’s timezone (or document explicit UTC tradeoff).

## KPI set (v1 — pilot)

Aligned with existing single-branch daily report building blocks. All are **optional columns** in one tenant rollup response; empty branches excluded from denominators where noted.

| KPI | Definition | Notes |
|-----|--------------|--------|
| **Net paid sales (minor)** | Sum of `Order.totalMinor` where `status = PAID` and `paidAt` in window, per branch, then **sum across branches** | Primary headline metric |
| **Order count (paid)** | Count of paid orders in window, summed across branches | |
| **Average ticket (minor)** | `netPaidSales / paidOrderCount` at tenant level | Guard divide-by-zero |
| **Sales by order type** | Per-type sum of `totalMinor` (DINE_IN, TAKEAWAY, WHATSAPP_MANUAL, QR_REQUEST), aggregated across branches | Same grouping as branch `typeRows` |
| **Top branches by sales** | Rank branches by net paid sales in window | Limit **top N = 10** |
| **Discount pressure** | Sum `discountMinor` (and optionally count orders with discount) across branches | Mirrors discount sections of daily report |
| **Hourly distribution (tenant)** | Optional: stack hourly buckets per branch timezone then sum — **v1 may omit** if query cost too high; prefer **per-branch hourly** in drill-down only |

### Explicitly out of v1 pilot

- Cross-branch item-level merge (menu item IDs differ per branch unless duplicated by design).
- Real-time WebSocket rollups.
- Stock or COGS across branches.

## Query cost and limits

| Constraint | Value | Rationale |
|------------|--------|-----------|
| **Maximum calendar range** | **31 days** per request for tenant rollup | Keeps seq scans bounded; product can tighten to 7 for first ship |
| **Maximum branches** | `min(tenant.maxBranches ?? plan default, 25)` per request | Align with [`PLAN_LIMITS`](apps/api/src/commerce/plan-limits.config.ts); cap prevents accidental `IN` with hundreds of IDs |
| **Default range** | Last **7** calendar days (UTC boundaries **or** document “each branch local day” as Phase-2.1) | Reduces support load |
| **Pagination** | N/A for aggregate JSON; if listing branch breakdown rows, **page size ≤ 50** | |
| **Concurrency** | Same as existing reports — no dedicated pool; if p95 > 2s, add materialized daily rollups (later) | |

## CS playbook: tenant rollup vs branch daily (UTC vs local)

**Why this exists:** Support and venues compare **tenant rollup** totals to **per-branch daily** reports. They will not always match line-for-line until Phase-2.1 aligns definitions. Use this section to **avoid false engineering escalations**.

### What the API does today

| Surface | Date semantics for paid orders | Typical use |
|---------|--------------------------------|-------------|
| **`GET /api/v1/tenants/reports/tenant-rollup`** | **`paidAt` filtered by an inclusive UTC calendar range** (see controller description in [`TenantReportsController`](../../apps/api/src/modules/reports/tenant-reports.controller.ts)) | Owner/manager headline KPIs across branches |
| **Branch daily report** (`GET …/reports/daily` via [`ReportsService`](../../apps/api/src/modules/reports/reports.service.ts)) | **Branch-local calendar day** in that branch’s timezone | Site-level ops, cashiers, close-of-day |

So: the **same physical order** can fall into **different “days”** on the two surfaces when the venue is not UTC or when the chosen date range does not map 1:1 to local midnights.

### What to tell the customer

1. For **apples-to-apples** checks: use **branch daily** for a single branch and date, or compare rollup **branch breakdown rows** to that branch’s daily for a range you document explicitly in UTC.
2. Small deltas at timezone boundaries are **expected**, not necessarily a bug.
3. If totals disagree **inside the same report type** (e.g. two loads of branch daily), escalate; if only rollup vs daily disagree, re-read this doc first.

### When to escalate to engineering

- Permission errors or wrong `tenantId` / data from another tenant (isolation).
- Branch daily internally inconsistent.
- Product commits to **local-day rollup** parity ([INCREMENTAL_PRODUCT_GATES.md](../growth/INCREMENTAL_PRODUCT_GATES.md) may gate this).

### Related ops docs

- Branch access policy (tenant-wide vs future ACL): [branch-access-policy.md](../operations/branch-access-policy.md)
- Expansion process: [BRANCH_ROLLOUT_MODEL.md](../growth/BRANCH_ROLLOUT_MODEL.md)
- Support endpoints: [SUPPORT_TOOLING.md](../operations/SUPPORT_TOOLING.md)

## Implementation sketch (non-binding)

- **One query per branch per day** is expensive; prefer **single SQL** with `WHERE tenantId = ? AND branchId = ANY(?) AND paidAt >= ? AND paidAt < ?` and `GROUP BY branchId` for paid aggregates, reusing indexed paths (`@@index([branchId, tenantId, status, paidAt])` on `Order`).
- **Reject** unbounded `ORDER BY` on large joins without `LIMIT` for exploratory endpoints.

## Acceptance checks (before shipping I)

- [x] Permission denied without `reports.tenant_rollups` (or chosen code) — enforced via `GET /api/v1/tenants/reports/tenant-rollup` + [`TenantReportsController`](../../apps/api/src/modules/reports/tenant-reports.controller.ts).
- [ ] User with access to only one branch cannot see another branch’s totals (membership test) — **deferred:** current product uses tenant-wide branch access; filter when per-branch membership exists.
- [ ] Rollup for one branch matches existing `GET …/reports/daily` for same branch + date (within documented timezone semantics) — **partial:** rollup uses **UTC inclusive `paidAt` range**; single-branch daily uses **branch-local calendar day** — parity when TZ is UTC and range is one local day only.
- [ ] Load test: tenant with **5 branches**, **31-day** window completes under agreed p95 (e.g. &lt; 2s on reference hardware).

## Revision

Bump this doc when KPI definitions change; keep in sync with integration tests for tenant rollup endpoints.
