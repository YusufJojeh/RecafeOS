# Mobile readiness gates — pass/fail specification

**Authority:** This document defines **enforceable** criteria for starting a **native** staff/customer app program. Narrative strategy remains in [`mobile-strategy.md`](./mobile-strategy.md). Detailed inventory lives in [`mobile-readiness-checklist.md`](./mobile-readiness-checklist.md).

## Executive decision (hard rule)

| State | Meaning |
|--------|---------|
| **NATIVE_BLOCKED** | Do **not** open a full native app program (RN/Expo, Flutter, or separate mobile repos). |
| **PWA_TABLET_ALLOWED** | Continue **ops-web** tablet-first PWA hardening without this gate doc blocking you. |

**Current repo verdict:** **NATIVE_BLOCKED** until every **Tier A** gate below is **PASS** (see § Current snapshot).

### How to read gates

- **PASS / FAIL** are objective; “Partial” from the checklist maps to **FAIL** for Tier A unless the gate text explicitly allows partial credit.
- **Proof** lists what a reviewer checks (code path, doc, CI job, or manual evidence).

---

## Tier A — must PASS before native work

### Gate A1 — Product completeness (staff critical path)

| Criterion | PASS when | FAIL when |
|-----------|-----------|-----------|
| Staff can run floor → session → dine-in order → kitchen/bar → cashier close on **product UI** (not seed-only demos) | E2E or scripted proof covers the path on `ops-web` against a real API | Critical steps exist only via test helpers/API seeding |
| **Proof** | `pnpm --filter ops-web run test:e2e:critical` (or agreed substitute) green in CI or recorded run; routes referenced in checklist | |

### Gate A2 — Auth/session maturity

| Criterion | PASS when | FAIL when |
|-----------|-----------|-----------|
| Access + refresh token flow implemented and used by the primary client | Documented endpoints + client refresh behavior | Native would need a new auth design from scratch |
| **Proof** | `apiFetch` / `SessionProactiveRefresh` behavior + `/auth/refresh`; mobile contract: [`architecture/mobile-client-session-contract.md`](./architecture/mobile-client-session-contract.md) | |

### Gate A3 — Branch/session semantics

| Criterion | PASS when | FAIL when |
|-----------|-----------|-----------|
| Branch context is unambiguous for REST + WS; stale branch handling exists | `X-Branch-Id`, `BranchGuard`, `BranchTenantGate`, and contract doc aligned | Ad hoc branch headers per screen |
| **Proof** | [`operations/branch-access-policy.md`](./operations/branch-access-policy.md) + [`architecture/branch-session-semantics.md`](./architecture/branch-session-semantics.md) + gate component | |
| **Note** | Per-member branch **ACL** may still be FAIL; **PASS** here means **consistent semantics**, not full ACL | |

### Gate A4 — API contract maturity

| Criterion | PASS when | FAIL when |
|-----------|-----------|-----------|
| Operational hot paths have **shared** request/response types (or generated OpenAPI) consumed by clients | Staff/public contracts in `apps/ops-web/src/lib/contract/*` (or codegen) cover orders, floor, kitchen, branch, public guest as agreed | Each client re-declares ad-hoc types |
| **Proof** | `staff-api.ts`, `public-guest-api.ts`, optional `contract:openapi`; typecheck + tests | |
| **Optional stretch** | OpenAPI export checked into CI **not** required for PASS if pinned TS contracts cover Tier A routes | |

### Gate A5 — Notification readiness

| Criterion | PASS when | FAIL when |
|-----------|-----------|-----------|
| Operational alerts can reach devices **in production-like conditions** (background) | FCM/APNs (or agreed Web Push) + provider binding + targeting policy **and** runbook | Only Socket.IO or only DB outbox without provider |
| **Proof** | `NotificationReadiness.mobilePush` / provider keys valid in `@restocafe/types`; ops runbook | Today: **`FAIL`** — see [`operations/notifications-readiness.md`](./operations/notifications-readiness.md) |
| **Current partial credit** | Durable outbox + retry + invalid-token **hook** implemented — **does not** satisfy PASS | |

### Gate A6 — Offline/retry safety

| Criterion | PASS when | FAIL when |
|-----------|-----------|-----------|
| Financial/critical mutations are replay-safe with documented idempotency | Idempotency keys on close-bill + other critical writes as per [`operations/idempotency-and-offline.md`](./operations/idempotency-and-offline.md); queue policy explicit | Broad offline queue without policy |
| **Proof** | `packages/types/src/mutation-safety.ts` (`MUTATION_SAFETY_BY_OPERATION`, `OFFLINE_REPLAY_BY_OPERATION`) + `offline-queue.ts` allowlist + server idempotency ([`idempotency-and-offline.md`](./operations/idempotency-and-offline.md)) | |

### Gate A7 — Bilingual / RTL

| Criterion | PASS when | FAIL when |
|-----------|-----------|-----------|
| All **staff-exposed** surfaces needed for native parity are localized (EN/AR) with RTL verified | Checklist routes green; no blocking English-only flows in scope | Material staff flows English-only |
| **Proof** | Shared `en`/`ar` leaf keys (`locale-parity.test.ts`) + RTL pass on dense ops layouts (e.g. `SetupPage` progress bar `start-0`, list `ps-5`, `ms-*` spacing) | |

### Gate A8 — PWA/tablet readiness

| Criterion | PASS when | FAIL when |
|-----------|-----------|-----------|
| Ops product is shippable on **shared tablets** via browser/PWA with documented limitations | PWA config + install/runbook; known gaps listed | “Mobile” assumed to mean native only with no tablet baseline |
| **Proof** | `vite-plugin-pwa` config + QA notes | |

### Gate A9 — Test coverage and verification

| Criterion | PASS when | FAIL when |
|-----------|-----------|-----------|
| CI runs unit + integration + critical E2E; API permission/route verification exists | `.github/workflows/ci.yml` + `verify:permissions` + documented E2E prereqs | Native proposed with no automated safety net |
| **Proof** | CI green on default branch; commands in [`mobile-native-prerequisites.md`](./mobile-native-prerequisites.md) | |

---

## Tier B — should PASS before app-store / production native

- Crash/analytics and mobile release pipeline defined.
- Push permission UX and preference model (mute kitchen vs cashier).
- Notification inbox or audit for missed alerts.
- Load/regression budget for mobile fan-out.

---

## Current snapshot (maintenance)

Regenerate when shipping major features:

| Gate | Status | Notes |
|------|--------|--------|
| A1 Product | **PASS** | Floor/dine-in/critical E2E path productized (checklist Ready). |
| A2 Auth/session | **PASS** | JWT + refresh + contract doc. |
| A3 Branch semantics | **PASS** (ACL **FAIL**) | Tenant-wide policy explicit; no per-member branch ACL schema. |
| A4 API contract | **PASS** | Tier A hot paths: shared `staff-api` / `public-guest-api` + `branchPaths` / `publicGuestPaths`; enums in `@restocafe/types`; Vitest path + enum contract tests. **Remaining:** exhaustive OpenAPI diff in CI, long tail of non–hot-path modules. |
| A5 Notifications | **FAIL** | **Partial:** optional **`FcmStaffPushProviderService`** (Firebase HTTP v1) when `STAFF_PUSH_PROVIDER=fcm` + service account; same outbox/worker. **Still FAIL** gate: no **proven** FCM/APNs/Web background delivery on production-like devices, no APNs-native path, no horizontal worker, preference center, inbox. |
| A6 Offline/retry | **FAIL** | **Partial credit:** explicit `OfflineReplayPolicy` + strict Dexie allowlist (close-bill + key + branch); improved cashier/PWA copy. **Still FAIL** for native gate: no broad safe offline mutations, order/create/menu/inventory not queueable. |
| A7 Bilingual/RTL | **FAIL** | **Partial credit:** `SetupPage` keyed; onboarding steps + export CSV localized **by stable step id** (`onboarding-step-copy.ts`); full EN/AR tree parity tested. **Still FAIL:** unmapped step ids; commerce/plan raw values; other routes; no automated RTL screenshot/E2E. |
| A8 PWA/tablet | **PASS** (with caveats) | Browser-first; phone UX not primary. |
| A9 Tests | **PASS** | CI + verify scripts; full native suites N/A. |

**Composite:** **NATIVE_BLOCKED** — failing gates **A5, A6, A7** (minimum) prevent opening a full native program (A4 Tier-A pinned contracts: **PASS**).

---

## References

- [`mobile-readiness-checklist.md`](./mobile-readiness-checklist.md) — item-level inventory.
- [`mobile-native-prerequisites.md`](./mobile-native-prerequisites.md) — commands and summary table.
- [`operations/notifications-readiness.md`](./operations/notifications-readiness.md) — push architecture truth.
