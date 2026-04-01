import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ar } from '@/i18n/ar';
import { LanguageProvider } from '@/i18n/context';
import { SetupPage } from './SetupPage';

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn(async () => 'data:image/png;base64,qr') },
}));

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
    onboardingStatus: () => '/onboarding-status',
    configSnapshot: () => '/config-snapshot',
    onboardingUi: () => '/onboarding-ui',
    goLiveAck: () => '/go-live-ack',
    patchBranch: () => '/patch-branch',
  },
  tenantPaths: {
    commerce: () => '/tenant-commerce',
    pilotFeedback: () => '/pilot-feedback',
  },
}));

import { ApiError, apiFetch } from '../lib/api';
const mockApiFetch = vi.mocked(apiFetch);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <MemoryRouter>
          <SetupPage />
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe('SetupPage', () => {
  beforeEach(() => {
    localStorage.setItem('restocafe-lang', 'en');
  });

  it('shows forbidden message on settings permission error', async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/onboarding-status') throw new ApiError('forbidden', 403, {});
      if (path === '/tenant-commerce') {
        return {
          subscriptionPlan: 'pilot',
          billingStatus: 'active',
          trialEndsAt: null,
          maxBranches: 1,
          branchesInUse: 1,
          maxUsers: 1,
          usersInUse: 1,
          features: { qrOrdering: true, inventory: true, apiAccess: true },
          access: { ok: true },
          limits: { maxBranches: 1, branchesInUse: 1, maxUsers: 1, usersInUse: 1 },
        };
      }
      if (path === '/config-snapshot') {
        return {
          branch: { id: 'b', name: 'Main', slug: 'main', timezone: 'UTC', currency: 'USD', settings: { qrOrderingEnabled: true, qrCallWaiterEnabled: true } },
          environment: { appPublicUrlConfigured: false, publicMenuUrlTemplate: null },
        };
      }
      return {};
    });
    renderPage();
    expect(await screen.findByText(/settings.manage/i)).toBeInTheDocument();
  });

  it('shows not-ready banner from onboarding status', async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/tenant-commerce') {
        return {
          subscriptionPlan: 'pilot',
          billingStatus: 'active',
          trialEndsAt: null,
          maxBranches: 1,
          branchesInUse: 1,
          maxUsers: 5,
          usersInUse: 1,
          features: { qrOrdering: true, inventory: true, apiAccess: true },
          access: { ok: true },
          limits: { maxBranches: 1, branchesInUse: 1, maxUsers: 5, usersInUse: 1 },
        };
      }
      if (path === '/onboarding-status') {
        return {
          branchSlug: 'main',
          tenantSlug: 'demo',
          publicMenuUrlTemplate: null,
          appPublicUrlConfigured: false,
          steps: [],
          progressPercent: 10,
          blockingIncompleteCount: 2,
          readyForGoLive: false,
          goLiveAcknowledgedAt: null,
        };
      }
      if (path === '/config-snapshot') {
        return {
          branch: { id: 'b', name: 'Main', slug: 'main', timezone: 'UTC', currency: 'USD', settings: { qrOrderingEnabled: true, qrCallWaiterEnabled: true } },
          environment: { appPublicUrlConfigured: false, publicMenuUrlTemplate: null },
        };
      }
      return {};
    });
    renderPage();
    expect(await screen.findByText(/Not ready for go-live/i)).toBeInTheDocument();
  });

  it('shows localized onboarding step label/why in Arabic when API sends English strings', async () => {
    localStorage.setItem('restocafe-lang', 'ar');
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/tenant-commerce') {
        return {
          subscriptionPlan: 'pilot',
          billingStatus: 'active',
          trialEndsAt: null,
          maxBranches: 1,
          branchesInUse: 1,
          maxUsers: 5,
          usersInUse: 1,
          features: { qrOrdering: true, inventory: true, apiAccess: true },
          access: { ok: true },
          limits: { maxBranches: 1, branchesInUse: 1, maxUsers: 5, usersInUse: 1 },
        };
      }
      if (path === '/onboarding-status') {
        return {
          branchSlug: 'main',
          tenantSlug: 'demo',
          publicMenuUrlTemplate: null,
          appPublicUrlConfigured: false,
          steps: [
            {
              id: 'menu',
              label: 'At least one menu item',
              done: false,
              tier: 'blocking',
              why: 'Orders need sellable items.',
              nextPath: '/menu',
            },
          ],
          progressPercent: 20,
          blockingIncompleteCount: 3,
          readyForGoLive: false,
          goLiveAcknowledgedAt: null,
        };
      }
      if (path === '/config-snapshot') {
        return {
          branch: {
            id: 'b',
            name: 'Main',
            slug: 'main',
            timezone: 'UTC',
            currency: 'USD',
            settings: { qrOrderingEnabled: true, qrCallWaiterEnabled: true },
          },
          environment: { appPublicUrlConfigured: false, publicMenuUrlTemplate: null },
        };
      }
      return {};
    });
    renderPage();
    const blockingHeading = await screen.findByRole('heading', {
      name: ar.setupPage.tiers.blocking,
    });
    const blockingSection = blockingHeading.closest('section');
    expect(blockingSection).toBeTruthy();
    expect(
      within(blockingSection as HTMLElement).getByText(ar.setupPage.onboardingSteps.menu.label, {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText('At least one menu item')).toBeNull();
    expect(
      within(blockingSection as HTMLElement).getByText(ar.setupPage.onboardingSteps.menu.why, {
        exact: false,
      }),
    ).toBeInTheDocument();
  });

  it('allows go-live ack, branch toggles, and feedback submit on ready state', async () => {
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/tenant-commerce') {
        return {
          subscriptionPlan: 'pilot',
          billingStatus: 'active',
          trialEndsAt: null,
          maxBranches: 2,
          branchesInUse: 1,
          maxUsers: 10,
          usersInUse: 3,
          features: { qrOrdering: true, inventory: true, apiAccess: true },
          access: { ok: true },
          limits: { maxBranches: 2, branchesInUse: 1, maxUsers: 10, usersInUse: 3 },
        };
      }
      if (path === '/go-live-ack') {
        return { ok: true, acknowledgedAt: new Date().toISOString() };
      }
      if (path === '/onboarding-status') {
        if (init?.method === 'PATCH') {
          return {
            branchSlug: 'main',
            tenantSlug: 'demo',
            publicMenuUrlTemplate: 'https://example.com/menu/{sessionToken}',
            appPublicUrlConfigured: true,
            steps: [],
            progressPercent: 100,
            blockingIncompleteCount: 0,
            readyForGoLive: true,
            goLiveAcknowledgedAt: null,
          };
        }
        return {
          branchSlug: 'main',
          tenantSlug: 'demo',
          publicMenuUrlTemplate: 'https://example.com/menu/{sessionToken}',
          appPublicUrlConfigured: true,
          steps: [{ id: 'session', label: 'Open session', done: false, tier: 'recommended', why: 'ops', nextPath: '/floor' }],
          progressPercent: 100,
          blockingIncompleteCount: 0,
          readyForGoLive: true,
          goLiveAcknowledgedAt: null,
        };
      }
      if (path === '/config-snapshot') {
        return {
          branch: { id: 'b', name: 'Main', slug: 'main', timezone: 'UTC', currency: 'USD', settings: { qrOrderingEnabled: true, qrCallWaiterEnabled: true } },
          environment: { appPublicUrlConfigured: true, publicMenuUrlTemplate: 'https://example.com/menu/{sessionToken}' },
        };
      }
      if (path === '/patch-branch') return { ok: true };
      if (path === '/pilot-feedback') return { ok: true };
      return {};
    });

    renderPage();
    expect(await screen.findByText(/Record go-live acknowledgment/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Record go-live acknowledgment/i }));
    fireEvent.click(screen.getByLabelText(/QR ordering enabled/i));
    fireEvent.click(screen.getByLabelText(/QR call waiter enabled/i));
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. ordering/i), { target: { value: 'ordering' } });
    fireEvent.change(screen.getByPlaceholderText(/What happened/i), { target: { value: 'details' } });
    fireEvent.click(screen.getByRole('button', { name: /Send feedback/i }));
    expect(mockApiFetch).toHaveBeenCalled();
  }, 15000);
});
