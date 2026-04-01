# Branch and staff session semantics

Grounded in `BranchGuard`, JWT payload, `GET /auth/me`, and ops-web `auth-store`.

## Current model (code)

| Concern | Where | Behavior |
|--------|--------|----------|
| Tenant | JWT access token | `tenantId`; refreshed with refresh token. |
| Permissions | JWT + `/auth/me` | Permission codes; route guards use JWT / cache. |
| Active branch | **Not in JWT** | Client holds `branchId` (Zustand + `localStorage`); API calls send `X-Branch-Id`. |
| Branch vs URL | `BranchGuard` | `X-Branch-Id` required; must match `:branchId` when the route includes it. |
| Branch belongs to tenant | `BranchGuard` | Branch id must exist for the token’s `tenantId`. |
| Per-user branch allow-list | **None** | Any tenant member with route permissions may use any branch of that tenant. `TenantMember.defaultBranchId` is preference only (ordering on branch picker + `/auth/me`). |
| Branch access scope (API) | `/auth/me` | `branchAccessScope` is today always `ALL_TENANT_BRANCHES` (`STAFF_BRANCH_ACCESS_SCOPE` in `@restocafe/types`); reserved for a future assigned-branch product mode. |
| Stale `branchId` on client | `BranchTenantGate` | After branches load, if stored id is not in `GET /tenants/branches`, client clears branch and `RequireAuth` sends user to `/branch`. |

## Product policy vs code policy

**Product policy (not enforced by API today)**

- “This role may only work at branches A and B.”
- “Cashiers default to branch X but may never see branch Y.”

**Code policy (enforced today)**

- Staff must present a valid tenant + permissions.
- For branch-scoped routes, `X-Branch-Id` must name a branch that belongs to that tenant.
- Client must not rely on branch id alone for authorization (any id in the tenant is accepted for eligible members).

Implementing assigned-branch policy requires data model (e.g. membership–branch matrix), admin/invite flows, and tightening `BranchGuard` (or a parallel check) against that matrix—not only UI.

## Mobile / multi-client notes

- Native clients must treat **`branchId` as session state** alongside tokens: same JWT, different `X-Branch-Id` ⇒ different operational context.
- Server remains the source of truth for **tenant + branch existence**; clients should reconcile lists (as ops-web does) to avoid persistent 403 loops after deletes or tenant changes.

## See also

- **[`mobile-client-session-contract.md`](./mobile-client-session-contract.md)** — REST headers, Socket.IO `joinBranch`, forbidden assumptions, minimal state machine.
