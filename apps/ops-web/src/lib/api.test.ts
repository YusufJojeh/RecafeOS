import { STAFF_HTTP_HEADER } from '@restocafe/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './auth-store';
import {
  ApiError,
  apiFetch,
  getBranchId,
  getSocketBaseUrl,
  getToken,
  isApiError,
} from './api';

describe('ApiError', () => {
  it('is an instance of Error', () => {
    const e = new ApiError('oops', 400);
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(ApiError);
  });
  it('stores status and body', () => {
    const body = { code: 'NOT_FOUND' };
    const e = new ApiError('not found', 404, body);
    expect(e.status).toBe(404);
    expect(e.body).toBe(body);
    expect(e.message).toBe('not found');
    expect(e.name).toBe('ApiError');
  });
  it('works without body', () => {
    const e = new ApiError('fail', 500);
    expect(e.body).toBeUndefined();
  });
});

describe('isApiError', () => {
  it('returns true for ApiError instances', () => {
    expect(isApiError(new ApiError('x', 400))).toBe(true);
  });
  it('returns false for plain Error', () => {
    expect(isApiError(new Error('x'))).toBe(false);
  });
  it('returns false for null', () => {
    expect(isApiError(null)).toBe(false);
  });
  it('returns false for strings', () => {
    expect(isApiError('error')).toBe(false);
  });
});

describe('getToken / getBranchId', () => {
  beforeEach(() => localStorage.clear());

  it('getToken returns null when not set', () => {
    expect(getToken()).toBeNull();
  });
  it('getToken returns stored value', () => {
    localStorage.setItem('accessToken', 'my_token');
    expect(getToken()).toBe('my_token');
  });
  it('getBranchId returns null when not set', () => {
    expect(getBranchId()).toBeNull();
  });
  it('getBranchId returns stored value', () => {
    localStorage.setItem('branchId', 'branch_1');
    expect(getBranchId()).toBe('branch_1');
  });
});

describe('getSocketBaseUrl', () => {
  it('returns window.location.origin when no VITE_API_URL', () => {
    // jsdom sets window.location.origin
    const result = getSocketBaseUrl();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('apiFetch', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.getState().clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not force a JSON content-type header on body-less requests', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal('fetch', mockFetch);

    await apiFetch('/test');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    const headers = new Headers(init.headers as HeadersInit);
    expect(headers.get('Content-Type')).toBeNull();
  });

  it('sets JSON content-type when a string body is sent', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal('fetch', mockFetch);

    await apiFetch('/test', { method: 'POST', body: JSON.stringify({ ok: true }) });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    const headers = new Headers(init.headers as HeadersInit);
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('attaches Authorization header when token present', async () => {
    localStorage.setItem('accessToken', 'tok123');
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    vi.stubGlobal('fetch', mockFetch);

    await apiFetch('/test');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    const headers = new Headers(init.headers as HeadersInit);
    expect(headers.get(STAFF_HTTP_HEADER.AUTHORIZATION)).toBe('Bearer tok123');
  });

  it('attaches X-Branch-Id header when branchId present', async () => {
    localStorage.setItem('branchId', 'branch_x');
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    vi.stubGlobal('fetch', mockFetch);

    await apiFetch('/test');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    const headers = new Headers(init.headers as HeadersInit);
    expect(headers.get(STAFF_HTTP_HEADER.BRANCH_ID)).toBe('branch_x');
  });

  it('throws ApiError on non-2xx response with JSON body', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Not found' }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Not found' }), { status: 404 }));
    vi.stubGlobal('fetch', mockFetch);

    await expect(apiFetch('/notfound')).rejects.toBeInstanceOf(ApiError);
    await expect(apiFetch('/notfound')).rejects.toMatchObject({ status: 404 });
  });

  it('throws ApiError on 403 with body.code', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Suspended', code: 'TENANT_SUSPENDED' }), {
        status: 403,
      }),
    );
    vi.stubGlobal('fetch', mockFetch);

    try {
      await apiFetch('/protected');
    } catch (e) {
      expect(isApiError(e)).toBe(true);
      expect((e as ApiError).status).toBe(403);
      expect((e as ApiError).body).toMatchObject({ code: 'TENANT_SUSPENDED' });
    }
  });

  it('returns undefined for 204 responses', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', mockFetch);

    const result = await apiFetch('/delete');
    expect(result).toBeUndefined();
  });

  it('handles non-JSON error body gracefully', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('Internal Server Error', { status: 500 }),
    );
    vi.stubGlobal('fetch', mockFetch);

    await expect(apiFetch('/fail')).rejects.toBeInstanceOf(ApiError);
  });

  it('handles empty error body', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('', { status: 503, statusText: 'Service Unavailable' }),
    );
    vi.stubGlobal('fetch', mockFetch);

    try {
      await apiFetch('/down');
    } catch (e) {
      expect(isApiError(e)).toBe(true);
      expect((e as ApiError).message).toContain('Service Unavailable');
    }
  });

  it('refreshes the session after a 401 and retries the original request', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'stale_access',
      refreshToken: 'refresh_1',
      tenantId: 'tenant_1',
      tenantSlug: 'demo',
    });
    useAuthStore.getState().setBranch('branch_1');

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessToken: 'fresh_access',
            refreshToken: 'refresh_2',
            tenantId: 'tenant_1',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    vi.stubGlobal('fetch', mockFetch);

    await expect(apiFetch<{ ok: boolean }>('/protected')).resolves.toEqual({ ok: true });

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockFetch.mock.calls[1]?.[0]).toBe('/api/v1/auth/refresh');
    expect(mockFetch.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ refreshToken: 'refresh_1' }),
    });

    const retryInit = mockFetch.mock.calls[2]?.[1] as RequestInit & { headers: Headers };
    const retryHeaders = new Headers(retryInit.headers as HeadersInit);
    expect(retryHeaders.get(STAFF_HTTP_HEADER.AUTHORIZATION)).toBe(
      'Bearer fresh_access',
    );
    expect(retryHeaders.get(STAFF_HTTP_HEADER.BRANCH_ID)).toBe('branch_1');
    expect(useAuthStore.getState().accessToken).toBe('fresh_access');
    expect(useAuthStore.getState().branchId).toBe('branch_1');
  });

  it('clears the session and records expiry when refresh fails', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'stale_access',
      refreshToken: 'refresh_1',
      tenantId: 'tenant_1',
      tenantSlug: 'demo',
    });
    useAuthStore.getState().setBranch('branch_1');

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Refresh expired' }), { status: 401 }),
      );
    vi.stubGlobal('fetch', mockFetch);

    await expect(apiFetch('/protected')).rejects.toMatchObject({ status: 401 });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
    expect(useAuthStore.getState().branchId).toBeNull();
    expect(localStorage.getItem('restocafe-session-reason')).toBe('expired');
  });

  it('refreshes after 401 when refresh token exists but access token is missing', async () => {
    useAuthStore.setState({
      accessToken: null,
      refreshToken: 'refresh_1',
      tenantId: 'tenant_1',
      branchId: 'branch_1',
      preferredTenantSlug: 'demo',
    });
    localStorage.setItem('refreshToken', 'refresh_1');
    localStorage.setItem('tenantId', 'tenant_1');
    localStorage.setItem('branchId', 'branch_1');

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessToken: 'fresh_access',
            refreshToken: 'refresh_2',
            tenantId: 'tenant_1',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    vi.stubGlobal('fetch', mockFetch);

    await expect(apiFetch<{ ok: boolean }>('/protected')).resolves.toEqual({ ok: true });

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(useAuthStore.getState().accessToken).toBe('fresh_access');
  });

  it('retries GET once on transient network failure (TypeError)', async () => {
    vi.useFakeTimers();
    try {
      const mockFetch = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ ok: true }), { status: 200 }),
        );
      vi.stubGlobal('fetch', mockFetch);

      const req = apiFetch<{ ok: boolean }>('/ok');
      await vi.advanceTimersByTimeAsync(500);
      await expect(req).resolves.toEqual({ ok: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not retry POST on network failure', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', mockFetch);
    await expect(
      apiFetch('/x', { method: 'POST', body: '{}' }),
    ).rejects.toBeInstanceOf(TypeError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
