# Staging restore drill checklist

Use for **staging** or any **non-production** database. Goal: prove a backup can be restored, migrated, and that the API serves real data.

**Prerequisites**

- Postgres client tools (`pg_dump`, `psql`, `createdb`, `dropdb`) on a Unix shell (Linux, macOS, or **WSL/Git Bash** on Windows).
- Repo clone with `npm install` at root; Node for `npm run db:migrate:deploy`.
- Stopping or repointing **one** staging API instance so `DATABASE_URL` can target the restored DB safely.

## Procedure (operator steps)

| Step | Action | Notes |
|------|--------|--------|
| 1 | **Record start time** | For RTO measurement |
| 2 | Create logical backup | e.g. `pg_dump` of source DB; store path and checksum/hash |
| 3 | Create **new** database name | e.g. `restocafe_drill_YYYYMMDD`—do not drop production |
| 4 | Restore dump into new DB | `psql` or `pg_restore` per format |
| 5 | `export DATABASE_URL=postgresql://.../restocafe_drill_...?schema=public` | Include password if required |
| 6 | From **repo root:** `npm run db:migrate:deploy` | Applies any migrations not in the dump |
| 7 | Point **staging API** `DATABASE_URL` at restored DB; **restart** API | Docker compose, systemd, k8s—manual |
| 8 | Run health checks | See validation below |
| 9 | Optional: [`restore-drill-smoke.sh`](../../deploy/scripts/restore-drill-smoke.sh) | Env: `DRILL_LOGIN_EMAIL`, `DRILL_LOGIN_PASSWORD` |
| 10 | Optional: Playwright critical path vs staging URL | [`docs/qa/E2E_CRITICAL_PATH.md`](../qa/E2E_CRITICAL_PATH.md) |
| 11 | **Record end time**; sign off | |

**Automated partial path:** [`deploy/scripts/backup-restore-verify.sh`](../../deploy/scripts/backup-restore-verify.sh) covers steps similar to 2–6 on one host; you must still restart the API and run validation.

## Validation (success criteria)

| ID | Criterion | Pass? |
|----|-----------|-------|
| A | DB restored and `db:migrate:deploy` completed without error | |
| B | API process starts with `DATABASE_URL` pointing at restored DB | |
| C | `GET .../health/live` returns **200** | |
| D | `GET .../health/ready` returns **200** (DB query succeeds) | |
| E | Authenticated `GET /api/v1/tenants/branches` returns expected branch(es) | |
| F | Optional: Playwright critical path green **or** `GET /api/v1/branches/:branchId/tables` after login | |

**Minimum bar for pilot gate:** A, B, C, D, and E. **F** is recommended quarterly or after schema changes.

## Sign-off

| Field | Value |
|-------|--------|
| Date | |
| Operator | |
| Dump file / object path | |
| Dump checksum (optional) | |
| Restored database name | |
| Start time | |
| End time | |
| RTO notes (wall-clock) | |
| Evidence (log snippet, CI link) | |

Paste into change ticket or [`PILOT_RELEASE_GATE.md`](./PILOT_RELEASE_GATE.md) evidence column for gate 4.

## Cadence

| When | What |
|------|------|
| Before paid pilot | Full drill + sign-off |
| Quarterly | Repeat restore + health + E; add F when feasible |
| After major migration | One restore test to ensure dumps still apply |
