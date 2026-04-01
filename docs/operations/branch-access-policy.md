# Branch access policy (tenant-wide vs per-member)

## Current production semantics (accepted)

As implemented in [`BranchGuard`](../../apps/api/src/common/guards/branch.guard.ts) and [`BranchesService.listForTenant`](../../apps/api/src/modules/branches/branches.service.ts). For staff session + `/auth/me` + client reconciliation, see [`../architecture/branch-session-semantics.md`](../architecture/branch-session-semantics.md) and [`../architecture/mobile-client-session-contract.md`](../architecture/mobile-client-session-contract.md).

- Any authenticated **tenant member** may send **`X-Branch-Id`** for **any branch** that belongs to their `tenantId`.
- `TenantMember.defaultBranchId` is a **UI default only**; it does **not** restrict API access.
- **Permissions** (`PermissionsGuard`) still gate **which actions** a role may perform, but **not which branch** within the tenant.

**Implication:** Operators who can reach the staff app for a tenant can, in principle, read and mutate operational data for **all branches** of that tenant if their role includes the relevant permission codes. This matches single-owner multi-site pilots where “venue staff” are trusted across locations.

## When this is insufficient

Require **per-member branch ACL** before native rollouts or enterprise deals if any of the following apply:

- Staff must **not** see another site’s live orders, PII, or cash metrics even with the same tenant login.
- **Regulatory / franchise** contracts mandate branch-scoped separation at the application layer.
- **Tenant rollups** must exclude branches the user is not assigned to (see deferred checks in [`MULTIBRANCH_READ_PILOT.md`](../phase2/MULTIBRANCH_READ_PILOT.md)).

## Engineering direction (when product selects ACL)

1. Add a join model (e.g. `TenantMemberBranch { memberId, branchId }`) or branch list on `TenantMember`.
2. Filter **`GET /tenants/branches`** to assigned branches only (breaking change — version or flag).
3. Extend **`BranchGuard`** (and Socket.IO `joinBranch`) to deny branches outside the allow-list.
4. Filter **tenant rollup** and other cross-branch readers with `branchId IN (:allowed)`.

Until then, treat **tenant-wide branch access** as **explicit product policy**, not an accident.
