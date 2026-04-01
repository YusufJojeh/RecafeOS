# Ops Web

Ops Web is the operational dashboard for RecafeOS. It runs on Vite + React + TypeScript and uses shadcn/ui patterns for the app shell, dashboards, and auth flows.

**Positioning:** This is the **primary cross-platform operational surface** — a **tablet-first PWA**, not a substitute for a native POS binary. It is honest about connectivity and offline limits.

## Local Dev

1. Install deps at repo root: `pnpm install`
2. Start the API and any required services in separate terminals.
3. Start Ops Web: `pnpm -C apps/ops-web dev`

## Visual Testing

### Playwright Visual Snapshots

Playwright visual tests require the API to be running and seeded (demo owner account from `apps/api/prisma/seed.ts`).

- Run: `pnpm -C apps/ops-web test:e2e:visual`
- Update snapshots: `pnpm -C apps/ops-web test:e2e:visual --update-snapshots`

If the tests time out, the API or web server is likely not running or not reachable.

### Storybook

- Start Storybook: `pnpm -C apps/ops-web storybook`
- Build Storybook: `pnpm -C apps/ops-web storybook:build`

### Chromatic

Chromatic expects `CHROMATIC_PROJECT_TOKEN` to be set in the environment.

- Run: `pnpm -C apps/ops-web chromatic`

## PWA scope (what to expect)

### Supported

- **Install:** Chromium-style browsers: one-tap install when `beforeinstallprompt` fires. **iPhone / iPad:** manual **Share → Add to Home Screen** (the app surfaces an honest in-product hint; there is no Apple install API).
- **Display:** `standalone`, **any orientation** (kitchen tablets in landscape are first-class).
- **Session recovery:** Refresh-token rotation via `/auth/refresh`; proactive refresh before JWT expiry; **session-expired** routing to sign-in; cache invalidation on successful refresh (`SessionNavBridge` + `SessionProactiveRefresh`).
- **Branch context:** Operations require a selected branch; `X-Branch-Id` is applied consistently on API calls.
- **Degraded connectivity:** Browser online/offline events; header badges for offline and realtime reconnect; stacking notices for offline + mutation queue; toast when the device comes back online (does not imply full sync).
- **Retry-safe reads:** `apiFetch` retries **GET/HEAD/OPTIONS** once after a transient network `TypeError` (not for POST/PUT/PATCH).
- **Limited mutation queue:** Dexie-backed queue for **close-bill only**, with runtime checks (`Idempotency-Key` + `X-Branch-Id` path match). See `offline-queue.ts`, `OFFLINE_REPLAY_BY_OPERATION` in `@restocafe/types`, and open orders cashier offline path.
- **Realtime:** Socket.IO when authenticated + branch selected; HTTP polling fallback when disconnected (see floor/kitchen/bar pages).
- **Bilingual / RTL:** Arabic and English UI strings; `dir`/`lang` on `<html>` (including a tiny pre-React bootstrap in `index.html` to reduce RTL flash).

### Explicitly not supported

- **Full offline venue operation** — no offline-first guarantee.
- **Native push notifications** — no Web Push / FCM / APNs product path in this app (device token API may exist on the server for future use only).
- **Background sync** for arbitrary mutations.
- **Cashier-grade reliability without network** — assume live server for tendering and confirmation.
- **Phone-primary UX** — phones are supported for **limited manager / glance workflows**; dense service flows expect a tablet or larger.

### Verification (automated)

From repo root:

```bash
pnpm -C apps/ops-web test
```

Includes API client GET network-retry tests, iOS install-surface helper tests, session navigation bridge tests, and EN/AR parity for `pwa.*` strings.

### Operational note

The cached shell may open while offline, but **live floor state, tickets, and most writes require connectivity**. Describe this product as **connectivity-aware**, not offline-first.

## Notes

- Visual snapshots rely on seeded demo owner credentials in `apps/ops-web/e2e/helpers/login.ts`.
- Locale and RTL: Storybook toolbar; Playwright uses a fixed locale/timezone for stable renders where configured.
