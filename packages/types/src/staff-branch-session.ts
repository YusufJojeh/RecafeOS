/**
 * How much of a tenant’s branch set a staff token may address via `X-Branch-Id`.
 *
 * Today only `ALL_TENANT_BRANCHES` exists at the data layer: `BranchGuard` checks
 * tenant ownership, not per-user assignment. A future `ASSIGNED_BRANCHES_ONLY` mode
 * would require schema (e.g. join table) + invite/admin UX.
 */
export const STAFF_BRANCH_ACCESS_SCOPE = {
  ALL_TENANT_BRANCHES: 'ALL_TENANT_BRANCHES',
} as const;

export type StaffBranchAccessScope =
  (typeof STAFF_BRANCH_ACCESS_SCOPE)[keyof typeof STAFF_BRANCH_ACCESS_SCOPE];
