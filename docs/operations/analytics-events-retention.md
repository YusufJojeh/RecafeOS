# AnalyticsEvent retention and growth

## Current behavior

- `AnalyticsEvent` rows are **append-only** (e.g. `commerce.recordAnalyticsEvent`, payment-related events). Indexes: `[tenantId, createdAt]`, `[name, createdAt]` — good for tenant-scoped reads and name+time filters.
- There is **no automatic deletion** in application code today. The table will **grow without bound** as tenants and traffic scale.

## Risk

- Storage and **vacuum/autovacuum** cost on large tables.
- Backup/restore duration increases with table size.

## Recommended policy (before high multi-tenant scale)

1. **Operational retention window:** For production, define a maximum age (e.g. **13–24 months** of raw events) aligned with product/analytics needs. Older data can be dropped or exported to cold storage.
2. **Implementation options (choose one when volume warrants):**
   - **Scheduled job:** periodic `DELETE FROM "AnalyticsEvent" WHERE "createdAt" < $cutoff` (or batched deletes) during low-traffic windows. Schema includes `@@index([createdAt])` to support efficient range deletes once a job is implemented.
   - **Partitioning:** monthly partitions on `createdAt` with **detach/drop** of old partitions — best for very large volume; more ops complexity.
3. **Do not** block hot paths: retention jobs should run **outside** request transactions (dedicated worker/cron, or leader-locked job similar to audit retention).

## Monitoring

- Watch table size and growth rate; alert when passing agreed thresholds.
- If `AnalyticsEvent` dominates `pg_stat_statements` or disk, prioritize retention or partitioning before adding more tenants.

## Related

- Audit log retention (application timer): [`audit-retention.service.ts`](../../apps/api/src/modules/audit/audit-retention.service.ts) and `AUDIT_LOG_RETENTION_DAYS`.
- Deployment and connection sizing: [`DEPLOYMENT_DEVOPS.md`](./DEPLOYMENT_DEVOPS.md) §2c.
