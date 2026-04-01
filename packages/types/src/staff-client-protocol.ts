/**
 * Staff client protocol: HTTP headers, Socket.IO wiring, and tiny helpers.
 * Single source of truth for api, ops-web, load scripts (copy literals), and future native apps.
 */

/** Canonical header names for Fetch `Headers` and supertest `.set()`. */
export const STAFF_HTTP_HEADER = {
  BRANCH_ID: 'X-Branch-Id',
  AUTHORIZATION: 'Authorization',
  IDEMPOTENCY_KEY: 'Idempotency-Key',
} as const;

/** Socket.IO namespace and path must match `OpsGateway` and `branch-realtime.tsx`. */
export const STAFF_WS = {
  NAMESPACE: '/ws',
  ENGINE_PATH: '/socket.io',
  CLIENT_EVENT_JOIN_BRANCH: 'joinBranch',
} as const;

/**
 * `handshake.auth` field accepted by `tokenFromSocket` (`apps/api/src/websocket/socket-token.ts`).
 * ops-web passes `auth: { [key]: accessToken }`.
 */
export const STAFF_WS_HANDSHAKE_AUTH_TOKEN_KEY = 'token' as const;

export type StaffWsJoinBranchPayload = { branchId: string };

export function staffWsBranchRoom(branchId: string): string {
  return `branch:${branchId}`;
}

export function staffAuthorizationBearer(accessToken: string): string {
  return `Bearer ${accessToken}`;
}

export const STAFF_AUTH_SCHEME = {
  BEARER_PREFIX: 'Bearer ',
} as const;

/**
 * Node/Express exposes `IncomingMessage.headers` keys lowercased; use this for reads.
 */
export function staffHttpHeaderLower(
  name: (typeof STAFF_HTTP_HEADER)[keyof typeof STAFF_HTTP_HEADER],
): string {
  return name.toLowerCase();
}

/**
 * Queued or merged header bags may use canonical or lowercase keys (see offline replay).
 */
export function getStaffBranchIdFromHeaders(
  headers: Record<string, string | undefined> | undefined,
): string | undefined {
  if (!headers) {
    return undefined;
  }
  return (
    headers[STAFF_HTTP_HEADER.BRANCH_ID] ??
    headers[staffHttpHeaderLower(STAFF_HTTP_HEADER.BRANCH_ID)]
  );
}
