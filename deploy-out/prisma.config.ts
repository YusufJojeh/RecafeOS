import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { defineConfig } from 'prisma/config';

const dbProvider = process.env.DB_PROVIDER?.trim().toLowerCase() === 'mysql'
  ? 'mysql'
  : 'postgresql';

const envCandidates =
  dbProvider === 'mysql'
    ? [
        path.resolve(process.cwd(), '.env.mysql-xampp'),
        path.resolve(process.cwd(), '../../.env.mysql-xampp'),
        path.resolve(process.cwd(), 'apps/api/.env.mysql-xampp'),
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), '../../.env'),
        path.resolve(process.cwd(), 'apps/api/.env'),
      ]
    : [
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), '../../.env'),
        path.resolve(process.cwd(), 'apps/api/.env'),
      ];

const explicitKeys = new Set(Object.keys(process.env));
for (const candidate of envCandidates) {
  loadEnvFileOverride(candidate, explicitKeys);
}

export default defineConfig({
  schema:
    dbProvider === 'mysql'
      ? 'prisma/mysql/schema.prisma'
      : 'prisma/schema.prisma',
  migrations: {
    seed: 'node ../../node_modules/ts-node/dist/bin.js --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
});

function loadEnvFileOverride(filePath: string, lockedKeys: Set<string>) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const equalsIndex = line.indexOf('=');
    if (equalsIndex <= 0) {
      continue;
    }
    const key = line.slice(0, equalsIndex).trim();
    if (!key || lockedKeys.has(key)) {
      continue;
    }
    let value = line.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
