# Playwright pilot flow (full stack)

## What it covers

[`apps/ops-web/e2e/pilot-flow.spec.ts`](../../apps/ops-web/e2e/pilot-flow.spec.ts) runs:

1. Login with seeded demo user (`owner@demo.local` / `demo12345` — see [`apps/api/prisma/seed.ts`](../../apps/api/prisma/seed.ts))
2. Select **Main** branch
3. Open **Kitchen** and assert the preparation queue shell loads

## Prerequisites (local)

- Postgres with schema + seed (`npm run prisma:seed -w api`)
- API on port **3000** (`npm run start:dev -w api`); optional **`REDIS_URL`** for production-like idempotency/WS
- ops-web dev server on **5173** with Vite proxying `/api` to the API (default)

Run Playwright without starting Vite from the config (because you started servers yourself):

```bash
# from repo root, with API + vite already running
cd apps/ops-web
set PLAYWRIGHT_SKIP_WEBSERVER=1   # Windows
# export PLAYWRIGHT_SKIP_WEBSERVER=1  # Unix
npm run test:e2e:pilot
```

## Critical path (dine-in → prep → pay)

See [`E2E_CRITICAL_PATH.md`](./E2E_CRITICAL_PATH.md) — `npm run test:e2e:critical -w ops-web`.

## CI

Scheduled / manual workflow: [`.github/workflows/e2e-pilot.yml`](../../.github/workflows/e2e-pilot.yml) (runs pilot + critical tests).
