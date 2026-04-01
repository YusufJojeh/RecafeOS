# Retention backlog — ranked (post-pilot)

Ordered by **impact on churn** and **dependency**: fix foundations before scale features.

## Working backlog (canonical)

- **Strategic maps + implementation order:** [STRATEGIC_MAPS_AND_ORDER.md](./STRATEGIC_MAPS_AND_ORDER.md) (risk, retention, expansion, reporting gaps, ordered steps).
- **Phased roadmap:** [POST_PILOT_ROADMAP.md](./POST_PILOT_ROADMAP.md).
- **Decisions and shipped rows:** [GROWTH_READINESS_REPORT.md](./GROWTH_READINESS_REPORT.md).
- **When to build larger increments (invites, import, local-day rollup):** [INCREMENTAL_PRODUCT_GATES.md](./INCREMENTAL_PRODUCT_GATES.md) — default is defer.

### Policy (narrow paid pilots)

- **Staff identity:** Default remains **support-only provisioning** (`POST /support/tenants/:tenantId/members`). **Self-serve email invites** are the next step when revenue or pilot count justifies the larger UX and security surface — track the call in [GROWTH_READINESS_REPORT.md](./GROWTH_READINESS_REPORT.md).
- **Menu bulk import:** Treat as a build trigger when **either** (a) the active catalog exceeds **80** line items (items, not modifier options), **or** (b) the tenant is on **second branch** rollout / multi-site production — whichever comes first. Adjust these numbers in this doc when you have data.

## Tier 1 — highest impact (do first)

1. **Identity for multi-staff venues**  
   - **Problem:** No self-serve invites; shared owner logins create security and training risk ([ONBOARDING_DEFERRED.md](../operations/ONBOARDING_DEFERRED.md)).  
   - **Options:** (A) Email invite + password set flow — larger surface. (B) **Support-only** `POST /support/tenants/:tenantId/members` — **shipped** (manager/cashier/kitchen roles).  
   - **Next:** Plan **(A)** when revenue justifies UX investment.

2. **Guest QR / public URL correctness**  
   - **Problem:** Wrong `APP_PUBLIC_URL` breaks QR; no in-app fix ([PILOT_OPERATIONAL_READINESS_REPORT.md](../operations/PILOT_OPERATIONAL_READINESS_REPORT.md)).  
   - **Mitigation:** Harden **ops checklist**, onboarding status warnings, and support triage — optional future “diagnostic deep link” only if still top churn driver.

## Tier 2 — high impact when volume grows

3. **Menu bulk import (CSV/JSON)**  
   - **Problem:** Large menus are manual CRUD — time-to-value and post-incident recovery suffer.  
   - **Trigger to build:** See **Policy** above (80+ items or second-branch context); do not build before the trigger.

4. **Safer commercial moves**  
   - **Problem:** Commerce/metadata PATCH via Swagger/curl is error-prone ([PILOT_OPERATIONAL_READINESS_REPORT.md](../operations/PILOT_OPERATIONAL_READINESS_REPORT.md)).  
   - **Mitigation:** Guarded internal UI for common PATCHes, or wizard-style support scripts — without expanding ERP scope.

## Tier 3 — visibility and proactive CS

5. **Disengagement detection**  
   - **Problem:** Silence discovered late ([PILOT_SUCCESS_CRITERIA.md](../operations/PILOT_SUCCESS_CRITERIA.md)).  
   - **Mitigation:** Automatable signals in [CUSTOMER_HEALTH_SIGNALS.md](./CUSTOMER_HEALTH_SIGNALS.md) + weekly cadence.

## Explicitly later (unless data says otherwise)

- Full tax/service charge engines (deferred in [ONBOARDING_DEFERRED.md](../operations/ONBOARDING_DEFERRED.md)).
- Server-side QR PNG/PDF unless venues cannot use browser print.
