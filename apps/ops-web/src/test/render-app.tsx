import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '../lib/auth-store';
import { LanguageProvider } from '../i18n/context';

type AuthSeed = {
  accessToken?: string | null;
  refreshToken?: string | null;
  tenantId?: string | null;
  branchId?: string | null;
  preferredTenantSlug?: string | null;
};

type RenderAppOptions = {
  route?: string;
  auth?: AuthSeed;
  renderOptions?: Omit<RenderOptions, 'wrapper'>;
};

export function seedAuthStore(seed: AuthSeed = {}): void {
  useAuthStore.setState({
    accessToken: seed.accessToken ?? null,
    refreshToken: seed.refreshToken ?? null,
    tenantId: seed.tenantId ?? null,
    branchId: seed.branchId ?? null,
    preferredTenantSlug: seed.preferredTenantSlug ?? null,
  });
}

export function renderWithAppProviders(ui: ReactElement, options: RenderAppOptions = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  seedAuthStore(options.auth);

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <MemoryRouter initialEntries={[options.route ?? '/']}>{ui}</MemoryRouter>
        </LanguageProvider>
      </QueryClientProvider>,
      options.renderOptions,
    ),
  };
}
