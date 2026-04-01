import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../i18n/context';
import { MenuPage } from './MenuPage';

vi.mock('../lib/use-branch-id', () => ({
  useBranchId: () => 'branch_1',
}));

vi.mock('../lib/api', () => ({
  ApiError: class MockApiError extends Error {
    constructor(
      message: string,
      readonly status: number,
      readonly body?: unknown,
    ) {
      super(message);
    }
  },
  apiFetch: vi.fn(),
  branchPaths: {
    menuCategories: (id: string) => `/branches/${id}/menu/categories`,
    menuImportDryRun: (id: string) => `/branches/${id}/menu/import/dry-run`,
    menuImportApply: (id: string) => `/branches/${id}/menu/import/apply`,
  },
}));

import { apiFetch } from '../lib/api';

const mockApiFetch = vi.mocked(apiFetch);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <MemoryRouter>
          <MenuPage />
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe('MenuPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders menu categories and items', async () => {
    mockApiFetch.mockResolvedValueOnce([
      {
        id: 'c1',
        name: 'Hot drinks',
        items: [{ id: 'i1', name: 'Latte', priceMinor: 450, available: true }],
      },
    ]);

    renderPage();
    expect(await screen.findByText('Hot drinks', {}, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.getByText('Latte')).toBeInTheDocument();
  });

  it('runs dry-run and enables apply on successful validation', async () => {
    mockApiFetch
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        ok: true,
        itemCount: 1,
        categoryCount: 1,
        errors: [],
      })
      .mockResolvedValueOnce({ categoriesCreated: 1, itemsCreated: 1 })
      .mockResolvedValueOnce([]);

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Dry-run' }));
    await screen.findByText(/Validation result/i);

    const applyButton = screen.getByRole('button', { name: 'Apply' });
    expect(applyButton).toBeEnabled();
    fireEvent.click(applyButton);
    expect(await screen.findByText(/Applied: 1 categories, 1 items/i)).toBeInTheDocument();
  }, 15000);

  it('shows loading state while list query is pending', () => {
    mockApiFetch.mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Loading menu')).toBeInTheDocument();
  });

  it('shows client-side validation message for invalid JSON', async () => {
    mockApiFetch.mockResolvedValueOnce([]);
    renderPage();
    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, { target: { value: '{ invalid json' } });
    fireEvent.click(screen.getByRole('button', { name: 'Dry-run' }));

    await waitFor(() =>
      expect(screen.getByText(/Import JSON is not valid JSON/i)).toBeInTheDocument(),
    );
  });
});
