import { describe, expect, it } from 'vitest';
import {
  getAccessTokenExpiryMs,
  msUntilProactiveRefresh,
  PROACTIVE_REFRESH_LEEWAY_MS,
} from './jwt-expiry';

function b64urlJson(obj: unknown): string {
  const json = JSON.stringify(obj);
  const b64 = btoa(json);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('getAccessTokenExpiryMs', () => {
  it('returns null for malformed tokens', () => {
    expect(getAccessTokenExpiryMs('')).toBeNull();
    expect(getAccessTokenExpiryMs('a.b')).toBeNull();
    expect(getAccessTokenExpiryMs('not-a-jwt')).toBeNull();
  });

  it('reads exp from a valid-shaped JWT payload', () => {
    const exp = 1_700_000_000;
    const token = `eyJhbGciOiJIUzI1NiJ9.${b64urlJson({ exp })}.sig`;
    expect(getAccessTokenExpiryMs(token)).toBe(exp * 1000);
  });

  it('returns null when exp is missing', () => {
    const token = `eyJhbGciOiJIUzI1NiJ9.${b64urlJson({ sub: 'x' })}.sig`;
    expect(getAccessTokenExpiryMs(token)).toBeNull();
  });
});

describe('msUntilProactiveRefresh', () => {
  it('returns 0 when already inside leeway window', () => {
    const now = 1_700_000_000_000;
    const expSec = (now + 30_000) / 1000;
    const token = `eyJhbGciOiJIUzI1NiJ9.${b64urlJson({ exp: expSec })}.sig`;
    expect(msUntilProactiveRefresh(token, now)).toBe(0);
  });

  it('schedules before exp minus leeway', () => {
    const now = 1_700_000_000_000;
    const expMs = now + 600_000;
    const expSec = expMs / 1000;
    const token = `eyJhbGciOiJIUzI1NiJ9.${b64urlJson({ exp: expSec })}.sig`;
    expect(msUntilProactiveRefresh(token, now)).toBe(
      expMs - now - PROACTIVE_REFRESH_LEEWAY_MS,
    );
  });
});
