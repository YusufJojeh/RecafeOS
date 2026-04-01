import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../i18n/context';
import { PublicMenuPage } from './PublicMenuPage';

function renderPage(path = '/m/demo/main/t/token123', routePath = '/m/:tenantSlug/:branchSlug/t/:token') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={routePath} element={<PublicMenuPage />} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe('PublicMenuPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders fetched menu categories and items', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          branch: { name: 'Main branch' },
          categories: [
            {
              name: 'Coffee',
              items: [
                {
                  id: '1',
                  name: 'Latte',
                  priceMinor: 500,
                  available: true,
                  visible: true,
                  modifierGroups: [],
                },
              ],
            },
          ],
        }),
      } as Response);

    renderPage();
    expect(await screen.findByText('Main branch', {}, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.getByText('Coffee')).toBeInTheDocument();
    expect(screen.getByText('Latte')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/public/tenants/demo/branches/main/sessions/token123/menu'),
    );
  }, 15000);

  it('shows menu error state when menu request fails', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: false } as Response);
    renderPage();

    expect(
      await screen.findByText(/Menu is unavailable right now/i),
    ).toBeInTheDocument();
  });

  it('shows waiter call error when mutation fails', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          branch: { name: 'Main' },
          categories: [],
        }),
      } as Response)
      .mockResolvedValueOnce({ ok: false } as Response);

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Call waiter' }));

    await waitFor(() =>
      expect(screen.getByText(/Could not notify staff/i)).toBeInTheDocument(),
    );
  }, 15000);

  it('shows empty menu state when categories have no items', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ branch: { name: 'Main' }, categories: [{ name: 'Coffee', items: [] }] }),
    } as Response);

    renderPage();
    expect(await screen.findByText(/No items are available right now/i)).toBeInTheDocument();
  });

  it('disables waiter action and shows invalid-link message when token missing', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ branch: { name: 'Main' }, categories: [] }),
    } as Response);

    renderPage('/m/demo/main/t', '/m/:tenantSlug/:branchSlug/t/:token?');
    expect(await screen.findByText(/Invalid menu\/session link/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Call waiter/i })).toBeDisabled();
  });
});
