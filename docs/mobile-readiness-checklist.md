# Mobile Readiness Checklist

Use this checklist before approving any mobile build for RecafeOS.

**Enforceable pass/fail:** **[`mobile-readiness-gates.md`](./mobile-readiness-gates.md)** — **native work is blocked until Tier A gates there are PASS** (currently **NATIVE_BLOCKED**).

Status values:

- `Ready`: confirmed in code and current product behavior
- `Partial`: exists but is not strong enough for native/mobile scale
- `Blocked`: missing or explicitly deferred

**Gate review (Mar 2026 implementation pass):** see [`mobile-native-prerequisites.md`](./mobile-native-prerequisites.md), [`operations/branch-access-policy.md`](./operations/branch-access-policy.md), **[`architecture/mobile-client-session-contract.md`](./architecture/mobile-client-session-contract.md)** (headers, JWT vs branch, Socket.IO), and **`mobile-readiness-gates.md`**.

## 1. Product maturity

| Item | Status | Notes |
|---|---|---|
| Staff login and tenant selection exist | Ready | `apps/api/src/modules/auth/*`, `apps/ops-web/src/pages/LoginPage.tsx` |
| Branch selection exists | Ready | `apps/ops-web/src/pages/BranchSelectPage.tsx` |
| Full staff order/session capture is productized in UI | Ready | Floor: `FloorOpenSessionModal`, `FloorDineInOrderModal`, `FloorPage`; critical E2E: `e2e/helpers/floor-dine-in-ui.ts` |
| Kitchen and bar execution exist | Ready | API + `apps/ops-web/src/pages/KitchenPage.tsx` and `BarPage.tsx` |
| Cashier close-bill exists | Partial | Exists, but wider shift/cash procedure is incomplete |
| Shift / drawer operations are fully wired | Blocked | `apps/ops-web/src/pages/SetupPage.tsx` says not wired in API yet |
| Onboarding and member management are low-support | Partial | Staff invite flow exists, but owner onboarding and broader rollout remain support-heavy |
| Per-branch membership isolation is enforced | Partial | **Policy documented** — tenant-wide access is explicit (`docs/operations/branch-access-policy.md`); **no** per-member ACL schema yet |

## 2. API and auth

| Item | Status | Notes |
|---|---|---|
| Access token auth exists | Ready | `auth/login` |
| Refresh token endpoint exists | Ready | `auth/refresh` |
| Client auto-refresh flow exists | Ready | `apiFetch` + `SessionProactiveRefresh` (`apps/ops-web/src/lib/api.ts`, `jwt-expiry.ts`) |
| Permission model exists | Ready | Guarded backend routes |
| Branch-scoped request model exists | Ready | `X-Branch-Id` plus `BranchGuard`; non-web clients: [`architecture/mobile-client-session-contract.md`](./architecture/mobile-client-session-contract.md) |
| Generated typed API client exists | Partial | **Tier A pinned:** `staff-api.ts`, `public-guest-api.ts` (`publicGuestPaths`), `auth-api.ts`, `branchPaths` / `api.ts`; Vitest: `api-paths-contract.test.ts`, `contract/hot-path-contract.test.ts`. **Optional** exhaustive OpenAPI codegen: `pnpm run contract:openapi -w ops-web` |
| Pagination is consistent across list endpoints | Partial | Orders paginate; customers search is fixed `take: 20`; support and reports vary |
| Retry-safe mutation policy is documented per endpoint | Partial | `MUTATION_SAFETY_BY_OPERATION` + **`OFFLINE_REPLAY_BY_OPERATION`** + `docs/operations/idempotency-and-offline.md`; **server keys:** close-bill + **create order** (draft) when `Idempotency-Key` sent |

## 3. Realtime and offline

| Item | Status | Notes |
|---|---|---|
| Realtime branch event contract exists | Ready | `apps/api/src/websocket/ops.gateway.ts`, `packages/types/src/realtime.ts`; join + auth: [`architecture/mobile-client-session-contract.md`](./architecture/mobile-client-session-contract.md) |
| Client resync and polling fallback exist | Ready | `apps/ops-web/src/lib/branch-realtime.tsx` |
| Offline mutation queue exists | Partial | Dexie queue **allowlist-only**: `POST …/close` with `Idempotency-Key` + `X-Branch-Id` match (`offline-queue.ts`); not a general offline write buffer |
| Offline replay policy is safe for financial/critical actions | Partial | Close-bill queue path is bounded + enforced; other financial paths require online + idempotency discipline — see gate A6 **FAIL** with partial credit |
| Queue visibility and failure recovery UX exist | Blocked | Not surfaced as a complete product feature |
| Background sync semantics are defined | Blocked | Not present |

## 4. Localization and UX

| Item | Status | Notes |
|---|---|---|
| English and Arabic foundations exist | Ready | Language providers in `ops-web` and `landing` |
| RTL direction switching exists | Ready | Shared layout and language context support it |
| All ops-web routes are fully translated | Partial | **`SetupPage`** + onboarding checklist: API still returns English `label`/`why` for compatibility, but `ops-web` maps known step `id`s to `setupPage.onboardingSteps` (and localized CSV via `onboardingCsv`). **Still:** new API step ids without a client map fall back to server strings; other routes may have literals — `locale-parity.test.ts`. |
| Public guest flow is fully bilingual | Partial | `PublicMenuPage` + localized `callAssistanceMessage` |
| Mobile phone UX is the primary design target | Blocked | Current product is dashboard/tablet-oriented |
| Tablet UX is credible | Partial | Stronger than phone, but still browser-first |

## 5. Mobile platform needs

| Item | Status | Notes |
|---|---|---|
| Push notification backend contract exists | Partial | Device registration + realtime → **`StaffPushOutbox`** + in-process worker + `StaffPushProviderPort` (**noop** until FCM/APNs) — see [`operations/notifications-readiness.md`](./operations/notifications-readiness.md) |
| Mobile device/session management exists | Partial | Push token registration per user+tenant; no native session SDK |
| Camera/scanner/hardware flows are defined | Blocked | No mobile-native hardware strategy found |
| App-store distribution need is proven | Blocked | Repo and docs still center browser/PWA operations |
| PWA installability exists | Partial | `vite-plugin-pwa` is configured, but product scope remains browser-first |

## 6. Operational release readiness

| Item | Status | Notes |
|---|---|---|
| CI covers build, tests, integration, E2E | Ready | `.github/workflows/ci.yml` |
| Load-test tooling exists | Ready | `ops/load` |
| Production Redis and idempotency discipline exist | Ready | Enforced by env validation and docs |
| Mobile-specific crash/analytics instrumentation exists | Blocked | Not found |
| Native app release pipeline exists | Blocked | Not found |

## Approval rule

**Primary rule:** see **[`mobile-readiness-gates.md`](./mobile-readiness-gates.md)** — Tier **A** gates **A1–A9** must be **PASS** before opening a native program.

Legacy checklist framing (subsumed by gates): do **not** approve a native mobile build until items below are at least `Partial`, with staff critical path + auth **Ready**. Notification **PASS** requires real provider delivery (not outbox-only).

1. Full staff critical path in UI
2. Client token refresh
3. Branch isolation model
4. Typed API contract layer
5. Mutation replay policy
6. Full bilingual and RTL coverage for exposed screens
7. Notification strategy (**PASS** = FCM/APNs or agreed Web Push + targeting, per gates doc)
8. Role-specific mobile scope

**Current pass (Mar 2026):** Items **1** and **2** are **Ready**. Items **3** and **4** remain **Partial**. Items **5–8** are **Partial** or **Blocked**. **Gates doc: NATIVE_BLOCKED.**

## Current decision

**Do not start a full native mobile app yet.** (Verdict also recorded as **NATIVE_BLOCKED** in [`mobile-readiness-gates.md`](./mobile-readiness-gates.md).)

Near-term:

- Continue **ops-web** tablet-first PWA.
- If enterprise needs **branch ACL**, implement allow-list model and filter rollups (`docs/phase2/MULTIBRANCH_READ_PILOT.md`).
- Evolve **push** by implementing a real `StaffPushProviderPort` (FCM/APNs/Web) + device fan-out; optional Redis/Bull in front of or behind the outbox for multi-instance APIs (`docs/operations/notifications-readiness.md`).
- Re-run **gates** + this checklist before opening an Expo/RN or Flutter track.
