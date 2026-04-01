import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TenantRollupSection } from './TenantRollupSection';

const baseRollup = {
  semantics: 'utc',
  fromUtc: '',
  toUtcInclusive: '',
  paidAtWindow: { start: '2026-01-01T00:00:00Z', endExclusive: '2026-01-08T00:00:00Z' },
  branchLimit: 5,
  branchIdsIncluded: ['b1'],
  branchesInScope: [{ branchId: 'b1', name: 'Main', slug: 'main' }],
  netPaidSalesMinor: 10000,
  paidOrderCount: 20,
  averageTicketMinor: 500,
  salesByOrderType: {},
  orderCountByOrderType: {},
  topBranchesBySales: [{ branchId: 'b1', name: 'Main', netPaidSalesMinor: 10000, paidOrderCount: 20 }],
  discountPressure: { totalDiscountMinor: 1000, ordersWithDiscountCount: 2 },
  priorPeriod: null,
};

describe('TenantRollupSection', () => {
  it('renders rollup snapshot and branch list', () => {
    render(
      <TenantRollupSection
        rollupFrom=""
        setRollupFrom={vi.fn()}
        rollupTo=""
        setRollupTo={vi.fn()}
        rollupQ={{ data: baseRollup, isLoading: false, isError: false } as never}
        rollupOperatorCues={['Coach low branch']}
        branchSnapDate="2026-01-10"
        setBranchSnapDate={vi.fn()}
        branchSnapQ={{
          data: { semantics: 'local_day', date: '2026-01-10', branchLimit: 5, branches: [{ branchId: 'b1', name: 'Main', slug: 'main', branchTimezone: 'UTC', netPaidSalesMinor: 9000, paidOrderCount: 19 }] },
          isLoading: false,
          isError: false,
        } as never}
      />,
    );

    expect(screen.getByText(/All branches \(tenant rollup\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Included branch IDs/i)).toBeInTheDocument();
    expect(screen.getAllByText('Main').length).toBeGreaterThan(0);
  });

  it('renders loading and error states', () => {
    render(
      <TenantRollupSection
        rollupFrom=""
        setRollupFrom={vi.fn()}
        rollupTo=""
        setRollupTo={vi.fn()}
        rollupQ={{ data: undefined, isLoading: true, isError: true } as never}
        rollupOperatorCues={[]}
        branchSnapDate="2026-01-10"
        setBranchSnapDate={vi.fn()}
        branchSnapQ={{ data: undefined, isLoading: true, isError: true } as never}
      />,
    );

    expect(screen.getByText(/Loading rollup/i)).toBeInTheDocument();
    expect(screen.getByText(/Could not load tenant rollup/i)).toBeInTheDocument();
    expect(screen.getByText(/Loading snapshot/i)).toBeInTheDocument();
  });
});
