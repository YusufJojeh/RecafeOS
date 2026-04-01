/**
 * Decode JWT `exp` (seconds since epoch) without verifying the signature.
 * Used only for scheduling proactive refresh; authorization remains server-side.
 */
export function getAccessTokenExpiryMs(accessToken: string): number | null {
  const parts = accessToken.split('.');
  if (parts.length !== 3) {
    return null;
  }
  const segment = parts[1];
  try {
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (padded.length % 4)) % 4;
    const base64 = padded + '='.repeat(padLen);
    const json = atob(base64);
    const payload = JSON.parse(json) as { exp?: unknown };
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
      return null;
    }
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

/** Refresh this many milliseconds before `exp` to avoid edge 401s on concurrent requests. */
export const PROACTIVE_REFRESH_LEEWAY_MS = 90_000;

/** Minimum delay before firing a scheduled refresh (avoids tight loops on bad clocks). */
export const PROACTIVE_REFRESH_MIN_DELAY_MS = 10_000;

export function msUntilProactiveRefresh(
  accessToken: string,
  nowMs: number = Date.now(),
): number | null {
  const expMs = getAccessTokenExpiryMs(accessToken);
  if (expMs == null) {
    return null;
  }
  const delay = expMs - nowMs - PROACTIVE_REFRESH_LEEWAY_MS;
  if (delay <= 0) {
    return 0;
  }
  return Math.max(PROACTIVE_REFRESH_MIN_DELAY_MS, delay);
}
