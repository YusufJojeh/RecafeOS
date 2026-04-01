# Growth readiness report (post-pilot package)

**Purpose:** Close the loop on the Post-Pilot Growth Package: what shipped, what to watch, and open decisions. This is not a full product roadmap — it ties retention, expansion discipline, reporting intelligence, and controlled AI to measurable outcomes.

| Field | Value |
|-------|--------|
| **Last reviewed** | 2025-03-22 |
| **Next review** | After the next pilot or commercial wave, or within one quarter — whichever comes first |

## Canonical backlog ownership

| Artifact | Role |
|----------|------|
| [STRATEGIC_MAPS_AND_ORDER.md](./STRATEGIC_MAPS_AND_ORDER.md) | Single source for **risk, retention, expansion, reporting gap maps** and **recommended implementation order** — update when strategy shifts, not in duplicate docs. |
| **This file (`GROWTH_READINESS_REPORT.md`)** | **Shipped vs planned**, risks, metrics, open decisions — **refresh after each pilot or commercial wave** (or at least quarterly) so CS and product share one snapshot. |

## Architecture guardrails (unchanged)

- **Modular monolith** (NestJS + Prisma + ops-web) — no microservices split.
- **No** consumer mobile app, marketplace, or ERP scope — see [POST_PILOT_STAKEHOLDER_ALIGNMENT.md](./POST_PILOT_STAKEHOLDER_ALIGNMENT.md).

## Shipped capabilities (this package)

| Area | What | Where |
|------|------|--------|
| **Working backlog** | Risk, retention, expansion, reporting gap maps + implementation order | [STRATEGIC_MAPS_AND_ORDER.md](./STRATEGIC_MAPS_AND_ORDER.md), links from [RETENTION_BACKLOG.md](./RETENTION_BACKLOG.md) |
| **Retention policy** | Default: support-only staff; menu-import thresholds (80+ items or second branch) | [RETENTION_BACKLOG.md](./RETENTION_BACKLOG.md) § Policy |
| **Retention / identity** | Support-only staff provisioning (no self-serve invites) | `POST /api/v1/support/tenants/:tenantId/members` — [SUPPORT_TOOLING.md](../operations/SUPPORT_TOOLING.md), [ONBOARDING_DEFERRED.md](../operations/ONBOARDING_DEFERRED.md) |
| **QR / setup** | Stronger in-app warning when `APP_PUBLIC_URL` is missing; QR verification copy | [SetupPage.tsx](../../apps/ops-web/src/pages/SetupPage.tsx) · [ONE_DAY_PILOT_RUNBOOK.md](../operations/ONE_DAY_PILOT_RUNBOOK.md) |
| **Branch expansion** | CS-visible rollout ledger + headroom on support summary; guardrails doc | `Tenant.metadata.branchRollouts` + `GET .../support/tenants/:id/summary` — [BRANCH_ROLLOUT_MODEL.md](./BRANCH_ROLLOUT_MODEL.md) |
| **Branch / rollup UI hints** | Owner/manager: multi-branch note on branch select; rollup copy on Reports | [BranchSelectPage.tsx](../../apps/ops-web/src/pages/BranchSelectPage.tsx), [ReportsPage.tsx](../../apps/ops-web/src/pages/ReportsPage.tsx) |
| **Reporting** | Tenant rollup prior-period comparison (UTC), operator copy | [reports.service.ts](../../apps/api/src/modules/reports/reports.service.ts), [ReportsPage.tsx](../../apps/ops-web/src/pages/ReportsPage.tsx) |
| **Operator intelligence** | “Suggested focus” cues from existing daily + rollup payloads (discount share, quiet hour, cancellations, stock, branch spread) | [ReportsPage.tsx](../../apps/ops-web/src/pages/ReportsPage.tsx) |
| **Visit intelligence** | Branch-scoped 30d visit aggregates (no PII); repeat share + operator plays | `GET /api/v1/branches/:branchId/customers/visit-signals`, [ReportsPage.tsx](../../apps/ops-web/src/pages/ReportsPage.tsx) |
| **AI guardrails** | Growth/scale plan gate, per-branch-per-day cap, opt-in unchanged; ops monitoring table | [ai-insights.service.ts](../../apps/api/src/modules/ai-insights/ai-insights.service.ts), [PLAN_AND_AI_UPSELL.md](./PLAN_AND_AI_UPSELL.md) |
| **Health signals** | Automated suggested lines on weekly pilot report | [support.service.ts](../../apps/api/src/modules/support/support.service.ts), [pilot-weekly-snapshot.mjs](../../deploy/scripts/pilot-weekly-snapshot.mjs) |
| **Safer support PATCH** | Guarded script: allowlisted commerce keys; metadata merge validation; dry-run without `--confirm` | [support-guarded-patch.mjs](../../deploy/scripts/support-guarded-patch.mjs), `npm run support:guarded-patch`, [SUPPORT_TOOLING.md](../operations/SUPPORT_TOOLING.md) |
| **Commerce read model** | `menuItemsInCatalog` for retention trigger UX (80+ line items policy) | [commerce.service.ts](../../apps/api/src/commerce/commerce.service.ts) `getCommerceReadModel`, [SetupPage.tsx](../../apps/ops-web/src/pages/SetupPage.tsx) |
| **Weekly health lines** | Branch cap, rollout ledger gaps, catalog scale, 7d visits/repeats | [support.service.ts](../../apps/api/src/modules/support/support.service.ts) `computeTenantHealthSignals`, [CUSTOMER_HEALTH_SIGNALS.md](./CUSTOMER_HEALTH_SIGNALS.md) |
| **AI ops logs** | JSON lines `msg: ai_insights_daily_summary` for eligibility and caps | [ai-insights.service.ts](../../apps/api/src/modules/ai-insights/ai-insights.service.ts), [PLAN_AND_AI_UPSELL.md](./PLAN_AND_AI_UPSELL.md) |
| **Provisioning guardrail** | Clear `BRANCH_LIMIT_REACHED` message pointing at rollout doc | [provisioning.service.ts](../../apps/api/src/provisioning/provisioning.service.ts) |
| **Branch select / setup** | At-cap warnings; staff policy copy; menu scale banner | [BranchSelectPage.tsx](../../apps/ops-web/src/pages/BranchSelectPage.tsx), [SetupPage.tsx](../../apps/ops-web/src/pages/SetupPage.tsx) |

## Risks to keep watching

| Risk | Mitigation |
|------|------------|
| **UTC vs local “day”** on tenant rollup | Documented in UI; parity work remains a future phase if multi-TZ owners demand it — [MULTIBRANCH_READ_PILOT.md](../phase2/MULTIBRANCH_READ_PILOT.md) |
| **Per-branch staff permissions** | Still tenant-wide branch access in product; revisit before selling strict site-scoped roles |
| **Support key safety** | Rotate keys; restrict internal console — [INTERNAL_SUPPORT_CONSOLE.md](../operations/INTERNAL_SUPPORT_CONSOLE.md) |

## Metrics to track

- **Churn / retention:** paid order recency (already surfaced in `healthSignals`), onboarding blocking branches, billing `access.ok` on tenant summary.
- **Expansion:** `expansion.branchesRemaining` / `seatsRemaining` on support summary; `branchRollouts` stage discipline; weekly suggested lines when at branch cap or ledger gaps.
- **Reporting usage:** frequency of tenant rollup vs branch daily (product analytics if/when available); operator cue engagement (qualitative from pilot feedback).
- **AI:** rate of `plan_not_eligible`, `cap_exceeded`, and successful `available: true` — from API responses **or** log aggregation on `msg: "ai_insights_daily_summary"` — see [PLAN_AND_AI_UPSELL.md](./PLAN_AND_AI_UPSELL.md) § Operations: monitoring and [OBSERVABILITY.md](../operations/OBSERVABILITY.md) §2.1.

## Open decisions (fill with owners)

| Decision | Owner | Notes |
|----------|-------|-------|
| Self-serve email invites vs support-only members | | **Default:** support-only until revenue/pilot count justifies invites — [RETENTION_BACKLOG.md](./RETENTION_BACKLOG.md) |
| Menu CSV import | | **Default trigger:** 80+ catalog line items or second-branch context — same doc |
| Local-day parity for tenant rollup | | Engineering cost vs cross-TZ owner confusion — defer until validated |

## Related index

- [POST_PILOT_GROWTH_INDEX.md](./POST_PILOT_GROWTH_INDEX.md) · [STRATEGIC_MAPS_AND_ORDER.md](./STRATEGIC_MAPS_AND_ORDER.md)
