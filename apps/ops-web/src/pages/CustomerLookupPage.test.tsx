import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CustomerLookupPage } from './CustomerLookupPage';

const staffMe = (permissions: string[]) => ({
  userId: 'u1',
  email: 'a@b.c',
  displayName: 'T',
  tenantId: 't1',
  permissions,
  defaultBranchId: null as string | null,
  branchAccessScope: 'ALL_TENANT_BRANCHES' as const,
});

const staffPermState = {
  permissions: [] as string[],
};

vi.mock('../lib/staff-permissions', () => ({
  useStaffPermissions: () => ({
    permissions: staffPermState.permissions,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('../lib/use-branch-id', () => ({
  useBranchId: () => 'branch_1',
}));

vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(),
  branchPaths: {
    customersBranchSearch: (_id: string, q: string) => `/customers/search?q=${q}`,
  },
  customerPaths: {
    detail: (id: string) => `/customers/${id}`,
    patch: (id: string) => `/customers/${id}`,
    addNote: (id: string) => `/customers/${id}/notes`,
    addOffer: (id: string) => `/customers/${id}/offers`,
  },
  tenantPaths: {
    repeatCustomers: () => '/repeat-customers',
    archiveStaleCustomerVisits: () => '/archive',
  },
}));

import { apiFetch } from '../lib/api';
const mockApiFetch = vi.mocked(apiFetch);

function renderPage(path = '/customers?q=ab') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/customers" element={<CustomerLookupPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CustomerLookupPage', () => {
  it('shows no matches state for empty search result', async () => {
    staffPermState.permissions = [];
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/auth/me') return staffMe([]);
      if (path.startsWith('/customers/search')) return [];
      return {};
    });
    renderPage();
    expect(await screen.findByText('No matches.')).toBeInTheDocument();
  }, 15000);

  it('shows search error state when search API fails', async () => {
    staffPermState.permissions = [];
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/auth/me') return staffMe([]);
      if (path.startsWith('/customers/search')) throw new Error('nope');
      return {};
    });
    renderPage();
    expect(await screen.findByText(/Search failed/i)).toBeInTheDocument();
  });

  it('runs search from input interaction', async () => {
    staffPermState.permissions = [];
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/auth/me') return staffMe([]);
      if (path.startsWith('/customers/search')) return [];
      return {};
    });
    renderPage('/customers');
    fireEvent.change(screen.getByPlaceholderText(/Phone or name/i), { target: { value: '55' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('No matches.')).toBeInTheDocument();
  });

  it('renders detail and triggers manage actions when permission allows', async () => {
    staffPermState.permissions = ['customers.manage', 'reports.tenant_rollups'];
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/auth/me') return staffMe(['customers.manage', 'reports.tenant_rollups']);
      if (path.startsWith('/customers/search')) return [{ id: 'c1', phone: '123', name: 'A', visitCount: 1 }];
      if (path === '/customers/c1') {
        if (init?.method === 'PATCH') return { ok: true };
        return {
          id: 'c1',
          phone: '123',
          name: 'Guest',
          notes: 'sticky',
          tags: ['vip'],
          visitCount: 1,
          visits: [],
          noteEntries: [],
          offers: [],
          intelligence: { daysSinceLastVisit: 1, visitsLast90Days: 1, primaryBranch: null, segment: 'new' },
          suggestedActions: [],
        };
      }
      if (path === '/customers/c1/notes') return { ok: true };
      if (path === '/customers/c1/offers') return { ok: true };
      if (path === '/repeat-customers') return { customers: [], days: 90 };
      if (path === '/archive') return { deletedVisitRows: 0, years: 7, cutoffUtc: new Date().toISOString() };
      return {};
    });

    renderPage('/customers?q=ab&id=c1');
    expect(await screen.findByText(/Tags and sticky note/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save profile fields' }));
    });
    fireEvent.change(screen.getByLabelText(/New note text/i), { target: { value: 'VIP table preference' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    });
    fireEvent.change(screen.getByLabelText(/Offer title/i), { target: { value: 'Free dessert' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    });

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
  }, 15000);
});
