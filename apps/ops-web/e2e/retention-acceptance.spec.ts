import { expect, test } from '@playwright/test';
import { apiV1Base, authHeaders } from './helpers/api-base';
import { loginAsDemoOwner, selectMainBranch } from './helpers/login';
import { readSessionFromPage } from './helpers/session';

/**
 * Encodes post-pilot retention acceptance (plan: ops strip, close of day, rollup,
 * weekly digest, returning guest). Requires API + seeded demo (see E2E_CRITICAL_PATH).
 */
test.describe('retention acceptance B–E @retention', () => {
  test('API contracts: ops-snapshot; daily flags; weekly digest; open orders', async ({
    request,
    page,
  }) => {
    test.setTimeout(120_000);

    await loginAsDemoOwner(page);
    await selectMainBranch(page);
    const session = await readSessionFromPage(page);
    expect(session).toBeTruthy();
    const { accessToken, branchId } = session!;

    const base = apiV1Base();
    const h = authHeaders(accessToken, branchId);

    // B — strip data source: counts only, no PII
    const opsRes = await request.get(
      `${base}/tenants/branches/${branchId}/ops-snapshot`,
      { headers: h },
    );
    expect(opsRes.ok(), await opsRes.text()).toBeTruthy();
    const ops = (await opsRes.json()) as Record<string, unknown>;
    expect(ops).toMatchObject({
      readyForGoLive: expect.any(Boolean),
      blockingIncompleteCount: expect.any(Number),
      lowStockCount: expect.any(Number),
      openShiftPresent: expect.any(Boolean),
    });
    expect(Object.keys(ops).sort()).toEqual(
      [
        'blockingIncompleteCount',
        'lowStockCount',
        'openShiftPresent',
        'readyForGoLive',
      ].sort(),
    );
    expect(ops).not.toHaveProperty('phone');
    expect(ops).not.toHaveProperty('name');

    // A — daily flags severities
    const dailyRes = await request.get(`${base}/branches/${branchId}/reports/daily`, {
      headers: h,
    });
    expect(dailyRes.ok(), await dailyRes.text()).toBeTruthy();
    const daily = (await dailyRes.json()) as {
      flags: Array<{ severity: string }>;
    };
    for (const f of daily.flags) {
      expect(['info', 'warn', 'risk']).toContain(f.severity);
    }

    // C — weekly digest semantics + setup snapshot
    const weekRes = await request.get(
      `${base}/branches/${branchId}/reports/weekly-digest`,
      { headers: h },
    );
    expect(weekRes.ok(), await weekRes.text()).toBeTruthy();
    const week = (await weekRes.json()) as {
      semantics: string;
      setup: { readyForGoLive: boolean; blockingIncompleteCount: number };
    };
    expect(week.semantics).toBe('branch_local_7_calendar_days_vs_prior_7');
    expect(week.setup).toMatchObject({
      readyForGoLive: expect.any(Boolean),
      blockingIncompleteCount: expect.any(Number),
    });

    // E — open orders include returningGuest
    const ordRes = await request.get(`${base}/branches/${branchId}/orders`, {
      headers: h,
    });
    expect(ordRes.ok(), await ordRes.text()).toBeTruthy();
    const ord = (await ordRes.json()) as {
      items: Array<{ returningGuest?: boolean }>;
    };
    expect(Array.isArray(ord.items)).toBe(true);
    for (const item of ord.items) {
      expect(typeof item.returningGuest).toBe('boolean');
    }
  });

  test('UI: Floor strip or empty; Reports close of day + rollup; weekly digest', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await loginAsDemoOwner(page);
    await selectMainBranch(page);

    await page.goto('/floor');
    await expect(page.locator('#app-main').getByRole('heading', { name: 'Floor', exact: true })).toBeVisible();
    // B: strip is optional when nothing to signal — at least the page loads
    const strip = page.getByText("Today's signals");
    if (await strip.isVisible().catch(() => false)) {
      await expect(strip).toBeVisible();
    }

    const main = page.locator('#app-main');

    await page.goto('/reports');
    await expect(main.getByRole('heading', { name: 'Operational report' })).toBeVisible();
    await expect(main.getByText('Close of day')).toBeVisible({
      timeout: 45_000,
    });
    // D — rollup copy (owner role)
    await expect(main.getByText('All branches (tenant rollup)')).toBeVisible();
    await expect(main.getByText('UTC window:').first()).toBeVisible();

    await page.goto('/weekly-digest');
    await expect(main.getByRole('heading', { name: 'Weekly digest' })).toBeVisible();
    await expect(main.getByText(/Last 7 calendar days/i)).toBeVisible();
  });
});
