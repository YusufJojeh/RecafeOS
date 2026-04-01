# Pilot feature migrations (Postgres)

Pilot tracking adds tables and columns via Prisma migrations under [`apps/api/prisma/migrations/`](../../apps/api/prisma/migrations/).

## Required migrations

| Migration folder | Contents |
|------------------|----------|
| `20250322190000_pilot_feedback` | `PilotFeedbackItem` + enums (`PilotFeedbackType`, etc.) |
| [`20250322200000_pilot_feedback_lifecycle`](../../apps/api/prisma/migrations/20250322200000_pilot_feedback_lifecycle/migration.sql) | `PilotFeedbackStatus`, triage columns; `PilotWeeklySnapshot` |

## Apply in each environment

From repo root:

```bash
npm run db:migrate:deploy -w api
```

Requires `DATABASE_URL`. Run **once** per rollout before new API code handles new columns (see [`MIGRATIONS.md`](../database/MIGRATIONS.md)).

## Verify

- [ ] `npx prisma migrate status` (in `apps/api`) shows no pending migrations.
- [ ] `GET /api/v1/support/tenants/:id/pilot-feedback` returns 200 (empty list is fine).
- [ ] Optional: `POST` a pilot feedback row with support write key succeeds.

## Rollback

Prisma does not auto-downgrade production. If you must revert **only** the pilot tables: restore Postgres from backup taken before the migration, or write a **forward** migration that drops the new objects (only if no production data to keep). See [`MIGRATIONS.md`](../database/MIGRATIONS.md) §Rollback limits.
