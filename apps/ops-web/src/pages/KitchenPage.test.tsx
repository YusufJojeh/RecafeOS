import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../lib/auth-store';
import { LanguageProvider } from '../i18n/context';
import { KitchenPage } from './KitchenPage';

vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(),
  branchPaths: {
    kitchenTickets: (id: string) => `/api/v1/branches/${id}/kitchen/tickets`,
    barTickets: (id: string) => `/api/v1/branches/${id}/bar/tickets`,
    kitchenTicket: (branchId: string, ticketId: string) =>
      `/api/v1/branches/${branchId}/kitchen/tickets/${ticketId}`,
    barTicket: (branchId: string, ticketId: string) =>
      `/api/v1/branches/${branchId}/bar/tickets/${ticketId}`,
  },
}));

vi.mock('../lib/use-branch-realtime-connected', () => ({
  useBranchRealtimeConnected: () => true,
}));

import { apiFetch } from '../lib/api';

const mockApiFetch = vi.mocked(apiFetch);

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function makeTicket(id: string, name: string, status = 'NEW') {
  return { id, status, orderItem: { menuItem: { name } } };
}

function renderKitchen(station: 'KITCHEN' | 'BAR' = 'KITCHEN') {
  return render(
    <QueryClientProvider client={makeClient()}>
      <LanguageProvider>
        <MemoryRouter>
          <KitchenPage station={station} />
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe('KitchenPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clear();
    localStorage.clear();
  });

  it('renders Kitchen heading for KITCHEN station', () => {
    mockApiFetch.mockResolvedValue([]);
    useAuthStore.getState().setBranch('branch_1');
    renderKitchen('KITCHEN');
    expect(screen.getByText('Kitchen')).toBeInTheDocument();
  });

  it('renders Bar heading for BAR station', () => {
    mockApiFetch.mockResolvedValue([]);
    useAuthStore.getState().setBranch('branch_1');
    renderKitchen('BAR');
    expect(screen.getByText('Bar')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    mockApiFetch.mockImplementation(() => new Promise(() => {}));
    useAuthStore.getState().setBranch('branch_1');
    renderKitchen();
    expect(screen.getByText('Loading preparation queue')).toBeInTheDocument();
  });

  it('shows empty state when no tickets', async () => {
    mockApiFetch.mockResolvedValue([]);
    useAuthStore.getState().setBranch('branch_1');
    renderKitchen();

    await waitFor(() => expect(screen.getByText('No tickets')).toBeInTheDocument());
  });

  it('renders ticket cards when data loads', async () => {
    const tickets = [makeTicket('t1', 'Espresso'), makeTicket('t2', 'Latte')];
    mockApiFetch.mockResolvedValue(tickets);
    useAuthStore.getState().setBranch('branch_1');
    renderKitchen();

    await waitFor(() => expect(screen.getByTestId('prep-ticket-t1')).toBeInTheDocument());
    expect(screen.getByTestId('prep-ticket-t2')).toBeInTheDocument();
    expect(screen.getByText('Espresso')).toBeInTheDocument();
    expect(screen.getByText('Latte')).toBeInTheDocument();
  });

  it('calls apiFetch with PATCH to advance a ticket', async () => {
    const tickets = [makeTicket('t1', 'Flat White', 'NEW')];
    mockApiFetch
      .mockResolvedValueOnce(tickets)
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValue([{ ...tickets[0], status: 'ACCEPTED' as const }]);
    useAuthStore.getState().setBranch('branch_1');
    renderKitchen();

    await waitFor(() => expect(screen.getByTestId('prep-ticket-t1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('prep-ticket-advance'));

    await waitFor(() => {
      const patchCalls = mockApiFetch.mock.calls.filter(
        ([url]) => typeof url === 'string' && url.includes('t1'),
      );
      expect(patchCalls.length).toBeGreaterThan(0);
      expect(patchCalls[0][1]).toMatchObject({ method: 'PATCH' });
    });
  });

  it('shows Deliver button for READY status tickets', async () => {
    const tickets = [makeTicket('t1', 'Cappuccino', 'READY')];
    mockApiFetch.mockResolvedValue(tickets);
    useAuthStore.getState().setBranch('branch_1');
    renderKitchen();

    await waitFor(() => expect(screen.getByText('Deliver')).toBeInTheDocument());
  });

  it('does not fetch when branch is not set', () => {
    renderKitchen();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});
