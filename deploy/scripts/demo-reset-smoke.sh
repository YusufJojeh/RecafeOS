#!/usr/bin/env bash
# Health checks + optional support reset-demo for a demo branch.
# Intended for demo stacks with Tenant.metadata.demo === true (no ack required).
#
# After this script succeeds, run through the live demo UI sequence (Setup through
# Reports) per docs/operations/DEMO_SALES_EXECUTION_PACKAGE.md §1 steps B–H.
#
# Linux/macOS/Git Bash/WSL.
#
# Env:
#   API_BASE_URL  default http://127.0.0.1:3000/api/v1
#   SKIP_CHECKS=1  exit 0 without curling
#
# For reset (optional; requires all three):
#   SUPPORT_API_KEY
#   TENANT_ID
#   BRANCH_ID
#   ACK_PRODUCTION_RESET=1  set only if tenant is NOT demo-tagged (discouraged; see docs/operations/DEMO_TENANT.md)
set -euo pipefail

: "${API_BASE_URL:=http://127.0.0.1:3000/api/v1}"

if [[ "${SKIP_CHECKS:-0}" == "1" ]]; then
  echo "SKIP_CHECKS=1 — not curling API."
  exit 0
fi

echo "==> GET ${API_BASE_URL}/health/live"
curl -sfS "${API_BASE_URL}/health/live" >/dev/null

echo "==> GET ${API_BASE_URL}/health/ready"
curl -sfS "${API_BASE_URL}/health/ready" >/dev/null

echo "==> OK: live + ready returned 2xx"

if [[ -n "${SUPPORT_API_KEY:-}" && -n "${TENANT_ID:-}" && -n "${BRANCH_ID:-}" ]]; then
  if [[ "${ACK_PRODUCTION_RESET:-0}" == "1" ]]; then
    body="$(printf '{"branchId":"%s","acknowledgeProductionReset":true}' "${BRANCH_ID}")"
  else
    body="$(printf '{"branchId":"%s"}' "${BRANCH_ID}")"
  fi
  echo "==> POST ${API_BASE_URL}/support/tenants/${TENANT_ID}/reset-demo"
  curl -sfS -X POST "${API_BASE_URL}/support/tenants/${TENANT_ID}/reset-demo" \
    -H "Content-Type: application/json" \
    -H "x-support-api-key: ${SUPPORT_API_KEY}" \
    -d "${body}"
  echo ""
  echo "==> OK: reset-demo completed"
else
  echo "    (Skip reset: set SUPPORT_API_KEY, TENANT_ID, BRANCH_ID to run POST .../reset-demo after health.)"
fi
