# Data retention and archival

## Audit logs

High-volume append-only table: `AuditLog`.

- **Runtime pruning**: If `AUDIT_LOG_RETENTION_DAYS` is set to a positive integer, the API periodically deletes rows with `createdAt` older than that many days (UTC). Leave unset or `0` to disable automatic deletion (e.g. strict compliance requiring external archival first).
- **Before enabling deletion in production**: Confirm legal/regulatory retention periods and whether you must export to cold storage (object store, warehouse) first.

## Orders and payments

`Order`, `OrderItem`, and `Payment` are core financial records. **Do not** bulk-delete without a written policy (tax, consumer protection, dispute windows). Typical patterns:

- Keep hot data in PostgreSQL for operational windows (e.g. current fiscal year).
- Archive older **paid, settled** orders to a reporting warehouse or parquet/csv in object storage; retain minimum fields required for audits.

## Stock movements

`StockMovement` grows with every sale and adjustment. If volume becomes large:

- Archive rows older than *N* months to an analytics store after reconciling branch inventory snapshots.
- Keep aggregated COGS / usage reports derived from archived data.

## Refresh tokens

Expired sessions: periodically delete `RefreshToken` rows where `expiresAt < now()` (scheduled job or external cron) to control table size.

## Order archival (policy)

Define explicitly per jurisdiction:

- Minimum retention for **paid** orders (invoices, VAT/GST).
- Whether **cancelled** or **draft** orders may be purged sooner.
- Whether personal data in `Customer` / visits must be anonymized on a schedule (GDPR-style), separate from order retention.
