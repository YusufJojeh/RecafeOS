import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LanguageProvider } from '@/i18n/context';
import { DailyReportBody } from './DailyReportBody';
import type { DailyReport } from './reports-types';

function renderWithI18n(ui: ReactElement) {
  return render(
    <LanguageProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </LanguageProvider>,
  );
}

const report: DailyReport = {
  totalSalesMinor: 10000,
  orderCount: 20,
  averageOrderValueMinor: 500,
  sameWeekdayBenchmark: {
    priorSameWeekdaysSampled: 4,
    medianNetSalesMinor: 9000,
    medianOrderCount: 18,
  },
  salesByOrderType: { DINE_IN: 7000 },
  orderCountByOrderType: { DINE_IN: 14 },
  topItems: [{ name: 'Latte', qty: 10, revenue: 3000 }],
  salesByCategory: [{ name: 'Coffee', revenueMinor: 7000, qty: 14 }],
  paymentsByMethod: { CASH: 4000, CARD: 6000 },
  summary: { grossSalesMinor: 11000, netSalesMinor: 10000, totalDiscountMinor: 1000 },
  hourlySales: [{ hour: 9, orderCount: 4, salesMinor: 2000 }],
  cancellations: {
    count: 1,
    lostSubtotalMinor: 300,
    byReason: [{ reason: 'CUSTOMER_CHANGE', count: 1, lostSubtotalMinor: 300 }],
  },
  discounts: {
    ordersWithDiscountCount: 2,
    totalDiscountMinor: 1000,
    topReasons: [{ reason: 'PROMO', count: 2 }],
  },
  cashiers: [{ userId: 'u1', displayName: 'Cashier', paymentsTotalMinor: 6000, orderCount: 10 }],
  shifts: [{ id: 's1', openedAt: new Date().toISOString(), closedAt: null, orderCount: 20, salesMinor: 10000 }],
  topCustomers: [{ customerId: 'c1', phone: '123', name: 'Guest', ordersCount: 2, revenueMinor: 900 }],
  visits: { visitsRecorded: 5, repeatVisitsAtBranch: 2, firstTimeVisitsAtBranch: 3 },
  stock: {
    lowStockItems: [
      {
        id: 'i1',
        name: 'Milk',
        quantity: '1',
        lowThreshold: '2',
        unit: 'L',
        severityRatio: 0.5,
        linkedToTopSeller: true,
      },
    ],
  },
  flags: [],
};

describe('DailyReportBody', () => {
  it('renders core report sections and KPIs', () => {
    renderWithI18n(
      <DailyReportBody
        report={report}
        dailyOperatorCues={['Watch discount pressure']}
        visitSignals={undefined}
        demand={undefined}
        demandLoading={false}
        demandError={false}
        typeEntries={[['DINE_IN', 7000]]}
        maxHourly={2000}
        maxType={7000}
      />,
    );

    expect(screen.getAllByText('Net sales').length).toBeGreaterThan(0);
    expect(screen.getByText('Top items')).toBeInTheDocument();
    expect(screen.getByText('Sales by category')).toBeInTheDocument();
    expect(screen.getByText('Cancellation reasons')).toBeInTheDocument();
  }, 15000);

  it('renders demand loading and error states', () => {
    renderWithI18n(
      <DailyReportBody
        report={report}
        dailyOperatorCues={[]}
        visitSignals={undefined}
        demand={undefined}
        demandLoading
        demandError
        typeEntries={[]}
        maxHourly={1}
        maxType={1}
      />,
    );

    expect(screen.getByText(/Loading demand profile/i)).toBeInTheDocument();
    expect(screen.getByText(/Could not load demand profile/i)).toBeInTheDocument();
  });

  it('wraps dense data tables in horizontal overflow containers', () => {
    const { container } = renderWithI18n(
      <DailyReportBody
        report={report}
        dailyOperatorCues={[]}
        visitSignals={undefined}
        demand={undefined}
        demandLoading={false}
        demandError={false}
        typeEntries={[]}
        maxHourly={1}
        maxType={1}
      />,
    );

    const wrappedTables = container.querySelectorAll('div.overflow-x-auto > table');
    expect(wrappedTables.length).toBeGreaterThanOrEqual(3);
  });
});
