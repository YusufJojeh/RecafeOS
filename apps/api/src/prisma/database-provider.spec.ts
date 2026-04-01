import {
  inferDatabaseProviderFromUrl,
  isMysqlLocalMode,
  resolveConfiguredDatabaseProvider,
} from './database-provider';

describe('database-provider', () => {
  it('infers provider from database url', () => {
    expect(
      inferDatabaseProviderFromUrl(
        'postgresql://restocafe:restocafe@localhost:5432/restocafe',
      ),
    ).toBe('postgresql');
    expect(
      inferDatabaseProviderFromUrl('mysql://root:@127.0.0.1:3306/restocafe'),
    ).toBe('mysql');
  });

  it('prefers explicit DB_PROVIDER when set', () => {
    expect(
      resolveConfiguredDatabaseProvider({
        DB_PROVIDER: 'mysql',
        DATABASE_URL:
          'postgresql://restocafe:restocafe@localhost:5432/restocafe',
      } as NodeJS.ProcessEnv),
    ).toBe('mysql');
  });

  it('recognizes local mysql mode only outside production', () => {
    expect(
      isMysqlLocalMode({
        DB_PROVIDER: 'mysql',
        ALLOW_MYSQL_LOCAL: 'true',
        NODE_ENV: 'development',
      } as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(
      isMysqlLocalMode({
        DB_PROVIDER: 'mysql',
        ALLOW_MYSQL_LOCAL: 'true',
        NODE_ENV: 'production',
      } as NodeJS.ProcessEnv),
    ).toBe(false);
  });
});
