# Demo and pilot environment strategy

Disciplined separation between **sales/training demos** and **paid pilots**. Technical behavior is implemented in the API ([`resetDemoBranch`](../../apps/api/src/provisioning/provisioning.service.ts), tenant `metadata.demo`); this document is the operational contract.

**Related:** [DEMO_TENANT.md](./DEMO_TENANT.md) (tagging and reset API), [PILOT_RELEASE_GATE.md](./PILOT_RELEASE_GATE.md) (paid pilot only), [PILOT_CUTOVER_CHECKLIST.md](./PILOT_CUTOVER_CHECKLIST.md), [SUPPORT_TOOLING.md](./SUPPORT_TOOLING.md), [ONBOARDING_DEFERRED.md](./ONBOARDING_DEFERRED.md), [DEMO_SALES_EXECUTION_PACKAGE.md](./DEMO_SALES_EXECUTION_PACKAGE.md) (demo order, objections, pilot handoff).

---

## 1. Demo environment model

| Layer | Rule |
|-------|------|
| **Stack** | Separate Postgres + API + ops-web per purpose (e.g. `demo-sales` vs `pilot-acme`). **No shared database** between demo and paying pilots. |
| **Tenant** | `Tenant.metadata.demo === true` **only** for demo/training. Paid pilots omit `demo` or keep it false; use CS keys (`pilotPhase`, etc.) per [PILOT_METADATA_SCHEMA.md](./PILOT_METADATA_SCHEMA.md). |
| **Branch** | Prefer one primary branch per demo (`main`) for scripts and URLs. |
| **Lifecycle** | Create (provision) → use (presentations) → reset (transactional wipe) → retire (suspend tenant or tear down stack). |

---

## 2. Seeding and reset strategy

**Seeding**

- `POST /api/v1/support/tenants/provision` with sample menu + tables; then `PATCH .../metadata` with `{ "demo": true }` if not set at provision time.
- Script: [`deploy/scripts/provision-pilot-tenant.mjs`](../../deploy/scripts/provision-pilot-tenant.mjs) against the **demo** `API_BASE_URL`.
- Roles and owner user come from provisioning helpers (see [ONBOARDING_PROVISION.md](./ONBOARDING_PROVISION.md)).

**Reset**

- `POST /api/v1/support/tenants/:tenantId/reset-demo` removes orders, sessions, stock movements, visits, shifts, waiter calls for the branch; **keeps** menu, tables, staff.
- Audit: `support.reset_demo` with counts.
- Non-demo tenants require `acknowledgeProductionReset: true` (see [DEMO_TENANT.md](./DEMO_TENANT.md)).

**Cannot reset via this API:** menu catalog, floor table layout, users—use ops-web or a new provision for a greenfield demo tenant.

---

## 3. Demo vs pilot separation rules

| Rule | Why |
|------|-----|
| Different **databases** for demo vs any paying pilot | Hard isolation. |
| **Never** set `metadata.demo` on a paying customer | Avoids frictionless reset and wrong runbooks. |
| Pilots follow **PILOT_RELEASE_GATE** + cutover checklist; demos follow quick smoke only | Infra gates are not for slide decks. |
| Support API is global per environment—**only call URLs** for the intended stack ([SUPPORT_TOOLING.md](./SUPPORT_TOOLING.md)). |
| Guest QR URL changes = new **table session**, not an environment switch | Same product rules everywhere. |

---

## 4. Scripts and admin tools

| Tool | Use |
|------|-----|
| `provision-pilot-tenant.mjs` | Seed or re-seed a demo tenant on a target API. |
| Support console (`VITE_SUPPORT_CONSOLE=true`, `/internal/support`) | Lookup, branches, onboarding, reset-demo, audit ([INTERNAL_SUPPORT_CONSOLE.md](./INTERNAL_SUPPORT_CONSOLE.md)). |
| `demo-reset-smoke.sh` | Optional: health + reset in one shot ([deploy/scripts/demo-reset-smoke.sh](../../deploy/scripts/demo-reset-smoke.sh)). |
| `pilot-environment-smoke.sh` | Health only; point `API_BASE_URL` at demo API when checking demo stack. |

---

## 5. Support playbook: recover demo before a presentation

1. Confirm browser/API URL is the **demo** host, not a pilot.
2. Resolve `tenantId` / `branchId` (lookup by slug or support summary + branches).
3. Confirm `metadata.demo === true`; if missing, patch metadata (audited) before relying on reset without ack.
4. `POST .../reset-demo` with `branchId` (no ack when demo-tagged).
5. Smoke: Floor → session → small order → pay; or guest menu if `APP_PUBLIC_URL` is set.
6. If still failing: `/support/diagnostics`, logs/metrics ([OBSERVABILITY.md](./OBSERVABILITY.md)); do **not** reset pilot tenants without approval.

Verify `support.reset_demo` in `GET .../audit-log?actionPrefix=support.`.

---

## 6. Demo smoke checks (before a scheduled demo)

Follow [DEMO_SALES_EXECUTION_PACKAGE.md](./DEMO_SALES_EXECUTION_PACKAGE.md) §1 for **presentation order** (Setup → floor → QR optional → kitchen/bar → close → reports) after infra smoke passes.

- [ ] `GET /api/v1/health/live` and `/health/ready` (or `demo-reset-smoke.sh` / `pilot:env-smoke` against demo URL).
- [ ] `APP_PUBLIC_URL` set if QR story is live ([onboarding checklist](../../apps/api/src/modules/branches/branches.service.ts)).
- [ ] Optional: one paid smoke order on the demo branch.
- [ ] Staff can log in (trial/commerce not blocking).

**Not required for demo:** full [PILOT_RELEASE_GATE.md](./PILOT_RELEASE_GATE.md).

---

## 7. Trial expiry job (commercial)

- **Endpoint:** `POST /api/v1/support/jobs/expire-trials` with header `x-support-api-key`.
- **Schedule:** Run daily (or hourly) via external cron, Kubernetes `CronJob`, or cloud scheduler against the **correct** API base URL for that environment.
- **Effect:** Tenants still `trialing` with `trialEndsAt` in the past are set to `suspended`; metadata records `trialExpiredAt` and block reason for support visibility. Details: [COMMERCIAL_LIFECYCLE.md](./COMMERCIAL_LIFECYCLE.md).
- **Scripts / K8s:** [expire-trials-job.sh](../../deploy/scripts/expire-trials-job.sh), [cronjob-expire-trials.example.yaml](../../deploy/k8s/cronjob-expire-trials.example.yaml). Full rollout: [COMMERCIAL_ROLLOUT.md](./COMMERCIAL_ROLLOUT.md).

---

## 8. Implementation checklist (ongoing)

- [ ] **Naming:** e.g. tenant slug prefix `demo-` for sales tenants (team convention).
- [ ] **Runbook:** “Before sales call: confirm demo URL → reset-demo → 2-minute smoke → [DEMO_SALES_EXECUTION_PACKAGE.md](./DEMO_SALES_EXECUTION_PACKAGE.md) §1 live sequence.”
- [ ] **Stacks:** separate `DATABASE_URL` per demo vs pilot in deployment config.
- [ ] **Training:** support team reads [DEMO_TENANT.md](./DEMO_TENANT.md) and this doc before using reset in production-adjacent environments.

---

## Summary

**Speed:** provision + `demo` tag + `reset-demo` + short smoke.

**Safety:** isolate pilots at the **database** level; never tag paying tenants as demo; destructive reset is **audited** and gated for non-demo tenants.
