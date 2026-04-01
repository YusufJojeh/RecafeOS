# Playwright critical path (dine-in, prep, payment)

## 1. Chosen scenario and why

**Flow:** Login (seeded demo owner) → select **Main** branch → **Floor** shows table state → **API** creates a **dine-in** order on **T2** with **Classic Burger** + **Cola** (same contract as [`order-critical-flows.integration-spec.ts`](../../apps/api/test/integration/order-critical-flows.integration-spec.ts)) → **Kitchen** and **Bar** UIs advance prep tickets to **DELIVERED** → **API** marks **served** and **closes bill** (cash + `Idempotency-Key`) → **Floor** shows **T2** **AVAILABLE**.

**Why this path:** It is the highest-value end-to-end slice that uses **real ops-web screens** (login, branch, floor, kitchen, bar) while exercising **order → prep → payment → table release** behavior. The API fills gaps where the SPA has **no** order builder or close-bill UI yet—avoiding a flaky or huge UI build for the first E2E.

## 2. Missing testability in the current UI

- **No** cashier flow to open a table session, add line items, confirm, send to prep, serve, or pay from the browser.
- **Menu** page is read-only (no cart).
- **Floor** lists tables but has no actions.

The test uses **authenticated HTTP** (`page.request`) for those steps so staging validation still proves the **stack** works; the browser proves **staff-facing** queue and floor views.

## 3. Playwright structure

| Piece | Purpose |
|-------|---------|
| [`apps/ops-web/e2e/critical-path-dine-in.spec.ts`](../../apps/ops-web/e2e/critical-path-dine-in.spec.ts) | Main test (`@critical` tag) |
| [`e2e/helpers/login.ts`](../../apps/ops-web/e2e/helpers/login.ts) | Demo login + `branch-option-main` |
| [`e2e/helpers/session.ts`](../../apps/ops-web/e2e/helpers/session.ts) | Read `accessToken` / `branchId` from `localStorage` |
| [`e2e/helpers/api-base.ts`](../../apps/ops-web/e2e/helpers/api-base.ts) | `PLAYWRIGHT_API_URL` default `http://127.0.0.1:3000/api/v1` |
| [`e2e/helpers/dine-in-api.ts`](../../apps/ops-web/e2e/helpers/dine-in-api.ts) | Seed dine-in order; served + close |
| [`e2e/helpers/advance-prep-ui.ts`](../../apps/ops-web/e2e/helpers/advance-prep-ui.ts) | Click through prep until “No tickets” |

**UI hooks:** `data-testid` on [`floor-table-T*`](../../apps/ops-web/src/pages/FloorPage.tsx), [`prep-ticket-*`](../../apps/ops-web/src/pages/KitchenPage.tsx), [`branch-option-*`](../../apps/ops-web/src/pages/BranchSelectPage.tsx).

## 4. Fixtures / seeding requirements

- After a **database restore drill** on staging, you can run this spec against the restored stack to satisfy optional validation (F) in [`staging-restore-drill-checklist.md`](../operations/staging-restore-drill-checklist.md)—same seed expectations apply.
- Postgres with migrations applied and **`npm run prisma:seed -w api`** (or equivalent).
- Demo user **`owner@demo.local` / `demo12345`**, tenant **demo**, branch **main**.
- Floor tables **T1**, **T2**; menu items **Classic Burger**, **Cola** (see [`seed.ts`](../../apps/api/prisma/seed.ts) / provisioning).

## 5. Flake-risk mitigations

- **Stable selectors:** `getByLabel` for login, `data-testid` for branch and floor table **T2**, `prep-ticket-advance` for prep buttons.
- **No animation assertions;** explicit `toBeVisible` timeouts on headings and item names.
- **Order creation is synchronous API** (no race on “click add to cart”).
- **Idempotent close:** `idempotency-key` on close bill.
- **Advance loop** capped with a final **“No tickets”** expectation.

## 6. Future E2E expansion (not in scope now)

- Pure-UI order creation when product adds a cashier flow.
- Split payment / modifiers once exposed in SPA.
- Second browser tab / role (e.g. kitchen vs floor) under Redis + multi-replica.
- Visual regression only if needed.

## How to run

**Local (API + Vite already running)**

```bash
cd apps/ops-web
set PLAYWRIGHT_SKIP_WEBSERVER=1
npm run test:e2e:critical
```

**From repo root (Windows PowerShell example)**

```powershell
cd apps/ops-web
$env:PLAYWRIGHT_SKIP_WEBSERVER='1'
npm run test:e2e:critical
```

Ensure API is on **3000** or set **`PLAYWRIGHT_API_URL`** to your `http://host:port/api/v1`.

**CI / staging**

- Manual or scheduled workflow: [`.github/workflows/e2e-pilot.yml`](../../.github/workflows/e2e-pilot.yml) starts Postgres, Redis, migrates, seeds, runs API + Vite, then **`npm run test:e2e:critical`** alongside the pilot smoke test.

See also [`E2E_PILOT.md`](./E2E_PILOT.md) for environment parity.
