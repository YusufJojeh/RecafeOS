# Tenant.metadata — pilot and demo keys

Stored as JSON on `Tenant.metadata`. Merged shallowly by support `PATCH .../metadata`.

| Key | Type | Purpose |
|-----|------|---------|
| `demo` | boolean | Demo/sales tenant; allows `reset-demo` without `acknowledgeProductionReset` ([DEMO_TENANT.md](./DEMO_TENANT.md)). |
| `commercialEngagement` | string | `pilot` or `production` — CS label for paid vs evaluation; **not** used for enforcement (see [COMMERCIAL_LIFECYCLE.md](./COMMERCIAL_LIFECYCLE.md)). |
| `pilotPhase` | string | Short label, e.g. `onboarding`, `live`, `week1`. |
| `csOwner` | string | Internal owner email or handle for customer success. |
| `goLiveDate` | string | ISO date or free text target for go-live. |
| `goLiveDateActual` | string | ISO date when production cutover completed (distinct from aspirational `goLiveDate`). |
| `venueStatus` | string | Lifecycle: `contracted`, `onboarding`, `uat`, `live`, `steady_state`, `at_risk`, `churned`, `ended` (use consistently in CS tooling). |
| `pilotHealth` | string | Weekly rollup: `green`, `yellow`, or `red` (see [PILOT_SUCCESS_CRITERIA.md](./PILOT_SUCCESS_CRITERIA.md)). |
| `engineeringLiaison` | string | Optional internal contact for escalations to engineering. |
| `limitationsAcknowledged` | array | Structured rows: `{ id?, description, acknowledgedAt?, acknowledgedBy?, venueSignoff? }` for known product/deployment caveats. |
| `externalIncidentIds` | string[] | External ticket ids or URLs (not a substitute for observability; links triage to feedback). |
| `enabledModulesSnapshot` | object | Optional JSON map of module → boolean (e.g. mirrors plan features at kickoff); effective flags always come from commerce in support summary. |
| `branchCountSnapshot` | number | Optional denormalized pilot-scope branch count at kickoff; live count is always in support `counts.branches`. |
| `branchRollouts` | array | Optional per-branch rollout stages for disciplined expansion — see [BRANCH_ROLLOUT_MODEL.md](../growth/BRANCH_ROLLOUT_MODEL.md). |
| `pilotNotes` | string | Freeform internal notes (keep non-PII if possible). |
| `previousBillingStatus` | string | Set automatically on support **suspend**; used on **reactivate** to restore prior `BillingStatus`. |
| `suspensionReasonCode` | string | Last manual suspend reason (`payment`, `abuse`, `customer_request`, `trial_end`, `other`). |
| `suspensionNote` | string | Optional detail for the last manual suspend. |
| `suspendedAt` | string | ISO timestamp of last manual suspend. |
| `trialExpiredAt` | string | ISO timestamp when the **expire-trials** job suspended an expired trial tenant. |
| `blockReasonCode` | string | Machine-readable reason when access is blocked (`trial_end` from job, etc.). |
| `blockDetail` | string | Human-readable detail for operators. |
| `aiInsights` | object | Optional AI advisory opt-in (see [PLAN_AND_AI_UPSELL.md](../growth/PLAN_AND_AI_UPSELL.md)). `enabled: true` is the master switch. `features` is an optional map (`dailySummary`, `weeklyDigest`, `lowStockCommentary`, `underperformingItems`, `promotionIdeas`, `socialDrafts`, `branchCompare`). If `features` is **omitted**, legacy behavior treats **daily summary** as allowed when `enabled` is true; if `features` is present, each key must be explicitly `true` (including `dailySummary`). |

Support `GET /api/v1/support/tenants/:tenantId/summary` returns a **`pilot`** object derived from these keys (plus `demo` and **`modulesEffective`**: effective plan feature flags) and **`onboardingRollup`** across branches. **`pilotFeedbackCount`** is the number of structured feedback rows. Commercial block/limit context is under **`commercial`** (effective limits + access explanation).

Structured pilot feedback is stored in **`PilotFeedbackItem`** (see [PILOT_FEEDBACK_TAXONOMY.md](./PILOT_FEEDBACK_TAXONOMY.md)); list/create via support API in [SUPPORT_TOOLING.md](./SUPPORT_TOOLING.md).
