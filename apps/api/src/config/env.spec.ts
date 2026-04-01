import { validateEnv } from './env';

describe('validateEnv', () => {
  it('applies sane defaults for test environments', () => {
    const validated = validateEnv({ NODE_ENV: 'test' });

    expect(validated.NODE_ENV).toBe('test');
    expect(validated.PORT).toBe(3000);
    expect(validated.LOG_LEVEL).toBe('debug');
    expect(String(validated.JWT_ACCESS_SECRET).length).toBeGreaterThanOrEqual(
      32,
    );
    expect(String(validated.JWT_REFRESH_SECRET).length).toBeGreaterThanOrEqual(
      32,
    );
  });

  it('rejects production when CORS_ORIGIN is missing', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        REDIS_URL: 'redis://redis:6379',
        JWT_ACCESS_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
      }),
    ).toThrow(/CORS_ORIGIN must be set in production/);
  });

  it('rejects production when REDIS_URL is missing', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        CORS_ORIGIN: 'https://ops.example.com',
        APP_PUBLIC_URL: 'https://api.example.com',
      }),
    ).toThrow(/REDIS_URL must be set when IDEMPOTENCY_REQUIRE_REDIS=true/);
  });

  it('rejects explicit IDEMPOTENCY_REQUIRE_REDIS=false in production', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        REDIS_URL: 'redis://redis:6379',
        IDEMPOTENCY_REQUIRE_REDIS: 'false',
        JWT_ACCESS_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        CORS_ORIGIN: 'https://ops.example.com',
        APP_PUBLIC_URL: 'https://api.example.com',
      }),
    ).toThrow(/IDEMPOTENCY_REQUIRE_REDIS=false is not allowed in production/);
  });

  it('rejects malformed TTL values', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        JWT_ACCESS_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        JWT_ACCESS_TTL: 'fifteen-minutes',
      }),
    ).toThrow(/JWT_ACCESS_TTL/);
  });

  it('rejects mysql without explicit local-only opt-in', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        DB_PROVIDER: 'mysql',
        DATABASE_URL: 'mysql://root:@127.0.0.1:3306/restocafe',
        JWT_ACCESS_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
      }),
    ).toThrow(/ALLOW_MYSQL_LOCAL=true/);
  });

  it('rejects mysql in production', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DB_PROVIDER: 'mysql',
        ALLOW_MYSQL_LOCAL: 'true',
        DATABASE_URL: 'mysql://root:@127.0.0.1:3306/restocafe',
        REDIS_URL: 'redis://redis:6379',
        JWT_ACCESS_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        CORS_ORIGIN: 'http://localhost:5173',
        APP_PUBLIC_URL: 'https://api.example.com',
      }),
    ).toThrow(/not allowed in production/);
  });

  it('accepts mysql for local development with explicit opt-in', () => {
    const validated = validateEnv({
      NODE_ENV: 'development',
      DB_PROVIDER: 'mysql',
      ALLOW_MYSQL_LOCAL: 'true',
      DATABASE_URL: 'mysql://root:@127.0.0.1:3306/restocafe',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      CORS_ORIGIN: 'http://localhost:5173',
    });

    expect(validated.DB_PROVIDER).toBe('mysql');
    expect(validated.ALLOW_MYSQL_LOCAL).toBe('true');
  });

  it('defaults IDEMPOTENCY_REQUIRE_REDIS to true in production', () => {
    const validated = validateEnv({
      NODE_ENV: 'production',
      REDIS_URL: 'redis://redis:6379',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      CORS_ORIGIN: 'https://ops.example.com',
      APP_PUBLIC_URL: 'https://api.example.com',
    });

    expect(validated.IDEMPOTENCY_REQUIRE_REDIS).toBe('true');
  });

  it('rejects production when APP_PUBLIC_URL is missing', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        REDIS_URL: 'redis://redis:6379',
        JWT_ACCESS_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        CORS_ORIGIN: 'https://ops.example.com',
      }),
    ).toThrow(/APP_PUBLIC_URL must be set in production/);
  });
});
