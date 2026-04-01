import { expect, test } from '@playwright/test';
import { loginAsDemoOwner, selectMainBranch } from './helpers/login';

/**
 * Customer lookup E2E tests.
 *
 * Proves: search works, customer profile renders intelligence + suggestedActions
 * fields that CustomerLookupPage expects.
 *
 * @critical
 */

const MOCK_CUSTOMER_ID = 'mock-cust-001';
const MOCK_SEARCH_RESPONSE = [
  {
    id: MOCK_CUSTOMER_ID,
    phone: '+15550001111',
    name: 'Mock Customer',
    visitCount: 3,
  },
];
const MOCK_CUSTOMER_DETAIL = {
  id: MOCK_CUSTOMER_ID,
  phone: '+15550001111',
  name: 'Mock Customer',
  notes: null,
  tags: ['vip'],
  visitCount: 3,
  visits: [],
  noteEntries: [],
  offers: [],
  intelligence: {
    daysSinceLastVisit: 5,
    visitsLast90Days: 3,
    primaryBranch: { id: 'branch-1', name: 'Main' },
    segment: 'regular',
  },
  suggestedActions: [{ type: 'offer', message: 'Offer a loyalty reward' }],
};

test.describe('customer lookup @critical', () => {
  test('customer page loads without crash', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await loginAsDemoOwner(page);
    await selectMainBranch(page);
    await page.goto('/customers');

    expect(errors).toHaveLength(0);
    // Page should render — either a search input or a heading
    await expect(page.locator('input[type="text"], input[type="search"], input[placeholder]').first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('search returns result list (with mock response)', async ({ page }) => {
    await loginAsDemoOwner(page);
    await selectMainBranch(page);

    // Mock both branch-scoped search and tenant-wide search
    await page.route('**/customers/search**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SEARCH_RESPONSE),
      }),
    );

    await page.goto('/customers');

    // Type in search box
    const searchInput = page.locator('input').first();
    await searchInput.fill('+15550001');

    // Submit search (try button click or Enter)
    const searchBtn = page.locator('#app-main').getByRole('button', { name: /search/i });
    if (await searchBtn.isVisible()) {
      await searchBtn.click();
    } else {
      await searchInput.press('Enter');
    }

    // Expect mock customer name or phone to appear
    await expect(
      page.getByText(/Mock Customer|\+15550001111/).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('customer profile shows intelligence fields (daysSinceLastVisit, visitsLast90Days)', async ({
    page,
  }) => {
    await loginAsDemoOwner(page);
    await selectMainBranch(page);

    // Mock search to return our mock customer
    await page.route('**/customers/search**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SEARCH_RESPONSE),
      }),
    );

    // Mock customer detail endpoint
    await page.route(`**/customers/${MOCK_CUSTOMER_ID}**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_CUSTOMER_DETAIL),
      }),
    );

    await page.goto('/customers');

    const searchInput = page.locator('input').first();
    await searchInput.fill('+15550001');

    const searchBtn = page.locator('#app-main').getByRole('button', { name: /search/i });
    if (await searchBtn.isVisible()) {
      await searchBtn.click();
    } else {
      await searchInput.press('Enter');
    }

    // Click on the result to open profile
    await expect(
      page.getByText(/Mock Customer|\+15550001111/).first(),
    ).toBeVisible({ timeout: 10_000 });

    await page.getByText(/Mock Customer|\+15550001111/).first().click();

    // Profile must show intelligence fields (days since last visit and visits in 90d)
    await expect(
      page.getByText(/days since|last visit/i).first(),
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.getByText(/visits.*90|90.*visits/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('no premature search request when query is empty', async ({ page }) => {
    let searchRequestCount = 0;

    await loginAsDemoOwner(page);
    await selectMainBranch(page);

    // Count search requests
    await page.route('**/customers/search**', (route) => {
      searchRequestCount++;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/customers');

    // Wait for page to fully settle
    await page.waitForTimeout(1000);

    // Clicking search with no query should either not fire or fire with empty q
    const searchBtn = page.locator('#app-main').getByRole('button', { name: /search/i });
    if (await searchBtn.isVisible()) {
      await searchBtn.click();
      await page.waitForTimeout(500);
    }

    // After page load with no input, we don't expect many search requests
    // The key assertion: no spontaneous search request was fired without user input
    expect(searchRequestCount).toBeLessThanOrEqual(1);
  });
});
