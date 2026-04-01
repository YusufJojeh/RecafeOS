#!/usr/bin/env bash
# Authenticated smoke after restore: login + list branches.
# Requires curl and Node (for JSON). No secrets in repo — use environment variables.
#
# Usage:
#   export DRILL_LOGIN_EMAIL=owner@demo.local
#   export DRILL_LOGIN_PASSWORD=demo12345
#   export API_BASE_URL=http://127.0.0.1:3000/api/v1   # optional
#   ./deploy/scripts/restore-drill-smoke.sh
set -euo pipefail

: "${API_BASE_URL:=http://127.0.0.1:3000/api/v1}"
: "${DRILL_LOGIN_EMAIL:?Set DRILL_LOGIN_EMAIL}"
: "${DRILL_LOGIN_PASSWORD:?Set DRILL_LOGIN_PASSWORD}"

echo "==> POST ${API_BASE_URL}/auth/login"
LOGIN_JSON="$(curl -sf -X POST "${API_BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${DRILL_LOGIN_EMAIL}\",\"password\":\"${DRILL_LOGIN_PASSWORD}\"}")"

TOKEN="$(printf '%s' "${LOGIN_JSON}" | node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync(0,'utf8'));console.log(j.accessToken)")"
if [[ -z "${TOKEN}" || "${TOKEN}" == "undefined" ]]; then
  echo "Failed to parse accessToken from login response" >&2
  exit 1
fi

echo "==> GET ${API_BASE_URL}/tenants/branches"
curl -sf "${API_BASE_URL}/tenants/branches" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" >/dev/null

echo "==> OK: authenticated branches list succeeded"
