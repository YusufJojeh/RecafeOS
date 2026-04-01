# Operational CS weekly cadence (post-pilot growth)

**Purpose:** Single checklist for **branch rollout discipline**, **support tooling**, and **weekly health** so expansion stays controlled and pilots do not drift into support chaos. No new product scope — links to existing runbooks.

## Before promising or provisioning another branch

1. **Commercial matches the deal** — plan, trial/paid state, overrides: [COMMERCIAL_LIFECYCLE.md](../operations/COMMERCIAL_LIFECYCLE.md).
2. **Headroom** — `GET /api/v1/support/tenants/:tenantId/summary` (or internal console): confirm `expansion.branchesRemaining` (and seats if staff-heavy). Details: [SUPPORT_TOOLING.md](../operations/SUPPORT_TOOLING.md).
3. **Rollout ledger** — After provision, append or update `Tenant.metadata.branchRollouts` per [BRANCH_ROLLOUT_MODEL.md](./BRANCH_ROLLOUT_MODEL.md). Use guarded metadata/commerce changes when applicable: [support-guarded-patch.mjs](../../deploy/scripts/support-guarded-patch.mjs), [SUPPORT_TOOLING.md](../operations/SUPPORT_TOOLING.md).
4. **One branch at a time to steady** — [BRANCH_ROLLOUT_MODEL.md](./BRANCH_ROLLOUT_MODEL.md) § Expansion guardrails.

## Weekly health review (pilots / narrow commercial)

1. **Suggested lines** — `GET /api/v1/support/pilots/weekly-report` includes per-tenant `healthSignals` (`level`, `suggestedLines`). Signal definitions: [CUSTOMER_HEALTH_SIGNALS.md](./CUSTOMER_HEALTH_SIGNALS.md). Implementation: `computeTenantHealthSignals` in [support.service.ts](../../apps/api/src/modules/support/support.service.ts).
2. **Snapshot script** — Markdown-friendly output for standups: [pilot-weekly-snapshot.mjs](../../deploy/scripts/pilot-weekly-snapshot.mjs) (`--format md` prints suggested health lines from the same payload).
3. **Escalation** — If tenant rollup disagrees with branch dailies in ways you cannot explain, see UTC vs local-day notes in [MULTIBRANCH_READ_PILOT.md](../phase2/MULTIBRANCH_READ_PILOT.md) before opening engineering.

## Related

- [INTERNAL_SUPPORT_CONSOLE.md](../operations/INTERNAL_SUPPORT_CONSOLE.md) (key safety)
- [PILOT_OPERATIONS_INDEX.md](../operations/PILOT_OPERATIONS_INDEX.md)
- [STRATEGIC_MAPS_AND_ORDER.md](./STRATEGIC_MAPS_AND_ORDER.md) § Recommended implementation order
