#!/usr/bin/env bash
# Quick smoke: API liveness + readiness (through TLS/reverse proxy if that is the pilot URL).
# Use the same base URL staff use in the browser (e.g. https://api.example.com/api/v1).
#
# Linux/macOS/Git Bash/WSL.
#
# Env:
#   API_BASE_URL  default http://127.0.0.1:3000/api/v1
#   SKIP_CHECKS=1  exit 0 without curling (for dry-run wiring)
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
echo "    Tip: with METRICS_ENABLED=true, scrape /api/v1/internal/metrics on the internal network only ([docs/operations/OBSERVABILITY.md])."
