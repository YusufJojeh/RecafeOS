---
name: mobile-architecture
description: Evaluate the best mobile strategy for RecafeOS by auditing product maturity, API readiness, role workflows, and cross-platform tradeoffs before recommending any stack.
---

# Mobile Architecture Skill

Use this skill when asked whether RecafeOS should build mobile, what kind of mobile product it should be, or which stack is justified.

## Non-negotiable rule

Do not choose a stack first.

Audit the real system first, then compare options.

## Required audit inputs

Inspect at least:

- `apps/ops-web/src/App.tsx`
- `apps/ops-web/src/lib/api.ts`
- `apps/ops-web/src/lib/auth-store.ts`
- `apps/ops-web/src/lib/branch-realtime.tsx`
- `apps/ops-web/src/lib/offline-queue.ts`
- `apps/ops-web/src/pages/SetupPage.tsx`
- `apps/ops-web/e2e/critical-path-dine-in.spec.ts`
- `apps/api/src/modules/auth`
- `apps/api/src/modules/orders`
- `apps/api/src/modules/branches`
- `apps/api/src/modules/public`
- `docs/operations/idempotency-and-offline.md`
- `docs/operations/PILOT_OPERATIONAL_READINESS_REPORT.md`
- `docs/growth/POST_PILOT_STAKEHOLDER_ALIGNMENT.md`

## Questions to answer before recommending any stack

1. Is the product mature enough for another client surface?
2. Does the API support mobile session handling cleanly?
3. Are branch, tenant, and permission semantics stable enough for mobile?
4. Are operational flows suitable for phone, tablet, or browser-only surfaces?
5. Is offline actually designed, or only hinted at?
6. Is push/background behavior needed for the first mobile value proposition?
7. Is bilingual English/Arabic plus RTL support already proven in shared UX patterns?

## Comparison frame

Evaluate each option against:

- Product maturity
- API contract stability
- Session/token model
- Branch scoping
- Realtime model
- Offline replay safety
- Push notification path
- Tablet suitability
- RTL and Arabic support
- Code sharing potential
- Release speed
- Long-term maintenance risk

## RecafeOS-specific defaults

- Treat the current product as browser-first unless code disproves it.
- Treat kitchen/bar/floor as tablet/browser workflows before treating them as phone-native workflows.
- Treat manager/owner visibility as a possible phone-companion use case, not proof that a full mobile ops app is ready.
- Treat PWA as a serious option because `ops-web` already uses `vite-plugin-pwa`.
- Treat native mobile as premature if client-side refresh, contract generation, offline policy, and branch access rules are still weak.

## Decision rules

- If the product is still pilot-stage, recommend prerequisite work before native mobile.
- If mobile should start now, define a narrow v1 and explicit non-goals.
- If a native path is justified later, prefer the option with the best balance of:
  - team leverage
  - contract reuse potential
  - RTL support
  - tablet/phone fit
  - production complexity

## Output requirements

Always provide:

1. Whether mobile should start now or later
2. Current best delivery strategy
3. Stack comparison table
4. Final recommendation and why
5. Why the rejected options are weaker
6. Prerequisites that must be fixed first
7. v1 personas, screens, and non-goals

