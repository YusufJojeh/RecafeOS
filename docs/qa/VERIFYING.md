# Verification workflow

## Official PostgreSQL verification

### Local prerequisites doctor

```bash
npm run doctor:local
```

Checks:

- env file presence
- Docker reachability (warning if unavailable)
- DB provider contract
- PostgreSQL connectivity
- Redis connectivity
- route permission drift check

`doctor:local` is the fastest way to distinguish a code regression from a missing local dependency before running integration or E2E flows.

### Static repo verification

```bash
npm run verify:repo
```

Checks:

- build for `types`, `api`, `ops-web`, `landing`
- lint across workspaces
- unit / component / workspace tests
- route permission drift check

### Integration verification

```bash
npm run verify:integration
npm run test:integration:cov
```

Requires:

- reachable PostgreSQL database
- reachable Redis instance
- `DATABASE_URL` and `REDIS_URL` set

`test:integration:cov` exists because `npm run test:cov -w api` only measures the default/unit Jest suite and does not reflect critical PostgreSQL-backed integration confidence.

### Smoke E2E verification

```bash
npm run verify:e2e:smoke
```

Requires:

- the same PostgreSQL/Redis setup as integration verification
- Playwright Chromium installed

### Full official verification

```bash
npm run verify:everything
```

Runs:

1. `npm run verify:repo`
2. `npm run verify:integration`
3. `npm run verify:e2e:smoke`

## Local MySQL / XAMPP verification

```bash
npm run verify:mysql:local
```

Requires:

- `.env.mysql-xampp` present
- `DB_PROVIDER=mysql`
- `ALLOW_MYSQL_LOCAL=true`
- reachable MySQL/XAMPP instance

What it does:

- validates the provider contract
- creates the database if missing
- generates Prisma client from the MySQL schema
- checks MySQL connectivity
- applies checked-in MySQL migrations
- seeds demo data
- builds the API with MySQL local mode enabled

## Meaning of green

- `verify:repo` green = code compiles, lints, and workspace tests pass.
- `verify:integration` green = PostgreSQL migrations, seed, and backend integration flows pass.
- `test:integration:cov` green = backend integration assertions are being counted as coverage instead of remaining invisible behind unit-only numbers.
- `verify:e2e:smoke` green = built API and built frontend work together on the official PostgreSQL stack.
- `verify:everything` green = the official PostgreSQL path is green end-to-end.
- `verify:mysql:local` green = local MySQL/XAMPP boot prerequisites, schema, migrations, seed, and API build are valid for core operations.
- `db:connect:check` green = the active provider is reachable and credentials are valid.

## Known blind spots

- `verify:mysql:local` does not claim report parity; report-heavy endpoints remain PostgreSQL-only
- load/performance scripts are not part of either verification path
- reverse proxy / TLS / production network checks are not part of local verification
