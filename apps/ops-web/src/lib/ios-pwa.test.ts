import { describe, expect, it, vi } from 'vitest';
import { isIosWebKitInstallSurface } from './ios-pwa';

describe('isIosWebKitInstallSurface', () => {
  it('returns false in the default jsdom environment (non-iOS UA)', () => {
    expect(isIosWebKitInstallSurface()).toBe(false);
  });

  it('detects iPhone user agents', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      platform: 'iPhone',
      maxTouchPoints: 5,
    });
    expect(isIosWebKitInstallSurface()).toBe(true);
    vi.unstubAllGlobals();
  });

  it('detects iPadOS desktop mode', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    });
    expect(isIosWebKitInstallSurface()).toBe(true);
    vi.unstubAllGlobals();
  });

  it('returns false for typical desktop Chrome', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      platform: 'Win32',
      maxTouchPoints: 0,
    });
    expect(isIosWebKitInstallSurface()).toBe(false);
    vi.unstubAllGlobals();
  });
});
