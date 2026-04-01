---
name: frontend-backend-integration
description: Extend RecafeOS safely by verifying backend controllers, auth and branch scoping, i18n/RTL behavior, and client query patterns before changing frontend flows or contracts.
---

# Frontend-Backend Integration Skill

Use this skill when changing routes, API calls, auth/session handling, realtime behavior, or bilingual UI in RecafeOS.

## Start from the contract

Before editing the UI, inspect:

- the controller route
- the DTO
- the guard stack
- the service behavior
- the current `ops-web` caller

For most product work, start with:

- `apps/api/src/modules/*/*.controller.ts`
- `apps/ops-web/src/lib/api.ts`
- the page component that consumes the data

## RecafeOS contract rules

### Auth

- Login: `POST /auth/login`
- Invite acceptance: `POST /auth/accept-invite`
- Refresh: `POST /auth/refresh`
- Logout: `POST /auth/logout`
- Me: `GET /auth/me`

Do not assume `ops-web` already refreshes access tokens automatically. Confirm the caller behavior first.

### Branch scope

- Branch-scoped APIs require `X-Branch-Id`.
- The selected branch lives in client state and local storage.
- Branch validation is enforced server-side by `BranchGuard`.

Do not remove or bypass branch selection without updating both contract and UX intentionally.

### Idempotency and offline

- Close-bill uses `Idempotency-Key`.
- The IndexedDB offline queue is primitive and only safe for explicitly retry-safe mutations.

Do not queue financial or side-effectful POST requests unless the API contract guarantees safe replay.

### Realtime

- `ops-web` uses Socket.IO for branch-scoped cache invalidation, not as the primary data source.
- HTTP remains the source of truth.

Do not add UI behavior that depends on receiving every socket event exactly once.

## Bilingual and RTL rules

- Every new visible string must be routed through the language layer.
- Verify both English and Arabic.
- Verify `dir` handling in page layout and portal content.
- Do not leave public pages or internal tools hardcoded if they are part of the same product surface.

## Testing expectations

For contract-affecting changes, check:

- route and query key alignment
- auth/permission behavior
- English and Arabic rendering when UI copy changes
- at least one happy path plus one failure state

For risky flows, inspect:

- `apps/ops-web/e2e`
- API integration tests under `apps/api/test`

## Anti-patterns

- Hand-editing fetch paths without checking the controller
- Inventing client-only business states that the API does not own
- Treating support-only APIs as normal end-user product flows
- Adding partial translation
- Adding offline retries without idempotency

