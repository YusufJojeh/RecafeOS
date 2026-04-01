# Customer health signals (automatable)

**Purpose:** Reduce reliance on meeting-only health reviews ([PILOT_SUCCESS_CRITERIA.md](../operations/PILOT_SUCCESS_CRITERIA.md)) by defining signals that can be **computed** from existing DB and support APIs.

## Source of truth

- **Support:** `GET /api/v1/support/tenants/:id/summary` — counts, pilot object, onboarding rollup, commerce ([SUPPORT_TOOLING.md](../operations/SUPPORT_TOOLING.md)).
- **DB:** `Order`, `Branch`, `Tenant`, `PilotFeedbackItem`, `Tenant.metadata`, `CustomerVisit`, `MenuItem`.

## Recommended signals (v1)

| Signal | How to derive | Yellow / red heuristic (tune per contract) |
|--------|----------------|---------------------------------------------|
| **Order activity** | Last paid `Order.paidAt` per tenant or branch | Red: no paid orders in **N** expected trading days; yellow: declining week-over-week |
| **Onboarding completion** | Support onboarding-status rollup | Red: blocking steps open past agreed date; yellow: one branch lagging |
| **Open pilot feedback** | Count `PilotFeedbackItem` with `status=open` and `businessCritical=true` | Red: critical open past SLA |
| **Billing access** | `describeTenantAccess` / support summary `commercial` | Red: suspended, canceled, trial expired unexpectedly |
| **Engagement proxy** | Orders last 24h / 7d from summary | Yellow: drop vs prior week without explained closure |
| **Branch expansion headroom** | `effective maxBranches` minus branch count (same as support `expansion`) | Suggested line when at cap — confirm plan before promising another site |
| **Rollout ledger** | `Tenant.metadata.branchRollouts` vs actual `Branch` rows | Suggested line when a branch id is missing from the ledger |
| **Catalog scale** | Count `MenuItem` for tenant | Informational line when ≥ **80** line items (menu-import trigger per [RETENTION_BACKLOG.md](./RETENTION_BACKLOG.md)) |
| **Visit / repeat (7d)** | `CustomerVisit` in rolling 7d window; group by `customerId` for 2+ visits | Informational line with visit totals and repeat customer count; compare to per-branch **visit signals** on Reports |

## Not automatable without extra investment

- **Per-tenant HTTP error stream** — still log pipeline / observability ([PILOT_OPERATIONAL_READINESS_REPORT.md](../operations/PILOT_OPERATIONAL_READINESS_REPORT.md) §6).
- **Staff “active users”** — requires session or audit instrumentation; optional later.

## Using metadata vs automation

- **`pilotHealth` / `venueStatus`** remain **human overrides** for nuance; automation should **suggest** updates, not silently overwrite.
- **`GET /api/v1/support/pilots/weekly-report`** includes per-tenant **`healthSignals`** (`level`, `suggestedLines`) computed from orders, onboarding rollup, billing access, open critical feedback, branch headroom, rollout ledger gaps, catalog size, and 7-day visit aggregates (aligned with Reports visit signals).
- Weekly snapshot script ([pilot-weekly-snapshot.mjs](../../deploy/scripts/pilot-weekly-snapshot.mjs)) prints a **Suggested health lines** section in `--format md` using that payload.

## Related

- [RETENTION_BACKLOG.md](./RETENTION_BACKLOG.md)
- [POST_PILOT_ROADMAP.md](./POST_PILOT_ROADMAP.md)
