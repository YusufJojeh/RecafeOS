# Native mobile prerequisites — gap map and status

Single entry point before starting **React Native / Flutter / KMP**. Updated after the Mar 2026 implementation pass.

| Area | Status after pass | Notes |
|------|-------------------|--------|
| **1. Staff-critical web flows** | **Improved → Ready** | Floor UI opens sessions and creates dine-in orders (`FloorPage`, `FloorOpenSessionModal`, `FloorDineInOrderModal`). Critical E2E: `apps/ops-web/e2e/helpers/floor-dine-in-ui.ts`. |
| **2. Client token refresh** | **Ready** | `apiFetch` 401 refresh + proactive JWT refresh. |
| **3. Branch access semantics** | **Partial** | **Tenant-wide model** is explicit ([`operations/branch-access-policy.md`](./operations/branch-access-policy.md)). **Implementation:** [`architecture/branch-session-semantics.md`](./architecture/branch-session-semantics.md), `/auth/me` branch fields, ops-web `BranchTenantGate`. **No** `TenantMember`↔branch ACL yet. Native clients: [`architecture/mobile-client-session-contract.md`](./architecture/mobile-client-session-contract.md). |
| **4. Typed contract** | **Partial** | Hot-path types in [`apps/ops-web/src/lib/contract/staff-api.ts`](../apps/ops-web/src/lib/contract/staff-api.ts); optional OpenAPI gen: [`contracts/openapi.md`](./contracts/openapi.md). |
| **5. Mutation safety** | **Partial** | Close-bill + **create order** support `Idempotency-Key` (see [`idempotency-and-offline.md`](./operations/idempotency-and-offline.md)). Broad offline queue still limited. |
| **6. Notifications** | **Partial** | Durable **`StaffPushOutbox`** + in-process worker + provider port (**noop**); **no FCM/APNs/Web Push** ([`notifications-readiness.md`](./operations/notifications-readiness.md)). |
| **7. Bilingual / RTL** | **Partial** | `SetupPage` + onboarding steps: client maps `branches.service` step ids to `setupPage.onboardingSteps` / `onboardingCsv`; API English fallback for unknown ids. |

## Validation commands

```bash
pnpm --filter @restocafe/types build
pnpm --filter api run prisma:generate
pnpm --filter api run build
pnpm --filter ops-web run test
pnpm --filter api run verify:permissions
pnpm --filter ops-web run test:e2e:critical   # needs API + DB + seed
```

## Final readiness (this repo)

| Gate | Status |
|------|--------|
| Ready for **PWA / tablet** hardening | **Yes** |
| Ready for **full native app program** | **No** — **[`mobile-readiness-gates.md`](./mobile-readiness-gates.md)** Tier A not satisfied (**NATIVE_BLOCKED**). |

See [`mobile-readiness-checklist.md`](./mobile-readiness-checklist.md) and [`mobile-readiness-gates.md`](./mobile-readiness-gates.md).
