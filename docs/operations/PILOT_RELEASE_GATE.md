# Strict pilot release gate (go / no-go)

**Canonical** paid-pilot checklist for RestoCafe OS. This is **not** a generic SaaS template: criteria tie to this repo’s modules, CI jobs, and ops docs.

**When to use:** immediately before turning on **paid pilot** for a venue (or promoting a release candidate to pilot production).

**Per-venue worksheet (identifiers + cross-walk to this table):** [`PILOT_CUTOVER_CHECKLIST.md`](./PILOT_CUTOVER_CHECKLIST.md).

**Evidence:** paste links, command output, dates, or ticket IDs in the **Evidence** columns—or attach artifacts (`summary.json`, CI run URL, signed UAT).

---

## 1. Blocking release gates

These must pass (or have a **signed, dated waiver** with named risk owner) before **Go**.

| # | Gate | Why (this codebase) | How to verify | Owner | Pass? | Evidence / notes |
|---|------|---------------------|---------------|-------|-------|------------------|
| B1 | **Distributed-safe idempotency** | Close-bill uses Redis-backed locks + idempotency keys; without `REDIS_URL`, behavior is not safe across multiple API instances ([`distributed-idempotency-design.md`](./distributed-idempotency-design.md), [`idempotency-and-offline.md`](./idempotency-and-offline.md)). | Pilot/staging/prod env has `REDIS_URL` set where multiple API processes exist. Run `npm run test:integration -w api` (includes idempotency paths with Redis). Staging: duplicate `POST .../close` with same `Idempotency-Key` does not double-charge. | Eng | | |
| B2 | **Socket.IO deployment mode decided** | Multi-replica **without** shared Redis breaks cross-node branch events; sticky sessions are insufficient ([`socket-io-scaling.md`](./socket-io-scaling.md)). | **Record one:** (a) **Single API replica** for pilot, *or* (b) **N replicas** with **identical `REDIS_URL`** on every pod and Redis adapter verified ([`staging-socket-io-checklist.md`](./staging-socket-io-checklist.md)). “Add Redis later” is **not** acceptable for (b). | Eng | | |
| B3 | **Health / readiness green** | Orchestrators and this repo expect **`GET /api/v1/health/live`** (liveness) and **`GET /api/v1/health/ready`** (dependency-aware readiness) ([`health.controller.ts`](../../apps/api/src/health.controller.ts)). Readiness returns `healthy`, `degraded`, or `not_ready` with DB/Redis detail. | From shell: [`deploy/scripts/pilot-environment-smoke.sh`](../../deploy/scripts/pilot-environment-smoke.sh) with `API_BASE_URL` pointing at pilot API (through TLS/proxy if that is how clients reach it). Production cutover requires `status=healthy`; `status=degraded` is a blocker unless an explicit waiver names the Redis/realtime risk. LB/probes match same paths. | Ops | | |
| B4 | **CI green on release candidate** | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) is the default quality gate: build, lint, unit tests, `npm audit --audit-level=critical`, Docker API image build, **`api-integration`**. | The commit (or merge) tagged for pilot has a **green** `CI` workflow run including **`api-integration`**. | Eng | | |
| B5 | **Integration tests green** | API integration suite uses Postgres + Redis (`test:integration`); catches branch/order/payment regressions not visible in unit tests alone. | Locally or in CI: `npm run test:integration -w api` with `DATABASE_URL` + `REDIS_URL` as in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). | Eng | | |
| B6 | **Playwright critical-path E2E green** | Dine-in → kitchen/bar → served → close is covered by [`apps/ops-web/e2e/critical-path-dine-in.spec.ts`](../../apps/ops-web/e2e/critical-path-dine-in.spec.ts); nightly runs in [`e2e-pilot.yml`](../../.github/workflows/e2e-pilot.yml). | `npm run test:e2e:critical -w ops-web` against a **staging-like** stack (API + ops-web + seeded DB), or attach green **`E2E Pilot`** workflow run that includes `test:e2e:critical`. | Eng | | |
| B7 | **Migrations reviewed** | Prisma migrations under [`apps/api/prisma/migrations/`](../../apps/api/prisma/migrations/) can be destructive; prod applies via `migrate deploy` ([`MIGRATIONS.md`](../database/MIGRATIONS.md)). | Named reviewer confirms migration set for this release; destructive steps called out; `npm run db:migrate:deploy -w api` plan for cutover documented. | Eng | | |
| B8 | **Backup of pilot environment exists** | Pilot DB holds real money-adjacent state; recovery procedure in [`backup-and-recovery.md`](./backup-and-recovery.md). | **Before cutover:** fresh backup (dump/snapshot) per org policy; record **timestamp**, **location**, **retention**. | Ops | | |
| B9 | **Restore drill status known** | RTO/RPO is unproven until a drill is completed or explicitly waived ([`staging-restore-drill-checklist.md`](./staging-restore-drill-checklist.md)). | State one: **Completed** (date + checklist link) / **Scheduled** (date) / **Exception** (risk owner + mitigation). Optional smoke: [`restore-drill-smoke.sh`](../../deploy/scripts/restore-drill-smoke.sh). | Ops | | |
| B10 | **Observability hooked up** | Logs (Pino), metrics (`METRICS_ENABLED`), health, support diagnostics ([`OBSERVABILITY.md`](./OBSERVABILITY.md)). | Pilot env: log shipping live; `METRICS_ENABLED=true` and scraper reach **`GET /api/v1/internal/metrics`** on internal network; `APP_VERSION` / `GIT_SHA` set on deploy; alerts or on-call path documented. | Ops | | |
| B11 | **Secrets, TLS, reverse proxy** | JWT, DB, `REDIS_URL`, `CORS_ORIGIN`, `TRUST_PROXY` for TLS termination ([`secrets-management.md`](./secrets-management.md), [`DEPLOYMENT_DEVOPS.md`](./DEPLOYMENT_DEVOPS.md), [`restocafe.conf.example`](../../deploy/nginx/restocafe.conf.example)). | No secrets in git; strong `JWT_*`; HTTPS at edge; `TRUST_PROXY=true` when behind proxy; CORS matches ops-web origin. | Eng/Ops | | |
| B12 | **Support / on-call owner** | Incidents need a named owner; optional [`/api/v1/support/diagnostics`](./OBSERVABILITY.md) with `SUPPORT_API_KEY`. | Name + contact method (rotation link or phone); runbook pointer (`OBSERVABILITY.md` §5 triage). | Ops | | |
| B13 | **Pilot rollback plan** | App rollback is image redeploy; DB may not roll back ([`DEPLOYMENT_DEVOPS.md`](./DEPLOYMENT_DEVOPS.md) §4). | Document **previous good API image tag** (and ops-web artifact if applicable); communication template; when to restore DB from backup vs redeploy only. | Eng/Ops | | |
| B14 | **Venue UAT complete** | Automation does not replace real floor/menu/staff ([`QA_STRATEGY.md`](../qa/QA_STRATEGY.md) §5). | UAT checklist signed: **manager name**, **date**, **branch id** (same doc section). | Pilot | | |
| B15 | **Printer / network caveats acknowledged** | No printer drivers ship in this repo; ops-web depends on network/browser ([`offline-queue.test.ts`](../../apps/ops-web/src/lib/offline-queue.test.ts)). | Written acknowledgment: receipt/printer expectations, Wi‑Fi/LAN stability, devices used, behavior on **network blip** (QA_STRATEGY edge cases). | Pilot | | |
| B16 | **Staging load test** | Pilot-scale HTTP validation ([`staging-pilot.k6.js`](../../ops/load/staging-pilot.k6.js), [`staging-performance-gate.md`](./staging-performance-gate.md)). | k6 thresholds pass; attach `summary.json` or stdout. **Waiver** only with product + eng sign-off. | Eng | | |
| B17 | **No blocking incidents** | SEV1/2 on orders/payments blocks go-live. | Confirm no open org-wide incidents in scope for this pilot. | All | | |

---

## 2. Non-blocking warnings (address or accept risk)

| # | Warning | Notes |
|---|---------|--------|
| W1 | **`npm audit`** only fails on **critical** in CI | Moderate/low CVE backlog may still exist; track separately. |
| W2 | **Full Playwright pilot** (`test:e2e:pilot`) vs **critical** | [`e2e-pilot.yml`](../../.github/workflows/e2e-pilot.yml) runs both; PR CI does not. Prefer full pilot green on schedule before cutover; if flaky, rerun and capture passing run. |
| W3 | **Nightly E2E** | Intermittent failures: retry once; if persistent, file bug before ignoring. |
| W4 | **k6 not run on every commit** | Load test is gate **B16**, not per-PR CI. |

---

## 3. Pre-pilot checklist (ordered)

Use in the days before cutover.

- [ ] Staging matches pilot topology (single vs multi API, `REDIS_URL`, TLS).
- [ ] DNS and TLS certificates valid for ops-web and API hostnames.
- [ ] Secrets injected via host/env or secret manager (not copied from dev laptops).
- [ ] Pilot branch seeded: menu, floor, staff roles per [`QA_STRATEGY.md`](../qa/QA_STRATEGY.md).
- [ ] `npm run ci` (root [`package.json`](../../package.json)) green locally on release candidate.
- [ ] `npm run test:integration -w api` green.
- [ ] `npm run test:e2e:critical -w ops-web` green against candidate stack.
- [ ] Review Prisma migrations and assign deploy order ([`MIGRATIONS.md`](../database/MIGRATIONS.md)).
- [ ] Confirm backup job and last successful backup time.
- [ ] Print or bookmark: triage section in [`OBSERVABILITY.md`](./OBSERVABILITY.md), rollback §4 in [`DEPLOYMENT_DEVOPS.md`](./DEPLOYMENT_DEVOPS.md).

---

## 4. Day-of-cutover checklist

- [ ] Communicate maintenance window if any breaking migration.
- [ ] Take **final backup** (B8) after quiet period or as policy dictates.
- [ ] Run **`npm run db:migrate:deploy -w api`** (or equivalent job) **once**, then roll out API container(s).
- [ ] Deploy **ops-web** static assets / image with correct `VITE_API_URL`.
- [ ] Run [`pilot-environment-smoke.sh`](../../deploy/scripts/pilot-environment-smoke.sh) against **public** URL (TLS + proxy path).
- [ ] Smoke: login → open table → order → kitchen/bar visibility → serve → pay/close (matches critical E2E).
- [ ] If multi-replica: quick Socket.IO check per [`staging-socket-io-checklist.md`](./staging-socket-io-checklist.md).
- [ ] Record deployed **`APP_VERSION` / `GIT_SHA`** in ticket.

---

## 5. Rollback checklist

- [ ] **Application:** redeploy previous **API** image tag; redeploy previous **ops-web** build if frontend changed ([`DEPLOYMENT_DEVOPS.md`](./DEPLOYMENT_DEVOPS.md) §4).
- [ ] **Database:** new migrations may be **irreversible**—do **not** “rollback app only” and assume DB matches; restore from **B8** backup if schema/data incompatible with previous code.
- [ ] **Config:** revert env (CORS, secrets) together with image rollback.
- [ ] **Communicate** pilot venue and internal stakeholders.
- [ ] Post-mortem if rollback was customer-visible.

---

## 6. Week-1 pilot monitoring checklist

**Daily (first 7 days)**

- [ ] Error rate / 5xx from logs or Prometheus (`http_requests_total`, `http_unhandled_errors_total`).
- [ ] `/api/v1/health/live` and `/ready` green from external or synthetic probe.
- [ ] Business signal: `restocafe_business_events_total` for `order_paid` non-zero during service hours (if metrics enabled).
- [ ] `websocket_authenticated_connections` plausible vs staff usage.
- [ ] Search logs for `slow_request`, Redis/idempotency errors, `http_exception` on payment routes.

**Weekly**

- [ ] Backup succeeded; spot-check restore procedure still documented.
- [ ] Review `AuditLog`-related disputes or close-bill anomalies.

---

## Staging load test (last run)

- Date:
- Command: `k6 run --summary-export=ops/load/out/summary.json ops/load/staging-pilot.k6.js`
- Outcome (pass/fail):
- Notes:

---

## Final decision

- **Go** — Signed: _________________  Date: _______
- **No-go** — Blockers: _________________
