# Production-grade QA strategy — RestoCafe OS

This document defines coverage expectations, priorities, flaky-risk areas, automation layout, UAT for pilot restaurants, and the regression suite. Implementation lives in `apps/api/test/integration`, `apps/ops-web` (Vitest + Playwright), and unit specs under `apps/api/src/**/*.spec.ts`.

## 1. Test matrix

| Area | Scope | Tooling | What to prove |
|------|--------|---------|----------------|
| **Backend integration** | HTTP + real DB (seeded demo tenant) | Jest + Supertest + `AppModule` | End-to-end API contracts: auth, branch guards, order lifecycle, kitchen/bar tickets, merge/move, payments, reports, inventory, public QR waiter |
| **Frontend unit / component** | Isolated UI and client utilities | Vitest + Testing Library | Router shell, forms, hooks; pure helpers (offline queue, formatting) |
| **E2E (browser)** | Ops web against running API (or mocked) | Playwright | Login smoke; **pilot path** login → branch → kitchen ([`E2E_PILOT.md`](./E2E_PILOT.md)); **critical path** dine-in → kitchen/bar prep → pay ([`E2E_CRITICAL_PATH.md`](./E2E_CRITICAL_PATH.md), same workflow) |
| **Regression** | Repeatable subset of integration + e2e smoke | CI script `test:regression` | No broken auth, orders, health, login |
| **UAT** | Human pilot | Checklist below | Real devices, printers, staff habits, peak load |
| **Tenant isolation** | Cross-tenant access denied | Integration | JWT tenant vs branch URL, other tenant branch 403 |
| **Permissions** | Route-level RBAC | Integration | Missing `orders.discount`, `payments.close`, etc. → 403 |
| **State transitions** | Order + prep ticket FSM | Unit + integration | Invalid transitions 409; valid paths succeed |
| **Offline / retry** | IndexedDB queue | Vitest | Enqueue + drain order; idempotency contract documented separately |
| **WebSocket / live** | Realtime order/ticket events | Manual / staging | Socket auth, reconnect, multi-tab; automated E2E flaky — run tagged `@live` in staging |
| **Reports** | Daily sales aggregates | Integration | 200 + shape; branch timezone bounds (spot-check values vs SQL) |
| **Inventory-lite** | Stock list, adjust, recipe guardrails | Integration | List scoped to branch; adjust changes quantity; sale deduction on close (via order flow) |
| **Payment closure** | Single close, idempotency header | Integration | PAID + Payment row; optional idempotency replay |

### Critical flows (must be covered by automation + UAT)

| Flow | Automation target | Notes |
|------|-------------------|--------|
| Dine-in full cycle | Integration: session → order → line → confirm → prep → tickets → ready → served → pay | Uses seeded menu + stock |
| Takeaway full cycle | Integration: order without session | No table release |
| QR menu + call waiter | Integration: `GET public/.../menu`, `POST .../call-waiter` | Throttle-aware |
| Kitchen / bar split | Integration: burger (kitchen) + drink (bar) tickets | Two PATCH bases |
| Move order between tables | Integration: `move-table` | Two open sessions |
| Merge orders | Integration: `POST .../orders/merge` | Both DRAFT |
| Merge table sessions | Optional integration / UAT | `tables.manage` |
| Discount permission | Integration: role without `orders.discount` → 403 | |
| Payment close + table release | Integration: close + floor table AVAILABLE | Dine-in |
| Cancelled order | Integration: cancel from DRAFT/CONFIRMED | |
| Low stock | Integration/API: list stock; item with qty ≤ threshold | UI alert = UAT |
| Customer repeat visit | Integration: `closeBill` + `customerPhone` → visit row | |
| Tenant separation | Integration: existing `tenant-isolation` + data queries | |
| Branch filtering | Integration: `X-Branch-Id` vs URL | |

## 2. Priority of missing coverage (highest first)

1. **Full order lifecycle integration** (dine-in + takeaway + pay) — highest business risk.
2. **Permission matrix on branch-scoped routes** — security regressions.
3. **Kitchen ticket pipeline** — multi-step state machine easy to break.
4. **Reports numeric correctness** — cross-check sample day vs SQL in staging.
5. **Playwright beyond login** — needs stable test env + seed.
6. **WebSocket automated tests** — defer to staging job; high flake without harness.
7. **Visual / a11y regression** — not in scope unless product asks.

## 3. Flaky-risk scenarios

| Scenario | Risk | Mitigation |
|----------|------|------------|
| WebSocket connect in CI | Network, timing | Tag `@live`, run on schedule not every PR |
| Playwright + dev server + API | Ports, race | `reuseExistingServer`, health wait, `PLAYWRIGHT_BASE_URL` |
| Parallel integration tests on one DB | FK collisions, shared demo tenant | `runInBand`, unique slugs per test file, cleanup `afterAll` |
| Timezone report assertions | UTC vs branch TZ | Assert shape + order of magnitude; exact cents only with fixed clock |
| Payment idempotency | Redis when `REDIS_URL` (CI + staging), else memory | Integration asserts replay safety; CI provides Redis for distributed store |
| Seed data drift | Tests assume burger/colon menu | Load IDs from DB in `beforeAll` |

## 4. Recommended E2E structure (Playwright)

```
apps/ops-web/e2e/
  smoke.spec.ts          # Fast: login visible, title
  regression.spec.ts     # Auth shell + branch selector if present
  pilot-flow.spec.ts     # Full stack: login, Main branch, kitchen (needs API + seed)
  fixtures/
    auth.ts              # (future) login helper once test user stable
```

**Projects** (in `playwright.config.ts`):

- `smoke` — `grep @smoke`, no API dependency where possible.
- `regression` — broader; may skip in PR if `SKIP_E2E=1`.

**CI**: run `pnpm exec playwright test --project=smoke` on every PR; full regression nightly.

## 5. UAT checklist for pilot customers

**Venue setup**

- [ ] Branch timezone and currency match operations.
- [ ] Menu categories, items, modifiers, prices match paper menu.
- [ ] Floor plan tables match physical layout; QR links open correct branch menu.

**Service modes**

- [ ] Dine-in: open table, order, kitchen receives tickets, serve, pay, table free.
- [ ] Takeaway: order from counter flow without table; pay and receipt.
- [ ] Guest QR: browse menu, request waiter (if enabled), staff sees call.

**Roles**

- [ ] Staff without discount permission cannot apply discount.
- [ ] Only authorized role closes payment / opens cash drawer policy.

**Edge cases**

- [ ] Move order to another table mid-meal.
- [ ] Merge two open tabs (draft orders) correctly.
- [ ] Cancel order before payment; no stock/payment corruption (spot-check inventory).
- [ ] Network blip: ops screen recovers or shows error (offline queue behavior).

**Reporting**

- [ ] End-of-day totals match manual tally for a pilot day.

**Sign-off**: pilot manager name, date, branch id.

## 6. Regression suite definition

**Command**: `npm run test:regression` at repo root ([`package.json`](../../package.json)).

**Includes**:

- `apps/api`: `npm run test` — unit specs (order state, ticket state, pricing, branch-scope, datetime, auth).
- `apps/ops-web`: `npm run test` — Vitest (e.g. `App.test.tsx`, [`offline-queue.test.ts`](../../apps/ops-web/src/lib/offline-queue.test.ts)).
- `apps/ops-web`: `npm run test:e2e:smoke` — Playwright [`e2e/smoke.spec.ts`](../../apps/ops-web/e2e/smoke.spec.ts) (`@smoke` in title for `grep`).

**Related but not in default regression** (requires DB + seed):

- `npm run test:integration -w api` — see [`INTEGRATION.md`](INTEGRATION.md).

**Excludes** (unless nightly / manual): full Playwright regression catalog, websocket/multi-tab E2E, load tests.

**Green criteria**: `test:regression` passes; integration job passes when enabled in CI.
