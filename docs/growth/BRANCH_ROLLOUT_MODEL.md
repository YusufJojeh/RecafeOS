# Branch rollout model (disciplined expansion)

**Purpose:** Make multi-branch growth **repeatable** without relaxing `BranchGuard` or splitting the monolith. Expansion is **gated by plan limits** ([plan-limits.config.ts](../../apps/api/src/commerce/plan-limits.config.ts)) and **process**, not ad-hoc branch creation.

**Single source with support ops:** Branch limits, provision path, and `branchRollouts` visibility are documented in tandem with [SUPPORT_TOOLING.md](../operations/SUPPORT_TOOLING.md) (see *Multi-branch rollout* there).

## Runbook index

| Step | Document / endpoint |
|------|------------------------|
| First branch / pilot provision | [ONBOARDING_PROVISION.md](../operations/ONBOARDING_PROVISION.md) — `POST /api/v1/support/tenants/provision` |
| Additional branch (same tenant) | Same provision contract: upsert tenant + **new** `branchSlug` under `maxBranches` ([`ProvisioningService`](../../apps/api/src/provisioning/provisioning.service.ts)); then update `branchRollouts` below |
| Headroom + pilot fields | `GET /api/v1/support/tenants/:id/summary` — [SUPPORT_TOOLING.md](../operations/SUPPORT_TOOLING.md) |
| Cutover signoff | [PILOT_CUTOVER_CHECKLIST.md](../operations/PILOT_CUTOVER_CHECKLIST.md) |
| Billing / plan / overrides | [COMMERCIAL_LIFECYCLE.md](../operations/COMMERCIAL_LIFECYCLE.md) |
| Tenant rollup vs branch daily (CS FAQ) | [MULTIBRANCH_READ_PILOT.md](../phase2/MULTIBRANCH_READ_PILOT.md) § CS playbook |
| Weekly CS rhythm | [OPERATIONAL_CS_WEEKLY_CADENCE.md](./OPERATIONAL_CS_WEEKLY_CADENCE.md) |
| Growth doc map | [POST_PILOT_GROWTH_INDEX.md](./POST_PILOT_GROWTH_INDEX.md) |
| Deferred menu copy (engineering spec) | [SUPPORT_ONLY_MENU_CLONE_SPEC.md](./SUPPORT_ONLY_MENU_CLONE_SPEC.md) |

## Principles

1. **One branch at a time** for go-live — prove operations before adding the next.
2. **Same tenant, isolated data** — no cross-branch stock transfers in v1 (see [MULTIBRANCH_READ_PILOT.md](../phase2/MULTIBRANCH_READ_PILOT.md) out-of-scope list).
3. **Metadata is the rollout ledger** — support/CS record stage and owner; engineering does not add a second state machine.

## Stages

| Stage | Meaning | Exit criteria |
|-------|---------|----------------|
| **planned** | Contract allows another branch; not yet provisioned | Budget + `maxBranches` headroom |
| **provisioned** | Branch row exists; menu/tables may be empty | Branch slug + timezone set |
| **configuring** | Menu, tables, QR settings in progress | `readyForGoLive` checklist (see branches onboarding) |
| **pilot_cutover** | Soft launch / parallel running | Venue signoff on [PILOT_CUTOVER_CHECKLIST.md](../operations/PILOT_CUTOVER_CHECKLIST.md) where applicable |
| **live** | Primary operations on RestoCafe OS | Orders on expected trading days |
| **steady** | Rolled into normal CS cadence | Health green/yellow in CS review |

Store the current stage per branch in **`Tenant.metadata.branchRollouts`** (see schema below). This is **CS-facing**; it does not enforce API behavior by itself.

## Metadata schema (`Tenant.metadata.branchRollouts`)

Array of objects (append-only; update `stage` in place):

| Field | Type | Description |
|-------|------|-------------|
| `branchId` | string | Prisma `Branch.id` |
| `stage` | string | One of `planned`, `provisioned`, `configuring`, `pilot_cutover`, `live`, `steady` |
| `updatedAt` | string | ISO timestamp |
| `owner` | string? | CS or venue owner responsible |
| `notes` | string? | Non-PII |

Support **`PATCH .../metadata`** merges shallowly — preserve array entries when patching other keys.

## Operational rules

- **Before** adding a branch: confirm `effective maxBranches` via support summary ([SUPPORT_TOOLING.md](../operations/SUPPORT_TOOLING.md)).
- **After** provision: set `branchRollouts` entry to `provisioned` or `configuring`.
- **Tenant rollup reporting** ([MULTIBRANCH_READ_PILOT.md](../phase2/MULTIBRANCH_READ_PILOT.md)): use read-only KPIs for owners/managers; cashiers stay on branch daily reports.

## Staff access model (intentionally simple)

For branch #2 and #3, **do not** introduce per-branch API ACLs or a `TenantMemberBranch` join table unless a pilot explicitly requires **deny-by-branch** enforcement.

- Today: [`TenantMember`](../../apps/api/prisma/schema.prisma) is **tenant-scoped**; `defaultBranchId` sets the **default** branch in the UI only—not API restriction. Any member with a role can send `X-Branch-Id` for any branch of that tenant (see [MULTIBRANCH_READ_PILOT.md](../phase2/MULTIBRANCH_READ_PILOT.md) acceptance: membership filter deferred).
- Rollouts: assign site leads via `POST .../support/tenants/:id/members` with `defaultBranchId` pointing at their site ([SUPPORT_TOOLING.md](../operations/SUPPORT_TOOLING.md)); train multi-site managers to switch branch in ops-web.
- Revisit `TenantMemberBranch` (or equivalent) only after a **documented** pilot need—not as part of routine second/third branch expansion.

## UI hints (ops-web)

Where the app shows **branch switcher** or **reports**, a short line of copy is acceptable: *“Add branches from your plan settings via support — see rollout runbook.”* Avoid exposing raw limits to every role if it creates noise; owner/manager contexts only.

## Support visibility

- **`GET /api/v1/support/tenants/:tenantId/summary`** returns **`branchRollouts`** (metadata entries enriched with `branchName` / `branchSlug` when the branch id exists) and **`expansion`** (`branchesRemaining`, `seatsRemaining`) so CS can confirm headroom before provisioning another branch.

## Expansion guardrails (single reference)

Use this checklist before promising dates or provisioning another branch. It does not replace contract review.

| Step | Action |
|------|--------|
| 1 | Confirm **billing** and **plan** match the deal (`billingStatus`, `subscriptionPlan`, overrides) — [COMMERCIAL_LIFECYCLE.md](../operations/COMMERCIAL_LIFECYCLE.md). |
| 2 | On `GET .../support/tenants/:id/summary`, verify **`expansion.branchesRemaining` ≥ 1** (and seats if adding staff-heavy rollout). |
| 3 | **Append or update** `Tenant.metadata.branchRollouts` for the branch id with `stage` (`planned` → `provisioned` → `configuring` → …). |
| 4 | One branch at a time to **live**; next branch only after prior site is **steady** or explicitly parallel pilot with CS signoff. |
| 5 | Escalate engineering if **tenant rollup** numbers disagree with branch dailies in ways you cannot explain (often **UTC vs local day** — [MULTIBRANCH_READ_PILOT.md](../phase2/MULTIBRANCH_READ_PILOT.md)). |

**Ops-web:** Owner/manager contexts may show a short hint on branch select / reports: additional branches go through **support** and plan limits — not self-serve purchase in narrow pilot mode.

## Related

- [PILOT_METADATA_SCHEMA.md](../operations/PILOT_METADATA_SCHEMA.md) (tenant-level pilot fields)
- [COMMERCIAL_LIFECYCLE.md](../operations/COMMERCIAL_LIFECYCLE.md)
- [SUPPORT_TOOLING.md](../operations/SUPPORT_TOOLING.md)
- [SUPPORT_ONLY_MENU_CLONE_SPEC.md](./SUPPORT_ONLY_MENU_CLONE_SPEC.md) (deferred; optional catalog copy)
- [STRATEGIC_MAPS_AND_ORDER.md](./STRATEGIC_MAPS_AND_ORDER.md)
