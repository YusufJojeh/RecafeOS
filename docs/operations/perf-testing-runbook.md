# Performance Testing Runbook

Operational checklist for activating and running staging performance tests.

---

## 1. Secret Contract

Configure these 3 GitHub repository secrets before any perf-gate CI job will run:

| Secret | Value | How to get it |
|--------|-------|---------------|
| `STAGING_BASE_URL` | API origin, e.g. `https://staging.restocafe.example.com` (no trailing slash) | Your staging deploy URL |
| `STAGING_PERF_JWT` | Staff access token with permissions: `tables.view`, `tables.manage`, `orders.*`, `kitchen.*`, `bar.*`, `payments.*`, `reports.view`, `menu.view` | `POST /api/v1/auth/login` with a staging staff user, extract `accessToken` |
| `STAGING_PERF_BRANCH_ID` | Branch CUID (e.g. `clxxxxxxxx`) | From staging DB or admin panel — the branch to run tests against |

**Behavior when secrets are missing:**
- **Push to main (smoke):** Skips with `::warning::` annotation — visible but non-blocking
- **Release (RC gate):** Fails hard with `::error::` — blocks the release
- **Manual dispatch:** Fails hard with `::error::` — blocks the run

---

## 2. What Runs When

| Trigger | Suites | Duration | Blocking? |
|---------|--------|----------|-----------|
| Push to `main` | smoke | ~2 min | Warning only (skips if no secrets) |
| Release created | benchmark → pilot → concurrency | ~25 min | Hard fail if secrets missing or thresholds fail |
| Manual dispatch | Any single suite | 2–35 min | Hard fail if secrets missing |

---

## 3. Running Tests Locally

```bash
# Set environment
export BASE_URL=https://staging.example.com
export JWT=eyJ...
export BRANCH_ID=clxxxxxxxx

# Individual suites
k6 run -e BASE_URL="$BASE_URL" -e JWT="$JWT" -e BRANCH_ID="$BRANCH_ID" \
  --summary-export=ops/load/out/smoke.json ops/load/staging-smoke.k6.js

# RC gate (pilot + concurrency via orchestrator)
./ops/load/run-suite.sh rc

# Full suite (benchmark + pilot + concurrency)
./ops/load/run-suite.sh all

# Soak (35 min, run weekly or before major milestones)
./ops/load/run-suite.sh soak

# Compare against a baseline
./ops/load/run-suite.sh pilot --compare ops/load/out/baseline-2026-03.json
```

---

## 4. Suite Reference

| Suite | Script | VUs | Duration | Purpose |
|-------|--------|-----|----------|---------|
| `smoke` | staging-smoke.k6.js | 5 | 2 min | Health + read sanity |
| `pilot` | staging-pilot.k6.js | ~25 + 4 writers | 8 min | Primary RC gate — full order lifecycle under realistic load |
| `concurrency` | concurrency-payments.k6.js | 20 | 3 min | 20 VUs race to close same order — idempotency stress |
| `benchmark` | benchmark-baselines.k6.js | 1 (sequential) | 9 min | Isolated per-endpoint p95/p99 baseline |
| `soak` | soak-sustained.k6.js | 15 | 35 min | Stability + leak detection (early/mid/late failure counters) |
| `growth` | growth-scale.k6.js | ~45 + 8 writers | 12 min | Next-tier capacity validation |

---

## 5. Artifact Naming Convention

| Context | Artifact name | Retention |
|---------|---------------|-----------|
| Smoke (push) | `perf-smoke-{sha}` | 30 days |
| RC benchmark | `perf-benchmark-{tag}` | 180 days |
| RC pilot | `perf-pilot-{tag}` | 90 days |
| RC concurrency | `perf-concurrency-{tag}` | 90 days |
| Manual dispatch | `perf-{suite}-{run_id}` | 90 days |
| Local run (orchestrator) | `ops/load/out/YYYYMMDD-HHMM/{suite}.json` | Local only |
| Committed baseline | `ops/load/out/baseline-YYYY-MM.json` | Permanent (git) |

---

## 6. Baseline Capture and Comparison

### First-time baseline

```bash
# Run benchmark in isolation
k6 run -e BASE_URL="$BASE_URL" -e JWT="$JWT" -e BRANCH_ID="$BRANCH_ID" \
  --summary-export=ops/load/out/benchmark.json ops/load/benchmark-baselines.k6.js

# Save as baseline
cp ops/load/out/benchmark.json ops/load/out/baseline-$(date +%Y-%m).json
```

### Comparing runs

```bash
node ops/load/compare-runs.js \
  --baseline ops/load/out/baseline-2026-03.json \
  --current ops/load/out/pilot.json \
  --threshold 20

# --warn-only: print warnings but exit 0 (for CI non-blocking comparison)
# --json: machine-readable output
# --threshold N: percent degradation to trigger FAIL (default: 20)
```

### Regression thresholds

| Status | Meaning |
|--------|---------|
| `OK` | Within normal variance |
| `IMPROVED` | Better than baseline |
| `WARN` | 10–20% degradation (investigate) |
| `FAIL` | ≥20% degradation (fix before release) |
| `NEW` | Metric in current run but not in baseline |

---

## 7. Pass/Fail Interpretation

### Release gate (must ALL pass)

| Check | Threshold | Source |
|-------|-----------|--------|
| Global error rate | < 2% | All suites |
| Health p95 | < 800ms | pilot |
| Read p95 | < 2000ms | pilot |
| Write p95 | < 5000ms | pilot |
| Write failures | < 8 of 24 | pilot |
| Concurrent close errors | exactly 0 | concurrency |
| Post-PAID server errors | exactly 0 | concurrency |
| Concurrent close p95 | < 3000ms | concurrency |

### Soak gate (weekly, pre-milestone)

| Check | Threshold | Meaning if fails |
|-------|-----------|-----------------|
| `soak_late_failures` | < 5 | Resource leak or connection pool exhaustion |
| Read p95 | < 2500ms | Query degradation under sustained load |
| Write p95 | < 6000ms | Transaction contention growing |

### Benchmark baselines (per-endpoint, monthly)

| Endpoint | p95 target | p99 target |
|----------|-----------|-----------|
| Health | 50ms | 150ms |
| Menu | 200ms | 500ms |
| Orders list | 300ms | 700ms |
| Kitchen tickets | 250ms | 600ms |
| Reports daily | 2000ms | 5000ms |
| Order create | 600ms | 1500ms |
| Order close | 1200ms | 2500ms |

---

## 8. Activation Checklist

```
[ ] 1. Configure STAGING_BASE_URL in GitHub repo secrets
[ ] 2. Configure STAGING_PERF_JWT in GitHub repo secrets
[ ] 3. Configure STAGING_PERF_BRANCH_ID in GitHub repo secrets
[ ] 4. Push to main — verify smoke test runs (check Actions tab)
[ ] 5. Run manual dispatch: smoke — verify it passes
[ ] 6. Run manual dispatch: benchmark — download artifact, save as baseline
[ ] 7. Run manual dispatch: pilot — verify thresholds pass
[ ] 8. Run manual dispatch: concurrency — verify 0 close errors
[ ] 9. Run manual dispatch: soak — verify late_failures < 5
[ ] 10. Create a test release tag — verify RC gate runs benchmark + pilot + concurrency
[ ] 11. Commit baseline: cp artifact → ops/load/out/baseline-YYYY-MM.json
```
