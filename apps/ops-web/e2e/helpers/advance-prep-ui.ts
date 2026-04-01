import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/** Clicks Next/Deliver until the station queue is empty (see KitchenPage "No tickets"). */
export async function advanceAllTicketsOnCurrentStation(page: Page): Promise<void> {
  for (let step = 0; step < 60; step++) {
    const emptyState = page.getByText('No tickets');
    if (await emptyState.isVisible().catch(() => false)) {
      break;
    }

    const buttons = page.locator('[data-testid="prep-ticket-advance"]:not([disabled])');
    if ((await buttons.count()) === 0) {
      await page.waitForTimeout(250);
      continue;
    }

    try {
      await buttons.first().evaluate((element: HTMLButtonElement) => {
        element.click();
      });
    } catch {
      await page.waitForTimeout(100);
      continue;
    }

    await page.waitForTimeout(200);
  }
  await expect(page.getByText('No tickets')).toBeVisible({ timeout: 60_000 });
}
