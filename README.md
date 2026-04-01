# RestoCafe OS

**RestoCafe OS** is a modern, multi-tenant SaaS Point-of-Sale (POS) platform designed for restaurants and cafés. It provides a comprehensive, real-time operations platform with kitchen management, order lifecycle automation, staff authentication, offline-first capabilities, and comprehensive audit logging.

## 🎯 Product Overview

RestoCafe OS enables restaurant and café operators to:
- **Manage multiple venues** with full multi-tenancy isolation
- **Real-time kitchen operations** with WebSocket-powered ticket updates and status synchronization
- **Order lifecycle automation** from draft to payment with optimistic concurrency control
- **Staff management** with fine-grained permissions and cached authentication
- **Offline operations** with automatic sync when connectivity resumes
- **Comprehensive audit trails** for compliance and accountability
- **Load-tested architecture** designed for production scale

## ✨ Key Features

### Multi-Tenant Architecture
- Complete data isolation per tenant with enforced application-level scoping
- Branch-based operations with per-branch staff and permissions
- Tenant-scoped APIs and real-time events

### Order Management
- Full order lifecycle: DRAFT → CONFIRMED → IN_PREPARATION → READY → SERVED → PAID
- Support for order cancellations with rollback capabilities
- State machine-enforced transitions with optimistic concurrency control
- Audit trail for every order state change

### Kitchen Module
- Real-time ticket system synchronized via WebSocket
- Kitchen staff views with virtualization for large ticket counts
- Ticket status updates propagate instantly to front-of-house

### Real-Time Synchronization
- Socket.IO WebSocket gateway with Redis adapter support for multi-replica deployments
- Eight event types for order, kitchen, and session updates
- Adaptive polling fallback (60s with WebSocket, 12s without)
- Client-side 320ms debounce for efficient server updates

### Offline-First PWA
- Progressive Web App with service workers
- Close-bill operation queued with idempotency tokens for reliable offline execution
- Automatic sync and conflict resolution on reconnection
- Dexie IndexedDB queue management

### Staff & Security
- JWT-based authentication with configurable session tokens
- Hierarchical permissions (admin, manager, cashier, kitchen, waiter)
- Redis-backed auth cache (optional, in-memory fallback)
- 90-second distributed idempotency lock for critical operations

### Audit & Compliance
- Synchronous audit logging on every state change
- Auto-retention management (configurable TTL)
- Full staff action history

## 🛠️ Tech Stack

### Backend (NestJS 11)
- **Framework:** NestJS with Guard pipeline for authentication, validation, throttling, and permissions
- **Database:** PostgreSQL 16 (primary), MySQL 8 (local development only)
- **ORM:** Prisma with optimistic/pessimistic locking support
- **Concurrency:** Distributed Redis-based idempotency with optional Lua scripting
- **WebSocket:** Socket.IO with Redis adapter
- **Caching:** Redis (optional) with graceful in-memory fallback
- **Monitoring:** Prometheus metrics, slow request tracking
- **Load Testing:** k6 with 8+ scenario scripts

### Frontend (React 19 + Vite 6)
- **UI Framework:** React with Tailwind CSS
- **State Management:** Zustand (client state) + TanStack React Query (server state)
- **Real-Time:** Socket.IO client with adaptive fallback polling
- **Offline:** Dexie IndexedDB + PWA service workers
- **Virtualization:** TanStack React Virtual for large lists
- **E2E Testing:** Playwright with smoke and critical path suites

### Monorepo Structure (pnpm workspace)
- **apps/api** — NestJS backend (18 feature modules)
- **apps/ops-web** — React operations dashboard
- **apps/landing** — Marketing landing page
- **packages/types** — Shared TypeScript types and realtime event definitions
- **packages/utils** — Shared utilities
- **packages/config** — Base TypeScript configuration

## 📊 Architecture Highlights

### Request Pipeline (Backend)
```
Helmet → ValidationPipe → ThrottlerGuard → JwtAuthGuard → BranchGuard → PermissionsGuard → Controller
         ↓ Response Path
SlowRequestInterceptor → HttpMetricsInterceptor → GlobalExceptionFilter
```

### Multi-Tenancy Model
Every database query is scoped through `whereUnderBranchTenant(branchId, tenantId)`:
```
{
  branchId,
  branch: { tenantId }
}
```
No database-level RLS—isolation is application-enforced.

### Idempotency & Concurrency
- **Close-bill operation:** Redis-based distributed lock (90s TTL) with token-matched release
- **Order state transitions:** Optimistic locking via `updateMany WHERE status = expected`
- **Session creation:** Pessimistic locking via `SELECT ... FOR UPDATE` in SQL transaction

### Data Model
- 44 Prisma models covering staff, orders, kitchen, sessions, audit logs, and more
- CUID primary keys (not UUIDs)
- Automatic `createdAt`/`updatedAt` timestamps

## 📂 Project Structure

```
apps/
  api/               # NestJS backend (REST + WebSocket)
    src/modules/    # 18 feature modules (orders, kitchen, staff, etc.)
    prisma/         # Schema & migrations (PostgreSQL + MySQL)
    test/           # Integration tests with serial execution
  ops-web/          # React operations dashboard
    src/pages/      # Route pages
    src/components/ # Reusable UI components
    e2e/           # Playwright scenarios
  landing/          # Landing page (Vite)

packages/
  types/            # Shared TypeScript definitions
  utils/            # Shared utility functions
  config/           # Shared tsconfig

docs/
  architecture/     # System design and contracts
  database/         # Migration and schema docs
  operations/       # Deployment and DevOps guides
  mobile-*          # Native mobile readiness gates and strategy
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- pnpm 8+
- Docker & Docker Compose (for local infrastructure)
- PostgreSQL 16, Redis 7, MinIO (via docker-compose)

### Quick Start

#### PostgreSQL (Official Path)

1. Copy environment file:
   ```bash
   cp .env.example .env
   ```

2. Start local infrastructure:
   ```bash
   docker compose up -d
   ```

3. Run health check and setup:
   ```bash
   npm run doctor:local
   npm run dev:setup
   ```

4. Start development servers:
   ```bash
   npm run dev:api         # NestJS on :3000
   npm run dev:web         # Vite on :5173 (proxies /api and /socket.io)
   npm run dev:landing     # Optional: Landing page
   ```

#### MySQL/XAMPP (Local Compatibility)

1. Copy environment files:
   ```bash
   cp .env.example .env
   cp .env.mysql-xampp.example .env.mysql-xampp
   ```

2. Start MySQL in XAMPP

3. Setup and run:
   ```bash
   npm run dev:setup:mysql
   npm run dev:api:mysql
   npm run dev:web
   ```

## 📋 Common Commands

### Setup & Validation
```bash
npm run doctor:local              # Local environment health check
npm run dev:setup                 # Initialize databases (PostgreSQL)
npm run dev:setup:mysql           # Initialize databases (MySQL)
npm run db:generate               # Generate Prisma client
npm run db:migrate                # Run migrations
npm run db:seed                   # Seed development data
```

### Development
```bash
npm run dev:api                   # Start API server (watch mode)
npm run dev:web                   # Start web dashboard (watch mode)
npm run dev:landing               # Start landing page (watch mode)
npm run build                     # Full monorepo build
npm run lint                      # Lint all workspaces
```

### Testing
```bash
npm run test                      # Unit tests (api + ops-web)
npm run test:integration          # Integration tests (requires running DB + Redis)
npm run test:e2e:smoke            # Smoke E2E tests (Playwright)
npm run test:e2e:critical         # Critical path E2E tests
npm run test:regression           # Full regression suite
```

### Verification & Quality
```bash
npm run verify:repo               # Linting + type checking
npm run verify:integration        # Integration test suite
npm run verify:e2e:smoke          # E2E smoke tests
npm run verify:everything         # Full quality gate
```

### Load Testing
```bash
npm run load:staging-smoke        # 5 VUs, ~2 min
npm run load:staging-pilot        # 25 VUs, 8 min
npm run load:concurrency          # 20 concurrent users
npm run load:soak                 # 15 VUs, 35 min sustained
npm run load:growth               # 45 VUs growth test
npm run load:suite                # Full test suite
```

### Database & Infrastructure
```bash
npm run db:provider:report        # Report which DB provider is configured
npm run db:connect:check          # Verify database connectivity
npm run redis:connect:check       # Verify Redis connectivity
npm run verify:mysql:local        # Verify MySQL local setup
```

## 🗄️ Database Strategy

### PostgreSQL (Official & Production)
- Primary database for CI, staging, and production
- Full feature support including reports, analytics, and AI insights
- Production connection pool: `connection_limit=15&pool_timeout=10`

### MySQL (Local Development Only)
- Local-only compatibility for specific workflows
- Schema at `apps/api/prisma/mysql/schema.prisma`
- Limitations:
  - Reports and analytics remain PostgreSQL-only
  - AI insights unavailable
  - Use `migrate deploy`, not `migrate dev`

### Documentation
- [Migrations Guide](docs/database/MIGRATIONS.md)
- [Database Compatibility](docs/database/COMPATIBILITY.md)
- [Local Setup Details](docs/database/LOCAL_SETUP.md)

## 🔧 Configuration

Key environment variables:
- `DATABASE_URL` — PostgreSQL connection string (add `?connection_limit=15&pool_timeout=10` for production)
- `REDIS_URL` — Redis connection string (optional locally, required for multi-replica production)
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — Secret keys for token signing
- `CORS_ORIGIN` — Allowed origins for CORS
- `METRICS_ENABLED` — Enable Prometheus at `/api/v1/internal/metrics` (set true in production)
- `IDEMPOTENCY_REQUIRE_REDIS` — Require Redis for close-bill idempotency (set true for multi-replica production)
- `AUTH_CACHE_TTL_SECONDS` — JWT permission cache TTL (default: 45, range: 5-300)
- `AUDIT_LOG_RETENTION_DAYS` — Auto-prune audit logs older than N days

See `.env.example` for complete configuration.

## 📦 Deployment

Deployment guidance and automation scripts are available in:
- [Deployment README](deploy/README.md)
- [DevOps Deployment Guide](docs/operations/DEPLOYMENT_DEVOPS.md)
- [Mobile Readiness Gates](docs/mobile-readiness-gates.md) (native app support status)

## 🚢 Production Checklist

Before deploying to production:
- [ ] Keep `DB_PROVIDER=postgresql`
- [ ] Configure strong `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`
- [ ] Set `CORS_ORIGIN` explicitly
- [ ] Enable `METRICS_ENABLED=true` for Prometheus scraping
- [ ] Set `IDEMPOTENCY_REQUIRE_REDIS=true` for multi-replica deployments
- [ ] Configure connection pooling: `connection_limit=15&pool_timeout=10`
- [ ] Review deployment guide in `deploy/README.md`

## 📚 Documentation

- **[Architecture](docs/architecture/)** — System design, API contracts, realtime events
- **[Database](docs/database/)** — Migrations, schema, local setup
- **[Operations](docs/operations/)** — Deployment, monitoring, DevOps guides
- **[Mobile](docs/)** — Mobile readiness, native strategy, prerequisites
- **[Product](docs/)** — Completeness audit, feature specs

## 🧪 Testing Strategy

### Unit Tests
- **Backend:** Jest with `src/**/*.spec.ts` pattern
- **Frontend:** Vitest with jsdom environment
- Command: `npm run test -w api` or `npm run test -w ops-web`

### Integration Tests
- Serial execution (`--runInBand`) for database consistency
- 120s timeout per suite
- Dedicated `recafe_test` database
- Command: `npm run test:integration -w api`

### E2E Tests
- Playwright-based scenarios (smoke, critical path)
- Commands: `npm run test:e2e:smoke -w ops-web`, `npm run test:e2e:critical -w ops-web`

### Load Testing
- k6 scripts in `ops/load/` with centralized thresholds
- CI performance gate via `.github/workflows/perf-gate.yml`
- Regression detection: 15% warn, 30% block

## 📱 Mobile Readiness

Native mobile support is planned. Check current status:
- [Readiness Gates](docs/mobile-readiness-gates.md) — Blocking gates
- [Readiness Checklist](docs/mobile-readiness-checklist.md) — Implementation tracking
- [Strategy](docs/mobile-strategy.md) — Roadmap and approach

**Current Status:** NATIVE_BLOCKED (gates must pass before development starts)

## 🤝 Contributing

- Follow existing code style and patterns
- Ensure all tests pass: `npm run verify:everything`
- Create atomic commits with clear messages
- Submit PRs with integration test results

## 📄 License

See LICENSE file for details.

---

For detailed architecture, API contracts, and deployment guidance, see the [docs/](docs/) folder.

## Local development

### Official path: PostgreSQL

1. Copy `.env.example` to `.env`.
2. Run `npm run doctor:local`.
3. Run `npm run dev:setup`.
4. Run `npm run dev:api`.
5. Run `npm run dev:web`.

Optional: `npm run dev:landing`.

### Local compatibility path: XAMPP / MySQL

This path is supported for local API boot and core venue operations only.
Production remains PostgreSQL-only.

1. Copy `.env.example` to `.env`.
2. Copy `.env.mysql-xampp.example` to `.env.mysql-xampp`.
3. Start MySQL in XAMPP.
4. Run `npm run dev:setup:mysql`.
5. Run `npm run dev:api:mysql`.
6. Run `npm run dev:web`.

## Common commands

```bash
npm run build
npm run lint
npm run test
npm run doctor:local
npm run verify:repo
npm run verify:integration
npm run verify:e2e:smoke
npm run verify:everything
npm run verify:mysql:local
npm run db:provider:report
npm run db:connect:check
npm run redis:connect:check
```

## Database strategy

- PostgreSQL is the official database for CI, staging, and production.
- MySQL/XAMPP is a local-only compatibility path.
- MySQL local mode uses:
  - `apps/api/prisma/mysql/schema.prisma`
  - `apps/api/prisma/mysql/migrations/`
  - provider-aware startup and CLI scripts
- MySQL local limitations:
  - reports and analytics endpoints remain PostgreSQL-only
  - AI insights that depend on reports remain PostgreSQL-only
  - local MySQL should use `migrate deploy`, not `migrate dev`

DB docs:

- `docs/database/MIGRATIONS.md`
- `docs/database/COMPATIBILITY.md`
- `docs/database/LOCAL_SETUP.md`

## Production notes

- Keep `DB_PROVIDER=postgresql`.
- Set strong `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.
- Set `CORS_ORIGIN` explicitly.
- Enable `METRICS_ENABLED=true` for Prometheus scraping.
- Set `IDEMPOTENCY_REQUIRE_REDIS=true` for multi-replica API deployments.
- Deployment assets and checklists live in `deploy/README.md` and `docs/operations/DEPLOYMENT_DEVOPS.md`.
#   R e c a f e O S  
 