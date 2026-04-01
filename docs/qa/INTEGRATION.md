# Backend integration tests

Located under [`apps/api/test/integration/`](../../apps/api/test/integration/).

## Prerequisites

- PostgreSQL reachable via `DATABASE_URL` (same as local dev).
- Schema applied: `npm run db:migrate:deploy -w api` (or `prisma migrate dev`).
- Seed data: `npm run db:seed -w api` (creates `demo` tenant, `main` branch, menu, stock, tables).
- Recommended for local runs: **`REDIS_URL`** (e.g. `redis://127.0.0.1:6379` with Docker Compose) so integration exercises **Redis-backed** close-bill idempotency (locks, token release, replay) as in production. Local runs may still omit Redis only when intentionally validating single-process dev behavior. CI sets `REDIS_URL` in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) for the `api-integration` job.

## Run

```bash
cd apps/api
npm run test:integration
```

These tests boot the full Nest `AppModule` and issue real HTTP requests. They are **not** included in the default `npm run test:regression` at the repo root (which stays DB-free for developer machines and CI without Postgres).

## CI recommendation

- **PR checks**: unit tests + frontend Vitest + Playwright smoke (`npm run test:regression`).
- **Nightly / merge queue**: add a job with a Postgres service container, then run `npm run test:integration -w api`.

## Failure: `app.close` / Prisma errors

If `beforeAll` fails (e.g. bad credentials), teardown still closes Prisma safely. Fix `DATABASE_URL` and re-run.
