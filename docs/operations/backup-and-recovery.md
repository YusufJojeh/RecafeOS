# Backup and recovery

## Pilot-scale assumptions (document your real hosting)

These are **starting points**—replace with measured values after your first restore drill ([`staging-restore-drill-checklist.md`](./staging-restore-drill-checklist.md)).

| Metric | Pilot-scale starting point | How to refine |
|--------|----------------------------|---------------|
| **RPO** (max acceptable data loss) | **≤24 hours** if you rely on nightly `pg_dump` only; **≤1 hour** or better if managed Postgres offers **PITR** and you use it | Set from backup schedule + provider SLA |
| **RTO** (time to health-ready + smoke pass on staging) | **1–4 hours** team-dependent until you time a drill | Record wall-clock in the staging checklist |

**Money and truth:** Business state for orders and payments lives in **PostgreSQL**. Restoring Postgres is the recovery priority.

## What to back up

### PostgreSQL (required)

- **Logical dump:** `pg_dump` (plain or custom), typically **compressed** (e.g. `.sql.gz`), full database—no table exclusions for simpler restores.
- **Frequency:** Align with your RPO (e.g. nightly dump **plus** provider automated snapshots if available).
- **Storage:** Off-box (S3-compatible, another region). Copying dumps is **operator- or provider-scheduled**; this repo does not ship a cloud uploader.
- **Credentials:** Use `PGPASSWORD` or a connection URI; never commit dumps or secrets to git.

### Redis (usually not “restored” for business data)

Redis holds **coordination** (close-bill idempotency, Socket.IO adapter). After a DB-focused incident, **empty Redis is acceptable**: locks and idempotency keys expire; clients reconnect. Do not treat Redis backup as a substitute for Postgres.

### Object / file storage (pilot default: often N/A)

If you are not using uploads in production, **no object backup** is required for the core pilot. If you enable MinIO/S3 for assets later, add bucket backup to your runbook ([`DEPLOYMENT_DEVOPS.md`](./DEPLOYMENT_DEVOPS.md)).

## Managed PostgreSQL

- Enable **automated backups** and **point-in-time recovery (PITR)** where available.
- Keep at least one **logical dump** on separate storage for vendor-independent restores.
- **Quarterly restore drill** (staging): follow [`staging-restore-drill-checklist.md`](./staging-restore-drill-checklist.md).

## Application-level checks after restore

1. **`GET /api/v1/health/live`** and **`GET /api/v1/health/ready`** return 200 against the API using the restored DB.
2. **Authenticated smoke:** at least `GET /api/v1/tenants/branches` with a valid JWT (see [`restore-drill-smoke.sh`](../../deploy/scripts/restore-drill-smoke.sh)).
3. Optional **full path:** run Playwright critical path against staging ([`docs/qa/E2E_CRITICAL_PATH.md`](../qa/E2E_CRITICAL_PATH.md)).
4. Spot-check **tenant isolation** if you have multiple tenants.
5. Re-issue **JWT secrets** if the incident involved DB or secret compromise (force re-login).

## Runbook (summary)

1. Stop traffic to the API (maintenance page or scale to zero).
2. Restore Postgres from backup or PITR to a new instance or database.
3. Point `DATABASE_URL` at restored DB; run `npm run db:migrate:deploy` from repo root (see [`package.json`](../../package.json)).
4. Restart API; verify health + smoke in **staging** first.
5. Resume traffic; monitor error rate and latency.

Document provider-specific steps (RDS, Cloud SQL, Supabase, etc.) in your internal runbook as you adopt them.

## Scripted helpers (not full automation)

| Script | Purpose |
|--------|---------|
| [`deploy/scripts/backup-restore-verify.sh`](../../deploy/scripts/backup-restore-verify.sh) | `pg_dump` → restore to new DB → `db:migrate:deploy` → optional **curl** health checks |
| [`deploy/scripts/restore-drill-smoke.sh`](../../deploy/scripts/restore-drill-smoke.sh) | Login + `GET /tenants/branches` (env-supplied credentials) |

Operators still configure `DATABASE_URL`, restart processes, and manage dumps. **Windows:** use WSL/Git Bash for bash scripts, or run equivalent `pg_dump`/`psql` commands manually.

## Related

- **Staging drill checklist & sign-off:** [`staging-restore-drill-checklist.md`](./staging-restore-drill-checklist.md)
- **Pilot gate:** [`PILOT_RELEASE_GATE.md`](./PILOT_RELEASE_GATE.md)
