import { describe, expect, it } from 'vitest';
import { ar } from './ar';
import { en } from './en';

function keysOf(obj: Record<string, unknown>, prefix = ''): string[] {
  let out: string[] = [];
  for (const k of Object.keys(obj).sort()) {
    const path = prefix ? `${prefix}.${k}` : k;
    const v = obj[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out = out.concat(keysOf(v as Record<string, unknown>, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

describe('PWA / connectivity locale parity (en vs ar)', () => {
  it('has identical key paths under pwa', () => {
    const ek = keysOf(en.pwa as unknown as Record<string, unknown>, 'pwa');
    const ak = keysOf(ar.pwa as unknown as Record<string, unknown>, 'pwa');
    expect(ak).toEqual(ek);
  });
});
