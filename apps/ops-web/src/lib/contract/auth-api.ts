/**
 * Staff auth REST shapes (mirror `AuthService` / `AuthController`).
 * Full OpenAPI typings: `pnpm run contract:openapi:export` then `pnpm run contract:openapi -w ops-web`
 * against a running API, or import `paths` from generated `openapi-api.d.ts`.
 */

import type { StaffBranchAccessScope } from '@restocafe/types';

export type StaffTenantSummary = {
  id: string;
  name: string;
  slug: string;
};

export type StaffAuthUser = {
  id: string;
  email: string;
  displayName: string;
};

/** `POST /auth/login`, `POST /auth/accept-invite` */
export type StaffAuthLoginResponse = {
  user: StaffAuthUser;
  tenantId: string;
  tenants: StaffTenantSummary[];
  accessToken: string;
  refreshToken: string;
};

/** `POST /auth/refresh` */
export type StaffAuthRefreshResponse = {
  accessToken: string;
  refreshToken: string;
  tenantId: string;
};

/** `GET /auth/me` */
export type StaffAuthMeResponse = {
  userId: string;
  email: string;
  displayName: string;
  tenantId: string;
  permissions: string[];
  /** Server preference only; client may still pick another branch while scope is tenant-wide. */
  defaultBranchId: string | null;
  /** Today always `ALL_TENANT_BRANCHES`; reserved for future assigned-branch mode. */
  branchAccessScope: StaffBranchAccessScope;
};
