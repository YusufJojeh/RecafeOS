# Final operational readiness report — RestoCafe OS (Pilot Execution Package)

This report is derived from the codebase and [docs/operations](./) as of the current tree. It does **not** assume your staging/prod stacks are green; it assesses **readiness of the package** (product + docs + operator workflows).

---

## 1. Onboarding readiness status

**Verdict: Partially ready — strong API/script path, weak self-serve scale.**

**What exists**

- Support provisioning: `POST /api/v1/support/tenants/provision` with scripted wrapper [`deploy/scripts/provision-pilot-tenant.mjs`](../../deploy/scripts/provision-pilot-tenant.mjs); documented in [ONBOARDING_PROVISION.md](./ONBOARDING_PROVISION.md).
- Staff journey: `/login` → branch → `/setup` with a real **blocking vs recommended** onboarding model backed by [`apps/api/src/modules/branches/branches.service.ts`](../../apps/api/src/modules/branches/branches.service.ts) (`readyForGoLive`, steps for `APP_PUBLIC_URL`, menu, tables, QR settings, smoke payment).
- Same-day runbook: [ONE_DAY_PILOT_RUNBOOK.md](./ONE_DAY_PILOT_RUNBOOK.md).

**Hard weaknesses (not sugar-coated)**

- **No staff invite / self-serve signup** in v1; additional users are a process workaround ([ONBOARDING_DEFERRED.md](./ONBOARDING_DEFERRED.md)). Multi-staff venues increase support burden or unsafe credential sharing.
- **No bulk menu import**; large menus are manual CRUD or awkward workarounds.
- **Credential handoff is manual** (generated password once or chosen on a call); security/process is on the operator.
- **`APP_PUBLIC_URL`** is a deployment/config prerequisite; if wrong, guest QR fails — the UI warns, but there is no “one-click fix” for the venue.
- Docs note provision script **does not implement `--help`** ([ONBOARDING_PROVISION.md](./ONBOARDING_PROVISION.md)) — small but real friction for occasional operators.

---

## 2. Internal support / admin readiness status

**Verdict: Capable for engineers / trained ops; not a polished “admin product.”**

**What exists**

- Broad `/api/v1/support/*` surface: lookup, summary, branches, onboarding (support), orders, audit log, diagnostics, commerce/suspend/reactivate, pilot portfolio, weekly report, pilot feedback CRUD, weekly snapshot upsert — see [SUPPORT_TOOLING.md](./SUPPORT_TOOLING.md) and [`apps/api/src/modules/support/support.controller.ts`](../../apps/api/src/modules/support/support.controller.ts).
- Optional **ops-web internal console** behind `VITE_SUPPORT_CONSOLE=true` — routes `/internal/support`, `/internal/pilots`, etc. ([INTERNAL_SUPPORT_CONSOLE.md](./INTERNAL_SUPPORT_CONSOLE.md)); keys in **sessionStorage** (paste per session).
- Optional **read/write key split** (`SUPPORT_API_KEY_READ` / `SUPPORT_API_KEY_WRITE`).

**Hard weaknesses**

- **Commerce and metadata PATCH** are explicitly **not** in the fat-finger-safe console UI — operators use Swagger/REST client ([INTERNAL_SUPPORT_CONSOLE.md](./INTERNAL_SUPPORT_CONSOLE.md)). Commercial moves stay high-risk for mistakes.
- **No IdP / SSO for operators** — shared support keys remain the trust boundary (“future” in docs).
- **Per-tenant HTTP error stream is not in the API** — triage depends on log pipeline discipline ([SUPPORT_TOOLING.md](./SUPPORT_TOOLING.md) gaps).

---

## 3. Demo environment readiness status

**Verdict: Documented and implementable; safety depends on ops discipline.**

**What exists**

- Clear **demo vs pilot** rules: separate DBs, `Tenant.metadata.demo === true`, `reset-demo` API, audit — [DEMO_AND_PILOT_ENVIRONMENT.md](./DEMO_AND_PILOT_ENVIRONMENT.md), [DEMO_TENANT.md](./DEMO_TENANT.md).
- Scripts: [`deploy/scripts/provision-pilot-tenant.mjs`](../../deploy/scripts/provision-pilot-tenant.mjs), [`deploy/scripts/demo-reset-smoke.sh`](../../deploy/scripts/demo-reset-smoke.sh), [`deploy/scripts/pilot-environment-smoke.sh`](../../deploy/scripts/pilot-environment-smoke.sh).

**Hard weaknesses**

- **Isolation is environmental** (you must actually deploy separate stacks/DBs). Wrong URL or wrong tenant = real damage or wrong runbook.
- **Reset does not reset menu/layout/users** — full “greenfield demo” may need re-provision.
- **Pre-demo checklist is manual** (health, `APP_PUBLIC_URL`, optional smoke order).

---

## 4. Commercial lifecycle / control readiness status

**Verdict: Billing state is real; “pilot” is mostly a label.**

**What exists**

- Clear model: **`billingStatus` / trial / plan limits** are enforcement; `commercialEngagement: pilot` is **metadata for CS**, not a second state machine ([COMMERCIAL_LIFECYCLE.md](./COMMERCIAL_LIFECYCLE.md), [PILOT_METADATA_SCHEMA.md](./PILOT_METADATA_SCHEMA.md)).
- Suspend/reactivate with `previousBillingStatus`, close account paths; trial expiry job **`POST .../jobs/expire-trials`** ([COMMERCIAL_LIFECYCLE.md](./COMMERCIAL_LIFECYCLE.md)).

**Hard weaknesses**

- **Pilot vs production is not automatically enforced** — mis-set metadata does not block features; governance is procedural.
- **Trial expiry requires external scheduling** (cron/K8s CronJob) — if unscheduled, trials behave inconsistently with policy ([DEMO_AND_PILOT_ENVIRONMENT.md](./DEMO_AND_PILOT_ENVIRONMENT.md) §7).
- **No integrated billing provider narrative in-repo** for this report — commercial “control” is support API + jobs, not full subscription automation unless you wired that outside the repo.

---

## 5. Venue installation readiness status

**Verdict: Runbooks exist; real-world cutover is still mostly outside the software.**

**What exists**

- [VENUE_INSTALLATION_CUTOVER.md](./VENUE_INSTALLATION_CUTOVER.md), [PILOT_CUTOVER_CHECKLIST.md](./PILOT_CUTOVER_CHECKLIST.md), Wi‑Fi / device / fallback thinking tied to [PILOT_RELEASE_GATE.md](./PILOT_RELEASE_GATE.md) (Redis, Socket.IO, health).

**Hard weaknesses (explicitly acknowledged in docs)**

- **No ESC/POS driver in repo** — printing is browser/OS/vendor territory.
- **Cash / structured shift** called out as not fully wired — operational workaround required ([VENUE_INSTALLATION_CUTOVER.md](./VENUE_INSTALLATION_CUTOVER.md) cross-refs `SetupPage`).
- **UAT and printer/network caveats** are human signoffs (B14/B15 in release gate), not automated proof.

---

## 6. Support diagnostics readiness status

**Verdict: Good correlation story (`x-request-id` + support GETs); weak without observability stack.**

**What exists**

- End-to-end workflow: [SUPPORT_DIAGNOSTICS_WORKFLOW.md](./SUPPORT_DIAGNOSTICS_WORKFLOW.md); diagnostics matrix by symptom; `GET /api/v1/support/diagnostics` for version/gitSha/db ([`apps/api/src/modules/support/support.service.ts`](../../apps/api/src/modules/support/support.service.ts)).
- First-line intake: [SUPPORT_INCIDENT_TRIAGE.md](./SUPPORT_INCIDENT_TRIAGE.md).

**Hard weaknesses**

- **No per-tenant error feed in API** — if log search is slow or missing, diagnostics stall ([SUPPORT_TOOLING.md](./SUPPORT_TOOLING.md)).
- **Socket.IO / multi-replica** issues require correct Redis deployment — documented as a common failure mode ([PILOT_RELEASE_GATE.md](./PILOT_RELEASE_GATE.md) B2, [socket-io-scaling.md](./socket-io-scaling.md)).

---

## 7. Pilot tracking and feedback readiness status

**Verdict: Data model and APIs exist; value depends on weekly process compliance.**

**What exists**

- **Prisma:** `PilotFeedbackItem`, `PilotWeeklySnapshot` ([`apps/api/prisma/schema.prisma`](../../apps/api/prisma/schema.prisma)).
- **Support APIs:** portfolio, weekly report, feedback CRUD, snapshot upsert ([SUPPORT_TOOLING.md](./SUPPORT_TOOLING.md)).
- **Automation helper:** [`deploy/scripts/pilot-weekly-snapshot.mjs`](../../deploy/scripts/pilot-weekly-snapshot.mjs) (JSON/Markdown, optional Slack webhook).
- **Process docs:** [PILOT_WEEKLY_REVIEW.md](./PILOT_WEEKLY_REVIEW.md), [PILOT_FEEDBACK_TAXONOMY.md](./PILOT_FEEDBACK_TAXONOMY.md), [PILOT_SUCCESS_CRITERIA.md](./PILOT_SUCCESS_CRITERIA.md).
- **Ops-web:** pilot portfolio/weekly/detail routes when support console flag is on ([INTERNAL_SUPPORT_CONSOLE.md](./INTERNAL_SUPPORT_CONSOLE.md)).

**Hard weaknesses**

- **Health rubric fields** (`pilotHealth`, `venueStatus`, etc.) require humans to **set and maintain** metadata consistently — nothing “auto-green” without discipline.
- **Weekly review** is a meeting cadence, not a daemon — absence of the meeting = blind spots.
- Report template still references pulling analytics for some signals ([PILOT_OPERATIONS_REPORT_TEMPLATE.md](./PILOT_OPERATIONS_REPORT_TEMPLATE.md) §5) — operator must know which sources are authoritative.

---

## 8. Remaining operational bottlenecks

| Bottleneck | Why it hurts |
|------------|--------------|
| **Deferred onboarding (invites, CSV menu)** | Every multi-user or large-menu venue costs more support time. |
| **Support key + curl/Swagger for commerce** | Faster mistakes; training burden. |
| **Logs required for deep triage** | Without a strong observability contract, first-line cannot close incidents quickly. |
| **Infrastructure gates (Redis, Socket.IO, backups)** | Documented as blocking in [PILOT_RELEASE_GATE.md](./PILOT_RELEASE_GATE.md); skipping them creates incident debt. |
| **Human UAT / venue signoff** | Cannot be automated; schedule-bound. |
| **“Pilot” as metadata** | Reporting and gating need CS discipline; easy to drift. |

---

## 9. What still depends on manual discipline

- **Correct environment URLs** (`API_BASE_URL`, ops-web `VITE_API_URL`, `APP_PUBLIC_URL`) per deployment.
- **Support key custody**, rotation, and optional read/write split.
- **Pasting support keys** into internal console sessionStorage — no SSO.
- **Weekly pilot review**, taxonomy triage, and metadata updates (`csOwner`, `pilotPhase`, health colors).
- **Demo**: confirm demo stack + `demo` flag before `reset-demo`.
- **Scheduled jobs**: trial expiry (and any other cron) against the **right** API base URL.
- **Release gate evidence**: CI green, integration tests, k6, backups, restore drill — all attested by humans attaching proof.
- **Commercial actions**: PATCH commerce/metadata with correct intent — no automatic “pilot playbook” wizard in product.

---

## 10. Go / no-go recommendation — next paid pilot with **lower support burden**

**Recommendation: Conditional go — not “low touch” yet.**

- **Go** only if **all** are true:
  - **Single branch (or very small scope)**, patient owner, acceptable to share one login short-term **or** you accept manual user-creation work if you add a support-only path out-of-band.
  - **[PILOT_RELEASE_GATE.md](./PILOT_RELEASE_GATE.md) satisfied or waivers are explicit**, including Redis/idempotency, Socket.IO topology, backups, observability.
  - **Named on-call** and log/metrics access for support ([PILOT_RELEASE_GATE.md](./PILOT_RELEASE_GATE.md) B12, B10).
  - **Demo stack isolated** from pilot; operators trained on support console + triage docs.

- **No-go (or re-scope)** if you expect:
  - **Multiple branches / large staff** without invite flows,
  - **Large menu migration** without ops capacity for manual entry,
  - **Minimal engineering/support staffing** — the package reduces chaos but does **not** remove the need for skilled responders,
  - **Unproven infra** (no Redis in multi-instance, flaky realtime, no backup story).

**Bottom line:** The Pilot Execution Package makes a **second paid pilot** *operationally repeatable* if you keep scope narrow and staff the workflows. It does **not** justify promising a **lower-support** pilot on its own — several high-friction items remain **intentionally deferred** ([ONBOARDING_DEFERRED.md](./ONBOARDING_DEFERRED.md)), and governance is still **key-based and procedural**.

---

### Reference map (for auditors)

- Index: [PILOT_OPERATIONS_INDEX.md](./PILOT_OPERATIONS_INDEX.md)
- Metadata contract: [PILOT_METADATA_SCHEMA.md](./PILOT_METADATA_SCHEMA.md)
