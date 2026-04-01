import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/i18n/context';
import { ReportsPage } from './ReportsPage';

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

vi.mock('./reports/DailyReportBody', () => ({
  DailyReportBody: () => <div data-testid="daily-report-body">Daily body</div>,
}));

vi.mock('./reports/reports-cues', () => ({
  buildDailyOperatorCues: () => [],
  buildRollupOperatorCues: () => [],
}));

vi.mock('./reports/TenantRollupSection', () => ({
  TenantRollupSection: () => <section data-testid="tenant-rollup">Tenant rollup</section>,
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
    customerVisitSignals: () => '/visit-signals',
    opsSnapshot: () => '/ops-snapshot',
    reportsDaily: () => '/reports/daily',
    reportsDemandProfile: () => '/reports/demand',
  },
  tenantPaths: {
    tenantRollup: () => '/tenant-rollup',
    branchSnapshot: () => '/branch-snapshot',
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
          <ReportsPage />
        </MemoryRouter>
      </QueryClientProvider>
    </LanguageProvider>,
  );
}

const dailyReportStub = {
  summary: { grossSalesMinor: 10000, totalDiscountMinor: 500, returnsMinor: 0, totalItemsSold: 10 },
  salesByOrderType: {},
  hourlySales: [],
  topItems: [],
};

describe('ReportsPage', () => {
  it('shows report error state when daily report fails', async () => {
    staffPermState.permissions = [];
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/auth/me') return staffMe([]);
      if (path === '/reports/daily') throw new Error('fail');
      return {};
    });
    renderPage();
    expect(
      await screen.findByText('Could not load report.', {}, { timeout: 10000 }),
    ).toBeInTheDocument();
  });

  it('shows permission guidance when report access is forbidden', async () => {
    staffPermState.permissions = [];
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/auth/me') return staffMe([]);
      if (path === '/reports/daily') throw new ApiError('Forbidden', 403);
      return {};
    });
    renderPage();
    expect(await screen.findByText('Report access is limited')).toBeInTheDocument();
    expect(screen.getByText(/requires reports\.view/i)).toBeInTheDocument();
  });

  it('renders daily body with branch report data', async () => {
    staffPermState.permissions = [];
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/auth/me') return staffMe([]);
      if (path === '/reports/daily') return dailyReportStub;
      return {};
    });
    renderPage();
    expect(await screen.findByTestId('daily-report-body')).toBeInTheDocument();
  });

  it('renders tenant rollup section when permission exists', async () => {
    staffPermState.permissions = ['reports.tenant_rollups'];
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/auth/me') return staffMe(['reports.tenant_rollups']);
      if (path === '/reports/daily') return dailyReportStub;
      if (path === '/tenant-rollup') return {};
      if (path === '/branch-snapshot') return {};
      return {};
    });
    renderPage();
    expect(await screen.findByTestId('tenant-rollup')).toBeInTheDocument();
  });
});
