import { expect, test, type Page } from '@playwright/test';

function staffMeJson(permissions: string[] = []) {
  return JSON.stringify({
    userId: 'route-matrix-user',
    email: 'rm@test',
    displayName: 'RM',
    tenantId: 'tenant',
    permissions,
    defaultBranchId: null,
    branchAccessScope: 'ALL_TENANT_BRANCHES',
  });
}

test.describe('route matrix @smoke', () => {
  async function seedStaffSession(page: Page, branchId?: string) {
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'token');
      localStorage.setItem('refreshToken', 'refresh');
      localStorage.setItem('tenantId', 'tenant');
    });
    if (branchId) {
      await page.addInitScript((value) => {
        localStorage.setItem('branchId', value);
      }, branchId);
      return;
    }
    await page.addInitScript(() => {
      localStorage.removeItem('branchId');
    });
  }

  const responsiveViewports = [
    { name: 'mobile-small', width: 360, height: 800 },
    { name: 'mobile', width: 390, height: 844 },
    { name: 'tablet-portrait', width: 768, height: 1024 },
    { name: 'tablet-landscape', width: 1024, height: 768 },
    { name: 'laptop', width: 1280, height: 800 },
  ] as const;

  for (const viewport of responsiveViewports) {
    test(`public/login routes avoid horizontal overflow (${viewport.name})`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      await page.goto('/login');
      await expect(page.getByRole('heading', { name: /Staff access/i })).toBeVisible();
      const loginOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(loginOverflow).toBeFalsy();

      await page.route(
        '**/api/v1/public/tenants/**/branches/**/sessions/**/menu',
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              branch: { name: 'Public Branch' },
              categories: [
                { name: 'Coffee', items: [{ id: '1', name: 'Espresso', priceMinor: 350 }] },
              ],
            }),
          });
        },
      );
      await page.route('**/api/v1/public/tenants/**/branches/**/menu', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            branch: { name: 'Public Branch' },
            categories: [{ name: 'Coffee', items: [{ id: '1', name: 'Espresso', priceMinor: 350 }] }],
          }),
        });
      });
      await page.goto('/m/demo/main/t/session-token');
      await expect(page.getByText('Public Branch')).toBeVisible();
      const publicOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(publicOverflow).toBeFalsy();
    });
  }

  test('redirects unauthenticated branch access to login', async ({ page }) => {
    await page.goto('/branch');
    await expect(page.getByRole('heading', { name: /Staff access/i })).toBeVisible();
  });

  test('disables sign-in whenever credentials are incomplete', async ({ page }) => {
    await page.goto('/login');

    const submit = page.getByRole('button', { name: 'Sign in' });
    await expect(submit).toBeEnabled();

    await page.getByLabel('Email').clear();
    await expect(submit).toBeDisabled();

    await page.getByLabel('Email').fill('owner@example.com');
    await expect(submit).toBeEnabled();

    await page.getByLabel('Password').clear();
    await expect(submit).toBeDisabled();

    await page.getByLabel('Password').fill('strong-password');
    await expect(submit).toBeEnabled();
  });

  test('shows login error when credentials are rejected', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 401, message: 'Invalid credentials' }),
      });
    });

    await page.goto('/login');
    await page.getByLabel('Email').fill('owner@example.com');
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    expect(errors).toHaveLength(0);
    await expect(page.getByRole('alert')).toContainText('Invalid credentials');
  });

  test('shows branch empty state when staff has no assigned venues', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await seedStaffSession(page);

    await page.route('**/api/v1/tenants/branches', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
    await page.route('**/api/v1/tenants/commerce', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          limits: { maxBranches: 3, branchesInUse: 0 },
        }),
      });
    });
    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: staffMeJson(),
      });
    });

    await page.goto('/branch');

    expect(errors).toHaveLength(0);
    await expect(page.getByText('No branches assigned')).toBeVisible();
  });

  test('shows branch error state when venue lookup fails', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await seedStaffSession(page);

    await page.route('**/api/v1/tenants/branches', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 500, message: 'Branches unavailable' }),
      });
    });
    await page.route('**/api/v1/tenants/commerce', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          limits: { maxBranches: 3, branchesInUse: 1 },
        }),
      });
    });
    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: staffMeJson(),
      });
    });

    await page.goto('/branch');

    expect(errors).toHaveLength(0);
    await expect(page.getByText('Could not load branches')).toBeVisible();
    await expect(page.getByText('Branches unavailable')).toBeVisible();
  });

  test('renders not-found page on unknown path', async ({ page }) => {
    await page.goto('/definitely-unknown-route');
    await expect(page.getByText('Page not found')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to Floor' })).toBeVisible();
  });

  test('renders public menu via deep-link route', async ({ page }) => {
    await page.route(
      '**/api/v1/public/tenants/**/branches/**/sessions/**/menu',
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            branch: { name: 'Public Branch' },
            categories: [{ name: 'Coffee', items: [{ id: '1', name: 'Espresso', priceMinor: 350 }] }],
          }),
        });
      },
    );
    await page.route('**/api/v1/public/tenants/**/branches/**/menu', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          branch: { name: 'Public Branch' },
          categories: [{ name: 'Coffee', items: [{ id: '1', name: 'Espresso', priceMinor: 350 }] }],
        }),
      });
    });

    await page.goto('/m/demo/main/t/session-token');
    await expect(page.getByText('Public Branch')).toBeVisible();
    await expect(page.getByText('Espresso')).toBeVisible();
  });

  test('shows report permission guidance when daily report is forbidden', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await seedStaffSession(page, 'branch-main');

    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: staffMeJson(),
      });
    });
    await page.route('**/api/v1/tenants/branches/**/ops-snapshot', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          lowStockCount: 0,
          blockingIncompleteCount: 0,
          openShiftPresent: false,
          readyForGoLive: true,
        }),
      });
    });
    await page.route('**/api/v1/branches/**/customers/visit-signals', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          windowDays: 30,
          since: '2026-01-01T00:00:00.000Z',
          branchId: 'branch-main',
          visitsRecorded: 0,
          uniqueVisitors: 0,
          repeatVisitors: 0,
          singleVisitVisitors: 0,
        }),
      });
    });
    await page.route('**/api/v1/branches/**/reports/demand-profile**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          semantics: 'branch_local_window',
          branchTimezone: 'UTC',
          window: { startDay: '2026-01-01', endDay: '2026-01-28', days: 28 },
          totalSalesMinor: 0,
          paidOrderCount: 0,
          hourlySales: [],
          peakContiguousHours: {
            startHour: 9,
            endHourExclusive: 12,
            salesMinor: 0,
            shareOfWindowSalesPct: 0,
          },
        }),
      });
    });
    await page.route('**/api/v1/branches/**/reports/daily**', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 403, message: 'Forbidden' }),
      });
    });

    await page.goto('/reports');

    expect(errors).toHaveLength(0);
    await expect(page.getByText(/Report access is limited/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/requires reports\.view/i)).toBeVisible();
  });

  test('shows setup permission guidance when onboarding status is forbidden', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await seedStaffSession(page, 'branch-main');

    await page.route('**/api/v1/tenants/commerce', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          subscriptionPlan: 'pilot',
          billingStatus: 'active',
          trialEndsAt: null,
          maxBranches: 1,
          branchesInUse: 1,
          maxUsers: 5,
          usersInUse: 2,
          features: { qrOrdering: true, inventory: true, apiAccess: true },
          access: { ok: true },
          limits: { maxBranches: 1, branchesInUse: 1, maxUsers: 5, usersInUse: 2 },
        }),
      });
    });
    await page.route('**/api/v1/tenants/branches/**/onboarding-status', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 403, message: 'Forbidden' }),
      });
    });
    await page.route('**/api/v1/tenants/branches/**/config-snapshot', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          branch: {
            id: 'branch-main',
            name: 'Main Branch',
            slug: 'main-branch',
            timezone: 'UTC',
            currency: 'USD',
            settings: { qrOrderingEnabled: true, qrCallWaiterEnabled: true },
          },
          environment: {
            appPublicUrlConfigured: false,
            publicMenuUrlTemplate: null,
          },
        }),
      });
    });

    await page.goto('/setup');

    expect(errors).toHaveLength(0);
    await expect(page.getByText(/settings\.manage/i)).toBeVisible();
  });

  test('shows stock empty state when inventory has no rows', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await seedStaffSession(page, 'branch-main');

    await page.route('**/api/v1/branches/**/inventory/stock', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/stock');

    expect(errors).toHaveLength(0);
    await expect(page.getByText('No stock rows')).toBeVisible();
  });

  test('shows open bills empty state when there are no active orders', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await seedStaffSession(page, 'branch-main');

    await page.route('**/api/v1/branches/**/orders', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [],
          nextCursor: null,
        }),
      });
    });

    await page.goto('/orders');

    expect(errors).toHaveLength(0);
    await expect(page.getByText('No open bills')).toBeVisible();
  });

  test('shows public menu unavailable state when backend errors', async ({ page }) => {
    await page.route(
      '**/api/v1/public/tenants/**/branches/**/sessions/**/menu',
      async (route) => {
        await route.fulfill({ status: 500, body: 'server error' });
      },
    );
    await page.route('**/api/v1/public/tenants/**/branches/**/menu', async (route) => {
      await route.fulfill({ status: 500, body: 'server error' });
    });

    await page.goto('/m/demo/main/t/session-token');
    await expect(page.getByText('Menu is unavailable right now. Try again shortly.')).toBeVisible();
  });

  test('redirects authenticated users without branch to branch picker', async ({ page }) => {
    await seedStaffSession(page);
    await page.route('**/api/v1/tenants/branches', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'branch-main', name: 'Main Branch', slug: 'main' },
        ]),
      });
    });
    await page.route('**/api/v1/tenants/commerce', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          limits: { maxBranches: 3, branchesInUse: 1 },
        }),
      });
    });
    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: staffMeJson(),
      });
    });

    await page.goto('/orders');
    await expect(page).toHaveURL(/\/branch/);
    await expect(page.getByRole('heading', { name: 'Select branch' })).toBeVisible();
  });

  test('login is keyboard reachable', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').focus();
    await expect(page.getByLabel('Email')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Password')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeFocused();
  });
});
