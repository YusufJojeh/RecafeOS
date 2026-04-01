# Post-pilot growth — strategic maps and implementation order

**Purpose:** Canonical in-repo reference for the Post-Pilot Growth Package: risk, retention, expansion, reporting/intelligence gaps, and **recommended implementation order**. Guardrails: modular monolith, no consumer mobile app, no marketplace/ERP scope — see [POST_PILOT_STAKEHOLDER_ALIGNMENT.md](./POST_PILOT_STAKEHOLDER_ALIGNMENT.md).

**Working backlog:** Execute in the order below; track decisions in [RETENTION_BACKLOG.md](./RETENTION_BACKLOG.md) and [GROWTH_READINESS_REPORT.md](./GROWTH_READINESS_REPORT.md).

### Living backlog maintenance

| Artifact | Role |
|----------|------|
| **This file** | Single source for the four maps and numbered implementation order — edit here when strategy shifts; do not fork duplicate tables into other docs. |
| [GROWTH_READINESS_REPORT.md](./GROWTH_READINESS_REPORT.md) | Shipped vs planned, metrics, open decisions — refresh after each pilot or commercial wave (or quarterly). |
| [POST_PILOT_GROWTH_INDEX.md](./POST_PILOT_GROWTH_INDEX.md) | Entry point and cross-links for the growth package. |

**Last reviewed:** 2025-03-22 (align `Last reviewed` in [GROWTH_READINESS_REPORT.md](./GROWTH_READINESS_REPORT.md) when you refresh).

---

## 1. Post-pilot product risk map

| Zone | Risk | Severity | Mitigation |
|------|------|----------|------------|
| **Onboarding / config** | Wrong `APP_PUBLIC_URL` breaks guest QR; no in-venue self-heal | High | Playbooks + [SetupPage.tsx](../../apps/ops-web/src/pages/SetupPage.tsx) warnings; optional diagnostic deep link only if data proves need |
| **Identity** | Shared owner logins; support-only members reduce but do not eliminate risk | High | Process; open decision: email invites vs support-only ([GROWTH_READINESS_REPORT.md](./GROWTH_READINESS_REPORT.md)) |
| **Commercial** | `pilot` is metadata, not enforcement; mis-labeling causes CS/revenue drift | Medium | [COMMERCIAL_LIFECYCLE.md](../operations/COMMERCIAL_LIFECYCLE.md); guarded PATCH UX/scripts ([RETENTION_BACKLOG.md](./RETENTION_BACKLOG.md) Tier 2) |
| **Ops / jobs** | Trial expiry job needs external scheduling | Medium | Cron/K8s per [DEMO_AND_PILOT_ENVIRONMENT.md](../operations/DEMO_AND_PILOT_ENVIRONMENT.md) |
| **Expansion** | Undisciplined branch adds vs plan caps | Medium | [branchRollouts](./BRANCH_ROLLOUT_MODEL.md) + support summary headroom |
| **Reporting** | Tenant rollup uses **UTC** `paidAt` vs branch **local calendar day** for daily reports | Medium | Documented in UI; local-day parity is a future cost/benefit trade ([MULTIBRANCH_READ_PILOT.md](../phase2/MULTIBRANCH_READ_PILOT.md)) |
| **Permissions** | Tenant-wide branch access; strict site-scoped roles not productized | Medium | Sales/CS positioning; revisit for multi-franchise deals |
| **Security** | Support API key blast radius | Medium | Rotation, restricted console ([INTERNAL_SUPPORT_CONSOLE.md](../operations/INTERNAL_SUPPORT_CONSOLE.md)) |
| **Observability** | Per-tenant HTTP error stream not in DB | Low | Logs/APM ([CUSTOMER_HEALTH_SIGNALS.md](./CUSTOMER_HEALTH_SIGNALS.md)) |

---

## 2. Retention opportunity map

| Opportunity | Mechanism | Status |
|-------------|-----------|--------|
| **Multi-staff identity** | Support `POST .../members` vs future invites | Shipped vs deferred per [RETENTION_BACKLOG.md](./RETENTION_BACKLOG.md) |
| **QR / setup** | Blocking vs recommended steps, warnings | Ongoing ([SetupPage.tsx](../../apps/ops-web/src/pages/SetupPage.tsx)) |
| **Menu scale** | CSV/JSON import above documented threshold | Trigger-gated in backlog |
| **Disengagement visibility** | Order recency, onboarding, billing, feedback | [CUSTOMER_HEALTH_SIGNALS.md](./CUSTOMER_HEALTH_SIGNALS.md), weekly report |
| **Operator trust in numbers** | Consistent definitions, comparisons | Tenant rollup + branch daily; operator cues in ops-web |

---

## 3. Expansion readiness map

| Layer | What “ready” means | Anchor |
|-------|---------------------|--------|
| **Commercial** | `maxBranches` / `maxUsers` match contract | [plan-limits.config.ts](../../apps/api/src/commerce/plan-limits.config.ts), support commerce PATCH |
| **Process** | One branch at a time; exit criteria per stage | [BRANCH_ROLLOUT_MODEL.md](./BRANCH_ROLLOUT_MODEL.md) |
| **Ledger** | `Tenant.metadata.branchRollouts` | Support `PATCH .../metadata` |
| **CS visibility** | `expansion.*`, enriched rollouts | [SUPPORT_TOOLING.md](../operations/SUPPORT_TOOLING.md) |
| **Operator visibility** | Owner/manager tenant rollup; cashiers branch daily | [MULTIBRANCH_READ_PILOT.md](../phase2/MULTIBRANCH_READ_PILOT.md) |

---

## 4. Reporting / intelligence gap map

| Capability | Exists | Gap (action-oriented) |
|------------|--------|------------------------|
| **Branch daily** | Full snapshot | Operator “focus” cues from same payload (discount share, quiet hours, cancellations, stock) |
| **Tenant rollup** | KPIs, prior period, UTC | Local-day parity when multi-TZ pain is proven; drill-down copy |
| **Visit / repeat** | 30d aggregates, no PII | Operator plays + links to menu/setup |
| **CS health** | `healthSignals`, weekly lines | Staff “active users” optional later |
| **AI** | Opt-in LLM, plan + caps | Monitor `plan_not_eligible` / `cap_exceeded` ([PLAN_AND_AI_UPSELL.md](./PLAN_AND_AI_UPSELL.md)) |

---

## 5. Recommended implementation order

1. **Retention foundation** — Policy for invites vs support-only; menu-import threshold in [RETENTION_BACKLOG.md](./RETENTION_BACKLOG.md); QR/setup alignment with runbooks.
2. **Branch rollout** — CS discipline on `branchRollouts`; headroom before provision; owner/manager UI hints ([BRANCH_ROLLOUT_MODEL.md](./BRANCH_ROLLOUT_MODEL.md)).
3. **Reporting → operator intelligence** — Cues from existing payloads; defer UTC/local rollup parity until validated.
4. **Customer / visit workflows** — Visit signals copy + plays; no PII expansion.
5. **Controlled AI** — Caps/env/docs; no vanity features.
6. **Safer self-serve boundaries** — Guarded support scripts ([deploy/scripts/support-guarded-patch.mjs](../../deploy/scripts/support-guarded-patch.mjs)), audit preserved.
7. **Expansion guardrails** — Single reference: [BRANCH_ROLLOUT_MODEL.md](./BRANCH_ROLLOUT_MODEL.md) § Expansion guardrails.
8. **Growth readiness** — Refresh [GROWTH_READINESS_REPORT.md](./GROWTH_READINESS_REPORT.md) after each wave.

---

## Related

- [POST_PILOT_ROADMAP.md](./POST_PILOT_ROADMAP.md) · [POST_PILOT_GROWTH_INDEX.md](./POST_PILOT_GROWTH_INDEX.md)
- [OPERATIONAL_CS_WEEKLY_CADENCE.md](./OPERATIONAL_CS_WEEKLY_CADENCE.md) · [INCREMENTAL_PRODUCT_GATES.md](./INCREMENTAL_PRODUCT_GATES.md)
