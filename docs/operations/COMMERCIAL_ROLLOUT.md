# Commercial layer rollout (operators)

Checklist to finish deployment after the commercial control code is merged. See [COMMERCIAL_LIFECYCLE.md](./COMMERCIAL_LIFECYCLE.md) for product semantics.

## 1. Database migrations

Apply pending migrations so `Tenant.maxUsers` (and any earlier commercial migrations) exist:

```bash
# From repo root, with DATABASE_URL pointing at the target database:
./deploy/scripts/prisma-migrate-deploy.sh
```

Or:

```bash
cd apps/api && npx prisma migrate deploy
```

Run in **each** environment (staging, then production) using that environment’s `DATABASE_URL`.

## 2. Schedule trial expiry job

Call `POST /api/v1/support/jobs/expire-trials` with header `x-support-api-key` on a schedule (daily is typical).

- **Shell / cron:** [deploy/scripts/expire-trials-job.sh](../../deploy/scripts/expire-trials-job.sh) — set `API_BASE_URL` and `SUPPORT_API_KEY`.
- **Kubernetes:** Example [deploy/k8s/cronjob-expire-trials.example.yaml](../../deploy/k8s/cronjob-expire-trials.example.yaml).

Details: [DEMO_AND_PILOT_ENVIRONMENT.md](./DEMO_AND_PILOT_ENVIRONMENT.md) §7.

## 3. Paid pilot tenant data

Follow the copy-paste playbook: [PILOT_COMMERCIAL_SETUP.md](./PILOT_COMMERCIAL_SETUP.md).

## 4. Verification

- `npm run build` in `apps/api` and `apps/ops-web` (CI should run both on every merge).
- **Integration tests:** `npm run test:integration` from `apps/api` requires a reachable PostgreSQL matching `DATABASE_URL`, seeded data (e.g. `demo` tenant from `prisma db seed`), and `SUPPORT_API_KEY` aligned with the API under test. Without valid DB credentials the suite fails at `prisma.$connect()` — run in CI with secrets or locally via [docker-compose.stack.yml](../../deploy/docker-compose.stack.yml).

Optional env vars: see [apps/api/.env.example](../../apps/api/.env.example) (`COMMERCE_ENFORCE_PAST_DUE`, `COMMERCE_DEFAULT_TRIAL_DAYS`).
