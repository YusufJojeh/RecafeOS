# Mobile / alternate client session contract

Single reference for any client that is not the Vite SPA (React Native, Capacitor shell, Flutter, etc.). **Normative behavior** is defined by the API and `apps/ops-web` reference implementation.

## Shared exports (`@restocafe/types`)

Protocol literals live in **`packages/types/src/staff-client-protocol.ts`** (re-exported from the package root). Use these instead of duplicating strings:

| Export | Role |
|--------|------|
| `STAFF_HTTP_HEADER` | `BRANCH_ID`, `AUTHORIZATION`, `IDEMPOTENCY_KEY` — canonical names for Fetch / supertest. |
| `staffHttpHeaderLower` | Node `IncomingMessage.headers` keys are lowercased; use for reads (e.g. logging, guards). |
| `staffAuthorizationBearer` | Builds `Authorization` value (`Bearer <access>`). |
| `getStaffBranchIdFromHeaders` | Reads branch id from a loose `Record` (canonical or lowercase key). |
| `STAFF_WS` | `NAMESPACE`, `ENGINE_PATH`, `CLIENT_EVENT_JOIN_BRANCH` — must match Nest `OpsGateway` and clients. |
| `STAFF_WS_HANDSHAKE_AUTH_TOKEN_KEY` | Key on `handshake.auth` for the access JWT (see `socket-token.ts`). |
| `staffWsBranchRoom` | Server room id `branch:<id>` — use if you emit/listen with the same convention. |
| `STAFF_AUTH_SCHEME` | `BEARER_PREFIX` for parsing `Authorization` (WS + HTTP helpers). |

**API integration tests** use `apps/api/test/integration/staff-request-headers.ts` (`staffAuthHeaders`, `staffBearerOnlyHeaders`) so `.set()` stays aligned with the package.

## REST

| Concern | Contract |
|--------|----------|
| **Base URL** | Same origin as configured for staff (`VITE_API_URL` in web → typically `/api/v1` prefix or absolute API host). All staff paths in ops-web are rooted under that base (`apps/ops-web/src/lib/api.ts` → `branchPaths`, `tenantPaths`, etc.). |
| **Auth** | `Authorization: Bearer <access_token>` on staff routes. |
| **Branch context** | **`X-Branch-Id: <branch cuid>`** on branch-scoped routes. **Not** encoded in the JWT. Reference: `buildHeaders` in `apps/ops-web/src/lib/api.ts`. |
| **URL vs header** | When the path includes `:branchId`, the guard requires `X-Branch-Id` to match (`BranchGuard` in `apps/api/src/common/guards/branch.guard.ts`). |
| **Refresh** | `POST /auth/refresh` with `{ "refreshToken": "..." }` (rotation). On failure, drop local session and send user to sign-in. |
| **Session introspection** | `GET /auth/me` returns `userId`, `email`, `displayName`, `tenantId`, `permissions`, **`defaultBranchId`**, **`branchAccessScope`**. See [`branch-session-semantics.md`](./branch-session-semantics.md). |
| **Branch listing** | `GET /tenants/branches` — tenant-wide list today; reconcile selected `branchId` against this list to avoid stale ids after deletes (web: `BranchTenantGate`). |
| **Idempotent mutations** | Some write paths accept **`Idempotency-Key`** (`docs/operations/idempotency-and-offline.md`, `packages/types/src/mutation-safety.ts`). |

### Pinned REST shapes (Tier A — native / alternate clients)

Use these instead of re-declaring request/response structs per screen:

| Area | Module | Notes |
|------|--------|--------|
| Staff ops (floor, orders, kitchen, branch snapshot, menu list, customers subset) | `apps/ops-web/src/lib/contract/staff-api.ts` | Enum-narrowed fields (`OrderStatus`, `OrderType`, `FloorTableStatus`, `TableSessionStatus`, `PaymentStatus`, …) mirror Prisma / Nest DTOs. |
| Staff auth | `apps/ops-web/src/lib/contract/auth-api.ts` | Login, refresh, `/auth/me`. |
| Public QR menu + guest order | `apps/ops-web/src/lib/contract/public-guest-api.ts` | Menu JSON, order summary, status poll; **`publicGuestPaths`** matches `PublicController` routes. |
| Path builders | `apps/ops-web/src/lib/api.ts` | `branchPaths`, `tenantPaths`, `customerPaths` — always relative to `/api/v1` base. |

**Wire enums** live in **`@restocafe/types`** (`OrderStatus`, `PrepTicketStatus`, `PublicGuestCustomerStatus`, `TableSessionStatus`, `PaymentStatus`, realtime payloads). Vitest locks cardinalities in `apps/ops-web/src/lib/contract/hot-path-contract.test.ts` and path templates in `api-paths-contract.test.ts`.

**Optional:** `pnpm run contract:openapi:export` (API) then `pnpm run contract:openapi -w ops-web` for generated `paths` typings — does not replace the pinned modules for Tier A until codegen covers the same routes.

## Forbidden assumptions

1. **JWT carries the active branch** — False. Branch is client session state + `X-Branch-Id` (+ Socket `joinBranch`).
2. **`GET /tenants/branches` is an access-control list** — False. It lists tenant branches; enforcement of “may only see these branches” is **product future** (see `docs/operations/branch-access-policy.md`).
3. **`TenantMember.defaultBranchId` restricts API** — False. It is preference for UI and `/auth/me` only until ACL exists.

## Socket.IO (branch realtime)

| Concern | Contract |
|--------|----------|
| **Namespace** | `STAFF_WS.NAMESPACE` (currently `/ws`) in `ops.gateway.ts` and `branch-realtime.tsx`. |
| **Engine path** | `STAFF_WS.ENGINE_PATH` (`/socket.io`). |
| **URL** | `<apiOrigin>` + namespace + Socket.IO path (see web `io(\`${base}${STAFF_WS.NAMESPACE}\`, { path: STAFF_WS.ENGINE_PATH, ... })`). |
| **Connection auth** | **Access token** via `handshake.auth[STAFF_WS_HANDSHAKE_AUTH_TOKEN_KEY]` **or** `Authorization: Bearer` (`socket-token.ts`). |
| **Room join** | After `connect`, emit **`STAFF_WS.CLIENT_EVENT_JOIN_BRANCH`** with **`{ branchId: string }`**. Server joins `staffWsBranchRoom(branchId)` and verifies tenant (same checks as HTTP). |
| **Events (names)** | `BranchRealtimeEvent` in `@restocafe/types` (`packages/types/src/realtime.ts`). **Version** field: `REALTIME_CONTRACT_VERSION` — bump with breaking name/shape changes. |
| **Payloads** | Typed as `BranchRealtimePayloads` in the same module. **HTTP remains source of truth** for full entities; events trigger refetch / cache invalidation (see web invalidation map in `branch-realtime.tsx`). |
| **Reconnect** | Clients should re-`joinBranch` after reconnect (web does this on `connect`). Consider resync/refetch after outage; web uses jittered invalidation (see `branch-realtime.tsx`). |

## Minimal client state machine

1. Obtain valid `accessToken` + `refreshToken` + `tenantId` (login or accept-invite).
2. Optionally call `GET /auth/me` for permissions and `defaultBranchId`.
3. Load branches (`GET /tenants/branches`); pick or default branch → persist **`branchId`** securely on device.
4. All branch-scoped HTTP: set **`X-Branch-Id`** (and Bearer token).
5. Open Socket.IO with token → on connect emit **`joinBranch`** with same **`branchId`**.
6. On token refresh: update socket auth if your client library requires reconnect; re-**`joinBranch`** after reconnect.
7. On branch switch: update stored `branchId`, update HTTP headers, leave old branch room if applicable, **`joinBranch`** with new id (or disconnect and reconnect).

## Related docs

- [`branch-session-semantics.md`](./branch-session-semantics.md) — branch + staff session model.
- [`../operations/branch-access-policy.md`](../operations/branch-access-policy.md) — tenant-wide vs ACL product policy.
- [`../mobile-native-prerequisites.md`](../mobile-native-prerequisites.md) — gap map before a native program.
- [`../mobile-readiness-checklist.md`](../mobile-readiness-checklist.md) — release gates.
