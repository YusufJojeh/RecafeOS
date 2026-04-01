import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LanguageProvider } from '@/i18n/context';
import { CloseOfDayPanel } from './CloseOfDayPanel';

type Shift = {
  id: string;
  openedAt: string;
  closedAt: string | null;
  orderCount: number;
  salesMinor: number;
};

type ReportFlag = {
  code: string;
  severity: 'info' | 'warn' | 'risk';
  message: string;
};

function makeReport(overrides: {
  totalSalesMinor?: number;
  orderCount?: number;
  shifts?: Shift[];
  flags?: ReportFlag[];
} = {}) {
  return {
    totalSalesMinor: 0,
    orderCount: 0,
    shifts: [],
    flags: [],
    ...overrides,
  };
}

function makeShift(closed: boolean, id = 's1'): Shift {
  return {
    id,
    openedAt: '2026-03-24T08:00:00Z',
    closedAt: closed ? '2026-03-24T16:00:00Z' : null,
    orderCount: 10,
    salesMinor: 5000,
  };
}

function renderPanel(report: ReturnType<typeof makeReport>) {
  return render(
    <LanguageProvider>
      <MemoryRouter>
        <CloseOfDayPanel report={report} />
      </MemoryRouter>
    </LanguageProvider>,
  );
}

describe('CloseOfDayPanel', () => {
  it('renders net sales formatted as decimal', () => {
    renderPanel(makeReport({ totalSalesMinor: 12345 }));
    expect(screen.getByText('123.45')).toBeInTheDocument();
  });

  it('renders order count', () => {
    renderPanel(makeReport({ orderCount: 42 }));
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    renderPanel(makeReport());
    expect(screen.getByRole('link', { name: /Stock/i })).toHaveAttribute('href', '/stock');
    expect(screen.getByRole('link', { name: /Setup/i })).toHaveAttribute('href', '/setup');
    expect(screen.getByRole('link', { name: /Open bills/i })).toHaveAttribute('href', '/orders');
  });

  it('shows no open shift alert when all shifts are closed', () => {
    renderPanel(makeReport({ shifts: [makeShift(true)] }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows open shift alert when one shift is open', () => {
    renderPanel(makeReport({ shifts: [makeShift(false)] }));
    const alert = screen.getByRole('status');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/shift still open/i);
  });

  it('shows correct count and plural for multiple open shifts', () => {
    renderPanel(
      makeReport({
        shifts: [makeShift(false, 's1'), makeShift(false, 's2'), makeShift(true, 's3')],
      }),
    );
    const alert = screen.getByRole('status');
    expect(alert).toHaveTextContent('2');
    expect(alert).toHaveTextContent('shifts');
  });

  it('shows no flags message when flags array is empty', () => {
    renderPanel(makeReport({ flags: [] }));
    expect(screen.getByText(/No automated flags for this day/i)).toBeInTheDocument();
  });

  it('does not show no-flags message when flags are present', () => {
    renderPanel(
      makeReport({
        flags: [{ code: 'DISC_HIGH', severity: 'warn', message: 'Discount share elevated' }],
      }),
    );
    expect(screen.queryByText(/No automated flags/i)).toBeNull();
  });

  it('renders flag code and message', () => {
    renderPanel(
      makeReport({
        flags: [{ code: 'CANCEL_RATE', severity: 'info', message: 'Cancellation rate above average' }],
      }),
    );
    expect(screen.getByText('CANCEL_RATE')).toBeInTheDocument();
    expect(screen.getByText('Cancellation rate above average')).toBeInTheDocument();
  });

  it('renders multiple flags', () => {
    renderPanel(
      makeReport({
        flags: [
          { code: 'F1', severity: 'info', message: 'Info message' },
          { code: 'F2', severity: 'warn', message: 'Warn message' },
          { code: 'F3', severity: 'risk', message: 'Risk message' },
        ],
      }),
    );
    expect(screen.getByText('F1')).toBeInTheDocument();
    expect(screen.getByText('F2')).toBeInTheDocument();
    expect(screen.getByText('F3')).toBeInTheDocument();
    expect(screen.getByText('Info message')).toBeInTheDocument();
    expect(screen.getByText('Warn message')).toBeInTheDocument();
    expect(screen.getByText('Risk message')).toBeInTheDocument();
  });

  it('applies risk styling to risk-severity flag', () => {
    renderPanel(
      makeReport({
        flags: [{ code: 'HIGH_RISK', severity: 'risk', message: 'Critical issue' }],
      }),
    );
    const flagItem = screen.getByText('HIGH_RISK').closest('li');
    expect(flagItem?.className).toContain('red');
  });

  it('applies warn styling to warn-severity flag', () => {
    renderPanel(
      makeReport({
        flags: [{ code: 'WARN_CODE', severity: 'warn', message: 'Warning message' }],
      }),
    );
    const flagItem = screen.getByText('WARN_CODE').closest('li');
    expect(flagItem?.className).toContain('amber');
  });

  it('applies info styling to info-severity flag', () => {
    renderPanel(
      makeReport({
        flags: [{ code: 'INFO_CODE', severity: 'info', message: 'Info message' }],
      }),
    );
    const flagItem = screen.getByText('INFO_CODE').closest('li');
    expect(flagItem?.className).toContain('bg-muted/30');
  });
});
