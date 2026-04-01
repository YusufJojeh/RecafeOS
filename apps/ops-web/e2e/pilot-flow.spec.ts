import { expect, test } from '@playwright/test';

/**
 * Full-stack pilot path: seeded demo tenant (see `apps/api/prisma/seed.ts`).
 * Requires API + DB + optional Redis; run via `.github/workflows/e2e-pilot.yml` or locally with
 * servers already listening (set `PLAYWRIGHT_SKIP_WEBSERVER=1`).
 */
test.describe('pilot @pilot', () => {
  test('login, select branch, open kitchen queue', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('owner@demo.local');
    await page.getByLabel('Password').fill('demo12345');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/branch/);
    await page.getByTestId('branch-option-main').click();

    await expect(page).toHaveURL(/\/floor/);

    await page.goto('/kitchen');
    await expect(page.locator('#app-main').getByRole('heading', { name: 'Kitchen' })).toBeVisible();
    await expect(
      page.locator('#app-main').getByText(/Tickets|Ready to hand off|No tickets/i).first(),
    ).toBeVisible();
  });
});
