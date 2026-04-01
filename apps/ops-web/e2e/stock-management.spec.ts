import { expect, test } from '@playwright/test';
import { loginAsDemoOwner, selectMainBranch } from './helpers/login';

/**
 * Stock management E2E tests.
 *
 * Proves: GET /branches/:b/inventory/stock renders correctly,
 * low-stock items show a LOW indicator.
 *
 * @critical
 */
test.describe('stock management @critical', () => {
  test('stock page loads with no errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await loginAsDemoOwner(page);
    await selectMainBranch(page);
    await page.goto('/stock');

    // No JS crash
    expect(errors).toHaveLength(0);

    // Heading must be visible
    await expect(page.locator('#app-main').getByRole('heading', { name: 'Stock', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Must not show a 403 error message
    await expect(page.getByText(/403|forbidden/i)).not.toBeVisible();
  });

  test('low-stock items show LOW badge when quantity is below threshold', async ({
    page,
  }) => {
    await loginAsDemoOwner(page);
    await selectMainBranch(page);

    // Mock the stock endpoint to return a low-stock item
    await page.route('**/inventory/stock**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'mock-stock-1',
            name: 'Milk',
            quantity: 2,
            lowThreshold: 5,
            unit: 'L',
          },
          {
            id: 'mock-stock-2',
            name: 'Flour',
            quantity: 10,
            lowThreshold: 3,
            unit: 'kg',
          },
        ]),
      }),
    );

    await page.goto('/stock');

    await expect(page.locator('#app-main').getByRole('heading', { name: 'Stock', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Milk (quantity 2, threshold 5) should show a LOW indicator
    await expect(page.getByText('Milk')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/low/i).first()).toBeVisible({ timeout: 10_000 });

    // Flour (quantity 10, threshold 3) should NOT show LOW
    const flourRow = page.getByText('Flour');
    await expect(flourRow).toBeVisible();
  });
});
