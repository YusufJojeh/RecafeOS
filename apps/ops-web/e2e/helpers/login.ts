import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { apiV1Base } from './api-base';

const DEMO_EMAIL = 'owner@demo.local';
const DEMO_PASSWORD = 'demo12345';
const SESSION_CACHE_MAX_AGE_MS = 10 * 60 * 1000;
const SESSION_CACHE_PATH = path.resolve(process.cwd(), '.codex-tmp', 'playwright-demo-session.json');

type DemoSessionCache = {
  accessToken: string;
  refreshToken: string;
  tenantId: string;
  tenantSlug: string;
  cachedAt: number;
};

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function readCachedSession(): Promise<DemoSessionCache | null> {
  try {
    const raw = await readFile(SESSION_CACHE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as DemoSessionCache;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.tenantId || !parsed.tenantSlug) {
      return null;
    }
    if (Date.now() - parsed.cachedAt > SESSION_CACHE_MAX_AGE_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeCachedSession(session: DemoSessionCache): Promise<void> {
  await mkdir(path.dirname(SESSION_CACHE_PATH), { recursive: true });
  const tempPath = `${SESSION_CACHE_PATH}.tmp-${process.pid}`;
  await writeFile(tempPath, JSON.stringify(session), 'utf8');
  await rename(tempPath, SESSION_CACHE_PATH);
}

async function clearCachedSession(): Promise<void> {
  await rm(SESSION_CACHE_PATH, { force: true }).catch(() => undefined);
}

async function requestFreshDemoSession(page: Page): Promise<DemoSessionCache> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await page.request.post(`${apiV1Base()}/auth/login`, {
      data: {
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      },
    });

    if (res.ok()) {
      const body = (await res.json()) as {
        accessToken: string;
        refreshToken: string;
        tenantId: string;
        tenants?: Array<{ id: string; slug: string }>;
      };
      const tenantSlug =
        body.tenants?.find((tenant) => tenant.id === body.tenantId)?.slug ?? 'demo';

      const session = {
        accessToken: body.accessToken,
        refreshToken: body.refreshToken,
        tenantId: body.tenantId,
        tenantSlug,
        cachedAt: Date.now(),
      } satisfies DemoSessionCache;

      await writeCachedSession(session);
      return session;
    }

    if (res.status() !== 429) {
      throw new Error(`Demo login failed: ${res.status()} ${await res.text()}`);
    }

    await sleep(1_500 * (attempt + 1));
  }

  throw new Error('Demo login failed repeatedly with 429 rate limiting.');
}

async function applySession(page: Page, session: DemoSessionCache): Promise<boolean> {
  await page.goto('/login');
  await page.evaluate(
    ({ accessToken, refreshToken, tenantId, tenantSlug }) => {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('tenantId', tenantId);
      localStorage.setItem('preferredTenantSlug', tenantSlug);
      localStorage.removeItem('branchId');
    },
    session,
  );

  await page.goto('/branch');
  await page.waitForLoadState('networkidle');
  return !page.url().includes('/login');
}

/** Seeded demo owner - see apps/api/prisma/seed.ts */
export async function loginAsDemoOwner(page: Page): Promise<void> {
  let session = await readCachedSession();
  if (!session) {
    session = await requestFreshDemoSession(page);
  }

  if (!(await applySession(page, session))) {
    await clearCachedSession();
    session = await requestFreshDemoSession(page);
    if (!(await applySession(page, session))) {
      throw new Error('Demo session could not be restored to the branch picker.');
    }
  }

  await page.waitForURL(/\/branch/, { timeout: 30_000 });
}

export async function selectMainBranch(page: Page): Promise<void> {
  await page.getByTestId('branch-option-main').click();
  await page.waitForURL(/\/floor/, { timeout: 15_000 });
}
