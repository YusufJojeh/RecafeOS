import { expect, test } from '@playwright/test';
import { loginAsDemoOwner, selectMainBranch } from './helpers/login';

/**
 * Error handling E2E tests.
 *
 * Proves that 401/403/network errors don't crash the app and
 * produce a graceful degraded state.
 *
 * @smoke
 */
test.describe('error handling @smoke', () => {
  test('403 on kitchen tickets endpoint shows page shell, not crash', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await loginAsDemoOwner(page);
    await selectMainBranch(page);

    await page.route('**/kitchen/tickets**', (route) =>
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 403, message: 'Forbidden' }),
      }),
    );

    await page.goto('/kitchen');

    expect(errors).toHaveLength(0);
    await expect(
      page.locator('#app-main').getByRole('heading', { name: 'Kitchen', exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('network abort on floor/tables shows page shell, not crash', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await loginAsDemoOwner(page);
    await selectMainBranch(page);

    await page.route('**/branches/*/tables**', (route) => route.abort());

    await page.goto('/floor');

    expect(errors).toHaveLength(0);
    await expect(page.locator('#app-main').getByRole('heading', { name: 'Floor', exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('401 response from API leads to login page or visible error (no crash)', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await loginAsDemoOwner(page);
    await selectMainBranch(page);

    await page.route('**/api/v1/**', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 401, message: 'Unauthorized' }),
      }),
    );

    await page.goto('/floor');

    expect(errors).toHaveLength(0);

    await expect
      .poll(async () => {
        const onLoginPage = page.url().includes('/login');
        const floorHeadingVisible = await page
          .locator('#app-main')
          .getByRole('heading', { name: 'Floor', exact: true })
          .isVisible()
          .catch(() => false);
        const visibleError = await page
          .getByRole('alert')
          .isVisible()
          .catch(async () =>
            page
              .getByText(/could not load|session expired|sign in again|unauthorized/i)
              .first()
              .isVisible()
              .catch(() => false),
          );
        return onLoginPage || floorHeadingVisible || visibleError;
      })
      .toBe(true);
  });
});
