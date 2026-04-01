# Plans, packages, and controlled AI upsell

## Subscription tiers (defaults)

Defined in [`apps/api/src/commerce/plan-limits.config.ts`](../../apps/api/src/commerce/plan-limits.config.ts).

| Plan | Branches (default) | Seats (default) | Notable features |
|------|--------------------|-----------------|------------------|
| **trial** | 1 | 5 | QR + inventory; no `apiAccess` |
| **starter** | 1 | 10 | Same; typical single-site |
| **growth** | 5 | 50 | **`apiAccess: true`** — integrations |
| **scale** | High cap (999) | 500 | Same features; contract governs real limits |

Overrides: `Tenant.maxBranches`, `Tenant.maxUsers` — must be **audited** and documented on the deal ([COMMERCIAL_LIFECYCLE.md](../operations/COMMERCIAL_LIFECYCLE.md)).

## Growth paths (sales / CS)

1. **starter → growth:** Customer adds branches or needs API — bump plan and confirm `maxBranches` / Stripe alignment outside repo if used.
2. **growth → scale:** Seat or branch count exceeds practical defaults — prefer **contract + overrides** over code forks.
3. **Trial → paid:** Use support commerce PATCH and metadata; schedule **expire-trials** job ([DEMO_AND_PILOT_ENVIRONMENT.md](../operations/DEMO_AND_PILOT_ENVIRONMENT.md)).

## AI-assisted value (advisory layer)

- **Module:** [`apps/api/src/modules/ai-insights/`](../../apps/api/src/modules/ai-insights/) — read-only narratives on top of **existing** report aggregates. The LLM never writes transactions or replaces core reporting.
- **Plan gate:** Product flags on [`PlanFeatures`](../../apps/api/src/commerce/plan-limits.config.ts) (`aiDailySummary`, `aiWeeklyDigest`, `aiLowStockCommentary`, `aiUnderperformingItems`, `aiBranchCompare`, …). **`trial` / `starter`** have these flags **off** — they receive `plan_not_eligible` even if metadata opt-in is set. **`growth` / `scale`** ship the first five advisory features as **on**; **`aiPromotionIdeas`** and **`aiSocialDrafts`** stay **off** until product enables them (reserved; no public routes yet).
- **Tenant opt-in:** Master switch `Tenant.metadata.aiInsights.enabled === true`. Per-feature consent under `aiInsights.features` (see [`tenant-ai-metadata.ts`](../../apps/api/src/modules/ai-insights/tenant-ai-metadata.ts)). **Legacy:** if `features` is **omitted**, only **daily summary** is treated as opted-in when `enabled` is true. If `features` is present, each key (including `dailySummary`) must be explicitly `true`.
- **HTTP routes** (all require permission `insights.generate`; branch scope via `BranchGuard`):
  - `GET /api/v1/branches/:branchId/insights/daily-summary` — daily report narrative.
  - `GET /api/v1/branches/:branchId/insights/weekly-digest` — narrative on [`weeklyBranchDigest`](../../apps/api/src/modules/reports/reports.service.ts) metrics.
  - `GET /api/v1/branches/:branchId/insights/low-stock` — commentary on low-stock rows from the daily report (`date` query optional).
  - `GET /api/v1/branches/:branchId/insights/underperforming-items` — deterministic week-vs-week shortlist + narrative.
  - `GET /api/v1/branches/:branchId/insights/branch-compare` — same-local-day branch comparison (`date` query optional); tenant-scoped data.
- **Rules:**
  - **Opt-in** — no silent PII; snapshots are redacted ([`insight-snapshot.ts`](../../apps/api/src/modules/ai-insights/insight-snapshot.ts) and sibling snapshot builders).
  - **Fallback** — when LLM unavailable, API returns structured `available: false` reasons ([`ai-insights.service.ts`](../../apps/api/src/modules/ai-insights/ai-insights.service.ts)).
  - **Kill switch** — set **`LLM_INSIGHTS_DISABLED=true`** to force noop LLM (no outbound calls). Without **`LLM_API_KEY`**, the client is noop anyway.
  - **Rate caps** (env, defaults in parentheses):
    - **`LLM_INSIGHTS_MAX_PER_BRANCH_PER_DAY`** (24) — daily summary, per branch per report date.
    - **`LLM_INSIGHTS_WEEKLY_MAX_PER_BRANCH_PER_DAY`** (8) — weekly digest narrative, per branch per local day.
    - **`LLM_INSIGHTS_LOW_STOCK_MAX_PER_BRANCH_PER_DAY`** (24) — low-stock commentary, per branch per report date.
    - **`LLM_INSIGHTS_UNDERPERFORMERS_MAX_PER_BRANCH_PER_DAY`** (12) — underperformers, per branch per local day.
    - **`LLM_INSIGHTS_BRANCH_COMPARE_MAX_PER_TENANT_PER_DAY`** (8) — branch compare, per tenant per calendar date.
  - **Upsell:** Position as **Insights add-on** for growth+ teams that already use reports — not a replacement for reporting, inventory truth, or support.

## Packaging suggestions (non-code)

- Tie **Insights** to plans that include **`reports.view`** and stable operations (avoid selling to trial chaos).
- Set **rate expectations** (e.g. per-branch per-day) via env: `LLM_*` config — document in deployment runbooks.

## Sales and CS copy alignment (product truth)

Use the same story in decks, contracts, and onboarding so customers are not surprised by API behavior ([`ai-insights.service.ts`](../../apps/api/src/modules/ai-insights/ai-insights.service.ts)):

| Topic | Accurate positioning |
|-------|----------------------|
| **Who gets Insights** | **Growth and scale** for shipped `PlanFeatures` AI flags. Trial/starter see `plan_not_eligible` — expected. |
| **Opt-in** | Master + per-feature flags in `Tenant.metadata.aiInsights` (see [PILOT_METADATA_SCHEMA.md](../operations/PILOT_METADATA_SCHEMA.md)). |
| **What it is** | Short **narratives on top of existing report payloads** — not a second reporting system, not a forecast, not autonomous writes. |
| **What it is not** | A replacement for branch daily reports, inventory thresholds, tenant rollup, support, or kitchen workflow. |
| **Limits** | Env caps per feature (see above); document so “unlimited AI” is never sold. |
| **Upsell motion** | Sell **plan upgrade to growth+** and stable operations first; position Insights as an add-on for teams that already read their numbers daily. |
| **Reserved** | **Promotion ideas** and **social drafts** — plan flags off; enable when offers/social flows are ready and CS copy is aligned. |

If `plan_not_eligible` spikes on **paying** growth accounts, verify `subscriptionPlan` and commerce metadata ([COMMERCIAL_LIFECYCLE.md](../operations/COMMERCIAL_LIFECYCLE.md)) before escalating to engineering.

## Operations: monitoring eligibility and caps

Track these in logs or API responses (no new microservice required):

| Signal | Meaning |
|--------|---------|
| **`plan_not_eligible`** | Plan does not include the feature flag, or tenant missing — confirms commerce gate. |
| **`tenant_opt_in_required`** | Master `aiInsights.enabled` is not true. |
| **`tenant_feature_opt_in_required`** | Master on, but the specific `aiInsights.features.<key>` is not true. |
| **`cap_exceeded`** | Per-feature env cap hit — tune env or set expectations. |
| **Successful `available: true`** | Normal use; correlate with support tickets if operators report “empty” insights. |

**Structured logs (API):** JSON lines via Nest `Logger` with `msg` values such as `ai_insights_daily_summary`, `ai_insights_weekly_digest`, `ai_insights_low_stock`, `ai_insights_underperformers`, `ai_insights_branch_compare`; fields include `tenantId`, `branchId`, `available`, and `reason` when blocked. No PII or report snapshot in the log line.

**Practical rule:** If `plan_not_eligible` dominates for paying growth customers, check commercial PATCH and plan field — not the LLM. If `cap_exceeded` is frequent, raise the cap only after reviewing cost and abuse risk.

See also [OBSERVABILITY.md](../operations/OBSERVABILITY.md) §2.1 for log field details and example aggregation queries.

## Related

- [POST_PILOT_STAKEHOLDER_ALIGNMENT.md](./POST_PILOT_STAKEHOLDER_ALIGNMENT.md)
- [MULTIBRANCH_READ_PILOT.md](../phase2/MULTIBRANCH_READ_PILOT.md) (tenant rollup KPIs)
