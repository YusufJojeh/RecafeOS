import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
  type ViewportSize,
} from '@playwright/test';
import {
  installDashboardMocks,
  seedDashboardSession,
} from './helpers/dashboard-visual-mocks';

type Locale = 'en' | 'ar';

type VisualRoute = {
  path: string;
  snapshot: string;
};

const DESKTOP_VIEWPORT: ViewportSize = { width: 1440, height: 1280 };
const MOBILE_VIEWPORT: ViewportSize = { width: 390, height: 844 };

const dashboardRoutesEn: VisualRoute[] = [
  { path: '/floor', snapshot: 'dashboard-floor-en-desktop.png' },
  { path: '/orders', snapshot: 'dashboard-orders-en-desktop.png' },
  { path: '/menu', snapshot: 'dashboard-menu-en-desktop.png' },
  { path: '/kitchen', snapshot: 'dashboard-kitchen-en-desktop.png' },
  { path: '/bar', snapshot: 'dashboard-bar-en-desktop.png' },
  { path: '/reports', snapshot: 'dashboard-reports-en-desktop.png' },
  { path: '/reports/shift-handoff', snapshot: 'dashboard-shift-handoff-en-desktop.png' },
  { path: '/weekly-digest', snapshot: 'dashboard-weekly-digest-en-desktop.png' },
  { path: '/customers', snapshot: 'dashboard-customers-en-desktop.png' },
  { path: '/stock', snapshot: 'dashboard-stock-en-desktop.png' },
  { path: '/setup', snapshot: 'dashboard-setup-en-desktop.png' },
];

const dashboardRoutesAr: VisualRoute[] = [
  { path: '/floor', snapshot: 'dashboard-floor-ar-desktop.png' },
  { path: '/orders', snapshot: 'dashboard-orders-ar-desktop.png' },
  { path: '/menu', snapshot: 'dashboard-menu-ar-desktop.png' },
  { path: '/kitchen', snapshot: 'dashboard-kitchen-ar-desktop.png' },
  { path: '/bar', snapshot: 'dashboard-bar-ar-desktop.png' },
  { path: '/reports', snapshot: 'dashboard-reports-ar-desktop.png' },
  { path: '/reports/shift-handoff', snapshot: 'dashboard-shift-handoff-ar-desktop.png' },
  { path: '/weekly-digest', snapshot: 'dashboard-weekly-digest-ar-desktop.png' },
  { path: '/customers', snapshot: 'dashboard-customers-ar-desktop.png' },
  { path: '/stock', snapshot: 'dashboard-stock-ar-desktop.png' },
  { path: '/setup', snapshot: 'dashboard-setup-ar-desktop.png' },
];

test.describe.configure({ mode: 'serial' });

async function createContext(
  browser: Browser,
  options: { locale: Locale; viewport: ViewportSize },
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: options.viewport,
    colorScheme: 'light',
  });

  await context.addInitScript((locale: Locale) => {
    localStorage.setItem('restocafe-lang', locale);
  }, options.locale);

  return context;
}

async function preparePage(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
}

async function takeSnapshot(
  page: Page,
  name: string,
  options: { fullPage?: boolean } = {},
): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
    fullPage: options.fullPage ?? true,
  });
}

async function waitForAuthScreen(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', { name: /staff access|وصول الموظفين/i }),
  ).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(500);
}

async function waitForBranchSelect(page: Page): Promise<void> {
  await expect(page.getByTestId('branch-option-main')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(500);
}

async function waitForDashboard(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'Toggle Sidebar' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator('#app-main h1').first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1000);
}

async function seedStaffSession(page: Page, branchId?: string): Promise<void> {
  await page.addInitScript((value?: string) => {
    localStorage.setItem('accessToken', 'visual-test-token');
    localStorage.setItem('refreshToken', 'visual-test-refresh');
    localStorage.setItem('tenantId', 'tenant_demo');
    localStorage.setItem('preferredTenantSlug', 'demo');
    if (value) {
      localStorage.setItem('branchId', value);
      return;
    }
    localStorage.removeItem('branchId');
  }, branchId);
}

async function installBranchSelectMocks(page: Page): Promise<void> {
  await page.route('**/api/v1/tenants/branches', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'branch_main', name: 'Main Branch', slug: 'main' },
        { id: 'branch_patio', name: 'Patio Branch', slug: 'patio' },
      ]),
    });
  });

  await page.route('**/api/v1/tenants/commerce', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        limits: { maxBranches: 3, branchesInUse: 2 },
      }),
    });
  });

  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        userId: 'vr-user',
        email: 'vr@test',
        displayName: 'VR',
        tenantId: 'tenant_vr',
        permissions: ['reports.tenant_rollups'],
        defaultBranchId: null,
        branchAccessScope: 'ALL_TENANT_BRANCHES',
      }),
    });
  });
}

async function installPublicMenuMocks(page: Page): Promise<void> {
  const body = JSON.stringify({
    branch: { name: 'Public Branch' },
    categories: [
      {
        name: 'Coffee',
        items: [
          {
            id: 'espresso',
            name: 'Espresso',
            description: 'Double shot served hot.',
            priceMinor: 350,
          },
          {
            id: 'cortado',
            name: 'Cortado',
            description: 'Balanced espresso with steamed milk.',
            priceMinor: 420,
          },
        ],
      },
      {
        name: 'Bakery',
        items: [
          {
            id: 'croissant',
            name: 'Butter Croissant',
            description: 'Fresh laminated pastry.',
            priceMinor: 500,
          },
        ],
      },
    ],
  });

  await page.route('**/api/v1/public/tenants/**/branches/**/sessions/**/menu', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body,
    });
  });

  await page.route('**/api/v1/public/tenants/**/branches/**/menu', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body,
    });
  });

  await page.route('**/api/v1/public/sessions/**/call-waiter', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
}

async function installSupportMocks(page: Page): Promise<void> {
  await page.route('**/api/v1/internal/support-ui/lookup/tenant-slug/alpha', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tenantId: 'tenant_alpha', slug: 'alpha' }),
    });
  });

  await page.route('**/api/v1/internal/support-ui/pilots', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            tenantId: 'tenant_1',
            name: 'Venue One',
            slug: 'venue-one',
            branchCount: 2,
            pilotFeedbackCount: 3,
            pilot: {
              venueStatus: 'live',
              pilotPhase: 'post-launch',
              pilotHealth: 'green',
            },
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/internal/support-ui/pilots/weekly-report**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        since: '2026-01-01',
        until: '2026-01-07',
        tenants: [
          {
            tenantId: 'tenant_1',
            name: 'Venue One',
            slug: 'venue-one',
            pilot: { pilotHealth: 'green', venueStatus: 'live' },
            summary: { ordersLast24h: 14, pilotFeedbackCount: 2 },
            window: {
              feedbackNewCount: 2,
              feedbackByTheme: { kitchen: 1, service: 1 },
              feedbackByType: { bug: 1, request: 1 },
              supportAuditActionsCount: 3,
              openBlockersCount: 1,
            },
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/internal/support-ui/tenants/tenant_1/summary', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        pilot: { pilotHealth: 'green', venueStatus: 'live' },
        pilotFeedbackCount: 3,
        commercial: {
          effectiveLimits: {
            features: {
              qrMenu: true,
              reports: true,
            },
          },
        },
      }),
    });
  });

  await page.route('**/api/v1/internal/support-ui/tenants/tenant_1/branches', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'branch_1', name: 'Main Branch', slug: 'main-branch' },
        { id: 'branch_2', name: 'Patio Branch', slug: 'patio-branch' },
      ]),
    });
  });

  await page.route('**/api/v1/internal/support-ui/tenants/tenant_1/pilot-feedback**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'feedback_1',
            feedbackType: 'bug',
            severity: 'sev2',
            status: 'open',
            themeKey: 'kitchen',
            businessCritical: false,
            triageNotes: null,
            title: 'Kitchen ticket lag',
            promotedToEngineering: false,
          },
        ],
      }),
    });
  });
}

test.describe('auth and access visuals', () => {
  test('captures login desktop in English', async ({ browser }) => {
    const context = await createContext(browser, { locale: 'en', viewport: DESKTOP_VIEWPORT });
    const page = await context.newPage();
    await preparePage(page);

    await page.goto('/login');
    await waitForAuthScreen(page);
    await takeSnapshot(page, 'auth-login-en-desktop.png');

    await context.close();
  });

  test('captures invite acceptance state in English', async ({ browser }) => {
    const context = await createContext(browser, { locale: 'en', viewport: DESKTOP_VIEWPORT });
    const page = await context.newPage();
    await preparePage(page);

    await page.goto('/login');
    await waitForAuthScreen(page);
    await page.getByRole('button', { name: 'Accept staff invite' }).click();
    await expect(page.getByLabel('Invite token')).toBeVisible();
    await page.waitForTimeout(300);
    await takeSnapshot(page, 'auth-invite-en-desktop.png');

    await context.close();
  });

  test('captures login mobile in English', async ({ browser }) => {
    const context = await createContext(browser, { locale: 'en', viewport: MOBILE_VIEWPORT });
    const page = await context.newPage();
    await preparePage(page);

    await page.goto('/login');
    await waitForAuthScreen(page);
    await takeSnapshot(page, 'auth-login-en-mobile.png');

    await context.close();
  });

  test('captures login desktop in Arabic RTL', async ({ browser }) => {
    const context = await createContext(browser, { locale: 'ar', viewport: DESKTOP_VIEWPORT });
    const page = await context.newPage();
    await preparePage(page);

    await page.goto('/login');
    await waitForAuthScreen(page);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await takeSnapshot(page, 'auth-login-ar-desktop.png');

    await context.close();
  });

  test('captures branch select in English', async ({ browser }) => {
    const context = await createContext(browser, { locale: 'en', viewport: DESKTOP_VIEWPORT });
    const page = await context.newPage();
    await preparePage(page);
    await seedStaffSession(page);
    await installBranchSelectMocks(page);

    await page.goto('/branch');
    await waitForBranchSelect(page);
    await takeSnapshot(page, 'branch-select-en-desktop.png');

    await context.close();
  });

  test('captures branch select in Arabic RTL', async ({ browser }) => {
    const context = await createContext(browser, { locale: 'ar', viewport: DESKTOP_VIEWPORT });
    const page = await context.newPage();
    await preparePage(page);
    await seedStaffSession(page);
    await installBranchSelectMocks(page);

    await page.goto('/branch');
    await waitForBranchSelect(page);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await takeSnapshot(page, 'branch-select-ar-desktop.png');

    await context.close();
  });

  test('captures public menu on mobile', async ({ browser }) => {
    const context = await createContext(browser, { locale: 'en', viewport: MOBILE_VIEWPORT });
    const page = await context.newPage();
    await preparePage(page);
    await installPublicMenuMocks(page);

    await page.goto('/m/demo/main/t/session-token');
    await expect(page.getByRole('heading', { level: 1, name: 'Public Branch' })).toBeVisible();
    await page.waitForTimeout(500);
    await takeSnapshot(page, 'public-menu-en-mobile.png');

    await context.close();
  });
});

test.describe('dashboard visuals in English', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await createContext(browser, { locale: 'en', viewport: DESKTOP_VIEWPORT });
    page = await context.newPage();
    await preparePage(page);
    await seedDashboardSession(page);
    await installDashboardMocks(page);
    await page.goto('/floor');
    await waitForDashboard(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  for (const route of dashboardRoutesEn) {
    test(`captures ${route.path} in English`, async () => {
      await page.goto(route.path);
      await waitForDashboard(page);
      await takeSnapshot(page, route.snapshot);
    });
  }
});

test.describe('dashboard visuals in Arabic RTL', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await createContext(browser, { locale: 'ar', viewport: DESKTOP_VIEWPORT });
    page = await context.newPage();
    await preparePage(page);
    await seedDashboardSession(page);
    await installDashboardMocks(page);
    await page.goto('/floor');
    await waitForDashboard(page);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test.afterAll(async () => {
    await context.close();
  });

  for (const route of dashboardRoutesAr) {
    test(`captures ${route.path} in Arabic RTL`, async () => {
      await page.goto(route.path);
      await waitForDashboard(page);
      await takeSnapshot(page, route.snapshot);
    });
  }
});

test.describe('dashboard mobile shell visuals', () => {
  test('captures mobile sidebar open state', async ({ browser }) => {
    const context = await createContext(browser, { locale: 'en', viewport: MOBILE_VIEWPORT });
    const page = await context.newPage();
    await preparePage(page);
    await seedDashboardSession(page);
    await installDashboardMocks(page);
    await page.goto('/floor');
    await waitForDashboard(page);

    await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
    await expect(page.getByText('RestoCafe OS')).toBeVisible();
    await page.waitForTimeout(300);
    await takeSnapshot(page, 'dashboard-floor-en-mobile-sidebar.png', { fullPage: false });

    await context.close();
  });
});

test.describe('internal tooling visuals', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await createContext(browser, { locale: 'en', viewport: DESKTOP_VIEWPORT });
    page = await context.newPage();
    await preparePage(page);
    await seedStaffSession(page, 'branch_main');
    await installSupportMocks(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('captures internal support console', async () => {
    await page.goto('/internal/support');
    await waitForDashboard(page);
    await page.getByPlaceholder('tenant slug').fill('alpha');
    await page.getByRole('button', { name: 'Resolve slug' }).click();
    await expect(page.getByText('"tenantId": "tenant_alpha"')).toBeVisible();
    await page.waitForTimeout(300);
    await takeSnapshot(page, 'internal-support-en-desktop.png');
  });

  test('captures pilot portfolio', async () => {
    await page.goto('/internal/pilots');
    await waitForDashboard(page);
    await expect(page.getByText('Venue One')).toBeVisible();
    await takeSnapshot(page, 'internal-pilot-portfolio-en-desktop.png');
  });

  test('captures pilot detail', async () => {
    await page.goto('/internal/pilots/tenant_1');
    await waitForDashboard(page);
    await expect(page.getByText('Kitchen ticket lag')).toBeVisible();
    await takeSnapshot(page, 'internal-pilot-detail-en-desktop.png');
  });

  test('captures weekly pilot health', async () => {
    await page.goto('/internal/pilots/weekly');
    await waitForDashboard(page);
    await expect(page.locator('tbody').getByText('Venue One')).toBeVisible();
    await takeSnapshot(page, 'internal-pilot-weekly-en-desktop.png');
  });
});
