# Support-only menu clone (deferred specification)

**Status:** Not implemented. Document this contract before building so rollouts stay **safe, repeatable, and auditable**—not a venue self-serve “sync” that bypasses support.

**When to build:** Pilot volume shows that **manual menu setup** for branch #2+ is the main bottleneck; CS and product agree the engineering cost is justified.

**Canonical process until then:** [BRANCH_ROLLOUT_MODEL.md](./BRANCH_ROLLOUT_MODEL.md) (sample menu at provision + manual edits) · [ONBOARDING_PROVISION.md](../operations/ONBOARDING_PROVISION.md).

---

## Goal

Copy **catalog definitions** from a **source branch** to a **target branch** within the same tenant: menu categories, items, modifier groups, and related stock **catalog** rows as applicable—**never** orders, sessions, shifts, or customer history.

## Non-goals

- Venue-facing UI or self-serve triggers.
- Cross-tenant copy.
- Ongoing “linked” menus (no master catalog); target branch owns its rows after copy.
- Cross-branch stock **transfers** or pooled inventory.

## API sketch (support key only)

| Aspect | Requirement |
|--------|-------------|
| **Route** | e.g. `POST /api/v1/support/tenants/:tenantId/branches/:targetBranchId/clone-menu` (exact path TBD with controller layout) |
| **Auth** | Same as other support mutations: write key + optional `x-support-operator`. |
| **Body** | `{ "sourceBranchId": "<cuid>", "mode": "replace_empty" \| "replace_all_catalog" }` — `replace_all_catalog` requires explicit confirmation flag to reduce fat-finger risk. |
| **Preconditions** | `sourceBranchId` and `targetBranchId` belong to `tenantId`; `targetBranch` under plan branch cap already satisfied; optional: `target` has zero menu rows for `replace_empty`. |
| **Transaction** | Single DB transaction; on failure, full rollback. |
| **Idempotency** | Optional `Idempotency-Key` header; duplicate key returns same summary without double-write. |
| **Audit** | `AuditLog` action e.g. `support.clone_menu` with `sourceBranchId`, `targetBranchId`, counts (categories, items, modifiers, stock defs), `supportOperator`. |

## Data copying rules

1. **New primary keys** on target for all copied rows (no shared IDs across branches).
2. **Order of insert:** categories (respect sort order) → items → modifier groups / links → stock catalog rows that are branch-scoped menu dependencies (mirror existing Prisma relations in [schema.prisma](../../apps/api/prisma/schema.prisma)).
3. **Branch settings** (`Branch.settings`) are **not** copied unless explicitly documented in the implementation (default: leave target settings as provisioned).
4. **Images / media:** If items reference external URLs, copy URL strings as-is; if blobs exist later, extend spec.

## Operational safeguards

- Run only after `branchRollouts` marks target at least `provisioned` ([BRANCH_ROLLOUT_MODEL.md](./BRANCH_ROLLOUT_MODEL.md)).
- CS checklist: confirm target has correct `timezone` / `currency` before clone (currency affects display; catalog amounts are minor units per existing model).

## Related

- [MULTIBRANCH_READ_PILOT.md](../phase2/MULTIBRANCH_READ_PILOT.md) (reporting; unrelated to clone but same multi-branch context)
- [SUPPORT_TOOLING.md](../operations/SUPPORT_TOOLING.md)
