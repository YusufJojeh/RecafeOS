#!/usr/bin/env bash
# Logical backup, restore to a new database, apply Prisma migrations, then verify API health.
# Linux/macOS/Git Bash. Set PGPASSWORD if required. Run in staging first.
#
# After this script, operators must point staging API DATABASE_URL at RESTORE_DB and restart the API,
# then run deploy/scripts/restore-drill-smoke.sh (optional authenticated check).
#
# Env:
#   API_BASE_URL   default http://127.0.0.1:3000/api/v1 — used for curl health checks
#   SKIP_API_CHECKS=1  skip curl (e.g. API not running on same host yet)
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=restocafe}"
: "${DUMP_FILE:=./restocafe-backup-$(date +%Y%m%d-%H%M%S).sql.gz}"
: "${RESTORE_DB:=restocafe_restore_verify}"
: "${API_BASE_URL:=http://127.0.0.1:3000/api/v1}"

echo "==> Dumping ${PGDATABASE} to ${DUMP_FILE}"
pg_dump --no-owner --format=plain "${PGDATABASE}" | gzip -c > "${DUMP_FILE}"

echo "==> Creating fresh DB ${RESTORE_DB} and restoring"
dropdb --if-exists "${RESTORE_DB}" 2>/dev/null || true
createdb "${RESTORE_DB}"
gunzip -c "${DUMP_FILE}" | psql -v ON_ERROR_STOP=1 -d "${RESTORE_DB}" >/dev/null

echo "==> Apply Prisma migrations on restored DB (from repo root)"
export DATABASE_URL="postgresql://${PGUSER}@${PGHOST}:${PGPORT}/${RESTORE_DB}?schema=public"
pushd "$(dirname "$0")/../.." >/dev/null
pnpm run db:migrate:deploy
popd >/dev/null

echo "==> Restored DB: ${RESTORE_DB}"
echo "    Export for API: export DATABASE_URL=\"postgresql://${PGUSER}@${PGHOST}:${PGPORT}/${RESTORE_DB}?schema=public\""

if [[ "${SKIP_API_CHECKS:-0}" == "1" ]]; then
  echo "==> SKIP_API_CHECKS=1 — not calling API. Restart API with DATABASE_URL above, then:"
  echo "    curl -sf ${API_BASE_URL}/health/live && curl -sf ${API_BASE_URL}/health/ready"
  echo "    deploy/scripts/restore-drill-smoke.sh (with DRILL_LOGIN_*)"
  exit 0
fi

echo "==> Health checks against ${API_BASE_URL}"
echo "    (API must be running with DATABASE_URL pointing at ${RESTORE_DB}; set SKIP_API_CHECKS=1 if not ready)"
curl -sf "${API_BASE_URL}/health/live" >/dev/null
curl -sf "${API_BASE_URL}/health/ready" >/dev/null
echo "==> OK: live + ready returned 200"
