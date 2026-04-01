import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { StockPage } from './StockPage';

vi.mock('../lib/use-branch-id', () => ({
  useBranchId: () => 'branch_1',
}));

vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(),
  branchPaths: {
    inventoryStock: (id: string) => `/branches/${id}/inventory/stock`,
  },
}));

import { apiFetch } from '../lib/api';
const mockApiFetch = vi.mocked(apiFetch);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <StockPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('StockPage', () => {
  it('renders stock rows and low badge', async () => {
    mockApiFetch.mockResolvedValueOnce([
      { id: 's1', name: 'Milk', quantity: '2', lowThreshold: '3', unit: 'L' },
      { id: 's2', name: 'Beans', quantity: '10', lowThreshold: '4', unit: 'kg' },
    ]);
    renderPage();

    expect(await screen.findByText('Milk', {}, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.getByText('LOW')).toBeInTheDocument();
    expect(screen.getByText('Beans')).toBeInTheDocument();
  }, 15000);
});
