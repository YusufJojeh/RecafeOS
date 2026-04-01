import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PilotDetailPage } from './PilotDetailPage';
import { PilotPortfolioPage } from './PilotPortfolioPage';
import { PilotWeeklyPage } from './PilotWeeklyPage';

vi.mock('../lib/support-console-fetch', () => ({
  supportFetch: vi.fn(),
}));

import { supportFetch } from '../lib/support-console-fetch';
const mockSupportFetch = vi.mocked(supportFetch);

describe('Pilot internal pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupportFetch.mockResolvedValue({});
  });

  it('shows backend authorization error on portfolio refresh failure', async () => {
    mockSupportFetch.mockRejectedValueOnce(new Error('Forbidden'));
    await act(async () => {
      render(
        <MemoryRouter>
          <PilotPortfolioPage />
        </MemoryRouter>,
      );
    });
    expect(await screen.findByText(/Forbidden/i)).toBeInTheDocument();
  });

  it('renders portfolio table rows when support data exists', async () => {
    mockSupportFetch.mockResolvedValue({
      items: [
        {
          tenantId: 't1',
          name: 'Venue One',
          slug: 'venue-one',
          branchCount: 2,
          pilotFeedbackCount: 3,
          pilot: { pilotHealth: 'green', venueStatus: 'live' },
        },
      ],
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <PilotPortfolioPage />
        </MemoryRouter>,
      );
    });

    expect(await screen.findByText('Venue One')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open' })).toBeInTheDocument();
  });

  it('shows backend authorization error on weekly refresh failure', async () => {
    mockSupportFetch.mockRejectedValueOnce(new Error('Forbidden'));
    await act(async () => {
      render(
        <MemoryRouter>
          <PilotWeeklyPage />
        </MemoryRouter>,
      );
    });
    expect(await screen.findByText(/Forbidden/i)).toBeInTheDocument();
  });

  it('renders weekly report table and raw details when data exists', async () => {
    mockSupportFetch.mockResolvedValue({
      since: '2026-01-01',
      until: '2026-01-07',
      tenants: [
        {
          tenantId: 't1',
          name: 'Venue One',
          slug: 'venue-one',
          pilot: { pilotHealth: 'green' },
          summary: { ordersLast24h: 11 },
          window: {
            feedbackNewCount: 1,
            feedbackByTheme: { kitchen: 1 },
            feedbackByType: { bug: 1 },
            supportAuditActionsCount: 2,
            openBlockersCount: 0,
          },
        },
      ],
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <PilotWeeklyPage />
        </MemoryRouter>,
      );
    });

    expect(await screen.findByText('Venue One')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByText('Raw JSON'));
    });
    expect(screen.getByText(/supportAuditActionsCount/i)).toBeInTheDocument();
  });

  it('renders pilot detail route and allows reload action', async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/internal/pilots/t1']}>
          <Routes>
            <Route path="/internal/pilots/:tenantId" element={<PilotDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Reload summary/i }));
    });
    expect(await screen.findByText('Pilot detail')).toBeInTheDocument();
  }, 15000);

  it('submits pilot feedback through the secured support gateway', async () => {
    mockSupportFetch.mockResolvedValue({});

    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/internal/pilots/t2']}>
          <Routes>
            <Route path="/internal/pilots/:tenantId" element={<PilotDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Issue title' } });
      fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Issue body' } });
      fireEvent.click(screen.getByRole('button', { name: 'Submit feedback' }));
    });
    await waitFor(() => expect(mockSupportFetch).toHaveBeenCalled());
  }, 15000);

  it('applies filters and saves triage for an item', async () => {
    mockSupportFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.includes('/pilot-feedback?')) {
        return {
          items: [
            {
              id: 'f1',
              feedbackType: 'bug',
              severity: 'sev2',
              status: 'open',
              themeKey: null,
              businessCritical: false,
              triageNotes: null,
              title: 'Bug row',
              promotedToEngineering: false,
            },
          ],
        };
      }
      if (path.endsWith('/pilot-feedback/f1') && init?.method === 'PATCH') return { ok: true };
      return {};
    });

    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/internal/pilots/t3']}>
          <Routes>
            <Route path="/internal/pilots/:tenantId" element={<PilotDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });

    await act(async () => {
      fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'open' } });
      fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    });
    expect(await screen.findByText('Bug row')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Triage' }));
    });
    const themeInput = await screen.findByLabelText('themeKey');
    await act(async () => {
      fireEvent.change(themeInput, { target: { value: 'kitchen' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });
    await waitFor(() =>
      expect(mockSupportFetch).toHaveBeenCalledWith(
        expect.stringContaining('/pilot-feedback/f1'),
        expect.objectContaining({ method: 'PATCH' }),
        expect.anything(),
      ),
    );
  }, 15000);
});
