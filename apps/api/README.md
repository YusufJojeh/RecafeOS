# API

NestJS API for RestoCafe OS.

## Local run

### PostgreSQL

From the repo root:

```bash
npm run dev:setup
npm run dev:api
```

### MySQL / XAMPP local compatibility mode

From the repo root:

```bash
npm run dev:setup:mysql
npm run dev:api:mysql
```

This mode is local-only and intentionally narrower than PostgreSQL.

## Required environment

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGIN`

Provider flags:

- PostgreSQL: `DB_PROVIDER=postgresql`, `ALLOW_MYSQL_LOCAL=false`
- Local MySQL: `DB_PROVIDER=mysql`, `ALLOW_MYSQL_LOCAL=true`

Useful optional keys:

- `REDIS_URL` for shared idempotency and Socket.IO scaling
- `IDEMPOTENCY_REQUIRE_REDIS=false` for local single-process development only
- `APP_PUBLIC_URL` for guest QR/public menu links
- `LOG_LEVEL`
- `METRICS_ENABLED`
- `TRUST_PROXY`

Production note:

- `NODE_ENV=production` now implies fail-closed idempotency startup validation.
- Production must provide `REDIS_URL`.
- `IDEMPOTENCY_REQUIRE_REDIS=false` is rejected in production.

See `apps/api/.env.example`, `apps/api/.env.mysql-xampp.example`, and `docs/database/COMPATIBILITY.md`.

## Provider audit

```bash
npm run db:provider:report
npm run db:connect:check
npm run db:connect:check:mysql
npm run redis:connect:check
```

## Validation

```bash
npm run test
npm run test:integration:cov
npm run verify:permissions
npm run verify:integration
npm run verify:mysql:local
```

`verify:integration` remains the official PostgreSQL-backed validation path.
`test:integration:cov` measures PostgreSQL-backed integration coverage separately from the default unit Jest coverage run.
`verify:mysql:local` validates the local MySQL schema, migrations, seed, connectivity, and API build only.
