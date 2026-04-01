# Local database setup

## Supported local targets

### 1. PostgreSQL — official local baseline

Use this for normal development, integration testing, and production parity.

#### Docker Compose

1. Copy `.env.example` to `.env`.
2. Run `npm run doctor:local`.
3. Run `npm run dev:setup`.
4. Run `npm run dev:api`.
5. Run `npm run dev:web`.

#### Native PostgreSQL

If Docker is unavailable, point `DATABASE_URL` at a native PostgreSQL instance:

```env
DB_PROVIDER=postgresql
ALLOW_MYSQL_LOCAL=false
DATABASE_URL=postgresql://restocafe:restocafe@localhost:5432/restocafe?schema=public
```

Then run:

```bash
npm run doctor:local
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
npm run dev:api
npm run dev:web
```

### 2. MySQL / XAMPP — local compatibility path

This path is supported for local API boot and core venue operations only.
Do not use it for production.

1. Copy `.env.example` to `.env`.
2. Copy `.env.mysql-xampp.example` to `.env.mysql-xampp`.
3. Start MySQL in XAMPP.
4. Run `npm run dev:setup:mysql`.
5. Run `npm run dev:api:mysql`.
6. Run `npm run dev:web`.

Default XAMPP DSN:

```env
DB_PROVIDER=mysql
ALLOW_MYSQL_LOCAL=true
DATABASE_URL=mysql://root:@127.0.0.1:3306/restocafe
```

What `dev:setup:mysql` does:

- validates the provider contract
- creates the MySQL database if missing
- generates Prisma client from `apps/api/prisma/mysql/schema.prisma`
- applies checked-in MySQL migrations with `migrate deploy`
- seeds demo data

## MySQL local limitations

- reports and analytics endpoints return `501 Not Implemented`
- AI insights that depend on reports also return `501 Not Implemented`
- CI, staging, and production remain PostgreSQL-only
- schema authoring should continue on PostgreSQL; MySQL local uses the checked-in migration tree
- for MySQL local, use `npm run db:migrate:deploy:mysql`, not `prisma migrate dev`

## Recommended validation

### PostgreSQL

```bash
npm run doctor:local
npm run verify:everything
```

### MySQL local

```bash
npm run verify:mysql:local
```
