# Load tests — RestoCafe OS

Use against **staging only** with anonymized data. Do not point at production without explicit approval.

Full strategy documentation: [`docs/operations/performance-validation-strategy.md`](../../docs/operations/performance-validation-strategy.md)

## Prerequisites

**k6** (all HTTP load tests):

```bash
# macOS
brew install k6

# Linux / CI
sudo gpg --dearmor -o /usr/share/keyrings/k6-archive-keyring.gpg < <(curl -fsSL https://dl.k6.io/key.gpg)
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install -y k6

# Docker
docker run --rm -i -v "%cd%:/src" -w /src grafana/k6 run ops/load/staging-pilot.k6.js
```

**Artillery** (WebSocket scenarios only):

```bash
npm install -g artillery artillery-plugin-socketio @artillery/plugin-expect
```

## Scripts

### K6 (HTTP load tests)

| File | Purpose | VUs | Duration |
|------|---------|-----|----------|
| `staging-smoke.k6.js` | Quick sanity check — health, kitchen, tables | 5 | 2 min |
| `staging-pilot.k6.js` | **Primary RC gate** — reads + full order write lifecycle | ~25 + 4 writers | 8 min |
| `staging-mixed-ws.k6.js` | Engine.IO polling + heavy HTTP concurrent stress | ~44 | 5 min |
| `benchmark-baselines.k6.js` | Isolated 1-VU per-endpoint baseline capture | 1 | 9 min |
| `concurrency-payments.k6.js` | 20 VUs race to close the same order — idempotency stress | 20 | 3 min |
| `soak-sustained.k6.js` | 35-min stability soak — catches resource leaks | 15 | 35 min |
| `growth-scale.k6.js` | Growth-tier profile for the next scale tier | ~45 + 8 writers | 12 min |

### Artillery (WebSocket / Socket.IO)

| File | Tests |
|------|-------|
| `ws-artillery/ws-branch-join.yml` | Authenticated connect + branch room join |
| `ws-artillery/ws-reconnect.yml` | Reconnect cycle after forced disconnect |
| `ws-artillery/ws-event-delivery.yml` | Event delivery timing after REST mutations |

### Supporting tools

| File | Purpose |
|------|---------|
| `lib/shared.js` | Shared K6 helpers (imported by new scripts) |
| `thresholds.json` | Canonical threshold registry for all scripts |
| `compare-runs.js` | Node.js CLI: compare two summary.json exports |
| `run-suite.sh` | Bash orchestrator for running suites |

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `BASE_URL` | Yes | API origin, e.g. `https://staging.example.com` (no trailing slash) |
| `JWT` | Yes | Staging staff access token with tables, orders, kitchen, bar, payments, reports permissions |
| `BRANCH_ID` | Yes | Branch UUID for `X-Branch-Id` |
| `SKIP_WRITES` | No | `1` = read-only scenarios only (no orders created) |
| `SKIP_REPORTS` | No | `1` = skip `GET .../reports/daily` |
| `TABLE_LABEL` | No | Preferred floor table label when opening sessions (default `T2`) |

## Quick start

```bash
export BASE_URL=https://staging.example.com
export JWT=eyJ...
export BRANCH_ID=clxxxxxxxx

# Smoke (2 min)
k6 run ops/load/staging-smoke.k6.js

# Pilot gate (8 min)
k6 run ops/load/staging-pilot.k6.js

# RC gate (pilot + concurrency via orchestrator)
./ops/load/run-suite.sh rc

# Growth scale (12 min)
./ops/load/run-suite.sh growth

# Soak (35 min)
./ops/load/run-suite.sh soak
```

## Export / release evidence

```bash
mkdir -p ops/load/out
k6 run --summary-export=ops/load/out/pilot-$(date +%Y%m%d).json ops/load/staging-pilot.k6.js
```

Attach or link the `summary.json` to your release record. For RC gates the CI workflow
uploads artifacts automatically — see `.github/workflows/perf-gate.yml`.

## Baseline comparison

After a benchmark run, save the output as a baseline and compare future runs against it:

```bash
# Save baseline
cp ops/load/out/benchmark.json ops/load/out/baseline-$(date +%Y-%m).json

# Compare a later run
node ops/load/compare-runs.js \
  --baseline ops/load/out/baseline-2026-03.json \
  --current  ops/load/out/pilot-2026-03-23.json \
  --threshold 20
```

## Pass / fail

Thresholds are defined canonically in `thresholds.json` and enforced in each k6 script.
The canonical explanation and tuning notes are in:
- [`staging-performance-gate.md`](../../docs/operations/staging-performance-gate.md) — pilot gate reference
- [`performance-validation-strategy.md`](../../docs/operations/performance-validation-strategy.md) — full strategy

## npm scripts (repo root)

```bash
npm run load:staging-pilot
npm run load:staging-smoke
```

Requires `k6` on PATH.
