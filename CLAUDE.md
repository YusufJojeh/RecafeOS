# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RestoCafe OS is a multi-tenant SaaS POS (Point of Sale) platform for restaurants and cafés. It is a **pnpm workspace monorepo** with a NestJS backend, React frontend, and shared type/utility packages.

## Build & Development Commands

```bash
# Local infrastructure (Postgres 16, Redis 7, MinIO)
docker compose up -d

# Install dependencies
pnpm install

# Generate Prisma client (required before build/dev)
npm run db:generate

# Run migrations and seed
npm run db:migrate
npm run db:seed

# Development servers
npm run dev:api          # NestJS on :3000 (watch mode)
npm run dev:web          # Vite on :5173 (proxies /api and /socket.io to :3000)

# Full build (types → api → ops-web)
npm run build
```

## Testing Commands

```bash
# Unit tests
npm run test -w api            # Jest, src/**/*.spec.ts
npm run test -w ops-web        # Vitest, jsdom environment

# Integration tests (requires running Postgres + Redis)
npm run test:integration -w api   # Jest, test/integration/**/*.integration-spec.ts
                                  # Runs --runInBand (serial), 120s timeout
                                  # Uses recafe_test database on localhost:5432

# E2E tests
npm run test:e2e:smoke -w ops-web     # Playwright smoke
npm run test:e2e:critical -w ops-web  # Playwright critical path

# Full regression suite
npm run test:regression        # api unit + ops-web unit + e2e smoke

# Run a single test file
npx jest --config test/jest-integration.json test/integration/my-test.integration-spec.ts  # from apps/api/
npx vitest run src/path/to/test.test.ts  # from apps/ops-web/

# Lint
npm run lint                   # All workspaces

# Load testing (requires k6 installed, staging env vars)
npm run load:staging-smoke     # 5 VUs, ~2 min
npm run load:staging-pilot     # 25 VUs, 8 min
npm run load:concurrency       # 20 VUs racing close-bill
npm run load:soak              # 15 VUs, 35 min sustained
npm run load:growth            # 45 VUs, 12 min
npm run load:suite             # Full suite via run-suite.sh
```

## Architecture

### Monorepo Structure

- **`apps/api`** — NestJS 11 backend (REST + Socket.IO WebSocket)
- **`apps/ops-web`** — React 19 + Vite 6 frontend (Tailwind CSS, TanStack React Query, Zustand)
- **`packages/types`** — Shared TypeScript type definitions (realtime events, DTOs)
- **`packages/config`** — Base tsconfig
- **`packages/utils`** — Shared utilities

### Backend Architecture (apps/api)

**Request pipeline:** Helmet → ValidationPipe (whitelist) → ThrottlerGuard (120 req/min) → JwtAuthGuard → BranchGuard (cached) → PermissionsGuard → Controller → SlowRequestInterceptor → HttpMetricsInterceptor → GlobalExceptionFilter

**Module organization:** 18 feature modules in `src/modules/` with clear boundaries. Global infrastructure modules: PrismaModule, StaffAuthCacheModule, IdempotencyModule, LeaderLockModule.

**Key architectural patterns:**
- **Multi-tenancy:** Every query is scoped via `whereUnderBranchTenant(branchId, tenantId)` which returns `{ branchId, branch: { tenantId } }`. No database-level RLS — isolation is application-enforced.
- **ID format:** Prisma uses CUIDs (`@default(cuid())`), not UUIDs. Use `@IsString()` in DTOs, never `@IsUUID()`.
- **NestJS POST responses:** All action POST endpoints use `@HttpCode(200)` explicitly because NestJS defaults POST to 201.
- **Optimistic concurrency:** Order state transitions use `updateMany` with `WHERE status = expected` as an optimistic lock.
- **Pessimistic locking:** Table session creation uses `SELECT ... FOR UPDATE` in Prisma `$transaction`.
- **Distributed idempotency:** Close-bill uses Redis-based lock with token-matched Lua release (90s lock TTL, 10 min idempotency TTL). Falls back to in-memory Map without Redis.
- **Deadlock prevention:** Session/order merge sorts IDs before locking to ensure consistent acquisition order.
- **Audit logging:** Synchronous `await prisma.auditLog.create()` in request path on every state change.
- **Redis:** Optional everywhere. Auth cache, idempotency, Socket.IO adapter, and report cache all gracefully degrade to in-memory when `REDIS_URL` is unset.
- **Leader lock:** `LeaderLockService` ensures scheduled jobs (audit retention) run on exactly one replica.

**Order lifecycle FSM:** DRAFT → CONFIRMED → IN_PREPARATION → READY → SERVED → PAID. Also DRAFT/CONFIRMED → CANCELLED. Defined in `src/modules/orders/order-state.ts`.

**Kitchen module isolation:** ESLint enforces that `kitchen/` cannot import directly from `orders/` — must use `orders.facade`.

### Frontend Architecture (apps/ops-web)

**State management:** Zustand for client state, TanStack React Query for server state (15s default staleTime, refetchOnWindowFocus disabled).

**Realtime:** Socket.IO connection per branch via `BranchRealtimeProvider`. 8 event types defined in `packages/types/src/realtime.ts`. Client-side 320ms debounce batches invalidations. Adaptive polling: 60s when Socket.IO connected, 12s fallback when disconnected, paused when tab backgrounded.

**Virtualization:** `@tanstack/react-virtual` for kitchen tickets and open orders lists (threshold: 28+ items).

**PWA:** Vite PWA plugin with auto-update. Dexie queue is **close-bill only** (idempotency key + `X-Branch-Id` path match); see `offline-queue.ts` and `OFFLINE_REPLAY_BY_OPERATION` in `@restocafe/types`.

### Database

**ORM:** Prisma with PostgreSQL 16. Schema at `apps/api/prisma/schema.prisma` (44 models).

**Connection pool:** PrismaService warns at startup if `DATABASE_URL` lacks `connection_limit`. For production: `?connection_limit=15&pool_timeout=10`. Size as `(limit × replicas) < 70% of Postgres max_connections`.

### WebSocket

**Gateway:** `OpsGateway` at namespace `/ws`. Authenticates via JWT from `handshake.auth.token` or `Authorization` header. Branch-scoped rooms (`branch:${branchId}`). Redis adapter optional for multi-replica. Each `emitBranchEvent` also invokes `BranchRealtimePushBridgeService` → `StaffPushDispatchPort` (default **Postgres outbox** + in-process worker; **provider** noop until FCM/APNs/Web Push).

### API contracts

- **Non-web clients (native / shell):** `docs/architecture/mobile-client-session-contract.md` — `Authorization`, `X-Branch-Id`, Socket.IO `joinBranch`, assumptions (JWT has no branch). Shared literals: `packages/types/src/staff-client-protocol.ts` (`STAFF_HTTP_HEADER`, `STAFF_WS`, …).
- **Offline OpenAPI JSON:** `pnpm run contract:openapi:export` → `contracts/openapi.json` (gitignored).
- **OpenAPI → TS (live API):** `pnpm run contract:openapi -w ops-web` → `apps/ops-web/src/generated/openapi-api.d.ts`.
- Pinned staff/public shapes: `apps/ops-web/src/lib/contract/*.ts` (`publicGuestPaths` for `PublicController`), `@restocafe/types` (realtime, push envelope, `TableSessionStatus`, `PaymentStatus`, `PublicGuestCustomerStatus`, order enums). Contract tests: `api-paths-contract.test.ts`, `contract/hot-path-contract.test.ts`.

### Native mobile program

**Do not open a full native app track until Tier A gates pass.** Authoritative spec: `docs/mobile-readiness-gates.md` (**NATIVE_BLOCKED** until then). Inventory: `docs/mobile-readiness-checklist.md`, strategy: `docs/mobile-strategy.md`.

### Load Testing

8 k6 scripts in `ops/load/` with centralized thresholds in `ops/load/thresholds.json`. CI performance gate in `.github/workflows/perf-gate.yml` (smoke on push to main, pilot+concurrency on release). `compare-runs.js` detects regressions (15% warn, 30% block).

## Environment Variables

Key variables (see `.env.example` for full list):
- `DATABASE_URL` — PostgreSQL connection string (required). Add `?connection_limit=15&pool_timeout=10` for production.
- `REDIS_URL` — Redis connection string (optional locally, **required for multi-replica production**)
- `METRICS_ENABLED` — Enable Prometheus metrics at `/api/v1/internal/metrics` (default: false; **set true in production**)
- `IDEMPOTENCY_REQUIRE_REDIS` — Crash startup if Redis unavailable for close-bill idempotency (default: false; **set true in production**)
- `SLOW_REQUEST_MS` — Threshold for slow request logging (default: 2000)
- `AUTH_CACHE_TTL_SECONDS` — JWT permission cache TTL (default: 45, range 5-300)
- `AUDIT_LOG_RETENTION_DAYS` — Auto-prune audit logs older than N days

## Integration Test Notes

- Tests use `recafe_test` database with seed data, run serially (`--runInBand`)
- Each test suite must clean up its own created resources in `afterAll` (track created IDs, reset FloorTable status to AVAILABLE)
- Tests are self-sufficient — do not depend on state from other test suites
- ts-node may be in `node_modules/.ignored/` due to pnpm — use the path from `.ignored/` if direct `ts-node` fails
