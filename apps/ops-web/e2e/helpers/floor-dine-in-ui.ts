import type { Page } from '@playwright/test';

/**
 * Staff-critical path: open session on T2 (if needed), create dine-in order with
 * Classic Burger + Cola via Floor UI, confirm + send to preparation.
 * Replaces API-only seeding for `critical-path-dine-in.spec.ts`.
 */
export async function createDineInOrderViaFloorUi(page: Page): Promise<{ orderId: string }> {
  await page.goto('/floor');

  const t2 = page.getByTestId('floor-table-T2');
  await t2.waitFor({ state: 'visible', timeout: 30_000 });

  const startBtn = page.getByTestId('floor-start-session-T2');
  if (await startBtn.isVisible().catch(() => false)) {
    await startBtn.click();
    await page.getByTestId('floor-session-guest-count').fill('2');
    const openSession = page.waitForResponse(
      (r) => {
        const u = new URL(r.url());
        return (
          r.request().method() === 'POST' &&
          u.pathname.includes('/tables/sessions') &&
          r.ok()
        );
      },
      { timeout: 30_000 },
    );
    await page.getByTestId('floor-session-submit').click();
    await openSession;
  }

  const burgerBox = page.getByRole('checkbox', { name: /Classic Burger/i });
  try {
    await burgerBox.waitFor({ state: 'visible', timeout: 5000 });
  } catch {
    await page.getByTestId('floor-new-dine-in-T2').click();
    await burgerBox.waitFor({ state: 'visible', timeout: 30_000 });
  }
  await burgerBox.check();
  await page.getByRole('checkbox', { name: /Cola/i }).check();

  const postOrder = page.waitForResponse(
    (r) => {
      const u = new URL(r.url());
      return (
        r.request().method() === 'POST' &&
        /\/api\/v1\/branches\/[^/]+\/orders$/.test(u.pathname) &&
        r.ok()
      );
    },
    { timeout: 60_000 },
  );

  await page.getByTestId('floor-dine-in-submit').click();
  const res = await postOrder;
  const body = (await res.json()) as { id: string };
  if (!body?.id) {
    throw new Error('Expected POST /orders JSON body with id');
  }
  return { orderId: body.id };
}
