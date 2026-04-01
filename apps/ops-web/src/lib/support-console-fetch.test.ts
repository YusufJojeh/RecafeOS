import { supportFetch } from './support-console-fetch';

describe('support-console-fetch', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('routes support requests through the internal server-side gateway', async () => {
    localStorage.setItem('accessToken', 'staff-token');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const out = await supportFetch('/support/diagnostics');
    expect(out).toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/internal/support-ui/diagnostics');
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer staff-token');
    expect(headers.get('x-support-api-key')).toBeNull();
    fetchMock.mockRestore();
  });

  it('adds operator header only for mutating support actions', async () => {
    localStorage.setItem('accessToken', 'staff-token');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await supportFetch(
      '/support/tenants/t1/pilot-feedback',
      { method: 'POST', body: JSON.stringify({ title: 'x' }) },
      { supportOperator: 'oncall' },
    );

    const [, init] = fetchMock.mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(headers.get('x-support-operator')).toBe('oncall');
    expect(headers.get('x-support-api-key')).toBeNull();
    expect(headers.get('Content-Type')).toBe('application/json');
    fetchMock.mockRestore();
  });

  it('does not read or write support secrets from browser storage', async () => {
    const sessionGet = vi.spyOn(Storage.prototype, 'getItem');
    const sessionSet = vi.spyOn(Storage.prototype, 'setItem');
    localStorage.setItem('accessToken', 'staff-token');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await supportFetch('/support/pilots');

    expect(
      sessionGet.mock.calls.some(([key]) => String(key).includes('support')),
    ).toBe(false);
    expect(
      sessionSet.mock.calls.some(([key]) => String(key).includes('support')),
    ).toBe(false);
    fetchMock.mockRestore();
    sessionGet.mockRestore();
    sessionSet.mockRestore();
  });
});
