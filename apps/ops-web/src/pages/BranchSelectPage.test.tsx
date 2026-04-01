import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../lib/auth-store';
import { LanguageProvider } from '../i18n/context';
import { BranchSelectPage } from './BranchSelectPage';

const navMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const mod = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...mod, useNavigate: () => navMock };
});

vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(),
  tenantPaths: {
    commerce: () => '/tenants/commerce',
  },
}));

const mockMe = (permissions: string[] = []) => ({
  userId: 'u1',
  email: 'a@b.c',
  displayName: 'Test',
  tenantId: 't1',
  permissions,
  defaultBranchId: null as string | null,
  branchAccessScope: 'ALL_TENANT_BRANCHES' as const,
});

import { apiFetch } from '../lib/api';

const mockApiFetch = vi.mocked(apiFetch);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <MemoryRouter>
          <BranchSelectPage />
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe('BranchSelectPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAuthStore.getState().clear();
  });

  it('renders branch options and navigates to floor on select', async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/auth/me') return mockMe();
      if (path === '/tenants/branches') {
        return [{ id: 'b1', name: 'Main', slug: 'main' }];
      }
      if (path === '/tenants/commerce') {
        return { limits: { maxBranches: 3, branchesInUse: 1 } };
      }
      return mockMe();
    });

    renderPage();
    const option = await screen.findByTestId('branch-option-main');
    fireEvent.click(option);

    expect(useAuthStore.getState().branchId).toBe('b1');
    expect(navMock).toHaveBeenCalledWith('/floor');
  });

  it('lists default branch from /auth/me first when present', async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/auth/me') return { ...mockMe(), defaultBranchId: 'b2' };
      if (path === '/tenants/branches') {
        return [
          { id: 'b1', name: 'First', slug: 'first' },
          { id: 'b2', name: 'Preferred', slug: 'preferred' },
        ];
      }
      if (path === '/tenants/commerce') {
        return { limits: { maxBranches: 3, branchesInUse: 2 } };
      }
      return mockMe();
    });

    renderPage();
    const options = await screen.findAllByTestId(/^branch-option-/);
    expect(options[0]).toHaveAttribute('data-testid', 'branch-option-preferred');
  });

  it('shows branch cap banner when plan limit is exhausted', async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/auth/me') return mockMe();
      if (path === '/tenants/branches') {
        return [{ id: 'b1', name: 'Main', slug: 'main' }];
      }
      if (path === '/tenants/commerce') {
        return { limits: { maxBranches: 1, branchesInUse: 1 } };
      }
      return mockMe();
    });

    renderPage();
    expect(await screen.findByText(/Plan branch limit in use/i)).toBeInTheDocument();
  });

  it('shows error state when branch fetch fails', async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/auth/me') return mockMe();
      if (path === '/tenants/branches') {
        throw new Error('Branches unavailable');
      }
      if (path === '/tenants/commerce') {
        return { limits: { maxBranches: 2, branchesInUse: 1 } };
      }
      return mockMe();
    });

    renderPage();
    await waitFor(() => expect(screen.getByText('Branches unavailable')).toBeInTheDocument());
  });
});
