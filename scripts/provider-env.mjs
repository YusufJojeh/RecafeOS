import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

export const rootDir = process.cwd();

const baseEnvCandidates = [
  path.join(rootDir, '.env'),
  path.join(rootDir, 'apps/api/.env'),
];

const mysqlEnvCandidates = [
  path.join(rootDir, '.env.mysql-xampp'),
  path.join(rootDir, 'apps/api/.env.mysql-xampp'),
];

export function inferProviderFromDatabaseUrl(databaseUrl) {
  if (!databaseUrl?.trim()) {
    return 'missing';
  }
  if (/^postgres(ql)?:\/\//i.test(databaseUrl)) {
    return 'postgresql';
  }
  if (/^(mysql|mariadb):\/\//i.test(databaseUrl)) {
    return 'mysql';
  }
  return 'unknown';
}

export function resolveProviderHint() {
  const explicit = process.env.DB_PROVIDER?.trim().toLowerCase();
  if (explicit === 'postgresql' || explicit === 'mysql') {
    return explicit;
  }
  const fromUrl = inferProviderFromDatabaseUrl(process.env.DATABASE_URL);
  return fromUrl === 'postgresql' || fromUrl === 'mysql'
    ? fromUrl
    : 'postgresql';
}

export function loadProviderEnv(providerHint = resolveProviderHint()) {
  const explicitKeys = new Set(Object.keys(process.env));
  for (const file of baseEnvCandidates) {
    loadEnvFileOverride(file, explicitKeys);
  }

  if (providerHint !== 'mysql') {
    return;
  }

  for (const file of mysqlEnvCandidates) {
    loadEnvFileOverride(file, explicitKeys);
  }
}

export function isMysqlLocalModeEnabled() {
  return (
    resolveProviderHint() === 'mysql' &&
    process.env.ALLOW_MYSQL_LOCAL === 'true' &&
    process.env.NODE_ENV !== 'production'
  );
}

function loadEnvFileOverride(filePath, explicitKeys) {
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
    if (!key) {
      continue;
    }
    if (explicitKeys.has(key)) {
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
