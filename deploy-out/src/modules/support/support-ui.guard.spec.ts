import type { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupportUiGuard } from './support-ui.guard';

function makeContext(email?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: email ? { email } : undefined }),
    }),
  } as ExecutionContext;
}

describe('SupportUiGuard', () => {
  it('allows authenticated allowlisted email', () => {
    const config = new ConfigService({
      NODE_ENV: 'production',
      SUPPORT_UI_ENABLED: 'true',
      SUPPORT_UI_ALLOWED_EMAILS: 'ops@example.com,oncall@example.com',
    });
    const guard = new SupportUiGuard(config);

    expect(guard.canActivate(makeContext('ops@example.com'))).toBe(true);
  });

  it('rejects email outside allowlist', () => {
    const config = new ConfigService({
      NODE_ENV: 'production',
      SUPPORT_UI_ENABLED: 'true',
      SUPPORT_UI_ALLOWED_EMAILS: 'ops@example.com',
    });
    const guard = new SupportUiGuard(config);

    expect(() => guard.canActivate(makeContext('owner@demo.local'))).toThrow();
  });

  it('allows authenticated users in non-production when allowlist is empty', () => {
    const config = new ConfigService({
      NODE_ENV: 'development',
      SUPPORT_UI_ENABLED: 'true',
    });
    const guard = new SupportUiGuard(config);

    expect(guard.canActivate(makeContext('dev@example.com'))).toBe(true);
  });
});
