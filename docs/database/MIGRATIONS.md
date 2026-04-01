# Database migrations (Prisma)

RestoCafe OS now maintains two Prisma migration trees:

- PostgreSQL official tree: `apps/api/prisma/migrations/`
- MySQL local-compatibility tree: `apps/api/prisma/mysql/migrations/`

## Commands from repo root

| Goal | PostgreSQL | MySQL local |
|------|------------|-------------|
| Generate Prisma client | `npm run db:generate` | `npm run db:generate:mysql` |
| Apply checked-in migrations | `npm run db:migrate:deploy` | `npm run db:migrate:deploy:mysql` |
| Seed demo data | `npm run db:seed` | `npm run db:seed:mysql` |
| Bootstrap local DB | `npm run dev:setup` | `npm run dev:setup:mysql` |

## Migration policy

### PostgreSQL

- official schema authoring target
- use `prisma migrate dev` when creating new migrations
- use `npm run db:migrate:deploy` from repo root in CI/staging/production
- repo-root PostgreSQL deploy is bootstrap-aware for a brand-new empty database where checked-in migration history predates a captured baseline

### MySQL local

- compatibility target only
- use the checked-in MySQL migration tree
- use `migrate deploy`
- do not treat MySQL local as the schema-authoring source of truth

Reason: the MySQL local baseline contains a generated-column unique index to preserve the open-session invariant. That invariant is intentionally implemented in SQL, not in the Prisma schema.

## Review expectations

- PostgreSQL remains the source of truth for new product/schema work.
- If a new migration changes provider-sensitive behavior, update both migration trees or explicitly keep the feature PostgreSQL-only.
- Do not claim MySQL parity unless both the schema and runtime path are updated.
