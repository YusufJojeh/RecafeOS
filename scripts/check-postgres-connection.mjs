import fs from 'node:fs';
import process from 'node:process';

if (typeof process.loadEnvFile === 'function') {
  if (fs.existsSync('.env')) {
    process.loadEnvFile('.env');
  }
  if (fs.existsSync('apps/api/.env')) {
    process.loadEnvFile('apps/api/.env');
  }
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl?.trim()) {
  process.stderr.write(
    'DATABASE_URL is not set. Copy `.env.example` to `.env` or `apps/api/.env.example` to `apps/api/.env`, then point it at PostgreSQL.\n',
  );
  process.exit(1);
}

if (!/^postgres(ql)?:\/\//i.test(databaseUrl)) {
  process.stderr.write(
    'DATABASE_URL is not PostgreSQL. This repository does not support MySQL/MariaDB/XAMPP as an active provider.\n',
  );
  process.exit(1);
}

const { PrismaClient } = await import('@prisma/client');

const prisma = new PrismaClient();

try {
  await prisma.$queryRawUnsafe('SELECT 1');
  process.stdout.write('PostgreSQL connectivity check passed.\n');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write('PostgreSQL connectivity check failed.\n');
  process.stderr.write(`${message}\n`);
  process.stderr.write(
    'Fix DATABASE_URL credentials or point it at a reachable PostgreSQL instance before running migrations, seeds, integration tests, or e2e smoke.\n',
  );
  process.exit(1);
} finally {
  await prisma.$disconnect().catch(() => undefined);
}
