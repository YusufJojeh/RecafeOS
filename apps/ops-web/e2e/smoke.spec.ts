import { expect, test } from '@playwright/test';

test('@smoke login page visible', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText('RestoCafe OS')).toBeVisible();
});
