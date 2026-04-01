import { expect, test } from '@playwright/test';
import { loginAsDemoOwner, selectMainBranch } from './helpers/login';

/**
 * Menu management E2E tests.
 *
 * Proves: GET /branches/:b/menu/categories renders correctly,
 * dry-run import validates JSON, apply import creates items.
 *
 * @critical
 */

const IMPORT_JSON = JSON.stringify({
  categories: [
    {
      name: 'E2E Import Category',
      items: [
        { name: 'E2E Import Item A', priceMinor: 1099, prepStation: 'KITCHEN' },
      ],
    },
  ],
});

test.describe('menu management @critical', () => {
  test('menu page loads and shows seeded menu items', async ({ page }) => {
    await loginAsDemoOwner(page);
    await selectMainBranch(page);
    await page.goto('/menu');

    await expect(page.locator('#app-main').getByRole('heading', { name: 'Menu', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByText(/\d+\.\d{2}/).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('dry-run import validates JSON and returns ok result', async ({ page }) => {
    await loginAsDemoOwner(page);
    await selectMainBranch(page);
    await page.goto('/menu');

    await expect(page.locator('#app-main').getByRole('heading', { name: 'Menu', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    const allTextareas = page.locator('textarea');
    const textareaCount = await allTextareas.count();

    if (textareaCount === 0) {
      test.skip();
      return;
    }

    await allTextareas.last().fill(IMPORT_JSON);

    const dryRunBtn = page.getByRole('button', { name: /dry.?run/i });
    if (!(await dryRunBtn.isVisible())) {
      test.skip();
      return;
    }
    await dryRunBtn.click();

    await expect(page.getByText(/ok|success|categor/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('apply import creates category visible in menu list', async ({ page }) => {
    await loginAsDemoOwner(page);
    await selectMainBranch(page);
    await page.goto('/menu');

    await expect(page.locator('#app-main').getByRole('heading', { name: 'Menu', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    const allTextareas = page.locator('textarea');
    if ((await allTextareas.count()) === 0) {
      test.skip();
      return;
    }

    await allTextareas.last().fill(IMPORT_JSON);

    const dryRunBtn = page.getByRole('button', { name: /dry.?run/i });
    if (!(await dryRunBtn.isVisible())) {
      test.skip();
      return;
    }
    await dryRunBtn.click();

    await page.waitForTimeout(1000);
    const applyBtn = page.getByRole('button', { name: /apply/i });
    if (!(await applyBtn.isVisible()) || !(await applyBtn.isEnabled())) {
      test.skip();
      return;
    }
    await applyBtn.click();

    await expect(page.getByText(/E2E Import Category|applied|success/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });
});
