import { expect, test } from '@playwright/test';
import { advanceAllTicketsOnCurrentStation } from './helpers/advance-prep-ui';
import { createDineInOrderViaFloorUi } from './helpers/floor-dine-in-ui';
import { loginAsDemoOwner, selectMainBranch } from './helpers/login';

/**
 * One high-value operational path: seeded demo tenant, dine-in on T2, kitchen + bar prep,
 * cashier close through the UI, floor verifies table released.
 *
 * Order + session are created from the Floor UI (staff-critical path). Requires API + DB + seed.
 */
test.describe('critical path @critical', () => {
  test('login → branch → floor; dine-in order; kitchen + bar prep in UI; pay; table available', async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await loginAsDemoOwner(page);
    await selectMainBranch(page);

    const { orderId } = await createDineInOrderViaFloorUi(page);

    await page.goto('/floor');
    await expect(page.getByTestId('floor-table-T2')).toContainText('OCCUPIED', {
      timeout: 30_000,
    });

    await page.goto('/kitchen');
    await expect(page.locator('#app-main').getByRole('heading', { name: 'Kitchen' })).toBeVisible();
    await expect(page.getByText('Classic Burger').first()).toBeVisible({ timeout: 30_000 });
    await advanceAllTicketsOnCurrentStation(page);

    await page.goto('/bar');
    await expect(page.locator('#app-main').getByRole('heading', { name: 'Bar' })).toBeVisible();
    await expect(page.getByText('Cola').first()).toBeVisible({ timeout: 30_000 });
    await advanceAllTicketsOnCurrentStation(page);

    await page.goto('/orders');
    await expect(page.getByTestId(`open-order-row-${orderId}`)).toBeVisible({
      timeout: 30_000,
    });
    await page.getByTestId(`open-cashier-${orderId}`).click();
    await expect(page.getByTestId('cashier-dialog')).toBeVisible({
      timeout: 30_000,
    });

    const markServed = page.getByRole('button', { name: 'Mark served' });
    if (await markServed.isVisible().catch(() => false)) {
      await markServed.evaluate((element: HTMLButtonElement) => {
        element.click();
      });
    }

    await expect(page.getByTestId('cashier-close-bill')).toBeEnabled({
      timeout: 30_000,
    });
    await page.getByTestId('cashier-close-bill').evaluate((element: HTMLButtonElement) => {
      element.click();
    });
    await expect(page.getByText('Bill closed from cashier')).toBeVisible({
      timeout: 30_000,
    });

    await page.goto('/floor');
    await expect(page.getByTestId('floor-table-T2')).toContainText('AVAILABLE', {
      timeout: 30_000,
    });
  });
});
