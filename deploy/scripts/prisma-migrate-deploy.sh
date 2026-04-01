#!/usr/bin/env bash
# Run Prisma migrations against DATABASE_URL (staging/prod CI or shell with secrets).
# Usage: from repo root —  deploy/scripts/prisma-migrate-deploy.sh
#    or:  cd apps/api && npx prisma migrate deploy
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${ROOT}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "error: DATABASE_URL must be set (PostgreSQL connection string)." >&2
  exit 1
fi

echo "==> prisma migrate deploy (bootstrap-aware, api workspace)"
pnpm --filter api run prisma:migrate:deploy:safe
