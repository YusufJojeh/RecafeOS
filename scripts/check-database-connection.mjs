import process from 'node:process';
import {
  inferProviderFromDatabaseUrl,
  isMysqlLocalModeEnabled,
  loadProviderEnv,
  resolveProviderHint,
} from './provider-env.mjs';

loadProviderEnv();

const provider = resolveProviderHint();
const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  process.stderr.write(
    'DATABASE_URL is not set. Use `.env` for PostgreSQL or `.env.mysql-xampp` for local XAMPP mode.\n',
  );
  process.exit(1);
}

const urlProvider = inferProviderFromDatabaseUrl(databaseUrl);
if (urlProvider === 'unknown') {
  process.stderr.write(
    'Unsupported DATABASE_URL protocol. Supported providers are PostgreSQL and local-only MySQL.\n',
  );
  process.exit(1);
}

if (provider !== urlProvider) {
  process.stderr.write(
    `DB_PROVIDER=${provider} does not match DATABASE_URL provider ${urlProvider}.\n`,
  );
  process.exit(1);
}

if (provider === 'mysql' && !isMysqlLocalModeEnabled()) {
  process.stderr.write(
    'MySQL is local-only. Set `DB_PROVIDER=mysql` and `ALLOW_MYSQL_LOCAL=true`, and do not use MySQL in production.\n',
  );
  process.exit(1);
}

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

try {
  await prisma.$queryRawUnsafe('SELECT 1');
  process.stdout.write(
    `${provider === 'mysql' ? 'MySQL' : 'PostgreSQL'} connectivity check passed.\n`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(
    `${provider === 'mysql' ? 'MySQL' : 'PostgreSQL'} connectivity check failed.\n`,
  );
  process.stderr.write(`${message}\n`);
  if (provider === 'mysql') {
    process.stderr.write(
      'Fix the MySQL/XAMPP credentials in `.env.mysql-xampp` and ensure the MySQL service is running before migrations, seed, or API boot.\n',
    );
  } else {
    process.stderr.write(
      'Fix DATABASE_URL credentials or point it at a reachable PostgreSQL instance before running migrations, seeds, integration tests, or e2e smoke.\n',
    );
  }
  process.exit(1);
} finally {
  await prisma.$disconnect().catch(() => undefined);
}
