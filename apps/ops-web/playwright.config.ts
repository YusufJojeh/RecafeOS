import { defineConfig } from '@playwright/test';

const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1';
const configuredWorkers = Number(process.env.PLAYWRIGHT_WORKERS ?? '');

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  workers:
    Number.isFinite(configuredWorkers) && configuredWorkers > 0
      ? configuredWorkers
      : undefined,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'light',
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
    },
  },
  ...(skipWebServer
    ? {}
    : {
        webServer: {
          command: 'npm run dev',
          env: {
            ...process.env,
            VITE_SUPPORT_CONSOLE: process.env.VITE_SUPPORT_CONSOLE ?? 'true',
          },
          port: 5173,
          reuseExistingServer: !process.env.CI,
        },
      }),
});
