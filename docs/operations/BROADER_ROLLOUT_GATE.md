# Broader rollout gate (beyond pilot)

**Purpose:** Defines the concrete pass/fail criteria for expanding RestoCafe OS beyond 1-5 pilot venues. This gate supplements `PILOT_RELEASE_GATE.md` — all pilot gates must already be passed.

**When to use:** Before onboarding the 6th venue, moving to a second geographic region, or marketing the product to new customers.

---

## 1. Blocking conditions (must ALL pass)

| # | Gate | How to verify | Evidence |
|---|------|---------------|----------|
| S1 | **Explicit DB pool limit** | `DATABASE_URL` contains `connection_limit=N` where `(N x API replicas) < 70%` of `max_connections`. | Env var screenshot or config dump. |
| S2 | **Redis required for idempotency** | `IDEMPOTENCY_REQUIRE_REDIS=true` in production env. API crashes on startup without `REDIS_URL`. | Env var + failed startup log without Redis. |
| S3 | **Prometheus metrics enabled** | `METRICS_ENABLED=true` in production. `/api/v1/internal/metrics` returns Prometheus text. | `curl` output from production internal network. |
| S4 | **Critical indexes applied** | `OrderItem_orderId_menuItemId_idx` and `Payment_createdAt_idx` exist. | `\di` output from `psql` or Prisma migration status. |
| S5 | **Staging load test passed** | k6 pilot suite (`staging-pilot.k6.js`) passes all thresholds on staging with production-like data volume. | `summary.json` artifact with timestamp. |
| S6 | **Concurrency test passed** | k6 concurrency suite (`concurrency-payments.k6.js`) — zero 5xx, exactly 1 payment per order. | `summary.json` artifact. |
| S7 | **Baseline captured** | Benchmark baselines (`benchmark-baselines.k6.js`) committed to `ops/load/out/` with date. | Git commit hash + file listing. |
| S8 | **Grafana/alerting dashboard** | At minimum: HTTP error rate, p95 latency, WebSocket connections, business events (`order_paid`). | Dashboard URL or screenshot. |
| S9 | **Redis adapter for Socket.IO** | If running >1 API replica: Redis adapter configured and verified per `staging-socket-io-checklist.md`. | Socket.IO checklist completed. |
| S10 | **Perf-gate CI active** | `.github/workflows/perf-gate.yml` runs smoke on push to main; RC gate runs on release. Secrets configured. | Green CI run URL for most recent release. |

---

## 2. Warning conditions (address or accept with named risk owner)

| # | Warning | Notes |
|---|---------|-------|
| W1 | **AuditLog unbounded growth** | No retention policy applied. At 10 venues, audit table grows ~500K rows/month. Set `AUDIT_LOG_RETENTION_DAYS`. |
| W2 | **AnalyticsEvent unbounded growth** | Similar to AuditLog. Consider retention or partitioning above 10M rows. |
| W3 | **PgBouncer not deployed** | At 3+ API replicas or 10+ venues, connection pool pressure may exceed Postgres `max_connections`. |
| W4 | **No read replica** | Report queries (daily settlement, tenant rollup) compete with OLTP at >15 concurrent branches. |
| W5 | **Soak test not run** | `soak-sustained.k6.js` (35 min) validates memory leaks and connection exhaustion under sustained load. |
| W6 | **Growth test not run** | `growth-scale.k6.js` (45 VUs, 12 min) validates behavior under expansion-phase traffic. |

---

## 3. Decision rule

**Broader rollout is approved when:**
- All 10 blocking gates (S1-S10) have evidence in this document.
- Each warning (W1-W6) is either resolved or has a named risk owner + mitigation plan.
- Sign-off from engineering lead and product owner.

**Broader rollout is blocked when:**
- Any S-gate lacks evidence.
- Any warning is unaddressed without a named owner.

---

## 4. Required evidence list

Attach or link each item before requesting sign-off:

- [ ] S1: DATABASE_URL with `connection_limit` — env config screenshot
- [ ] S2: `IDEMPOTENCY_REQUIRE_REDIS=true` — env config + crash log proof
- [ ] S3: `METRICS_ENABLED=true` — curl `/api/v1/internal/metrics` output
- [ ] S4: Index verification — `psql \di` or migration status
- [ ] S5: Pilot load test — `ops/load/out/staging-pilot-summary.json`
- [ ] S6: Concurrency test — `ops/load/out/concurrency-summary.json`
- [ ] S7: Baseline commit — git hash
- [ ] S8: Dashboard URL
- [ ] S9: Socket.IO checklist (if multi-replica)
- [ ] S10: Green perf-gate CI URL

---

## 5. Scaling thresholds reference

| Metric | Safe envelope | Action required above |
|--------|--------------|----------------------|
| Active branches | 1-10 | Monitor query latency; consider read replica |
| Socket.IO connections | <400 per replica | Add replicas + Redis adapter |
| API replicas | 1-3 | PgBouncer at 3+; review pool sizing |
| AuditLog rows | <5M | Enable retention (`AUDIT_LOG_RETENTION_DAYS=90`) |
| Orders/day | <2000 | Monitor close-bill p95; review stock lock contention |
| Postgres connections | <70% max_connections | PgBouncer mandatory |

---

## Sign-off

- **Go** — Engineering: _________________  Product: _________________  Date: _______
- **No-go** — Blockers: _________________
