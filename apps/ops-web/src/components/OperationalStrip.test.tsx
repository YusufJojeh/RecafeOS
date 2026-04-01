import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LanguageProvider } from '@/i18n/context';
import { OperationalStrip, type OpsSnapshot } from './OperationalStrip';

function makeSnapshot(overrides: Partial<OpsSnapshot> = {}): OpsSnapshot {
  return {
    readyForGoLive: true,
    blockingIncompleteCount: 0,
    lowStockCount: 0,
    openShiftPresent: false,
    ...overrides,
  };
}

function renderStrip(data: OpsSnapshot | undefined) {
  return render(
    <LanguageProvider>
      <MemoryRouter>
        <OperationalStrip data={data} />
      </MemoryRouter>
    </LanguageProvider>,
  );
}

describe('OperationalStrip', () => {
  it('renders nothing when data is undefined', () => {
    const { container } = renderStrip(undefined);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when all signals are clear', () => {
    const { container } = renderStrip(makeSnapshot());
    expect(container.firstChild).toBeNull();
  });

  it('shows setup incomplete row when blockingIncompleteCount > 0 and not ready', () => {
    renderStrip(makeSnapshot({ readyForGoLive: false, blockingIncompleteCount: 3 }));
    expect(screen.getByText(/Setup incomplete/i)).toBeInTheDocument();
    expect(screen.getByText(/3 blocking/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Setup/i })).toHaveAttribute('href', '/setup');
  }, 15000);

  it('does NOT show setup row when readyForGoLive is true even with blocking count', () => {
    renderStrip(makeSnapshot({ readyForGoLive: true, blockingIncompleteCount: 2 }));
    expect(screen.queryByText(/Setup incomplete/i)).toBeNull();
  });

  it('shows low stock row when lowStockCount > 0', () => {
    renderStrip(makeSnapshot({ lowStockCount: 5 }));
    expect(screen.getByText(/5 stock item\(s\)/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Review stock/i })).toHaveAttribute('href', '/stock');
  });

  it('shows open shift row when openShiftPresent is true', () => {
    renderStrip(makeSnapshot({ openShiftPresent: true }));
    expect(screen.getByText(/A shift is still open/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Reports/i })).toHaveAttribute('href', '/reports');
  });

  it('shows all three rows simultaneously', () => {
    renderStrip(
      makeSnapshot({
        readyForGoLive: false,
        blockingIncompleteCount: 1,
        lowStockCount: 2,
        openShiftPresent: true,
      }),
    );
    expect(screen.getByText(/Setup incomplete/i)).toBeInTheDocument();
    expect(screen.getByText(/2 stock item\(s\)/i)).toBeInTheDocument();
    expect(screen.getByText(/A shift is still open/i)).toBeInTheDocument();
  });

  it('has role="status" on the wrapper', () => {
    renderStrip(makeSnapshot({ lowStockCount: 1 }));
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
