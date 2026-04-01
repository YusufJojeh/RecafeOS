import { expect, test, type Page } from '@playwright/test';

function seedSupportSession(page: Page) {
  return page.addInitScript(() => {
    localStorage.setItem('accessToken', 'internal-support-test-token');
    localStorage.setItem('refreshToken', 'internal-support-refresh');
    localStorage.setItem('tenantId', 'tenant_alpha');
    localStorage.setItem('branchId', 'branch_main');
  });
}

test.describe('internal support and pilot routes @smoke', () => {
  test('support console resolves a tenant slug and renders payload output', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await seedSupportSession(page);

    await page.route('**/api/v1/internal/support-ui/lookup/tenant-slug/alpha', async (route) => {
      expect(route.request().headers()['x-support-api-key']).toBeUndefined();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tenantId: 'tenant_alpha', slug: 'alpha' }),
      });
    });

    await page.goto('/internal/support');

    await expect(page.getByRole('heading', { name: 'Internal support' })).toBeVisible();
    await expect(page.getByText(/browser never stores or sends support API keys/i)).toBeVisible();
    await page.getByPlaceholder('tenant slug').fill('alpha');
    await page.getByRole('button', { name: 'Resolve slug' }).click();

    expect(errors).toHaveLength(0);
    await expect(page.getByText('"tenantId": "tenant_alpha"')).toBeVisible();
    const supportKey = await page.evaluate(() =>
      sessionStorage.getItem('restocafe_support_api_key_read'),
    );
    expect(supportKey).toBeNull();
  });

  test('pilot routes load portfolio and detail through server-side support gateway', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await seedSupportSession(page);

    await page.route('**/api/v1/internal/support-ui/pilots', async (route) => {
      expect(route.request().headers()['x-support-api-key']).toBeUndefined();
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
      const request = route.request();
      if (request.method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        });
        return;
      }

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

    await page.goto('/internal/pilots');

    await expect(
      page.locator('#app-main').getByRole('heading', { level: 1, name: 'Pilot portfolio' }),
    ).toBeVisible();
    await expect(page.getByText('Venue One')).toBeVisible();
    await page.getByRole('link', { name: 'Open', exact: true }).click();

    await expect(page).toHaveURL(/\/internal\/pilots\/tenant_1/);
    await expect(page.getByRole('heading', { level: 1, name: 'Pilot detail' })).toBeVisible();
    await expect(page.getByText('Main Branch')).toBeVisible();
    await expect(page.getByText('Kitchen ticket lag')).toBeVisible();

    await page.getByLabel('Title').fill('Issue title');
    await page.getByLabel('Description').fill('Issue body');
    await page.getByRole('button', { name: 'Submit feedback' }).click();

    expect(errors).toHaveLength(0);
    await expect(page.getByText('Feedback submitted')).toBeVisible();
  });

  test('weekly pilot route renders health rollup and raw json details', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await seedSupportSession(page);

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

    await page.goto('/internal/pilots/weekly');

    await expect(page.getByRole('heading', { name: 'Weekly pilot health' })).toBeVisible();
    await expect(page.locator('tbody').getByText('Venue One')).toBeVisible();
    await page.getByText('Raw JSON').click();

    expect(errors).toHaveLength(0);
    await expect(page.getByText(/supportAuditActionsCount/i)).toBeVisible();
  });
});
