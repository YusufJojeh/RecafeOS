export type SupportedDatabaseProvider = 'postgresql' | 'mysql';
export type DatabaseProviderResolution =
  | SupportedDatabaseProvider
  | 'missing'
  | 'unknown';

export function inferDatabaseProviderFromUrl(
  databaseUrl?: string | null,
): DatabaseProviderResolution {
  const value = databaseUrl?.trim();
  if (!value) {
    return 'missing';
  }
  if (/^postgres(ql)?:\/\//i.test(value)) {
    return 'postgresql';
  }
  if (/^(mysql|mariadb):\/\//i.test(value)) {
    return 'mysql';
  }
  return 'unknown';
}

export function resolveConfiguredDatabaseProvider(
  env: NodeJS.ProcessEnv = process.env,
): SupportedDatabaseProvider {
  const explicit = env.DB_PROVIDER?.trim().toLowerCase();
  if (explicit === 'postgresql' || explicit === 'mysql') {
    return explicit;
  }

  const inferred = inferDatabaseProviderFromUrl(env.DATABASE_URL);
  if (inferred === 'postgresql' || inferred === 'mysql') {
    return inferred;
  }

  return 'postgresql';
}

export function isMysqlLocalMode(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    resolveConfiguredDatabaseProvider(env) === 'mysql' &&
    env.ALLOW_MYSQL_LOCAL === 'true' &&
    env.NODE_ENV !== 'production'
  );
}
