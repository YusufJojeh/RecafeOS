import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  inferProviderFromDatabaseUrl,
  isMysqlLocalModeEnabled,
  loadProviderEnv,
  resolveProviderHint,
  rootDir,
} from './provider-env.mjs';

const argv = new Set(process.argv.slice(2));
const shouldCheckEnv = argv.has('--check-env');
const jsonMode = argv.has('--json');

loadProviderEnv();

const configuredProvider = resolveProviderHint();
const databaseUrlProvider = inferProviderFromDatabaseUrl(process.env.DATABASE_URL);
const mysqlLocalMode = isMysqlLocalModeEnabled();

const postgresSchemaPath = path.join(rootDir, 'apps/api/prisma/schema.prisma');
const mysqlSchemaPath = path.join(rootDir, 'apps/api/prisma/mysql/schema.prisma');
const postgresMigrationLockPath = path.join(
  rootDir,
  'apps/api/prisma/migrations/migration_lock.toml',
);
const mysqlMigrationLockPath = path.join(
  rootDir,
  'apps/api/prisma/mysql/migrations/migration_lock.toml',
);
const postgresMigrationsDir = path.join(rootDir, 'apps/api/prisma/migrations');
const mysqlMigrationsDir = path.join(rootDir, 'apps/api/prisma/mysql/migrations');

const report = {
  strategy: {
    officialProductionProvider: 'postgresql',
    localCompatibilityProvider: 'mysql',
    mysqlSupportLevel: 'core_operations_only',
  },
  configuredProvider,
  databaseUrlProvider,
  mysqlLocalMode,
  prisma: {
    postgresql: describePrismaTree(
      postgresSchemaPath,
      postgresMigrationLockPath,
      postgresMigrationsDir,
    ),
    mysql: describePrismaTree(
      mysqlSchemaPath,
      mysqlMigrationLockPath,
      mysqlMigrationsDir,
    ),
  },
  runtime: {
    mysqlUnsupportedFeatures: [
      {
        feature: 'branch and tenant analytics reports',
        path: 'apps/api/src/modules/reports/reports.service.ts',
      },
      {
        feature: 'AI insights that depend on reports',
        path: 'apps/api/src/modules/ai-insights/ai-insights.service.ts',
      },
    ],
    mysqlCompatibilityRefactors: [
      {
        feature: 'portable customer tags',
        path: 'apps/api/src/modules/customers/customers.service.ts',
      },
      {
        feature: 'provider-safe ops snapshot',
        path: 'apps/api/src/modules/branches/branches.service.ts',
      },
      {
        feature: 'provider-safe table and order concurrency path',
        path: 'apps/api/src/modules/tables/tables.service.ts',
      },
      {
        feature: 'provider-safe stock deduction path',
        path: 'apps/api/src/modules/orders/order-stock.service.ts',
      },
    ],
  },
};

if (jsonMode) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  printReport(report);
}

if (shouldCheckEnv) {
  const check = validateConfiguredProvider(report);
  if (!check.ok) {
    process.stderr.write(`${check.message}\n`);
    process.exit(1);
  }
}

function describePrismaTree(schemaPath, migrationLockPath, migrationsDir) {
  const schemaExists = fs.existsSync(schemaPath);
  const migrationLockExists = fs.existsSync(migrationLockPath);
  return {
    schemaPath: relative(schemaPath),
    schemaExists,
    schemaProvider: schemaExists
      ? extractProviderFromPrismaSchema(fs.readFileSync(schemaPath, 'utf8'))
      : 'missing',
    migrationLockPath: relative(migrationLockPath),
    migrationLockExists,
    migrationLockProvider: migrationLockExists
      ? extractProviderFromMigrationLock(fs.readFileSync(migrationLockPath, 'utf8'))
      : 'missing',
    migrationsDir: relative(migrationsDir),
    migrationCount: countSqlFiles(migrationsDir),
  };
}

function countSqlFiles(dir) {
  if (!fs.existsSync(dir)) {
    return 0;
  }
  return walkFiles(dir, (file) => file.endsWith('.sql')).length;
}

function walkFiles(dir, predicate) {
  const results = [];
  if (!fs.existsSync(dir)) {
    return results;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath, predicate));
      continue;
    }
    if (predicate(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractProviderFromPrismaSchema(text) {
  const datasourceMatch = text.match(/datasource\s+db\s*{([\s\S]*?)}/m);
  const providerMatch = datasourceMatch?.[1]?.match(/provider\s*=\s*"([^"]+)"/);
  return providerMatch?.[1] ?? 'unknown';
}

function extractProviderFromMigrationLock(text) {
  const providerMatch = text.match(/provider\s*=\s*"([^"]+)"/);
  return providerMatch?.[1] ?? 'unknown';
}

function relative(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, '/');
}

function printReport(currentReport) {
  process.stdout.write('Database provider feasibility report\n');
  process.stdout.write(
    `- Official production target: ${currentReport.strategy.officialProductionProvider}\n`,
  );
  process.stdout.write(
    `- Local MySQL/XAMPP target: ${currentReport.strategy.mysqlSupportLevel}\n`,
  );
  process.stdout.write(
    `- DB_PROVIDER: ${currentReport.configuredProvider}\n`,
  );
  process.stdout.write(
    `- DATABASE_URL provider: ${currentReport.databaseUrlProvider}\n`,
  );
  process.stdout.write(
    `- Local MySQL mode enabled: ${currentReport.mysqlLocalMode}\n`,
  );
  process.stdout.write('\nPrisma trees\n');
  for (const [provider, details] of Object.entries(currentReport.prisma)) {
    process.stdout.write(
      `- ${provider}: schema=${details.schemaProvider} migrations=${details.migrationCount} migrationLock=${details.migrationLockProvider}\n`,
    );
  }
  process.stdout.write('\nMySQL local limits\n');
  for (const item of currentReport.runtime.mysqlUnsupportedFeatures) {
    process.stdout.write(`- unsupported: ${item.feature} (${item.path})\n`);
  }
  process.stdout.write('\nImplemented compatibility refactors\n');
  for (const item of currentReport.runtime.mysqlCompatibilityRefactors) {
    process.stdout.write(`- ${item.feature} (${item.path})\n`);
  }
}

function validateConfiguredProvider(currentReport) {
  if (currentReport.databaseUrlProvider === 'missing') {
    return {
      ok: false,
      message:
        'DATABASE_URL is not set. Use `.env` for PostgreSQL or `.env.mysql-xampp` with `DB_PROVIDER=mysql` for local XAMPP mode.',
    };
  }

  if (currentReport.databaseUrlProvider === 'unknown') {
    return {
      ok: false,
      message:
        'Unsupported DATABASE_URL protocol. Supported providers are PostgreSQL and local-only MySQL.',
    };
  }

  if (currentReport.configuredProvider !== currentReport.databaseUrlProvider) {
    return {
      ok: false,
      message:
        `DB_PROVIDER=${currentReport.configuredProvider} does not match DATABASE_URL provider ${currentReport.databaseUrlProvider}.`,
    };
  }

  if (currentReport.configuredProvider === 'postgresql') {
    return { ok: true };
  }

  if (!currentReport.mysqlLocalMode) {
    return {
      ok: false,
      message:
        'MySQL is local-only. Set `DB_PROVIDER=mysql` and `ALLOW_MYSQL_LOCAL=true`, and do not use MySQL in production.',
    };
  }

  if (currentReport.prisma.mysql.schemaProvider !== 'mysql') {
    return {
      ok: false,
      message:
        'The MySQL Prisma schema is missing or invalid. Expected `apps/api/prisma/mysql/schema.prisma` with `provider = "mysql"`. ',
    };
  }

  if (currentReport.prisma.mysql.migrationCount === 0) {
    return {
      ok: false,
      message:
        'The MySQL migration tree is missing. Expected checked-in migrations under `apps/api/prisma/mysql/migrations`.',
    };
  }

  return { ok: true };
}
