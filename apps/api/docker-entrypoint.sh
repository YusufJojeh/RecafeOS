#!/bin/sh
set -e
# Single-replica only. For multiple API replicas, run migrations from CI or a one-off job.
if [ "${RUN_MIGRATIONS_ON_START:-false}" = "true" ]; then
  echo "restocafe-api: prisma migrate deploy (bootstrap-aware)"
  node scripts/prisma-migrate-deploy-or-bootstrap.mjs
fi
exec node dist/src/main.js
