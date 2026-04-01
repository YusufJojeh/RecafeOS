import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { WeeklyDigestPage } from './WeeklyDigestPage';

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
    reportsWeeklyDigest: (id: string) => `/branches/${id}/reports/weekly-digest`,
  },
}));

import { apiFetch, ApiError } from '../lib/api';
const mockApiFetch = vi.mocked(apiFetch);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <WeeklyDigestPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const digest = {
  semantics: 'branch_local_7d',
  branchId: 'branch_1',
  branchName: 'Main',
  branchTimezone: 'UTC',
  calendarWindow: { startDay: '2026-03-01', endDay: '2026-03-07', startUtc: '', endUtc: '' },
  priorCalendarWindow: { startDay: '2026-02-22', endDay: '2026-02-28', startUtc: '', endUtc: '' },
  netPaidSalesMinor: 12300,
  paidOrderCount: 20,
  priorPeriod: { netPaidSalesMinor: 11000, paidOrderCount: 18, salesDeltaPct: 11.8 },
  setup: { readyForGoLive: true, blockingIncompleteCount: 0 },
  topIssue: null,
  weekdayComparison: [{ dow: 1, netSalesMinor: 1000, priorNetSalesMinor: 900, orderCount: 2, priorOrderCount: 1 }],
  orderTypeMix: { current: { salesByOrderType: {}, orderCountByOrderType: {} }, prior: { salesByOrderType: {}, orderCountByOrderType: {} } },
  discountTrends: { current: [], prior: [] },
};

describe('WeeklyDigestPage', () => {
  it('renders digest data', async () => {
    mockApiFetch.mockResolvedValueOnce(digest);
    renderPage();
    expect(await screen.findByText('Main', {}, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.getByText(/Net sales \(7d\)/i)).toBeInTheDocument();
  });

  it('renders error state when digest query fails', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('denied'));
    renderPage();
    expect(await screen.findByText(/Could not load digest/i)).toBeInTheDocument();
  });

  it('shows permission guidance when digest access is forbidden', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError('Forbidden', 403));
    renderPage();
    expect(await screen.findByText(/Digest access is limited/i)).toBeInTheDocument();
    expect(screen.getByText(/requires reports\.view/i)).toBeInTheDocument();
  });

  it('renders empty-state panels for missing mix and discount data', async () => {
    mockApiFetch.mockResolvedValueOnce({
      ...digest,
      orderTypeMix: {
        current: { salesByOrderType: {}, orderCountByOrderType: {} },
        prior: { salesByOrderType: {}, orderCountByOrderType: {} },
      },
      discountTrends: { current: [], prior: [] },
    });
    renderPage();
    expect(await screen.findAllByText('No paid orders')).toHaveLength(2);
    expect(screen.getAllByText('No discount reasons')).toHaveLength(2);
  });
});
