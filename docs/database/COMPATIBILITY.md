# Database compatibility

## Feasibility summary

- PostgreSQL is the official database for CI, staging, and production.
- MySQL/XAMPP is now supported as a local-only compatibility path.
- MySQL local mode is intentionally limited to core venue operations.
- This is not dual-production support.

## What changed

### Provider split

- PostgreSQL schema: `apps/api/prisma/schema.prisma`
- PostgreSQL migrations: `apps/api/prisma/migrations/`
- MySQL local schema: `apps/api/prisma/mysql/schema.prisma`
- MySQL local migrations: `apps/api/prisma/mysql/migrations/`

### Provider-neutral schema work

- `Customer.tags String[]` was removed from the active data model.
- Customer tags now use `CustomerTag`, which works on both providers.
- PostgreSQL migration: `apps/api/prisma/migrations/20260326130000_customer_tags_portable/migration.sql`

### Runtime refactors for MySQL local mode

- ops snapshot low-stock count no longer depends on PostgreSQL SQL
- stock adjustment and stock deduction no longer rely on PostgreSQL row-lock SQL
- table/open-session and order/table flows now use provider-aware concurrency paths
- MySQL local mode keeps the open-table-session invariant with a generated-column unique index in:
  - `apps/api/prisma/mysql/migrations/20260326143000_mysql_local_baseline/migration.sql`

## Exact limitations

### PostgreSQL-only features that remain

- branch and tenant analytics reports in `apps/api/src/modules/reports/reports.service.ts`
- AI insights that depend on reports in `apps/api/src/modules/ai-insights/ai-insights.service.ts`
- official integration/e2e verification flow
- production deployment target

In MySQL local mode, those report-heavy endpoints fail explicitly with `501 Not Implemented` instead of running incompatible SQL.

### Why full dual-provider parity is still not claimed

- reporting still depends on PostgreSQL SQL semantics (`AT TIME ZONE`, casts, filtered aggregates, raw report fan-out)
- PostgreSQL remains the only provider exercised by official integration/e2e validation
- MySQL local migrations include a generated-column invariant that is intentionally outside the Prisma schema, so MySQL local should use `migrate deploy`, not `migrate dev`

## Safe usage policy

### Production / CI / staging

- `DB_PROVIDER=postgresql`
- `ALLOW_MYSQL_LOCAL=false`
- use PostgreSQL only

### Local XAMPP / MySQL

- `DB_PROVIDER=mysql`
- `ALLOW_MYSQL_LOCAL=true`
- use `apps/api/prisma/mysql/schema.prisma`
- use `apps/api/prisma/mysql/migrations/`
- use `npm run dev:setup:mysql`

## Validation commands

```bash
npm run db:provider:report
npm run db:provider:check
npm run db:provider:check:mysql
npm run verify:integration
npm run verify:mysql:local
```

## No-BS conclusion

This repository is now:

- production-ready on PostgreSQL
- locally runnable on XAMPP/MySQL for core operations
- not fully portable across both providers for reporting and advanced analytics
