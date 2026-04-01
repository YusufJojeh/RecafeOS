import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SupportConsolePage } from './SupportConsolePage';

vi.mock('../lib/support-console-fetch', () => ({
  supportFetch: vi.fn(),
}));

import { supportFetch } from '../lib/support-console-fetch';
const mockSupportFetch = vi.mocked(supportFetch);

describe('SupportConsolePage', () => {
  it('does not render support key inputs or session save actions', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <SupportConsolePage />
        </MemoryRouter>,
      );
    });

    expect(screen.queryByPlaceholderText(/x-support-api-key/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Write key$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save session/i })).not.toBeInTheDocument();
    expect(screen.getByText(/browser never stores or sends support API keys/i)).toBeInTheDocument();
  }, 15000);

  it('runs diagnostics action and renders output payload', async () => {
    mockSupportFetch.mockResolvedValueOnce({ ok: true, ping: 'pong' });
    await act(async () => {
      render(
        <MemoryRouter>
          <SupportConsolePage />
        </MemoryRouter>,
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /GET \/support\/diagnostics/i }));
    });
    expect(await screen.findByText(/"ping": "pong"/i)).toBeInTheDocument();
    expect(mockSupportFetch).toHaveBeenCalledWith('/support/diagnostics');
  });

  it('runs lookup and audit actions through the server-side gateway', async () => {
    mockSupportFetch
      .mockResolvedValueOnce({ tenantId: 't1' })
      .mockResolvedValueOnce({ items: [] });
    await act(async () => {
      render(
        <MemoryRouter>
          <SupportConsolePage />
        </MemoryRouter>,
      );
    });

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('tenant slug'), { target: { value: 'alpha' } });
      fireEvent.click(screen.getByRole('button', { name: 'Resolve slug' }));
    });
    expect(await screen.findByText(/tenantId/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('tenant id (cuid)'), { target: { value: 't1' } });
      fireEvent.click(screen.getByRole('button', { name: 'Load audit log' }));
    });
    await waitFor(() =>
      expect(mockSupportFetch).toHaveBeenCalledWith(
        expect.stringContaining('/support/tenants/t1/audit-log?'),
      ),
    );
  }, 15000);
});
