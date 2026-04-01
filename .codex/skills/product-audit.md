---
name: product-audit
description: Audit RecafeOS product completeness, rollout maturity, and architectural risk using actual repository evidence instead of assumptions.
---

# Product Audit Skill

Use this skill when the task is to assess whether the repository represents a complete product, a controlled pilot, or an incomplete system.

## Core rule

Do not give a maturity verdict until you have inspected code from:

- `apps/api`
- `apps/ops-web`
- `docs/operations`
- `docs/growth`
- `.github/workflows`

## Audit sequence

1. Inventory the product surfaces.
   - Read `apps/ops-web/src/App.tsx`.
   - List private routes, auth routes, public guest routes, and internal support routes.
2. Inspect backend module coverage.
   - Read `apps/api/src/app.module.ts`.
   - Inventory controllers under `apps/api/src/modules`.
3. Validate real user flows.
   - Login, invite acceptance, branch selection.
   - Core order/session flow.
   - Kitchen/bar execution.
   - Cashier close-bill.
   - Reports, setup, customers, stock.
4. Check maturity evidence in tests and docs.
   - E2E helpers are especially important.
   - Docs under `docs/operations` often declare deferred or manual steps explicitly.
5. Classify findings into:
   - Complete
   - Incomplete
   - Fragile
   - Missing for real product operation

## RecafeOS-specific high-signal files

- `apps/ops-web/e2e/critical-path-dine-in.spec.ts`
- `apps/ops-web/e2e/helpers/dine-in-api.ts`
- `apps/ops-web/src/pages/SetupPage.tsx`
- `apps/ops-web/src/lib/api.ts`
- `apps/ops-web/src/lib/auth-store.ts`
- `apps/ops-web/src/lib/offline-queue.ts`
- `apps/ops-web/src/pages/PublicMenuPage.tsx`
- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/common/guards/branch.guard.ts`
- `apps/api/src/modules/reports/reports.service.ts`
- `docs/operations/PILOT_OPERATIONAL_READINESS_REPORT.md`
- `docs/operations/ONBOARDING_DEFERRED.md`
- `docs/operations/SUPPORT_TOOLING.md`
- `docs/phase2/MULTIBRANCH_READ_PILOT.md`

## What to treat as strong evidence of incompleteness

- UI tests that need API seeding to create a business flow.
- Setup or onboarding pages that explicitly mention API gaps or operational workarounds.
- Deferred self-serve onboarding, branch isolation, or critical ops procedures.
- Browser clients storing refresh tokens but not using a refresh flow.
- Offline queues with no per-mutation safety policy.
- Public or internal surfaces that bypass the shared i18n and design system.

## Maturity rubric

- `Prototype`: basic modules exist but end-to-end operational flows are not credible.
- `Advanced pilot`: real auth, billing, data model, and ops flows exist, but important workflows still depend on support process, seeded data, or documented workarounds.
- `Production-ready core with gaps`: core venue operation is complete and support-light, but adjacent admin or expansion features still lag.
- `Operationally complete product`: venue operations, onboarding, security, reporting, permissions, and deployment are all self-consistent and support-light.

Default to `Advanced pilot` unless code proves otherwise.

## Required output shape

Always report:

1. Executive verdict
2. Product maturity classification
3. Confirmed complete areas
4. Confirmed incomplete or fragile areas
5. Missing prerequisites for broader rollout
6. Evidence references

## Anti-patterns

- Do not equate many modules with mature product flows.
- Do not trust marketing or roadmap language over the code.
- Do not call support-only workarounds "features".
- Do not hide pilot-stage conclusions to make the output sound nicer.

