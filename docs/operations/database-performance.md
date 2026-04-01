# Database performance and profiling

## Principles

- Stay on **one primary** Postgres until metrics show sustained read pressure; then consider replicas or caching—not premature sharding.
- **Observe first**: latency p95/p99 per route (see Prometheus metrics when `METRICS_ENABLED=true`).

## Prisma

- **Connection pool**: size for your deployment (container CPU and Postgres `max_connections`). If using **PgBouncer**, follow Prisma’s recommended `DATABASE_URL` form for pooler mode.
- **N+1**: avoid unbounded `include` trees on hot paths; use `select` or batch queries where needed.
- **Indexes**: add composite indexes when `EXPLAIN` shows sequential scans on large tables. Example: `Order` includes `@@index([tenantId, branchId])` for tenant-scoped listings.

## When to add APM

- When error budgets or customer reports justify it, add **OpenTelemetry** or vendor APM and sample **10–50%** of traffic in production (not 100% without need).

## Load testing

- Run **k6** against staging with anonymized data; cap concurrency to avoid burning the shared DB. Scripts and thresholds: [`ops/load/`](../../ops/load/) and [`staging-performance-gate.md`](./staging-performance-gate.md).
