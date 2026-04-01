import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { useAuthStore } from './lib/auth-store';
import { LanguageProvider } from './i18n/context';

/** Default staff perms so dashboard routes resolve in jsdom without a real API. */
const MOCK_STAFF_PERMISSIONS = [
  'tables.manage',
  'orders.edit',
  'menu.read',
  'kitchen.view',
  'bar.view',
  'reports.view',
  'stock.manage',
  'settings.manage',
  'customers.view',
] as const;

function stubDashboardFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/me')) {
        return new Response(
          JSON.stringify({
            userId: 'mock-user',
            email: 'mock@test',
            displayName: 'Mock',
            tenantId: 'tenant',
            permissions: [...MOCK_STAFF_PERMISSIONS],
            defaultBranchId: 'branch_main',
            branchAccessScope: 'ALL_TENANT_BRANCHES',
          }),
          { status: 200 },
        );
      }
      if (url.includes('/tenants/branches') && !url.match(/\/branches\/[^/]+\//)) {
        return new Response(
          JSON.stringify([
            { id: 'branch_main', name: 'Main', slug: 'main' },
          ]),
          { status: 200 },
        );
      }
      if (url.includes('/ops-snapshot')) {
        return new Response(
          JSON.stringify({
            readyForGoLive: true,
            blockingIncompleteCount: 0,
            lowStockCount: 0,
            openShiftPresent: false,
          }),
          { status: 200 },
        );
      }
      if (url.includes('/tables') && !url.includes('/sessions')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(JSON.stringify({ message: 'not mocked' }), { status: 404 });
    }) as typeof fetch,
  );
}

async function renderApp(initialEntries: string[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  let rendered!: ReturnType<typeof render>;
  await act(async () => {
    rendered = render(
      <QueryClientProvider client={client}>
        <LanguageProvider>
          <MemoryRouter initialEntries={initialEntries}>
            <App />
          </MemoryRouter>
        </LanguageProvider>
      </QueryClientProvider>,
    );
  });

  return rendered;
}

describe('App', () => {
  beforeEach(() => {
    stubDashboardFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    act(() => {
      useAuthStore.setState({
        accessToken: null,
        refreshToken: null,
        tenantId: null,
        branchId: null,
        preferredTenantSlug: null,
      });
    });
  });

  it('renders login route', async () => {
    await renderApp(['/login']);
    expect(screen.getByText(/RestoCafe OS/i)).toBeInTheDocument();
  });

  it('redirects /branch to login when unauthenticated', async () => {
    await renderApp(['/branch']);
    expect(await screen.findByRole('heading', { name: /Staff access/i })).toBeInTheDocument();
  });

  it('redirects authenticated users without branch from /floor to /branch', async () => {
    act(() => {
      useAuthStore.setState({
        accessToken: 'token',
        refreshToken: 'refresh',
        tenantId: 'tenant',
        branchId: null,
      });
    });

    await renderApp(['/floor']);
    expect(await screen.findByText(/Select branch/i)).toBeInTheDocument();
  });

  it('shows not-found page for unknown routes', async () => {
    await renderApp(['/not-a-real-route']);
    expect(screen.getByText(/Page not found/i)).toBeInTheDocument();
  });

  it('redirects root to login when unauthenticated', async () => {
    await renderApp(['/']);
    expect(await screen.findByRole('heading', { name: /Staff access/i })).toBeInTheDocument();
  });

  it('renders guarded floor route when authenticated with branch', async () => {
    act(() => {
      useAuthStore.setState({
        accessToken: 'token',
        refreshToken: 'refresh',
        tenantId: 'tenant',
        branchId: 'branch_main',
      });
    });
    await renderApp(['/floor']);
    const main = document.querySelector('main#app-main');
    expect(main).toBeTruthy();
    expect(
      await within(main as HTMLElement).findByRole('heading', {
        level: 1,
        name: /^Floor$/,
      }),
    ).toBeInTheDocument();
  }, 15000);

  it('renders skip link and main landmark wrapper', async () => {
    await renderApp(['/login']);
    expect(screen.getByRole('link', { name: /Skip to main content/i })).toBeInTheDocument();
    expect(document.querySelector('main#app-main')).toBeTruthy();
  });

  it('not-found fallback has a return-to-floor action', async () => {
    await renderApp(['/404-test']);
    await act(async () => {
      fireEvent.click(screen.getByRole('link', { name: /Go to Floor/i }));
    });
    expect(await screen.findByRole('heading', { name: /Staff access/i })).toBeInTheDocument();
  });
});
