#!/usr/bin/env bash
# run-suite.sh — Orchestrate RestoCafe OS performance test suites.
#
# Usage:
#   ./ops/load/run-suite.sh [suite] [options]
#
# Suites:
#   smoke         2-min sanity check (default for quick runs)
#   pilot         Full pilot gate: reads + writes (8-min)
#   concurrency   Payment idempotency stress (3-min burst)
#   growth        Growth-scale profile (12-min)
#   soak          35-min sustained stability test
#   benchmark     Isolated per-endpoint baseline capture (9-min)
#   ws            Artillery WebSocket scenarios (requires artillery on PATH)
#   rc            Release candidate gate: pilot + concurrency
#   all           benchmark + pilot + concurrency (full non-soak suite)
#
# Options:
#   --compare <baseline.json>  After each run, compare vs baseline file
#   --skip-writes              Pass SKIP_WRITES=1 to k6 scripts
#   --skip-reports             Pass SKIP_REPORTS=1 to k6 scripts
#
# Required env vars:
#   BASE_URL      API origin (e.g. https://staging.example.com)
#   JWT           Staff access token with full permissions
#   BRANCH_ID     Branch UUID for X-Branch-Id
#
# Example:
#   export BASE_URL=https://staging.example.com
#   export JWT=eyJ...
#   export BRANCH_ID=clxxxxxxxx
#   ./ops/load/run-suite.sh rc
#   ./ops/load/run-suite.sh benchmark --compare ops/load/out/baseline-2026-02.json

set -euo pipefail

# ── Defaults ───────────────────────────────────────────────────────────────────

SUITE="${1:-smoke}"
shift || true

COMPARE_BASELINE=""
K6_EXTRA_VARS=""
ARTILLERY_EXTRA=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --compare)
      COMPARE_BASELINE="$2"
      shift 2
      ;;
    --skip-writes)
      K6_EXTRA_VARS="$K6_EXTRA_VARS -e SKIP_WRITES=1"
      shift
      ;;
    --skip-reports)
      K6_EXTRA_VARS="$K6_EXTRA_VARS -e SKIP_REPORTS=1"
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# ── Validation ─────────────────────────────────────────────────────────────────

if ! command -v k6 &>/dev/null; then
  echo "ERROR: k6 not found on PATH."
  echo "Install: https://k6.io/docs/get-started/installation/"
  echo "Or via Docker: see ops/load/README.md"
  exit 1
fi

if [[ -z "${BASE_URL:-}" || -z "${JWT:-}" || -z "${BRANCH_ID:-}" ]]; then
  echo "ERROR: BASE_URL, JWT, and BRANCH_ID must be set."
  echo "Example:"
  echo "  export BASE_URL=https://staging.example.com"
  echo "  export JWT=eyJ..."
  echo "  export BRANCH_ID=clxxxxxxxx"
  exit 1
fi

# ── Output directory ───────────────────────────────────────────────────────────

TIMESTAMP="$(date +%Y%m%d-%H%M)"
OUT_DIR="ops/load/out/${TIMESTAMP}"
mkdir -p "$OUT_DIR"
echo "Output directory: ${OUT_DIR}"

# ── Helpers ────────────────────────────────────────────────────────────────────

run_k6() {
  local script="$1"
  local label="$2"
  local out_file="${OUT_DIR}/${label}.json"

  echo ""
  echo "════════════════════════════════════════════"
  echo "  Running: ${label}"
  echo "  Script:  ${script}"
  echo "  Output:  ${out_file}"
  echo "════════════════════════════════════════════"

  k6 run \
    -e BASE_URL="${BASE_URL}" \
    -e JWT="${JWT}" \
    -e BRANCH_ID="${BRANCH_ID}" \
    ${K6_EXTRA_VARS} \
    --summary-export="${out_file}" \
    "${script}"

  echo "  ✓ ${label} complete → ${out_file}"

  if [[ -n "$COMPARE_BASELINE" && -f "$COMPARE_BASELINE" ]]; then
    echo ""
    echo "  Comparing vs baseline: ${COMPARE_BASELINE}"
    node ops/load/compare-runs.js \
      --baseline "${COMPARE_BASELINE}" \
      --current "${out_file}" \
      --threshold 20 \
      --warn-only || true
  fi
}

run_artillery() {
  local scenario="$1"
  local label="$2"

  if ! command -v artillery &>/dev/null; then
    echo "SKIP: artillery not on PATH — skipping ${label}"
    echo "Install: npm install -g artillery artillery-plugin-socketio"
    return
  fi

  local out_file="${OUT_DIR}/${label}-artillery.json"
  echo ""
  echo "════════════════════════════════════════════"
  echo "  Running (Artillery): ${label}"
  echo "════════════════════════════════════════════"

  artillery run \
    --output "${out_file}" \
    "${scenario}"

  artillery report "${out_file}" --output "${OUT_DIR}/${label}-report.html" || true
  echo "  ✓ ${label} complete → ${out_file}"
}

# ── Suite dispatch ─────────────────────────────────────────────────────────────

case "$SUITE" in
  smoke)
    run_k6 ops/load/staging-smoke.k6.js smoke
    ;;

  pilot)
    run_k6 ops/load/staging-pilot.k6.js pilot
    ;;

  concurrency)
    run_k6 ops/load/concurrency-payments.k6.js concurrency
    ;;

  growth)
    run_k6 ops/load/growth-scale.k6.js growth
    ;;

  soak)
    echo "WARNING: soak test runs for 35 minutes."
    run_k6 ops/load/soak-sustained.k6.js soak
    ;;

  benchmark)
    run_k6 ops/load/benchmark-baselines.k6.js benchmark
    echo ""
    echo "To use this as a new baseline:"
    echo "  cp ${OUT_DIR}/benchmark.json ops/load/out/baseline-$(date +%Y-%m).json"
    ;;

  ws)
    run_artillery ops/load/ws-artillery/ws-branch-join.yml    ws-branch-join
    run_artillery ops/load/ws-artillery/ws-reconnect.yml      ws-reconnect
    run_artillery ops/load/ws-artillery/ws-event-delivery.yml ws-event-delivery
    ;;

  rc)
    # Release candidate gate: benchmark + pilot + concurrency (matches CI perf-gate.yml)
    echo "Running release candidate gate (benchmark + pilot + concurrency)..."
    run_k6 ops/load/benchmark-baselines.k6.js benchmark
    run_k6 ops/load/staging-pilot.k6.js       pilot
    run_k6 ops/load/concurrency-payments.k6.js concurrency
    echo ""
    echo "════════════════════════════════════════════"
    echo "  RC gate complete. Attach these to your release record:"
    ls -1 "${OUT_DIR}/"
    echo ""
    echo "  To save benchmark as baseline:"
    echo "    cp ${OUT_DIR}/benchmark.json ops/load/out/baseline-$(date +%Y-%m).json"
    echo "════════════════════════════════════════════"
    ;;

  all)
    # Full non-soak suite (benchmark + pilot + concurrency)
    run_k6 ops/load/benchmark-baselines.k6.js benchmark
    run_k6 ops/load/staging-pilot.k6.js        pilot
    run_k6 ops/load/concurrency-payments.k6.js  concurrency
    echo ""
    echo "════════════════════════════════════════════"
    echo "  Full suite complete."
    echo "  Results: ${OUT_DIR}/"
    ls -1 "${OUT_DIR}/"
    echo "════════════════════════════════════════════"
    ;;

  *)
    echo "Unknown suite: ${SUITE}"
    echo "Valid suites: smoke | pilot | concurrency | growth | soak | benchmark | ws | rc | all"
    exit 1
    ;;
esac

echo ""
echo "Done. All results saved to: ${OUT_DIR}/"
