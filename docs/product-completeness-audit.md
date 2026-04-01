# Product Completeness Audit

Date: 2026-03-30

## Executive verdict

RecafeOS is not an operationally complete product yet.

It is an advanced pilot-stage restaurant operations system with real architecture, real billing and access controls, real staff workflows, and unusually strong support/runbook discipline. It is also still dependent on support-led onboarding, documented workarounds, partial UX coverage, and some contract weaknesses that would be risky to multiply through a native mobile app.

## Product maturity classification

Classification: Advanced pilot / controlled rollout product, not general-availability complete.

## Method

This audit is grounded in the current repository, especially:

- `apps/api/src/app.module.ts`
- `apps/api/src/modules/auth/*`
- `apps/api/src/modules/orders/*`
- `apps/api/src/modules/branches/*`
- `apps/api/src/modules/public/*`
- `apps/api/src/modules/reports/reports.service.ts`
- `apps/api/prisma/schema.prisma`
- `apps/ops-web/src/App.tsx`
- `apps/ops-web/src/lib/api.ts`
- `apps/ops-web/src/lib/auth-store.ts`
- `apps/ops-web/src/lib/branch-realtime.tsx`
- `apps/ops-web/src/lib/offline-queue.ts`
- `apps/ops-web/src/pages/SetupPage.tsx`
- `apps/ops-web/src/pages/PublicMenuPage.tsx`
- `apps/ops-web/e2e/critical-path-dine-in.spec.ts`
- `apps/ops-web/e2e/helpers/dine-in-api.ts`
- `docs/operations/PILOT_OPERATIONAL_READINESS_REPORT.md`
- `docs/operations/ONBOARDING_DEFERRED.md`
- `docs/operations/SUPPORT_TOOLING.md`
- `docs/phase2/MULTIBRANCH_READ_PILOT.md`

## Confirmed complete enough to run real pilots

### Backend scope is substantial

Confirmed from `apps/api/src/app.module.ts` and `apps/api/prisma/schema.prisma`:

- Multi-tenant model with tenants, branches, users, roles, permissions, invites, refresh tokens, audit logs, support metadata, pilot feedback, and weekly snapshots.
- Operational domain coverage for floor tables, table sessions, orders, order items, preparation tickets, payments, shifts, menu, inventory, customers, offers, and waiter calls.
- Public guest menu and waiter-call surface.
- Internal support and pilot portfolio surface.
- Commerce and billing-state enforcement.

This is not a toy backend.

### Auth and permissions are real

Confirmed from `apps/api/src/modules/auth/auth.controller.ts` and `auth.service.ts`:

- JWT access and refresh tokens exist.
- Refresh tokens are hashed and stored server-side.
- Multi-tenant login is supported.
- Invite acceptance is implemented as the real account-creation path.
- `auth/me` returns effective permissions.

Confirmed from guards and controller usage:

- Endpoints are permission-gated.
- Branch-scoped routes use `BranchGuard` and `X-Branch-Id`.

### Core venue operations exist

Confirmed from route inventory and `apps/api/src/modules/orders/orders.controller.ts`:

- Orders can be created, edited, confirmed, sent to preparation, moved, merged, served, closed, and cancelled.
- Kitchen and bar ticket APIs exist.
- Stock and recipe APIs exist.
- Reporting APIs exist for branch and tenant layers.

Confirmed from `apps/ops-web/src/App.tsx`:

- The main operational web surfaces exist for floor, orders, menu, kitchen, bar, reports, weekly digest, stock, customers, and setup.

### Realtime and deployment discipline exist

Confirmed from `apps/api/src/websocket/ops.gateway.ts` and `apps/ops-web/src/lib/branch-realtime.tsx`:

- Branch-scoped Socket.IO realtime is implemented.
- The client uses sockets for query invalidation and resync, not as an unsafe source of truth.

Confirmed from `.github/workflows/ci.yml` and `ops/load/README.md`:

- CI builds, unit tests, API integration tests, smoke E2E, Docker image build, and load-test tooling exist.
- Load-test scripts cover smoke, pilot, soak, payment concurrency, and websocket behavior.

This repo is operationally serious for a pilot.

## Confirmed incomplete or fragile areas

### The full staff critical path is not complete in the web UI

Confirmed from `apps/ops-web/e2e/critical-path-dine-in.spec.ts` and `apps/ops-web/e2e/helpers/dine-in-api.ts`:

- The high-value dine-in test logs in through the UI, then seeds the open session, order creation, line items, confirmation, and send-to-prep by direct API calls.
- The UI then resumes only for kitchen, bar, and cashier.

That is strong evidence that the staff web app does not yet provide a complete in-UI order/session capture flow for the tested critical path.

### Shift and cash-drawer operation is explicitly not wired

Confirmed from `apps/ops-web/src/pages/SetupPage.tsx`:

- The setup page states that structured open-shift / cash-drawer tracking is not wired in the API yet and advises venues to keep existing cash procedures.

That is a real product gap, not a cosmetic issue.

### Session refresh exists in the API but is not wired in the SPA client

Confirmed from:

- Backend refresh endpoint in `apps/api/src/modules/auth/auth.controller.ts`
- Stored refresh tokens in `apps/api/src/modules/auth/auth.service.ts`
- Client storage in `apps/ops-web/src/lib/auth-store.ts`
- Client fetch wrapper in `apps/ops-web/src/lib/api.ts`

The web client stores `refreshToken` but `apiFetch` does not attempt token refresh or retry on `401`.

This is acceptable for an internal pilot if staff re-login occasionally. It is weak for a mobile client where session continuity matters much more.

### Offline support is only a primitive

Confirmed from `apps/ops-web/src/lib/offline-queue.ts` and `docs/operations/idempotency-and-offline.md`:

- The queue only stores `{ path, method, body, createdAt }`.
- There is no typed mutation policy, no conflict model, no queue visibility in UI, and no broad idempotency guarantee.
- Repo docs explicitly say the queue is for non-critical, retry-safe actions only.

This is not mobile-grade offline architecture.

### Branch access is still tenant-wide, not branch-isolated

Confirmed from `docs/phase2/MULTIBRANCH_READ_PILOT.md` and `docs/growth/BRANCH_ROLLOUT_MODEL.md`:

- Per-branch membership filtering is deferred.
- `defaultBranchId` is a UI default, not a hard API restriction.
- A tenant member can send `X-Branch-Id` for any branch in the tenant today.

This is a major maturity gap for multi-branch correctness and any future mobile rollout.

### Public and internal UX is not fully unified or fully translated

Confirmed from `apps/ops-web/src/pages/PublicMenuPage.tsx`:

- The public guest menu still contains hardcoded English copy and bypasses the shared language layer.

Inferred from direct code inspection of the internal support surfaces:

- Internal/operator pages remain more English-heavy and less integrated with the product i18n discipline than the main shell.

That means the product is not yet truly complete on English/Arabic consistency.

### Menu management is only partially productized on the frontend

Confirmed from `apps/ops-web/src/pages/MenuPage.tsx`:

- The current UI focuses on list display plus JSON dry-run/apply import.
- There is no broad, polished, visual menu-management surface comparable to a mature admin product.

The API is richer than the current UI.

### Analytics portability is incomplete

Confirmed from `apps/api/src/modules/reports/reports.service.ts`:

- Advanced reporting throws `NotImplementedException` on the local MySQL compatibility path.

This is a reasonable engineering choice, but it means the product is more narrowly production-shaped around PostgreSQL than some repo paths may imply.

### Support operations remain process-heavy and key-based

Confirmed from `docs/operations/SUPPORT_TOOLING.md` and `docs/operations/INTERNAL_SUPPORT_CONSOLE.md`:

- Support uses server-side keys, allowlists, and internal routes.
- Some sensitive commercial changes remain REST/Swagger-only to avoid fat-finger UI.
- Operator SSO is deferred.

This is workable for trained operators, not a sign of a low-touch, broadly self-serve product.

## Missing for a real low-support product

These are the main items still missing if the goal is a generally complete product rather than a controlled pilot:

- Complete in-UI order capture and table-session initiation without E2E helper seeding.
- Real client-side token refresh and session recovery behavior.
- Hard per-branch access control instead of tenant-wide branch access.
- Lower-support onboarding and member lifecycle. Staff invites exist, but owner provisioning and broader rollout still rely heavily on support process.
- A defined offline and retry model for staff operations, not just a primitive queue.
- Complete bilingual and RTL consistency across all user-facing surfaces.
- Structured shift, drawer, and close-of-day operational workflows if the product intends to replace existing cash procedures fully.
- A stronger typed contract layer for additional clients.

## Architecture health

### Strengths

- Clear modular monolith.
- Strong domain coverage in Prisma and Nest modules.
- Real permission model.
- Realtime used conservatively.
- Good CI, integration, E2E, and load-test posture for a pilot product.
- Honest operational docs and rollout discipline.

### Debt concentration

- Client auth/session layer is weaker than backend auth.
- Product UX maturity lags backend capability in a few core areas.
- Branch access semantics are not strict enough for multi-branch confidence.
- Offline/mobile contract discipline is not ready for a second client platform.
- Support burden is still a major part of the operating model.

## Deployment assumptions

Confirmed from `apps/api/.env.example`, `apps/api/src/config/env.ts`, `docker-compose.yml`, and load/perf docs:

- PostgreSQL is the real database target.
- Redis is required for production-safe idempotency and scaled websocket behavior.
- `APP_PUBLIC_URL` must be correct for guest QR flows.
- Support UI is gated by environment flags and allowlists.
- Observability and scheduled jobs are assumed by the operating model.

This product expects a disciplined hosted environment. It is not a "drop it anywhere" package.

## Final classification

RecafeOS is best described as:

- Technically substantial
- Operationally credible for narrow paid pilots
- Not yet complete enough to call a finished low-support product
- Not yet mature enough to justify a full native mobile program without prerequisite work
