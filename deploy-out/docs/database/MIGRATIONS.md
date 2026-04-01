# Database migrations (Prisma)

## Deploy (CI / production)

Use the migration history in `prisma/migrations/`, not `prisma db push`.

```bash
cd apps/api
npx prisma migrate deploy
```

Run after `prisma generate` (or rely on your build script that already generates the client).

## Baseline and history

This repository ships incremental migrations. If a database was created earlier with `db push` or manual SQL and has **never** applied Prisma migrations:

1. Capture the live DDL (or use `pg_dump --schema-only`) and store it privately for comparison.
2. Either:
   - **Mark migrations as applied** after verifying schema matches:  
     `npx prisma migrate resolve --applied <migration_folder_name>`  
     for each migration that is already reflected in the database, **or**
   - Recreate the database from migrations in a lower environment and migrate data.

Never `db push` in production unless you accept unversioned drift.

## Rollbacks

Prisma does not auto-generate down migrations. For risky changes, keep a short runbook in the migration PR: forward SQL + manual reverse (e.g. `DROP INDEX CONCURRENTLY`, `ALTER TABLE ... DROP CONSTRAINT`).

## Large tables

For heavy `CREATE INDEX` on production, prefer **concurrent** index builds in a maintenance window (run outside Prisma’s default transaction if your ops process allows), then record the migration as applied or use a SQL migration split into non-transactional steps.
