# Incremental product gates (defer by default)

**Purpose:** RestoCafe OS stays a **modular monolith** with **narrow paid pilots** — not low-touch SaaS yet. Larger product increments (**self-serve invites**, **menu bulk import**, **tenant rollup local-day parity**) ship only when they clear the gates below. Until then, defaults in [RETENTION_BACKLOG.md](./RETENTION_BACKLOG.md) apply (support-only members, manual menu CRUD, UTC rollup with documented semantics).

## Gate: self-serve email invites

| Criterion | Question |
|-----------|----------|
| Revenue / volume | Does pilot or paid count justify the security, UX, and abuse surface (invites, password reset, email deliverability)? |
| Support burden | Is shared-login pain measurably worse than invite-related tickets? |
| Decision | Product + CS agree; document owner in [GROWTH_READINESS_REPORT.md](./GROWTH_READINESS_REPORT.md). |

**Default:** Keep [support-only member provisioning](../operations/SUPPORT_TOOLING.md) (`POST /api/v1/support/tenants/:tenantId/members`).

## Gate: menu CSV/JSON import

| Criterion | Question |
|-----------|----------|
| Trigger | Has the tenant hit **80+ catalog line items** **or** **second-branch / multi-site production** context (per [RETENTION_BACKLOG.md](./RETENTION_BACKLOG.md) § Policy)? |
| ROI | Will import reduce churn or implementation time enough to offset build + validation + support for bad files? |

**Default:** Do not build before the trigger; tune thresholds in [RETENTION_BACKLOG.md](./RETENTION_BACKLOG.md) when you have data.

## Gate: local-day parity for tenant rollup

| Criterion | Question |
|-----------|----------|
| Pain | Are multi-timezone owners **confused or disputing** numbers despite UI/docs ([MULTIBRANCH_READ_PILOT.md](../phase2/MULTIBRANCH_READ_PILOT.md))? |
| Cost | Is engineering + QA cost justified vs positioning and CS explanation? |

**Default:** Defer; UTC inclusive range remains the API contract until this gate opens.

## Related

- [GROWTH_READINESS_REPORT.md](./GROWTH_READINESS_REPORT.md) — open decisions table
- [STRATEGIC_MAPS_AND_ORDER.md](./STRATEGIC_MAPS_AND_ORDER.md) — risk and reporting gap maps
