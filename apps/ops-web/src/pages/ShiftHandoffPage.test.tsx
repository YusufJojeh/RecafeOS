import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/i18n/context';
import { ShiftHandoffPage } from './ShiftHandoffPage';

vi.mock('../lib/use-branch-id', () => ({
  useBranchId: () => 'branch_1',
}));

vi.mock('../lib/api', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    body?: unknown;
    constructor(message: string, status: number, body?: unknown) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.body = body;
    }
  },
  isApiError: (error: unknown) => error instanceof Error && error.name === 'ApiError',
  apiFetch: vi.fn(),
  branchPaths: {
    opsSnapshot: (id: string) => `/branches/${id}/ops-snapshot`,
    reportsDaily: (id: string, date: string) => `/branches/${id}/reports/daily?date=${date}`,
  },
}));

import { apiFetch, ApiError } from '../lib/api';
const mockApiFetch = vi.mocked(apiFetch);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <LanguageProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ShiftHandoffPage />
        </MemoryRouter>
      </QueryClientProvider>
    </LanguageProvider>,
  );
}

describe('ShiftHandoffPage', () => {
  it('renders summary cards from report payload', async () => {
    mockApiFetch.mockImplementation(async (path: unknown) => {
      const requestPath = String(path);
      if (requestPath.includes('/reports/daily')) {
        return {
          totalSalesMinor: 1500,
          orderCount: 6,
          shifts: [],
          flags: [],
          cancellations: { count: 1, reasons: [] },
          summary: { totalDiscountMinor: 100, grossSalesMinor: 1600, returnsMinor: 0 },
          stock: { lowStockItems: [] },
        };
      }
      return { lowStockCount: 0, blockingIncompleteCount: 0, hasOpenShift: false };
    });

    renderPage();
    expect(await screen.findByText('Shift handoff')).toBeInTheDocument();
    expect((await screen.findAllByText('Net sales')).length).toBeGreaterThan(0);
  });

  it('renders error state when report query fails', async () => {
    mockApiFetch.mockImplementation(async (path: unknown) => {
      const requestPath = String(path);
      if (requestPath.includes('/reports/daily')) {
        throw new Error('bad');
      }
      return { lowStockCount: 0, blockingIncompleteCount: 0, hasOpenShift: false };
    });
    renderPage();
    expect(await screen.findByText('Could not load report.')).toBeInTheDocument();
  });

  it('shows permission guidance when shift handoff access is forbidden', async () => {
    mockApiFetch.mockImplementation(async (path: unknown) => {
      const requestPath = String(path);
      if (requestPath.includes('/reports/daily')) {
        throw new ApiError('Forbidden', 403);
      }
      return { lowStockCount: 0, blockingIncompleteCount: 0, hasOpenShift: false };
    });
    renderPage();
    expect(await screen.findByText('Shift handoff access is limited')).toBeInTheDocument();
    expect(screen.getByText(/requires reports\.view/i)).toBeInTheDocument();
  });
});
