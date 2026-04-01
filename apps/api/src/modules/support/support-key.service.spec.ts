import { ConfigService } from '@nestjs/config';
import { SupportKeyService } from './support-key.service';

function svc(env: Record<string, string | undefined>) {
  const config = {
    get: (key: string) => env[key],
  } as ConfigService;
  const s = new SupportKeyService(config);
  s.onModuleInit();
  return s;
}

describe('SupportKeyService', () => {
  it('legacy mode: same key passes read and write checks', () => {
    const s = svc({ SUPPORT_API_KEY: 'secret-legacy' });
    expect(s.isDisabled()).toBe(false);
    expect(s.isSplitMode()).toBe(false);
    expect(s.checkRead('secret-legacy')).toBe(true);
    expect(s.checkWrite('secret-legacy')).toBe(true);
    expect(s.checkRead('wrong')).toBe(false);
    expect(s.checkWrite('wrong')).toBe(false);
  });

  it('split mode: read key passes read, write passes both read and write checks', () => {
    const s = svc({
      SUPPORT_API_KEY_READ: 'read-key',
      SUPPORT_API_KEY_WRITE: 'write-key',
    });
    expect(s.isSplitMode()).toBe(true);
    expect(s.checkRead('read-key')).toBe(true);
    expect(s.checkRead('write-key')).toBe(true);
    expect(s.checkWrite('write-key')).toBe(true);
    expect(s.checkWrite('read-key')).toBe(false);
  });

  it('throws when only one of read/write is set', () => {
    expect(() => svc({ SUPPORT_API_KEY_READ: 'r' })).toThrow(
      /SUPPORT_API_KEY_READ and SUPPORT_API_KEY_WRITE must both be set/,
    );
  });

  it('throws when legacy and split are both set', () => {
    expect(() =>
      svc({
        SUPPORT_API_KEY: 'a',
        SUPPORT_API_KEY_READ: 'r',
        SUPPORT_API_KEY_WRITE: 'w',
      }),
    ).toThrow(/Use either SUPPORT_API_KEY alone/);
  });

  it('disabled mode when no keys', () => {
    const s = svc({});
    expect(s.isDisabled()).toBe(true);
    expect(s.checkRead('x')).toBe(false);
    expect(s.checkWrite('x')).toBe(false);
  });
});
