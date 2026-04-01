#!/usr/bin/env bash
# Calls POST /support/jobs/expire-trials — run from cron, K8s CronJob, or cloud scheduler.
# Requires SUPPORT_API_KEY and a reachable API (same base URL as other support scripts).
#
# Env:
#   API_BASE_URL  default http://127.0.0.1:3000/api/v1
#   SUPPORT_API_KEY  required (header x-support-api-key)
#   SKIP_CHECKS=1  exit 0 without HTTP call (dry-run wiring)
set -euo pipefail

: "${API_BASE_URL:=http://127.0.0.1:3000/api/v1}"

if [[ "${SKIP_CHECKS:-0}" == "1" ]]; then
  echo "SKIP_CHECKS=1 — not calling expire-trials."
  exit 0
fi

if [[ -z "${SUPPORT_API_KEY:-}" ]]; then
  echo "error: set SUPPORT_API_KEY" >&2
  exit 1
fi

url="${API_BASE_URL%/}/support/jobs/expire-trials"
echo "==> POST ${url}"
code="$(curl -sS -o /tmp/expire-trials-body.json -w '%{http_code}' \
  -X POST \
  -H "x-support-api-key: ${SUPPORT_API_KEY}" \
  -H "Content-Type: application/json" \
  "${url}")"

if [[ "${code}" != "200" ]]; then
  echo "error: HTTP ${code}" >&2
  cat /tmp/expire-trials-body.json >&2 || true
  exit 1
fi

cat /tmp/expire-trials-body.json
echo ""
echo "==> OK"
