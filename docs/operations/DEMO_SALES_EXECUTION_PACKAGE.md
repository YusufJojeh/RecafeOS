# RestoCafe OS — sales / demo execution package (paid pilot conversion)

Disciplined structure for **live demos** and **paid pilot conversations** with restaurant or cafe operators. No marketing fluff—aligned with this repo’s product and ops runbooks.

**Grounding:** Staff UX lives in [`apps/ops-web`](../../apps/ops-web) (`/floor`, `/kitchen`, `/bar`, `/setup`, `/menu`, `/reports`). Guest ordering depends on API `APP_PUBLIC_URL` and branch QR settings (see onboarding steps in [`branches.service.ts`](../../apps/api/src/modules/branches/branches.service.ts)). Deployment is **VPS or customer-controlled cloud**, not serverless-only ([`DEPLOYMENT_DEVOPS.md`](./DEPLOYMENT_DEVOPS.md)). Venue caveats include **no in-repo thermal driver** and **cash/shift not fully productized** ([`VENUE_INSTALLATION_CUTOVER.md`](./VENUE_INSTALLATION_CUTOVER.md)). Pilots require engineering and venue gates ([`PILOT_RELEASE_GATE.md`](./PILOT_RELEASE_GATE.md)).

**Commercial alignment:** Adjust any SLA, hosting, and pricing claims to your **actual** pilot contract and offer—this doc does not set commercial terms.

---

## 1. Demo flow (order of operations)

### Prep (before the call)

Use a **demo stack** separate from any paid pilot DB ([`DEMO_AND_PILOT_ENVIRONMENT.md`](./DEMO_AND_PILOT_ENVIRONMENT.md)). Confirm the demo tenant has sample menu + tables + `metadata.demo` if you will use `reset-demo`. Smoke-test: login, one dine-in path, one report line.

### Live sequence (recommended)

| Step | Screen / topic | Why this order |
|------|----------------|----------------|
| **A** | **Problem frame (30–60s)** | “We’ll walk the order lifecycle: floor → kitchen/bar → pay → numbers. I’ll call out what we own vs what your network and devices own.” Sets honest tone before UI. |
| **B** | **Setup / readiness** (`/setup`) | Shows **blocking vs recommended** onboarding (menu, tables, `APP_PUBLIC_URL`, QR enabled, smoke payment). Operators see whether they are ready. |
| **C** | **Floor + tables** (`/floor`) | Open a **table session**—the anchor for dine-in. Without it, QR dine-in does not make sense in-product. |
| **D** | **Guest QR path** (phone or screenshot) | Open guest menu URL from the session; show **scan → browse → order / call waiter** as the environment allows. Tie to `APP_PUBLIC_URL`: “the API’s public base URL must match what guests hit.” |
| **E** | **Cashier / order** (floor order flow) | Create or extend order, **confirm**, **send to preparation**. Use their language: “this is the POS surface for staff.” |
| **F** | **Kitchen and bar** (`/kitchen`, `/bar`) | Show **station split** (e.g. food vs drinks) if the menu is set up that way—differentiator vs a single mixed ticket list. |
| **G** | **Serve → pay / close** | Complete the loop: table returns to available, payment/close as configured. Mention **idempotency** only if they care about double-tap pay: keys + Redis in multi-instance setups—not a sales slogan. |
| **H** | **Reports** (`/reports`) | Daily view; **spot-check** one number against a test order—operators care that numbers are plausible, not “AI insights.” |
| **I** | **Deployment + pilot boundaries** (conversation) | Where the app runs (their VPS/cloud, Compose-style stack, TLS, backups), **separate demo vs pilot DB**, what **must** be true before go-live (e.g. Redis if multiple API replicas). |
| **J** | **Close** | Recap: next step is pilot scope, dates, and who runs UAT on-site. Use the handoff checklist in §6. |

### What to show first (if you only have 10 minutes)

**Setup checklist → floor session → one item through kitchen/bar → close → one report line.** Show the **QR guest path** second if they are QR-first.

---

## 2. Operator-focused talking points

### QR menu

- Guest sees a **web menu** built from the live catalog; it is for **operational ordering**, not a brand brochure.
- Requires **correct public URL** on the API and **QR ordering enabled** for the branch; otherwise onboarding stays red.
- **Table/session model:** Staff opens a session; the guest link follows that model—train **who opens tables and when**.
- **QR codes:** Print or generate QR pointing at the guest URL ([`ONBOARDING_DEFERRED.md`](./ONBOARDING_DEFERRED.md))—no built-in server-side QR asset pipeline unless you add tooling.

### Tables / floor

- Floor plan and **table sessions** are the control plane for dine-in: layout matches the room.
- **Wrong-table risk** is partly operational: visible table numbers, staff discipline—software reduces confusion, it does not eliminate it.

### Cashier

- Staff flows run in **ops-web** (browser on tablet/PC)—not a dedicated embedded terminal OS from the product.
- **Cash drawer / structured shift accounting** are **not fully wired** in the API today—keep existing cash procedures for the pilot ([`VENUE_INSTALLATION_CUTOVER.md`](./VENUE_INSTALLATION_CUTOVER.md)).

### Kitchen / bar

- **Preparation tickets** by station beat one undifferentiated list—the menu must map items to the right station.
- **Realtime** needs stable network and correct deployment: single API vs multi-replica + **Redis** for Socket.IO ([`PILOT_RELEASE_GATE.md`](./PILOT_RELEASE_GATE.md) B2).

### Reports

- **Daily aggregates** for ops and reconciliation; validate against **branch timezone** ([`QA_STRATEGY.md`](../qa/QA_STRATEGY.md) §5 UAT themes).
- Position as **operations and reconciliation**, not a full finance/ERP unless contracted.

### Deployment model (honest)

- Typical pattern: **Postgres + API + ops-web static** behind **nginx/Caddy**, TLS at edge, `TRUST_PROXY` where applicable ([`DEPLOYMENT_DEVOPS.md`](./DEPLOYMENT_DEVOPS.md), [`deploy/README.md`](../../deploy/README.md)).
- **Their** side needs someone who can run containers (or equivalent), DNS, certs, backups—unless managed hosting is **actually** in your contract.
- **Redis:** Required for safe **multi-replica** close-bill/idempotency and Socket.IO fan-out; do not defer Redis if they run multiple API instances ([`PILOT_RELEASE_GATE.md`](./PILOT_RELEASE_GATE.md) B1–B2).

### Pilot constraints (say plainly)

- **Demo vs pilot:** Different databases; demos may use **reset-demo** for transactional wipe; **paid pilot** data follows the release gate and cutover runbooks ([`DEMO_AND_PILOT_ENVIRONMENT.md`](./DEMO_AND_PILOT_ENVIRONMENT.md)).
- **UAT on-site** is required for go-live signoff—automation does not replace real floor/menu/staff (B14).
- **Deferred v1 items:** bulk CSV menu import, self-serve staff invites—workarounds exist ([`ONBOARDING_DEFERRED.md`](./ONBOARDING_DEFERRED.md)).

### Onboarding time framing

- **Technical provision** can be same-day (tenant + sample data + owner login) per [`ONE_DAY_PILOT_RUNBOOK.md`](./ONE_DAY_PILOT_RUNBOOK.md).
- **Real go-live** includes real menu, floor, devices, Wi-Fi walk, **smoke payment**, and often a **quiet-window rehearsal**—budget **days**, not minutes; calendar depends on menu complexity and staffing.

### Support expectations

- Triage uses structured intake and **`x-request-id`** correlation—operators should capture the request id from errors ([`SUPPORT_DIAGNOSTICS_WORKFLOW.md`](./SUPPORT_DIAGNOSTICS_WORKFLOW.md), [`SUPPORT_INCIDENT_TRIAGE.md`](./SUPPORT_INCIDENT_TRIAGE.md)).
- **Severity and response time** follow the **contract**—do not invent 24/7 or 15-minute SLAs unless they are written for that pilot ([`PILOT_RELEASE_GATE.md`](./PILOT_RELEASE_GATE.md) B12).

### Pilot success criteria (how to frame)

- Internal **balanced scorecard**: stability (no unresolved SEV1/2 pattern), **onboarding complete** per API onboarding status or **documented exceptions**, **acknowledged limitations**, meaningful usage on trading days, and a **clear commercial exit** (convert, extend, or stop) ([`PILOT_SUCCESS_CRITERIA.md`](./PILOT_SUCCESS_CRITERIA.md)).
- **Health green/yellow/red** reflects incidents, engagement, and blockers—not vanity growth targets.

---

## 3. Objection handling (grounded)

| Objection | Response direction |
|-----------|-------------------|
| **“What if Wi-Fi dies?”** | Realtime and guest ordering need connectivity. Mitigate with **staff SSID**, site survey, failover; **paper fallback** should exist ([`VENUE_INSTALLATION_CUTOVER.md`](./VENUE_INSTALLATION_CUTOVER.md)). Do not promise offline-first POS. |
| **“Will receipts print?”** | No bundled thermal driver—**browser/OS print** or vendor bridge; test **80mm vs 58mm** on real hardware ([`VENUE_INSTALLATION_CUTOVER.md`](./VENUE_INSTALLATION_CUTOVER.md)). |
| **“How many orders/sec?”** | Pilot-scale validation is a **staging load gate** (k6), not a universal guarantee ([`PILOT_RELEASE_GATE.md`](./PILOT_RELEASE_GATE.md) B16). Capacity depends on **their** stack and network. |
| **“We need many branches day one.”** | **Plan limits** (`maxBranches`, etc.) are enforceable; set via commerce/support—do not imply unlimited scale ([`COMMERCIAL_LIFECYCLE.md`](./COMMERCIAL_LIFECYCLE.md)). |
| **“Integrations (accounting, delivery apps)?”** | Only commit to what is in **their** contract and the codebase; default: **pilot focuses on the core loop**; integrations are separate scope. |
| **“Can staff self-sign up?”** | **Deferred** for fast pilot; extra users may need a support-side process—do not promise self-serve invites ([`ONBOARDING_DEFERRED.md`](./ONBOARDING_DEFERRED.md)). |
| **“Is our data safe?”** | Backups, TLS, and secrets follow the deployment runbook; **restore drill** status matters ([`PILOT_RELEASE_GATE.md`](./PILOT_RELEASE_GATE.md) B8–B9). No absolute “100%” guarantees. |

---

## 4. “Do not say” list

- Do not promise **unlimited branches/users** without **plan limits** and support configuration.
- Do not promise **native mobile apps** if the pilot is **ops-web in the browser** unless you ship otherwise.
- Do not promise **full cash management / integrated shift accounting** as already shipped ([`VENUE_INSTALLATION_CUTOVER.md`](./VENUE_INSTALLATION_CUTOVER.md)).
- Do not promise **plug-and-play thermal receipts** without qualifying browser/bridge/driver.
- Do not promise **multi-region HA** or **massive scale** without architecture and load evidence.
- Do not say **“Redis optional in production”** if they run **multiple API replicas** (B1–B2).
- Do not promise **zero downtime deploys** or **easy DB rollback** with schema migrations—rollback is **image + careful DB story** ([`PILOT_RELEASE_GATE.md`](./PILOT_RELEASE_GATE.md) §5).
- Do not blur **demo reset** with **pilot production data**—separate stacks ([`DEMO_AND_PILOT_ENVIRONMENT.md`](./DEMO_AND_PILOT_ENVIRONMENT.md)).
- Do not invent **SLAs** or **24/7 coverage** not in the pilot agreement.

---

## 5. Pilot offer framing (paid conversion)

**What the pilot is:** A **time-boxed, scoped production trial** on an environment that passed (or has **signed waivers** for) the **release gate**, with a **named onboarding owner**, **UAT signoff**, and **weekly health** review using metadata such as `pilotPhase`, `pilotHealth`, `limitationsAcknowledged` ([`PILOT_METADATA_SCHEMA.md`](./PILOT_METADATA_SCHEMA.md), [`PILOT_WEEKLY_REVIEW.md`](./PILOT_WEEKLY_REVIEW.md)).

**Commercial envelope:** `billingStatus` and plan limits enforce access; `commercialEngagement: pilot` is **metadata labeling**, not a second billing engine ([`COMMERCIAL_LIFECYCLE.md`](./COMMERCIAL_LIFECYCLE.md)). Say clearly: pilot access is under a **defined plan/override**; trial vs active is set in commerce.

**Inclusions (typical):** Provision, setup checklist support, incident triage with request-id workflow, agreed escalation ([`PILOT_ESCALATION_MATRIX.md`](./PILOT_ESCALATION_MATRIX.md)).

**Exclusions (typical):** Custom hardware procurement, **their** ISP contract, accounting integrations unless scoped, **deferred** features unless separately committed.

**Success = exit clarity:** At pilot end: **convert to production**, **extend with documented reasons**, or **orderly stop**—commercial owner with CS input ([`PILOT_SUCCESS_CRITERIA.md`](./PILOT_SUCCESS_CRITERIA.md)).

---

## 6. Handoff checklist (after demo)

### Venue / buyer

- [ ] Named **owner** for decisions (menu, floor, go-live date).
- [ ] **Scope:** branch count, dine-in vs takeaway emphasis, QR in scope yes/no.
- [ ] **IT contact** for DNS/TLS/devices (or who will be hired).
- [ ] **Training window** proposed (quiet service + rehearsal).
- [ ] **Paper fallback** acknowledged ([`VENUE_INSTALLATION_CUTOVER.md`](./VENUE_INSTALLATION_CUTOVER.md)).

### Internal (your team)

- [ ] **Environment:** demo vs **new pilot stack** confirmed (no shared DB).
- [ ] **Provision** path ready ([`ONBOARDING_PROVISION.md`](./ONBOARDING_PROVISION.md)); secure credential handoff.
- [ ] **Release gate** owner assigned; waivers flagged early if needed.
- [ ] **Cutover worksheet** started ([`PILOT_CUTOVER_CHECKLIST.md`](./PILOT_CUTOVER_CHECKLIST.md)).
- [ ] **Support channel** and **business hours / severity** in one short paragraph for the customer.
- [ ] **Next meeting** scheduled: technical kickoff or on-site UAT date.

---

**Related:** [`PILOT_OPERATIONS_INDEX.md`](./PILOT_OPERATIONS_INDEX.md)
