# Deployment artifacts

| File | Purpose |
|------|---------|
| [`docker-compose.stack.yml`](./docker-compose.stack.yml) | Postgres + Redis + API (build from repo Dockerfile) |
| [`nginx/restocafe.conf.example`](./nginx/restocafe.conf.example) | Reverse proxy: static SPA + `/api` + WebSocket upgrade |
| [`scripts/provision-pilot-tenant.mjs`](./scripts/provision-pilot-tenant.mjs) | Node script calling support provision API (`pnpm run pilot:provision` from repo root) |
| [`scripts/prisma-migrate-deploy.sh`](./scripts/prisma-migrate-deploy.sh) | Run `prisma migrate deploy` in `apps/api` (requires `DATABASE_URL`) |
| [`scripts/expire-trials-job.sh`](./scripts/expire-trials-job.sh) | `POST .../support/jobs/expire-trials` for cron/scheduler (`SUPPORT_API_KEY`, `API_BASE_URL`) |
| [`k8s/cronjob-expire-trials.example.yaml`](./k8s/cronjob-expire-trials.example.yaml) | Example Kubernetes `CronJob` for trial expiry |
| [`observability/pilot-alerts.example.yaml`](./observability/pilot-alerts.example.yaml) | Example Prometheus alert rules (tune thresholds; set `METRICS_ENABLED`, `GIT_SHA` / `APP_VERSION` per [`OBSERVABILITY.md`](../docs/operations/OBSERVABILITY.md)) |

Full checklists: [`docs/operations/DEPLOYMENT_DEVOPS.md`](../docs/operations/DEPLOYMENT_DEVOPS.md). Pilot onboarding: [`docs/operations/ONBOARDING_PROVISION.md`](../docs/operations/ONBOARDING_PROVISION.md).

**Demo vs pilot:** separate stacks and metadata rules for sales demos vs paid pilots — [`docs/operations/DEMO_AND_PILOT_ENVIRONMENT.md`](../docs/operations/DEMO_AND_PILOT_ENVIRONMENT.md). Optional automation: [`scripts/demo-reset-smoke.sh`](./scripts/demo-reset-smoke.sh) or `pnpm run demo:reset-smoke` from repo root (after health/reset, walk the live UI using §1 steps B–H in [`docs/operations/DEMO_SALES_EXECUTION_PACKAGE.md`](../docs/operations/DEMO_SALES_EXECUTION_PACKAGE.md)).

**Live demos / pilot conversion:** talk track, objections, and post-demo handoff — [`docs/operations/DEMO_SALES_EXECUTION_PACKAGE.md`](../docs/operations/DEMO_SALES_EXECUTION_PACKAGE.md).

## Environment templates (canonical)

- **Monorepo / local:** copy [`.env.example`](../.env.example) at the repo root. It includes API defaults, Vite vars, and pointers for MySQL/XAMPP.
- **API-only (containers, systemd):** use [`apps/api/.env.example`](../apps/api/.env.example) as the source of truth for API variable names and comments. Keep names aligned with root `.env.example` for shared keys (`DATABASE_URL`, `REDIS_URL`, `JWT_*`, `CORS_ORIGIN`, `APP_PUBLIC_URL`, `METRICS_ENABLED`, etc.).

## Metrics in production

Set **`METRICS_ENABLED=true`** so the API exposes Prometheus metrics at `/api/v1/internal/metrics` (see [`docs/operations/OBSERVABILITY.md`](../docs/operations/OBSERVABILITY.md)). The example stack sets `METRICS_ENABLED` to `true` by default (`deploy/docker-compose.stack.yml`). Wire scrape configs, dashboards, and alerts in your observability stack; start from [`observability/pilot-alerts.example.yaml`](./observability/pilot-alerts.example.yaml).

## Production checklist (API)

- **Redis:** `REDIS_URL` reachable from every API replica; **`IDEMPOTENCY_REQUIRE_REDIS=true`** in production (reject explicit `false`).
- **CORS:** `CORS_ORIGIN` matches the ops-web (and any other allowed) origins.
- **Proxy:** `TRUST_PROXY=true` when behind Nginx/Caddy/ALB so client IP and HTTPS are correct.
- **Metrics:** `METRICS_ENABLED=true` and scrape `/api/v1/internal/metrics`.
- **Public URLs:** `APP_PUBLIC_URL` set to your public API base (`https://…`) for guest QR and public menu links (required when `NODE_ENV=production`).
- **Secrets:** rotate `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` on a schedule; never reuse dev values.
- **Migrations:** prefer `pnpm run db:migrate:deploy` from CI before rollout; optional `RUN_MIGRATIONS_ON_START` only for single-node bootstrap.

## Common commands (pnpm)

From the **repository root** (after `pnpm install --frozen-lockfile`):

- `pnpm run pilot:provision` — pilot tenant provisioning script (see table above).
- `pnpm run db:migrate:deploy` — apply Prisma migrations to the target database.
- `pnpm run verify:repo` / `pnpm run verify:integration` — CI-style verification (see root `package.json`).

Docker API image: from repo root, `docker build -f apps/api/Dockerfile .`
