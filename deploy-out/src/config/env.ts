import { z } from 'zod';
import { isValidDurationSpec } from '../common/config/duration';

const booleanFlag = z.enum(['true', 'false']).optional();

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  DB_PROVIDER: z.enum(['postgresql', 'mysql']).optional(),
  ALLOW_MYSQL_LOCAL: booleanFlag,
  REDIS_URL: z.string().trim().optional(),
  IDEMPOTENCY_REQUIRE_REDIS: booleanFlag,
  /** When true, guest POST …/order must send Idempotency-Key (recommended in production). */
  PUBLIC_GUEST_ORDER_REQUIRE_IDEMPOTENCY_KEY: booleanFlag,
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .optional(),
  METRICS_ENABLED: booleanFlag,
  TRUST_PROXY: booleanFlag,
  HELMET_ENABLED: booleanFlag,
  SWAGGER_ENABLED: booleanFlag,
  SUPPORT_UI_ENABLED: booleanFlag,
  CORS_ORIGIN: z.string().trim().optional(),
  SUPPORT_UI_ALLOWED_EMAILS: z.string().trim().optional(),
  JWT_ACCESS_SECRET: z.string().trim().optional(),
  JWT_REFRESH_SECRET: z.string().trim().optional(),
  JWT_ACCESS_TTL: z
    .string()
    .trim()
    .default('15m')
    .refine((value) => isValidDurationSpec(value), {
      message:
        'JWT_ACCESS_TTL must use an integer with optional unit (ms, s, m, h, d).',
    }),
  JWT_REFRESH_TTL: z
    .string()
    .trim()
    .default('7d')
    .refine((value) => isValidDurationSpec(value), {
      message:
        'JWT_REFRESH_TTL must use an integer with optional unit (ms, s, m, h, d).',
    }),
});

function applyNormalizedEnv(env: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }
}

export function validateEnv(raw: Record<string, unknown>) {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')}`,
    );
  }

  const env = parsed.data;
  const isTest = env.NODE_ENV === 'test';
  const normalized = {
    NODE_ENV: env.NODE_ENV,
    DB_PROVIDER: env.DB_PROVIDER ?? undefined,
    ALLOW_MYSQL_LOCAL: env.ALLOW_MYSQL_LOCAL ?? 'false',
    REDIS_URL: env.REDIS_URL?.trim() || undefined,
    IDEMPOTENCY_REQUIRE_REDIS:
      env.NODE_ENV === 'production'
        ? 'true'
        : (env.IDEMPOTENCY_REQUIRE_REDIS ?? 'false'),
    PUBLIC_GUEST_ORDER_REQUIRE_IDEMPOTENCY_KEY:
      env.NODE_ENV === 'production'
        ? (env.PUBLIC_GUEST_ORDER_REQUIRE_IDEMPOTENCY_KEY ?? 'true')
        : (env.PUBLIC_GUEST_ORDER_REQUIRE_IDEMPOTENCY_KEY ?? 'false'),
    PORT: String(env.PORT),
    LOG_LEVEL:
      env.LOG_LEVEL ?? (env.NODE_ENV === 'production' ? 'info' : 'debug'),
    METRICS_ENABLED: env.METRICS_ENABLED ?? 'false',
    TRUST_PROXY: env.TRUST_PROXY ?? 'false',
    HELMET_ENABLED: env.HELMET_ENABLED ?? 'true',
    SWAGGER_ENABLED: env.SWAGGER_ENABLED ?? 'false',
    SUPPORT_UI_ENABLED: env.SUPPORT_UI_ENABLED ?? undefined,
    CORS_ORIGIN: env.CORS_ORIGIN?.trim() || undefined,
    SUPPORT_UI_ALLOWED_EMAILS:
      env.SUPPORT_UI_ALLOWED_EMAILS?.trim() || undefined,
    JWT_ACCESS_TTL: env.JWT_ACCESS_TTL,
    JWT_REFRESH_TTL: env.JWT_REFRESH_TTL,
    JWT_ACCESS_SECRET: env.JWT_ACCESS_SECRET || undefined,
    JWT_REFRESH_SECRET: env.JWT_REFRESH_SECRET || undefined,
  };

  if (!isTest) {
    if (
      !normalized.JWT_ACCESS_SECRET ||
      normalized.JWT_ACCESS_SECRET.length < 32
    ) {
      throw new Error(
        'JWT_ACCESS_SECRET must be set to at least 32 characters.',
      );
    }
    if (
      !normalized.JWT_REFRESH_SECRET ||
      normalized.JWT_REFRESH_SECRET.length < 32
    ) {
      throw new Error(
        'JWT_REFRESH_SECRET must be set to at least 32 characters.',
      );
    }
  } else {
    normalized.JWT_ACCESS_SECRET ??= 'test-access-secret-32-chars-long!!';
    normalized.JWT_REFRESH_SECRET ??= 'test-refresh-secret-32-chars-long!';
  }

  if (normalized.NODE_ENV === 'production' && !normalized.CORS_ORIGIN) {
    throw new Error('CORS_ORIGIN must be set in production.');
  }
  if (
    normalized.NODE_ENV === 'production' &&
    env.IDEMPOTENCY_REQUIRE_REDIS === 'false'
  ) {
    throw new Error(
      'IDEMPOTENCY_REQUIRE_REDIS=false is not allowed in production.',
    );
  }
  if (
    normalized.IDEMPOTENCY_REQUIRE_REDIS === 'true' &&
    !normalized.REDIS_URL
  ) {
    throw new Error(
      'REDIS_URL must be set when IDEMPOTENCY_REQUIRE_REDIS=true. ' +
        'Production close-bill idempotency is fail-closed and does not allow the in-memory fallback.',
    );
  }
  if (
    normalized.NODE_ENV === 'production' &&
    normalized.SUPPORT_UI_ENABLED === 'true' &&
    !normalized.SUPPORT_UI_ALLOWED_EMAILS
  ) {
    throw new Error(
      'SUPPORT_UI_ALLOWED_EMAILS must be set when SUPPORT_UI_ENABLED=true in production.',
    );
  }
  if (
    normalized.DB_PROVIDER === 'mysql' &&
    normalized.ALLOW_MYSQL_LOCAL !== 'true'
  ) {
    throw new Error(
      'DB_PROVIDER=mysql requires ALLOW_MYSQL_LOCAL=true because MySQL is a local-only compatibility target.',
    );
  }
  if (
    normalized.NODE_ENV === 'production' &&
    normalized.DB_PROVIDER === 'mysql'
  ) {
    throw new Error(
      'DB_PROVIDER=mysql is not allowed in production. PostgreSQL remains the official production target.',
    );
  }

  applyNormalizedEnv(normalized);
  return {
    ...raw,
    ...normalized,
    PORT: env.PORT,
  };
}
