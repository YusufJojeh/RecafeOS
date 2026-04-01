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
  /** Public origin for guest menu / QR links (no trailing slash). Required in production. */
  APP_PUBLIC_URL: z.string().trim().optional(),
  /**
   * Seconds a staff push outbox row may sit in PROCESSING before reclaim (crash safety).
   * Default 300 (5 min). See `StaffPushOutboxWorkerService`.
   */
  STAFF_PUSH_STALE_PROCESSING_SEC: z.coerce
    .number()
    .int()
    .min(60)
    .max(7200)
    .optional(),
  /** `noop` (default) or `fcm` — see `FcmStaffPushProviderService`. */
  STAFF_PUSH_PROVIDER: z.enum(['noop', 'fcm']).optional(),
  /** Full Firebase service account JSON (string). Required in production when `STAFF_PUSH_PROVIDER=fcm`. */
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  /** When true, FCM provider logs fan-out but does not call Firebase (integration testing). */
  STAFF_PUSH_FCM_DRY_RUN: booleanFlag,
  /** Log per-token FCM failures at warn (may be noisy). */
  STAFF_PUSH_FCM_LOG_FAILURES: booleanFlag,
});

function isHttpOrHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

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
    APP_PUBLIC_URL: env.APP_PUBLIC_URL?.replace(/\/$/, '').trim() || undefined,
    STAFF_PUSH_STALE_PROCESSING_SEC: String(
      env.STAFF_PUSH_STALE_PROCESSING_SEC ?? 300,
    ),
    STAFF_PUSH_PROVIDER: (env.STAFF_PUSH_PROVIDER ?? 'noop').trim().toLowerCase(),
    STAFF_PUSH_FCM_DRY_RUN: env.STAFF_PUSH_FCM_DRY_RUN ?? 'false',
    STAFF_PUSH_FCM_LOG_FAILURES: env.STAFF_PUSH_FCM_LOG_FAILURES ?? 'false',
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
  if (normalized.NODE_ENV === 'production') {
    if (!normalized.APP_PUBLIC_URL) {
      throw new Error(
        'APP_PUBLIC_URL must be set in production (guest menu / QR URL template base).',
      );
    }
    if (!isHttpOrHttpsUrl(normalized.APP_PUBLIC_URL)) {
      throw new Error(
        'APP_PUBLIC_URL must be a valid http(s) URL (e.g. https://app.example.com).',
      );
    }
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

  const pushProvider = (env.STAFF_PUSH_PROVIDER ?? 'noop').trim().toLowerCase();
  if (pushProvider === 'fcm') {
    const sa = env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
    if (normalized.NODE_ENV === 'production') {
      if (!sa) {
        throw new Error(
          'FIREBASE_SERVICE_ACCOUNT_JSON is required when STAFF_PUSH_PROVIDER=fcm in production.',
        );
      }
      try {
        const j = JSON.parse(sa) as {
          project_id?: string;
          client_email?: string;
          private_key?: string;
        };
        if (!j.project_id || !j.client_email || !j.private_key) {
          throw new Error('incomplete');
        }
      } catch {
        throw new Error(
          'FIREBASE_SERVICE_ACCOUNT_JSON must be valid Firebase service-account JSON when STAFF_PUSH_PROVIDER=fcm.',
        );
      }
    }
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
    STAFF_PUSH_STALE_PROCESSING_SEC:
      env.STAFF_PUSH_STALE_PROCESSING_SEC ?? 300,
    STAFF_PUSH_PROVIDER: pushProvider,
  };
}
