/**
 * Shared CORS origin resolution for HTTP (main.ts) and Socket.IO gateway.
 * Production must set CORS_ORIGIN explicitly.
 */
export function resolveCorsOrigin(): boolean | string | string[] {
  if (process.env.NODE_ENV === 'production') {
    const raw = process.env.CORS_ORIGIN;
    if (!raw?.trim()) {
      throw new Error(
        'CORS_ORIGIN must be set in production (comma-separated origins)',
      );
    }
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const raw = process.env.CORS_ORIGIN;
  if (raw?.trim()) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return true;
}
