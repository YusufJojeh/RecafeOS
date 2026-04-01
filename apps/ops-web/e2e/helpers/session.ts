import type { Page } from '@playwright/test';

export type BrowserSession = {
  accessToken: string;
  branchId: string;
};

export async function readSessionFromPage(page: Page): Promise<BrowserSession | null> {
  const raw = await page.evaluate(() => ({
    accessToken: localStorage.getItem('accessToken'),
    branchId: localStorage.getItem('branchId'),
  }));
  if (!raw.accessToken?.trim() || !raw.branchId?.trim()) {
    return null;
  }
  return { accessToken: raw.accessToken, branchId: raw.branchId };
}
