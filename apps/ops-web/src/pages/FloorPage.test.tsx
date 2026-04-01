import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../lib/auth-store';
import { LanguageProvider } from '../i18n/context';
import { FloorPage } from './FloorPage';

vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(),
  branchPaths: {
    tables: (id: string) => `/api/v1/branches/${id}/tables`,
    opsSnapshot: (id: string) => `/api/v1/branches/${id}/ops-snapshot`,
  },
}));

vi.mock('../lib/use-branch-realtime-connected', () => ({
  useBranchRealtimeConnected: () => true,
}));

import { apiFetch } from '../lib/api';

const mockApiFetch = vi.mocked(apiFetch);

const opsSnapshot = {
  readyForGoLive: true,
  blockingIncompleteCount: 0,
  lowStockCount: 0,
  openShiftPresent: false,
};

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeClient()}>
      <LanguageProvider>
        <MemoryRouter>
          <FloorPage />
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe('FloorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clear();
    localStorage.clear();
  });

  it('renders page heading', () => {
    mockApiFetch.mockResolvedValue([]);
    useAuthStore.getState().setBranch('branch_1');
    renderPage();
    expect(screen.getByText('Floor')).toBeInTheDocument();
    expect(screen.getByText(/Monitor table occupancy/i)).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    mockApiFetch.mockImplementation(() => new Promise(() => {}));
    useAuthStore.getState().setBranch('branch_1');
    renderPage();
    expect(screen.getByText('Loading floor state')).toBeInTheDocument();
  });

  it('renders table cards when data is loaded', async () => {
    const tables = [
      { id: 't1', label: 'T1', status: 'AVAILABLE', sessions: [] },
      { id: 't2', label: 'T2', status: 'OCCUPIED', sessions: [{ id: 's1', guestCount: 3 }] },
    ];
    mockApiFetch.mockImplementation(async (path: string) =>
      path.includes('/tables') ? tables : opsSnapshot,
    );
    useAuthStore.getState().setBranch('branch_1');
    renderPage();

    await waitFor(() => expect(screen.getByTestId('floor-table-T1')).toBeInTheDocument());
    expect(screen.getByTestId('floor-table-T2')).toBeInTheDocument();
    expect(screen.getByText('T1')).toBeInTheDocument();
    expect(screen.getByText('T2')).toBeInTheDocument();
  });

  it('shows guest count for occupied tables', async () => {
    const tables = [
      { id: 't1', label: 'T1', status: 'OCCUPIED', sessions: [{ id: 's1', guestCount: 4 }] },
    ];
    mockApiFetch.mockImplementation(async (path: string) =>
      path.includes('/tables') ? tables : opsSnapshot,
    );
    useAuthStore.getState().setBranch('branch_1');
    renderPage();

    await waitFor(() => expect(screen.getByText('Guests: 4')).toBeInTheDocument());
  });

  it('shows error message when table fetch fails', async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes('/tables')) {
        throw new Error('Network error');
      }
      return opsSnapshot;
    });
    useAuthStore.getState().setBranch('branch_1');
    renderPage();

    await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
  });

  it('does not fetch when branch is not set', () => {
    renderPage();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});
