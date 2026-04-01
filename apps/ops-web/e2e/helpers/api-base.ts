import { STAFF_HTTP_HEADER, staffAuthorizationBearer } from '@restocafe/types';

/**
 * API origin for E2E helpers (must match Vite proxy target in dev).
 * CI: API listens on 3000; Playwright uses 127.0.0.1.
 */
export function apiV1Base(): string {
  return (
    process.env.PLAYWRIGHT_API_URL?.replace(/\/$/, '') ??
    'http://127.0.0.1:3000/api/v1'
  );
}

export function authHeaders(token: string, branchId: string): Record<string, string> {
  return {
    [STAFF_HTTP_HEADER.AUTHORIZATION]: staffAuthorizationBearer(token),
    [STAFF_HTTP_HEADER.BRANCH_ID]: branchId,
    'Content-Type': 'application/json',
  };
}
