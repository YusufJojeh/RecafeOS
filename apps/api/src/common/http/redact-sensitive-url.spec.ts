import { redactSensitiveRequestUrl } from './redact-sensitive-url';

describe('redactSensitiveRequestUrl', () => {
  it('redacts session token in tenant/branch session paths', () => {
    expect(
      redactSensitiveRequestUrl(
        '/api/v1/public/tenants/demo/branches/main/sessions/clxyzsecret123/menu',
      ),
    ).toBe(
      '/api/v1/public/tenants/demo/branches/main/sessions/[session]/menu',
    );
  });

  it('redacts call-waiter session segment', () => {
    expect(
      redactSensitiveRequestUrl(
        '/api/v1/public/sessions/clxyzsecret123/call-waiter',
      ),
    ).toBe('/api/v1/public/sessions/[session]/call-waiter');
  });

  it('preserves non-public paths', () => {
    expect(redactSensitiveRequestUrl('/api/v1/branches/b1/orders')).toBe(
      '/api/v1/branches/b1/orders',
    );
  });
});
