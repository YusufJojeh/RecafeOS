import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { RESTOCAFE_SESSION_EXPIRED_EVENT } from '@/lib/api';
import { SessionNavBridge } from '@/lib/session-nav-bridge';

function Loc() {
  const { pathname } = useLocation();
  return <span data-testid="where">{pathname}</span>;
}

describe('SessionNavBridge', () => {
  it('navigates to /login when session expired event fires', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/floor']}>
          <SessionNavBridge />
          <Routes>
            <Route path="/floor" element={<Loc />} />
            <Route path="/login" element={<Loc />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('where').textContent).toBe('/floor');

    await act(async () => {
      window.dispatchEvent(new Event(RESTOCAFE_SESSION_EXPIRED_EVENT));
    });

    await waitFor(() => {
      expect(screen.getByTestId('where').textContent).toBe('/login');
    });
  });
});
