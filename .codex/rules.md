# RecafeOS Codex Rules

## Scope-first working method

1. Audit before changing anything significant.
2. Read the real implementation, not just README files.
3. Separate every conclusion into:
   - Confirmed from code
   - Inferred from code and docs
   - Missing or unproven
4. Do not call this product "complete" unless the staff, guest, billing, support, and deployment flows are all proven end to end in the repo.

## Repository map to inspect first

- `apps/api`: source of truth for auth, permissions, branch scope, orders, reporting, support tooling, and deployment assumptions.
- `apps/ops-web`: source of truth for operational UX, route maturity, i18n/RTL, client auth behavior, and realtime usage.
- `apps/landing`: marketing site only unless code proves otherwise.
- `packages/types`: shared enums and realtime event names only; do not assume it is a full API contract layer.
- `docs/operations`, `docs/growth`, `docs/phase2`: explicit rollout constraints, deferred features, support processes, and scale assumptions.
- `ops/load` and `.github/workflows`: operational maturity, release gates, and performance expectations.

## Product-completeness discipline

- Do not confuse "broad module coverage" with "complete product".
- Treat pilot-only flows, support-only workarounds, seeded demos, and key-based operator paths as maturity warnings.
- Check E2E helpers for missing UI flows. If tests seed data through the API to make a flow possible, that is evidence the UI flow is incomplete.
- Treat any "deferred", "out of scope", "not wired", or "manual process" statements in code or docs as real product gaps unless disproven.

## Backend/frontend integration rules

- The backend contract is the real contract. Verify controller routes, DTOs, guards, and service behavior before changing UI assumptions.
- Preserve `Authorization: Bearer <token>` and `X-Branch-Id` semantics unless both API and client are updated deliberately.
- Do not loosen tenant or branch boundaries casually. Inspect `BranchGuard`, permission guards, and any support-only bypasses first.
- Treat idempotent mutations as special cases. Preserve `Idempotency-Key` behavior on close-bill and do not add offline retries to unsafe mutations without matching server guarantees.
- Prefer extracting typed API contracts from Swagger or shared schemas before adding more clients.

## Auth and security rules

- Verify login, invite acceptance, refresh, logout, and `auth/me` behavior from `apps/api/src/modules/auth`.
- Do not assume the web client refreshes tokens automatically. Confirm the actual `apiFetch` behavior first.
- Support tooling is not normal product surface. It is operator-only and can use different trust boundaries.
- Do not widen support access, key usage, or allowlists without documenting the risk.
- Preserve audit logging expectations on support and sensitive tenant actions.

## Arabic, English, and RTL rules

- Every user-facing change in `ops-web` must be checked for English and Arabic.
- Every route must respect `lang` and `dir`.
- Portal content, dialogs, popovers, drawers, and sheets must inherit or receive the correct direction explicitly.
- Do not ship partial translation on shell chrome while leaving page bodies hardcoded.
- Public pages count too. Guest menu, auth flows, and internal tools must be evaluated intentionally, not assumed.

## Mobile decision rules

- Do not choose a mobile stack because the web app uses React.
- First verify product maturity, API readiness, branch/auth semantics, offline safety, and role-specific UX density.
- If the web product is still pilot-stage or operationally incomplete, say so clearly and recommend prerequisite work before native mobile.
- Evaluate at minimum:
  - React Native / Expo
  - Flutter
  - Kotlin Multiplatform if native-specific investment is plausible
  - PWA-first
  - Hybrid staged strategy if the repo evidence supports it
- Prefer tablet-first PWA or companion-app strategy when the current product is browser-centric, branch-scoped, and dense with operational tables/forms.

## Architecture-change rules

- Keep the modular monolith unless the repo demonstrates a concrete scale trigger that tuning cannot solve.
- Do not introduce random abstractions, extra services, or speculative mobile sync engines.
- Improve contracts, session handling, pagination, idempotency, and UX correctness before pursuing large platform expansions.
- Preserve existing business constraints around commerce, branch rollout, and pilot operations.

## Minimum verification before closing work

- For audit work, cite the concrete files that support the verdict.
- For integration changes, verify both API and `ops-web` paths.
- For auth-sensitive work, test login and at least one protected route.
- For bilingual UI changes, check both `en` and `ar`, including RTL.
- For mobile strategy work, state clearly:
  - whether mobile should start now or later
  - what must be fixed first
  - which personas and flows belong in v1

