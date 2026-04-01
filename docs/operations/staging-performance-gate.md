# Staging performance gate (pilot)

Purpose: **objective** latency and reliability evidence before inviting paid pilot customers. Run in **staging** with data volume and hardware class close to the pilot deployment.

This is **pilot-scale** validation (tens of concurrent HTTP operations, modest sustained duration), not hyperscale load testing.

## 1. Load profile (proposal)

| Scenario | VUs | Duration | Behavior |
|----------|-----|----------|----------|
| `health_sustain` | 1 | 5 min | `GET /health/live` + `GET /health/ready` every ~2 s — proves liveness/readiness stay healthy under background traffic |
| `floor_staff` | 12 | 5 min | Floor + wait staff: `GET` tables, open orders list (`limit=80`), menu categories; ~1–3 s think time |
| `kitchen_bar` | 6 | 5 min | Expo: `GET` kitchen tickets (`station=KITCHEN`) + `GET` bar tickets; ~1–3 s think time |
| `report_pulse` | 2 | 5 min | Cashier/back-office: `GET` reports daily (optional; set `SKIP_REPORTS=1` if JWT lacks `reports.view`) |
| `order_writes` | 4 | up to ~8 min | Shared **24** full dine-in lifecycles: open session if needed → create order → add items (from seed menu) → confirm → send to prep → advance **all** prep tickets to `DELIVERED` → served → close bill (`CASH`, idempotent key). Starts after 10 s so reads warm the stack first |

**Concurrent load (rough):** ~21 HTTP-issuing VUs in steady state (1 + 12 + 6 + 2), plus up to 4 writers during the write phase — aligned with a small venue with several active tables, multiple handhelds, and kitchen/bar screens.

**Writes:** The harness creates real orders and payments in staging. Use a **dedicated branch/tenant** or accept seed DB growth; do not point at production.

## 2. Critical APIs and workflows under test

**Read hot paths**

- [`GET /api/v1/health/live`](../../apps/api/src/health.controller.ts), [`GET /api/v1/health/ready`](../../apps/api/src/health.controller.ts)
- [`GET /api/v1/branches/:branchId/tables`](../../apps/api/src/modules/tables/tables.controller.ts) — floor map
- [`GET /api/v1/branches/:branchId/orders`](../../apps/api/src/modules/orders/orders.controller.ts) — open orders
- [`GET /api/v1/branches/:branchId/menu/categories`](../../apps/api/src/modules/menu/menu.controller.ts) — menu cache / POS
- [`GET /api/v1/branches/:branchId/kitchen/tickets`](../../apps/api/src/modules/kitchen/kitchen.controller.ts), [`GET /api/v1/branches/:branchId/bar/tickets`](../../apps/api/src/modules/kitchen/kitchen.controller.ts) — expo queues
- [`GET /api/v1/branches/:branchId/reports/daily`](../../apps/api/src/modules/reports/reports.controller.ts) — end-of-shift style read (optional)

**Write hot paths (order_writes)**

- [`POST .../tables/sessions`](../../apps/api/src/modules/tables/tables.controller.ts) (when table has no session)
- [`POST .../orders`](../../apps/api/src/modules/orders/orders.controller.ts), [`POST .../orders/:id/items`](../../apps/api/src/modules/orders/orders.controller.ts)
- [`POST .../confirm`](../../apps/api/src/modules/orders/orders.controller.ts), [`POST .../send-to-preparation`](../../apps/api/src/modules/orders/orders.controller.ts)
- [`PATCH .../kitchen/tickets/:id`](../../apps/api/src/modules/kitchen/kitchen.controller.ts) and [`PATCH .../bar/tickets/:id`](../../apps/api/src/modules/kitchen/kitchen.controller.ts) — ticket state machine
- [`POST .../served`](../../apps/api/src/modules/orders/orders.controller.ts), [`POST .../close`](../../apps/api/src/modules/orders/orders.controller.ts) with `Idempotency-Key` — payment close path

**WebSocket / realtime**

- k6 exercises **HTTP only**. Realtime delivery (Socket.IO, Redis adapter, multi-replica fan-out) is covered by the functional checklist: [`staging-socket-io-checklist.md`](./staging-socket-io-checklist.md). Under load, still watch API CPU and Redis for symptoms of **emit backlog** or **connection churn** during the same window as this test.

## 3. Tooling and harness

| Script | Role |
|--------|------|
| [`ops/load/staging-pilot.k6.js`](../../ops/load/staging-pilot.k6.js) | **Primary** pilot gate — profile above |
| [`ops/load/staging-smoke.k6.js`](../../ops/load/staging-smoke.k6.js) | Short smoke (5 VUs, 2 min): health + kitchen + tables only |

See [`ops/load/README.md`](../../ops/load/README.md) for install (k6 binary or Docker), env vars, and report export.

## 4. Thresholds / pass–fail release gate

Defined in `staging-pilot.k6.js` (tune per deployment; document changes here when you change the script).

| Metric | Gate |
|--------|------|
| `http_req_failed` | &lt; **2%** |
| `http_req_duration{name:health}` p95 | &lt; **800 ms** |
| `http_req_duration{name:read}` p95 | &lt; **2000 ms** |
| `http_req_duration{name:write}` p95 | &lt; **5000 ms** (writes include many chained calls per iteration) |
| `pilot_write_failures` (counter) | &lt; **8** failed write iterations (out of 24) |

**Pass** = k6 exits **0** with no threshold violations.

**Quick smoke** (`staging-smoke.k6.js`): global `http_req_failed` &lt; 2%, `http_req_duration` p95 &lt; 1500 ms (stricter single bucket — appropriate for read-only short run).

## 5. How to run

Prerequisites: [k6](https://k6.io/docs/get-started/installation/) on PATH, or Docker (`grafana/k6`).

Set:

| Variable | Required | Description |
|----------|----------|-------------|
| `BASE_URL` | Yes | API origin, e.g. `https://staging-api.example.com` |
| `JWT` | Yes | Access token for a **staging** staff user |
| `BRANCH_ID` | Yes | Branch UUID for `X-Branch-Id` |
| `SKIP_WRITES` | No | `1` = read scenarios only (no order lifecycle) |
| `SKIP_REPORTS` | No | `1` = omit `GET reports/daily` (e.g. no `reports.view`) |
| `TABLE_LABEL` | No | Prefer this floor label when picking a table (default `T2`) |

From repo root:

```bash
export BASE_URL=https://staging.example.com
export JWT=eyJ...
export BRANCH_ID=clxxxxxxxx
k6 run ops/load/staging-pilot.k6.js
```

**Summary JSON (for tickets / release evidence):**

```bash
k6 run --summary-export=ops/load/out/summary.json ops/load/staging-pilot.k6.js
```

Add `ops/load/out/` to `.gitignore` for local exports; attach `summary.json` to the release record.

Root npm script (requires k6 on PATH):

```bash
npm run load:staging-pilot
```

## 6. How to interpret results

- **Checks (✓ / ✗):** Per-request checks in the k6 log show which endpoints returned expected status codes. Many failures here with low `http_req_failed` can mean assertions on edge cases (e.g. empty ticket list) — focus on **thresholds** for gate decisions.
- **http_req_failed:** Global error rate; investigate 4xx/5xx in the k6 log or API logs. Spikes often indicate auth (`401`), branch mismatch (`403`), or validation (`400`).
- **Tagged latency (`name:health` | `read` | `write`):** If **read** p95 is high while health is fine, suspect **Postgres** (pool, slow queries, missing indexes) or **heavy list endpoints**. If **write** p95 fails while reads pass, suspect **transactions**, **idempotency/Redis**, or **kitchen ticket** contention.
- **pilot_write_failures:** Counts iterations that aborted mid-flow (e.g. could not advance tickets). Non-zero merits log inspection even if latency thresholds pass.
- **Iterations completed:** For `order_writes`, compare completed iterations vs expected (24). Shortfall may indicate `maxDuration` cut-off or systematic failures.

## 7. Likely bottlenecks this test surfaces

- **Postgres:** Open-order listing, ticket listing with `include`, connection pool saturation (`too many clients` or Prisma queueing).
- **Redis:** Session/idempotency or Socket.IO adapter under concurrent writes; watch latency and error rate on Redis during the run.
- **CPU on API pods:** JSON serialization, validation, and logging volume under ~20+ parallel clients.
- **Write contention:** Multiple lifecycles opening sessions or competing for the same floor table — mitigated by spreading `VU`/`ITER` across tables; persistent `409` on `POST .../tables/sessions` suggests table contention or business rule limits.
- **Downstream not measured here:** Browser rendering, CDN, or third-party payments — out of scope for this harness.

## 8. If thresholds fail (remediation hints)

| Symptom | Direction |
|--------|-----------|
| High read p95, healthy DB metrics | Add indexes for branch-scoped lists; reduce `include` payload on hot routes; consider caching for menu snapshot |
| High write p95, DB at limit | Tune Prisma pool and Postgres `max_connections`; ensure PgBouncer if using many API replicas |
| `http_req_failed` spikes, 5xx | Check API logs for stack traces; scale API replicas; verify staging data/seed consistency |
| Redis timeouts | Verify `REDIS_URL`, memory/eviction, network; idempotency lock contention on `close` duplicates |
| Write failures, ticket advance | Ensure seed menu produces tickets on both stations when needed; verify JWT has `kitchen.view`, `bar.view`, `payments.close` |
| Health fails while app “works” | Staging dependency (DB/Redis) unhealthy — fix readiness probes or dependency SLOs first |

## 9. Cadence

- Before each pilot **release candidate** tag.
- After infra changes (DB size, API replicas, Redis, load balancer).

## 10. Recording results

Copy k6 stdout (or attach `summary.json`) into [`PILOT_RELEASE_GATE.md`](./PILOT_RELEASE_GATE.md) under “Staging load test”.
