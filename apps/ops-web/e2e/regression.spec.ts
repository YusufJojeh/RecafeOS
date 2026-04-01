import { expect, test } from '@playwright/test';

/**
 * Browser regression slice for CI. Extend with branch shell and order board
 * when a stable test API + seed are available (see docs/qa/QA_STRATEGY.md).
 */
test.describe('regression @regression', () => {
  test('login route renders app shell', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('RestoCafe OS')).toBeVisible();
  });
});
