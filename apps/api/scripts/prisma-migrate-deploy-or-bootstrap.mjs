import { readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const cwd = process.cwd();
const migrationsDir = path.join(cwd, 'prisma', 'migrations');

function emit(result) {
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
  }
  return result.status ?? 1;
}

function runPrisma(args) {
  const result =
    process.platform === 'win32'
      ? spawnSync(
          'cmd.exe',
          ['/d', '/s', '/c', `npx prisma ${args.join(' ')}`],
          {
            cwd,
            encoding: 'utf8',
            shell: false,
          },
        )
      : spawnSync('npx', ['prisma', ...args], {
          cwd,
          encoding: 'utf8',
          shell: false,
        });

  return emit(result);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: false,
    stdio: 'pipe',
  });

  return emit(result);
}

async function inspectDatabase() {
  const prisma = new PrismaClient();
  try {
    const appTables = await prisma.$queryRawUnsafe(
      `
        SELECT COUNT(*)::int AS count
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name <> '_prisma_migrations'
      `,
    );
    const migrationTable = await prisma.$queryRawUnsafe(
      `SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS present`,
    );

    const appTableCount =
      Array.isArray(appTables) && appTables.length > 0
        ? Number((appTables[0] ?? {}).count ?? 0)
        : 0;
    const migrationTablePresent =
      Array.isArray(migrationTable) && migrationTable.length > 0
        ? Boolean((migrationTable[0] ?? {}).present)
        : false;

    return {
      appTableCount,
      migrationTablePresent,
    };
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

async function resetMigrationMetadataIfSchemaIsEmpty() {
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(
      'DROP TABLE IF EXISTS "public"."_prisma_migrations"',
    );
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

function migrationNames() {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function bootstrapEmptyPostgres() {
  process.stdout.write(
    'Detected empty PostgreSQL schema with legacy migration history missing a baseline. Bootstrapping current schema once.\n',
  );

  await resetMigrationMetadataIfSchemaIsEmpty();

  if (runPrisma(['db', 'push', '--skip-generate']) !== 0) {
    process.exit(1);
  }

  for (const name of migrationNames()) {
    if (runPrisma(['migrate', 'resolve', '--applied', name]) !== 0) {
      process.exit(1);
    }
  }

  process.stdout.write(
    'Bootstrap complete. Checked-in migrations were marked as applied for this empty database.\n',
  );
}

const provider = process.env.DB_PROVIDER?.trim().toLowerCase() ?? 'postgresql';
if (provider === 'mysql') {
  process.exit(runPrisma(['migrate', 'deploy']));
}

const firstDeployStatus = runPrisma(['migrate', 'deploy']);
if (firstDeployStatus === 0) {
  process.exit(0);
}

const state = await inspectDatabase();
if (state.appTableCount > 0) {
  process.exit(firstDeployStatus);
}

await bootstrapEmptyPostgres();
process.exit(runPrisma(['migrate', 'deploy']));
