# Performance Validation Strategy — RestoCafe OS

> This document is the authoritative reference for all performance testing decisions.
> It covers the full six-deliverable scope: strategy, profiles, scenarios, tooling, thresholds, and interpretation.

---

## 1 · Benchmarking Strategy

### Philosophy

RestoCafe OS is a multi-tenant restaurant operations SaaS. Its performance envelope is defined by
the busiest possible shift at the largest pilot venue — not by internet-scale traffic. The goal of
performance validation is to give engineers objective, reproducible evidence before shipping to
real customers, not to simulate traffic that doesn't exist yet.

**Three core principles:**

1. **Realism over impressiveness.** A 25-VU pilot test that models an actual busy café is more
   useful than a 5000-VU test that proves nothing about real-world behaviour.

2. **Trend over snapshot.** A single pass/fail gate is necessary but not sufficient. Results
   must be compared over time — gradual latency creep is just as dangerous as an acute regression.

3. **Distinguish what is being measured.** An isolated benchmark (1 VU, one endpoint) and a
   full scenario (25 VUs, mixed workload) answer different questions and must not be conflated.

### What Is and Is Not Tested

| In scope | Out of scope |
|---|---|
| API hot paths under realistic concurrent load | Browser rendering, CDN, or client-side performance |
| Payment idempotency under genuine contention | Third-party payment gateway latency |
| Socket.IO connection stability and reconnect | Geographic distribution / CDN latency |
| Resource leaks over 35 minutes | Production multi-tenant fan-out across all tenants |
| Report generation under concurrent writes | Mobile app performance |
| Per-endpoint p95/p99 baselines | Hyperscale (>100 concurrent venues) |

### Baseline Lifecycle

1. **Capture:** Run `benchmark-baselines.k6.js` monthly and after optimization work.
   Save output as `ops/load/out/baseline-YYYY-MM.json`.
2. **Commit:** Only baseline files are committed to the repo (`ops/load/out/baseline-*.json`).
   All other run outputs are gitignored.
3. **Compare:** After every pilot gate run, use `compare-runs.js` to diff vs baseline.
   A drift > 20% on any metric triggers a warning; > 30% blocks the release.
4. **Retire:** Replace the baseline when the system intentionally changes behaviour
   (e.g. after adding a caching layer that halves report latency).

---

## 2 · Load Profile Definitions

### Profile Ladder

| Profile | Script | VUs | Duration | Trigger |
|---|---|---|---|---|
| **Smoke** | `staging-smoke.k6.js` | 5 | 2 min | Every push to `main` (CI) |
| **Pilot** | `staging-pilot.k6.js` | ~25 + 4 writers | 8 min | Every RC tag; post-infra change |
| **Concurrency** | `concurrency-payments.k6.js` | 20 simultaneous | 3 min | Every RC tag (after pilot) |
| **Growth** | `growth-scale.k6.js` | ~45 + 8 writers | 12 min | Before GA milestone; major infra change |
| **Soak** | `soak-sustained.k6.js` | 15 | 35 min | Weekly cron; before capacity change |
| **Benchmark** | `benchmark-baselines.k6.js` | 1 | 9 min | Monthly; after optimization |

### VU-to-Reality Mapping

| Profile | Models |
|---|---|
| Pilot (25 VU) | ~30-seat café. All handhelds polling (12 floor VUs), 2 kitchen/bar screens (6 VUs), 1 cashier, 2 back-office devices. 4 writers completing full order lifecycles in parallel. |
| Growth (45 VU) | ~25-table venue, 2 floors, dinner rush. Multiple handheld roles, dedicated bar screen, multi-cashier. 8 writers. |
| Soak (15 VU) | Moderate off-peak load. Not about throughput — about 35-minute connection and memory stability. |
| Concurrency (20 VU) | Worst-case double-tap scenario: cashier re-clicks "close" rapidly, POS retries fire simultaneously. All 20 VUs race on the same order + idempotency key. |

**Staging vs production distinction:**
Staging results are treated as indicative. Same hardware class and data volume as pilot deployment.
They do not account for CDN, multi-tenant fan-out across all branches, or geographic distribution.
Do not extrapolate: passing at 25 VUs does not guarantee production stability at 250 simultaneous
users — the VU-to-user mapping is behavioral, not 1:1.

---

## 3 · Critical Test Scenarios

### 3.1 Health Baseline (`benchmark-baselines.k6.js`)

**What:** Single VU, `GET /health/live` + `GET /health/ready`, 60s isolated.

**Why:** Health endpoints are hit by load balancer probes every 5s. If these regress, the pod
gets deregistered under load — a silent failure mode that looks like an outage, not a bug.

**Gate:** p95 < 50ms (live), p95 < 100ms (ready).

### 3.2 Hot Read Path (`staging-pilot.k6.js` floor_staff + kitchen_bar)

**What:** 12 floor-staff VUs polling tables, open orders, menu categories. 6 kitchen/bar VUs
polling ticket queues. ~3s think time between polls.

**Why:** These are the highest-frequency read paths. A POS handheld refreshes every 2-5s during
service. Menu categories must be fast — it's the first thing a waiter loads after login.

**Gate:** Read p95 < 2000ms. Under growth: p95 < 1500ms.

### 3.3 Full Order Lifecycle (`staging-pilot.k6.js` order_writes)

**What:** 4 writers, 24 shared iterations. Each iteration: open session → create order → add items →
confirm → send-to-prep → advance all tickets to DELIVERED → served → close bill (CASH + idempotency key).

**Why:** This is the critical revenue path. A failure anywhere in the lifecycle loses a transaction.
The test exercises: Prisma write transactions, prep ticket FSM, Redis idempotency lock, Socket.IO
event emission, and stock deduction.

**Gate:** Write p95 < 5000ms. Write failures < 8 of 24. Zero 5xx.

### 3.4 Payment Idempotency Race (`concurrency-payments.k6.js`)

**What:** Setup creates one SERVED order. 20 VUs simultaneously POST `close` with the *same*
idempotency key. Then a second wave retries with unique keys on the now-PAID order.

**Why:** Double-tap on a "Pay" button is the most common real-world cashier error. The Redis
distributed lock + idempotency cache must absorb 20 simultaneous requests without creating two
payments or returning a 5xx.

**Gate:** `concurrent_close_errors = 0` (hard stop). Post-PAID FSM must return 4xx, never 5xx.

### 3.5 Sustained Stability (`soak-sustained.k6.js`)

**What:** 5-min ramp to 15 VUs, hold 25 min, 5-min ramp-down. Read mix mirrors pilot; 8 write
lifecycles spread across the 25-min hold. Phase-aware failure counters split failures into
early/mid/late buckets.

**Why:** Postgres connections, Redis idle connections, pino buffers, and Node.js heap can all
creep under sustained load even when p95 looks fine in a 5-minute test.

**Gate:** `soak_late_failures < 5`. Read p95 < 2500ms. Compare early vs late p95 — > 30%
degradation from phase 1 to phase 3 indicates a leak.

### 3.6 Report Generation Under Write Load (`growth-scale.k6.js` report_concurrent)

**What:** 4 VUs pulling `GET /reports/daily` while 8 write workers and 36 read VUs are active.

**Why:** The daily report runs complex aggregations against the same Postgres instance used for
live orders. The 2-layer cache (in-process Map + Redis L2 with configurable TTL) should absorb
most load; the test validates that cache misses don't cause write latency spikes.

**Gate:** Report read p95 stays within the overall read threshold (1500ms under growth load).

### 3.7 WebSocket: Connection + Branch Join (`ws-artillery/ws-branch-join.yml`)

**What:** 20 Artillery virtual users connect to `/ws`, emit `joinBranch`, idle 5s, disconnect.

**Why:** OpsGateway.handleConnection extracts the JWT from query params, verifies it, and stores
it in socket.data. joinBranch validates branch membership via StaffAuthCacheService and adds the
socket to `branch:{branchId}` via the Redis adapter. Both steps must complete within the window.

**Gate:** 0 vuser failures. p95 < 500ms for connect + join.

### 3.8 WebSocket: Reconnect (`ws-artillery/ws-reconnect.yml`)

**What:** Connect → join → force disconnect → 1.5s wait → reconnect → rejoin → verify stable 5s.

**Why:** Network blips, server restarts, and load balancer connection resets are routine in
production. The Redis adapter must clean up stale room memberships on disconnect; re-auth must
succeed without server restart.

**Gate:** 0 failures. Full reconnect cycle p95 < 3000ms.

### 3.9 Engine.IO + HTTP Concurrent Stress (`staging-mixed-ws.k6.js`)

**What:** 18 floor-staff VUs + 10 kitchen VUs + 12 Engine.IO polling VUs simultaneously. The
Engine.IO VUs open new polling sessions repeatedly (HTTP/1.1 long-poll upgrade negotiation).

**Why:** Socket.IO clients fall back to long-polling before upgrading to WebSocket. This tests
the server's ability to handle simultaneous REST API traffic + Socket.IO polling negotiations
without mutual starvation.

**Gate:** Read p95 < 3000ms. Realtime (Engine.IO) p95 < 2500ms.

---

## 4 · Tooling

### Primary: K6

All HTTP load tests. Installed via apt or `grafana/k6` Docker image.

| Script | Role |
|---|---|
| `staging-smoke.k6.js` | Smoke — CI gate on every `main` push |
| `staging-pilot.k6.js` | Pilot gate — RC + post-infra |
| `staging-mixed-ws.k6.js` | Engine.IO + HTTP concurrent stress |
| `benchmark-baselines.k6.js` | Isolated 1-VU per-endpoint baselines |
| `concurrency-payments.k6.js` | Payment race + idempotency validation |
| `soak-sustained.k6.js` | 35-min stability soak |
| `growth-scale.k6.js` | Growth-tier profile |
| `lib/shared.js` | Shared helpers (imported by new scripts) |

### Secondary: Artillery

Socket.IO WebSocket scenarios (k6 cannot speak the Socket.IO framing protocol).

```
npm install -g artillery artillery-plugin-socketio @artillery/plugin-expect
```

| File | Tests |
|---|---|
| `ws-artillery/ws-branch-join.yml` | Connect + authenticate + joinBranch |
| `ws-artillery/ws-reconnect.yml` | Reconnect cycle after forced disconnect |
| `ws-artillery/ws-event-delivery.yml` | Event delivery timing after REST mutations |

### Supporting Tools

| Tool | Role |
|---|---|
| `thresholds.json` | Single canonical threshold registry — all scripts derive from here |
| `compare-runs.js` | Node.js CLI: diff two summary.json exports, flag regressions |
| `run-suite.sh` | Bash orchestrator: `./ops/load/run-suite.sh rc` |
| Prometheus (`/internal/metrics`) | Live metrics during runs: `http_request_duration_seconds`, `websocket_authenticated_connections`, `restocafe_business_events_total` |

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `BASE_URL` | Yes | API origin (no trailing slash) |
| `JWT` | Yes | Staging staff access token with full permissions |
| `BRANCH_ID` | Yes | Branch UUID for `X-Branch-Id` |
| `SKIP_WRITES` | No | `1` = read-only (no orders created) |
| `SKIP_REPORTS` | No | `1` = omit `GET reports/daily` |
| `TABLE_LABEL` | No | Preferred floor table label (default `T2`) |

---

## 5 · Thresholds and Release Gates

### Per-Endpoint Targets (Benchmark Baselines)

| Endpoint | p95 | p99 | Error Rate |
|---|---|---|---|
| `GET /health/live` | 50ms | 150ms | 0% |
| `GET /health/ready` | 100ms | 300ms | 0% |
| `GET /branches/:id/tables` | 250ms | 600ms | < 0.5% |
| `GET /branches/:id/orders` | 350ms | 800ms | < 0.5% |
| `GET /branches/:id/menu/categories` | 200ms | 500ms | < 0.5% |
| `GET /branches/:id/kitchen/tickets` | 250ms | 600ms | < 0.5% |
| `GET /branches/:id/bar/tickets` | 250ms | 600ms | < 0.5% |
| `GET /branches/:id/reports/daily` | 500ms (warm) / 2000ms (cold) | 5000ms | < 1% |
| `POST /branches/:id/orders` | 600ms | 1500ms | < 0.5% |
| `POST /orders/:id/items` | 400ms | 900ms | < 0.5% |
| `POST /orders/:id/close` | 1200ms | 2500ms | < 0.5% |
| WS connect + joinBranch | 500ms | 1200ms | 0% |
| WS event delivery lag | — | 2000ms after trigger | 0% |

All targets are defined canonically in `ops/load/thresholds.json`. Edit thresholds there, not
in individual scripts.

### Release Gate Summary

| Gate | Trigger | Pass Criteria |
|---|---|---|
| **Smoke** | Push to `main` | k6 exit 0; global p95 < 1500ms; error < 2% |
| **Pilot** | RC tag | k6 exit 0; write_failures < 8/24; read p95 < 2000ms |
| **Concurrency** | RC tag (after pilot) | k6 exit 0; `concurrent_close_errors = 0`; no 5xx on post-PAID |
| **Growth** | Before GA; major infra change | k6 exit 0; write_failures < 16/48; read p95 < 1500ms |
| **Soak** | Weekly cron; before capacity change | k6 exit 0; `soak_late_failures < 5`; p95 degradation < 30% |
| **Baseline refresh** | Monthly | All per-endpoint thresholds pass; save baseline JSON |

**Hard stops (block any release regardless of other results):**
- `concurrent_close_errors > 0` — data integrity risk
- `http_req_failed rate > 5%` sustained during soak
- p95 > 2× baseline on any write endpoint
- Any 5xx on `POST /orders/:id/close` outside the idempotency dedup path

### Trend Alert Thresholds

| Delta vs baseline | Action |
|---|---|
| < 15% | No action |
| 15–29% | Warning in compare-runs.js output; note in release record |
| ≥ 30% | Block release; investigate before merging |
| Improved by > 20% | Verify not due to cache warmth or data volume difference; update baseline |

---

## 6 · Interpretation Guide

### Reading k6 Output

**Checks (✓ / ✗):** Individual request assertions. Many ✗ with low `http_req_failed` often
means edge-case assertions (e.g. empty ticket list check) — focus on threshold violations, not
raw check counts.

**`http_req_failed`:** Global network/HTTP error rate. 4xx and 5xx responses count as failures
unless k6 is configured otherwise. Spikes → check API logs for `401` (token expired), `403`
(branch mismatch), `400` (validation), or `5xx` (server errors).

**Tagged latency (`name:health` | `read` | `write`):** Use these to isolate the failing layer:
- Read p95 high + health p95 fine → Postgres (missing index, N+1, pool saturation) or heavy list payload
- Write p95 high + reads fine → Redis lock contention, transaction depth, or ticket poll latency
- Both high → API CPU saturation or Postgres connection exhaustion

**`pilot_write_failures` / `growth_write_failures`:** Count of order lifecycle iterations that
aborted mid-flow. Non-zero merits log inspection even if latency thresholds pass.

**`soak_early_failures` vs `soak_late_failures`:** The ratio matters more than the absolute
count. Late >> Early → resource leak.

### Signal → Diagnosis Mapping

| Observed | Likely Cause | Where to Look |
|---|---|---|
| Read p95 high, health fine | Prisma N+1 / full scan | `EXPLAIN ANALYZE` open-order list; `include` depth in OrderRepository |
| Write p95 high, reads fine | Redis lock contention or transaction depth | Redis `MONITOR`; Prisma slow query log; idempotency store TTL |
| `concurrent_close_errors > 0` | Idempotency lock bug or FSM gap | `payment-idempotency.integration-spec.ts`; Redis key TTL config |
| Health fails, app "works" | Staging infra unhealthy | Postgres/Redis health probes; `docker ps` |
| `soak_late_failures` >> early | Resource leak | API heap; `pg_stat_activity` idle connections; Redis `CLIENT LIST` |
| WS connect fails under load | Redis pub/sub saturation / handshake timeout | `websocket_authenticated_connections` Prometheus metric; Redis memory |
| Reports cold hit > 6s | Cache miss + slow aggregation | `REPORTS_DAILY_CACHE_TTL_MS`; `EXPLAIN` on reports daily query |
| p95 regressed > 20% vs baseline | Recent change introduced overhead | `git log --since` + profile the relevant controller/service |

### p95 vs p99

- **p95** is the release gate. It describes what 19/20 requests experience — the operating expectation for normal usage.
- **p99** is the degradation canary. If p99 drifts upward across runs while p95 holds, tail latency is growing before it bleeds into the gate metric. Act on p99 drift before it becomes a p95 violation.
- **Do not optimize for average.** The `avg` stat hides bimodal distributions — cache-hit (fast) vs cold-miss (slow) for reports, or warm connection vs cold start for orders.

### When to Escalate Immediately

- `concurrent_close_errors > 0` → block the release, this is a data-integrity risk
- Any 5xx during the concurrency test (not 4xx) → block
- `http_req_failed` > 5% sustained for more than 60s during soak → stop the test, investigate
- p95 > 2× baseline on any write endpoint → block
- `soak_late_failures / soak_early_failures` > 3× → resource leak, do not release
- Health endpoint `GET /health/ready` returning non-200 → staging infrastructure issue, fix before testing

### Likely Bottlenecks by Symptom

| k6 symptom | Postgres | Redis | API CPU | Network |
|---|---|---|---|---|
| Read p95 degrades under concurrent load | ✓ Pool saturation, N+1 | | ✓ JSON serialization | |
| Write p95 spikes on `close` | ✓ Transaction + stock deduction | ✓ Lock contention | | |
| Health p95 > 500ms | ✓ Connection timeout | | | ✓ Proxy |
| WS events delayed | | ✓ Pub/sub backlog | ✓ Event emission loop | |
| Report cold > 5s | ✓ Aggregation / full scan | ✓ Cache miss | | |

---

## 7 · CI Automation

See `.github/workflows/perf-gate.yml` for full configuration.

### Secrets Required

| Secret | Purpose |
|---|---|
| `STAGING_BASE_URL` | API base URL for staging environment |
| `STAGING_PERF_JWT` | Dedicated test staff JWT (all permissions) |
| `STAGING_PERF_BRANCH_ID` | Branch UUID for the dedicated perf-test branch |

The perf test user should be a dedicated staging account with a long-lived JWT, separate from
developer accounts. Rotate it independently of developer credentials.

### Cadence

| Suite | Automated? | Frequency |
|---|---|---|
| Smoke | Yes — CI | Every push to `main` |
| Pilot + Concurrency | Yes — CI | Every GitHub release tag |
| Growth | Manual trigger | Before GA; after major infra changes |
| Soak | Manual trigger | Weekly (add to weekly ops checklist) |
| Baseline refresh | Manual trigger | Monthly; after optimization work |
| WS (Artillery) | Manual | Pre-release WS checklist |

---

## 8 · WebSocket Manual Release Checklist

Because Artillery Socket.IO tests require a live WS server and cannot run headlessly in standard
CI without a full staging deployment, the following is a manual pre-RC checklist:

```
[ ] Connect 5 simultaneous clients to /ws with valid JWT — all authenticate
[ ] Each client emits joinBranch — no error events received
[ ] POST /branches/:id/orders via REST — all 5 clients receive order.created within 2s
[ ] Force-disconnect 1 client — reconnect within 3s — room re-joined on second connect
[ ] PATCH /kitchen/tickets/:id via REST — ticket.updated received by remaining clients
[ ] POST /orders/:id/close via REST — order.paid received by remaining clients
[ ] Run: artillery run ops/load/ws-artillery/ws-branch-join.yml — 0 failures, p95 < 500ms
[ ] Check Prometheus: websocket_authenticated_connections increments/decrements correctly
[ ] Check Redis CLIENT LIST — no lingering idle Socket.IO connections after all clients disconnect
```

---

## 9 · Quick Reference

### Run from repo root

```bash
# Smoke
npm run load:staging-smoke

# Pilot gate
npm run load:staging-pilot

# Full RC gate (pilot + concurrency)
./ops/load/run-suite.sh rc

# Benchmark baselines
./ops/load/run-suite.sh benchmark

# Compare current run vs baseline
node ops/load/compare-runs.js \
  --baseline ops/load/out/baseline-2026-03.json \
  --current  ops/load/out/pilot-2026-03-23.json \
  --threshold 20

# WS validation
artillery run ops/load/ws-artillery/ws-branch-join.yml
```

### Export for release record

```bash
mkdir -p ops/load/out
k6 run --summary-export=ops/load/out/pilot-$(date +%Y%m%d).json ops/load/staging-pilot.k6.js
```

Attach `summary.json` to the release record or link the GitHub Actions artifact.

---

*See also:*
- [`staging-performance-gate.md`](./staging-performance-gate.md) — pilot gate reference (thresholds + remediation hints)
- [`database-performance.md`](./database-performance.md) — Prisma, connection pooling, indexing
- [`capacity-analysis.md`](./capacity-analysis.md) — scale envelope and bottleneck forecast
