import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../lib/auth-store';
import { ApiError } from '../lib/api';
import { OpenOrdersPage } from './OpenOrdersPage';
import { renderWithAppProviders } from '../test/render-app';

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    apiFetch: vi.fn(),
    branchPaths: {
      openOrders: (id: string) => `/api/v1/branches/${id}/orders`,
      orderDetail: (branchId: string, orderId: string) =>
        `/api/v1/branches/${branchId}/orders/${orderId}`,
      orderServed: (branchId: string, orderId: string) =>
        `/api/v1/branches/${branchId}/orders/${orderId}/served`,
      orderClose: (branchId: string, orderId: string) =>
        `/api/v1/branches/${branchId}/orders/${orderId}/close`,
    },
  };
});

vi.mock('../lib/use-branch-realtime-connected', () => ({
  useBranchRealtimeConnected: () => true,
}));

import { apiFetch } from '../lib/api';

const mockApiFetch = vi.mocked(apiFetch);

function makeOrder(overrides: {
  id?: string;
  customerId?: string | null;
  returningGuest?: boolean;
  totalMinor?: number;
  status?: string;
} = {}) {
  return {
    id: overrides.id ?? 'ord_abc123xyz',
    status: overrides.status ?? 'READY',
    type: 'DINE_IN',
    customerId: overrides.customerId ?? null,
    returningGuest: overrides.returningGuest ?? false,
    subtotalMinor: 1000,
    totalMinor: overrides.totalMinor ?? 1200,
    createdAt: '2026-03-24T10:00:00Z',
    tableSession: {
      id: 'sess_1',
      guestCount: 2,
      status: 'OPEN',
      floorTableId: 'table_1',
    },
  };
}

function makeOrderDetail(
  overrides: {
    id?: string;
    status?: string;
    totalMinor?: number;
    customerId?: string | null;
  } = {},
) {
  return {
    id: overrides.id ?? 'ord_abc123xyz',
    status: overrides.status ?? 'READY',
    type: 'DINE_IN',
    customerId: overrides.customerId ?? null,
    returningGuest: false,
    subtotalMinor: 1000,
    totalMinor: overrides.totalMinor ?? 1200,
    discountMinor: 0,
    createdAt: '2026-03-24T10:00:00Z',
    paidAt: null,
    tableSession: {
      id: 'sess_1',
      guestCount: 2,
      status: 'OPEN',
      floorTable: {
        id: 'table_1',
        label: 'T2',
      },
    },
    items: [
      {
        id: 'item_1',
        quantity: 1,
        unitPriceMinor: 1200,
        lineTotalMinor: 1200,
        notes: null,
        menuItem: {
          id: 'menu_1',
          name: 'Classic Burger',
        },
      },
    ],
    payments: [],
  };
}

function renderPage() {
  return renderWithAppProviders(<OpenOrdersPage />, {
    route: '/orders',
    auth: { accessToken: 'token', branchId: 'branch_1' },
  });
}

describe('OpenOrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clear();
    localStorage.clear();
  });

  it('renders page heading and empty state', async () => {
    mockApiFetch.mockResolvedValue({ items: [], nextCursor: null });
    renderPage();

    expect(screen.getByRole('heading', { name: 'Open bills' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('No open bills')).toBeInTheDocument());
  }, 15000);

  it('renders order rows with guest links', async () => {
    const orders = [makeOrder({ id: 'ord_abc123xyz000', customerId: 'cust_1', returningGuest: true, totalMinor: 2550 })];
    mockApiFetch.mockResolvedValue({ items: orders, nextCursor: null });
    renderPage();

    await waitFor(() => expect(screen.getByText(/ord_abc1/)).toBeInTheDocument());
    expect(screen.getByText('25.50')).toBeInTheDocument();
    expect(screen.getByText('Returning guest (prior visits at this branch)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View customer/i })).toHaveAttribute(
      'href',
      expect.stringContaining('cust_1'),
    );
  });

  it('opens cashier dialog and renders line items from order detail', async () => {
    const order = makeOrder();
    mockApiFetch.mockImplementation(async (path, init) => {
      if (path === '/api/v1/branches/branch_1/orders' && !init?.method) {
        return { items: [order], nextCursor: null };
      }
      if (path === `/api/v1/branches/branch_1/orders/${order.id}` && !init?.method) {
        return makeOrderDetail({ id: order.id });
      }
      throw new Error(`Unexpected path ${path}`);
    });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Open cashier' }));

    expect(await screen.findByTestId('cashier-dialog')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Loading bill detail')).toBeNull());
    expect(await screen.findByText(/Classic Burger/)).toBeInTheDocument();
    expect(screen.getByText(/Table T2/)).toBeInTheDocument();
  });

  it('marks a ready order as served from the cashier dialog', async () => {
    const order = makeOrder({ status: 'READY' });
    let detailStatus = 'READY';
    mockApiFetch.mockImplementation(async (path, init) => {
      if (path === '/api/v1/branches/branch_1/orders' && !init?.method) {
        return { items: [makeOrder({ id: order.id, status: detailStatus })], nextCursor: null };
      }
      if (path === `/api/v1/branches/branch_1/orders/${order.id}` && !init?.method) {
        return makeOrderDetail({ id: order.id, status: detailStatus });
      }
      if (path === `/api/v1/branches/branch_1/orders/${order.id}/served` && init?.method === 'POST') {
        detailStatus = 'SERVED';
        return makeOrderDetail({ id: order.id, status: 'SERVED' });
      }
      throw new Error(`Unexpected path ${path}`);
    });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Open cashier' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mark served' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Mark served' })).toBeNull());
    expect(screen.getAllByText('SERVED').length).toBeGreaterThan(0);
  }, 15000);

  it('closes the bill from the cashier dialog and sends an idempotency key', async () => {
    const order = makeOrder({ id: 'ord_pay_1' });
    let closed = false;
    mockApiFetch.mockImplementation(async (path, init) => {
      if (path === '/api/v1/branches/branch_1/orders' && !init?.method) {
        return { items: closed ? [] : [order], nextCursor: null };
      }
      if (path === `/api/v1/branches/branch_1/orders/${order.id}` && !init?.method) {
        return makeOrderDetail({ id: order.id });
      }
      if (path === `/api/v1/branches/branch_1/orders/${order.id}/close` && init?.method === 'POST') {
        closed = true;
        expect(init.headers).toBeDefined();
        const headers = new Headers(init.headers);
        expect(headers.get('idempotency-key')).toMatch(/^cashier-close:ord_pay_1:/);
        expect(init.body).toBe(JSON.stringify({ method: 'CASH' }));
        return { id: order.id, status: 'PAID' };
      }
      throw new Error(`Unexpected path ${path}`);
    });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Open cashier' }));
    fireEvent.click(await screen.findByTestId('cashier-close-bill'));

    await waitFor(() => expect(screen.getByText('Bill closed from cashier')).toBeInTheDocument());
    expect(screen.queryByTestId('cashier-dialog')).toBeNull();
  });

  it('blocks duplicate close submits while the first request is pending', async () => {
    const order = makeOrder({ id: 'ord_pending_1' });
    let closeCount = 0;
    let releaseClose: (() => void) | null = null;
    mockApiFetch.mockImplementation(async (path, init) => {
      if (path === '/api/v1/branches/branch_1/orders' && !init?.method) {
        return { items: [order], nextCursor: null };
      }
      if (path === `/api/v1/branches/branch_1/orders/${order.id}` && !init?.method) {
        return makeOrderDetail({ id: order.id });
      }
      if (path === `/api/v1/branches/branch_1/orders/${order.id}/close` && init?.method === 'POST') {
        closeCount += 1;
        await new Promise<void>((resolve) => {
          releaseClose = resolve;
        });
        return { id: order.id, status: 'PAID' };
      }
      throw new Error(`Unexpected path ${path}`);
    });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Open cashier' }));
    const closeButton = await screen.findByTestId('cashier-close-bill');
    fireEvent.click(closeButton);
    await waitFor(() => expect(closeButton).toBeDisabled());
    fireEvent.click(closeButton);
    expect(closeCount).toBe(1);
    releaseClose?.();
    await waitFor(() => expect(screen.getByText('Bill closed from cashier')).toBeInTheDocument());
  });

  it('shows a dedicated conflict message when close bill returns 409', async () => {
    const order = makeOrder({ id: 'ord_conflict_1' });
    mockApiFetch.mockImplementation(async (path, init) => {
      if (path === '/api/v1/branches/branch_1/orders' && !init?.method) {
        return { items: [order], nextCursor: null };
      }
      if (path === `/api/v1/branches/branch_1/orders/${order.id}` && !init?.method) {
        return makeOrderDetail({ id: order.id });
      }
      if (path === `/api/v1/branches/branch_1/orders/${order.id}/close` && init?.method === 'POST') {
        throw new ApiError('order_cannot_be_paid', 409, { message: 'order_cannot_be_paid' });
      }
      throw new Error(`Unexpected path ${path}`);
    });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Open cashier' }));
    fireEvent.click(await screen.findByTestId('cashier-close-bill'));

    expect(
      await screen.findByText(
        'Order state changed before payment. Refresh the bill and confirm it is still READY or SERVED.',
      ),
    ).toBeInTheDocument();
  });

  it('shows list error state when fetching open orders fails', async () => {
    mockApiFetch.mockRejectedValue(new Error('Forbidden'));
    renderPage();

    await waitFor(() => expect(screen.getByText(/Could not load orders/i)).toBeInTheDocument());
  });
});
