# Frontend Test Matrix (Strict Coverage Program)

## Scope

- `apps/ops-web/src`
- `apps/landing/src`
- `packages/types/src`
- `apps/ops-web/e2e`

## Layers

- Unit: pure logic/hooks/stores/utilities
- Component: isolated UI component behavior
- Integration: page plus providers/router/query/store behavior
- Route/Page: route guards, lazy loading, page-level states
- E2E: browser-level user and operational flows

## Route/Page Matrix (ops-web)

| Route | File | Needed Layers | Why | Required Scenarios | Mocks/Fixtures |
|---|---|---|---|---|---|
| `/login` | `apps/ops-web/src/pages/LoginPage.tsx` | Unit, Integration, E2E | Auth entrypoint with multi-tenant and invite flows | login success/error, invite accept success/error, tenant picker path, suspended tenant message, keyboard tab flow | `/auth/login`, `/auth/accept-invite`, auth store fixture |
| `/branch` | `apps/ops-web/src/pages/BranchSelectPage.tsx` | Integration, E2E | branch context gate | loading/error, branch cap warning, selection nav, no token redirect | `/tenants/branches`, `/auth/me`, commerce fixture |
| `/floor` | `apps/ops-web/src/pages/FloorPage.tsx` | Integration, E2E | primary ops dashboard | loading/error/empty, occupied/available cards, ops strip visibility, refetch interval branch | tables fixture, ops-snapshot fixture, realtime connected/disconnected |
| `/kitchen` `/bar` | `apps/ops-web/src/pages/KitchenPage.tsx` | Unit, Integration, E2E | realtime-sensitive ticket workflow | loading/error/empty, next-status transitions, virtualized mode threshold, PATCH failure path | ticket list fixture, station-specific API fixture |
| `/orders` | `apps/ops-web/src/pages/OpenOrdersPage.tsx` | Integration, E2E | open bill ops + customer links | loading/error/empty, returning guest badge branch, virtualized list path | open-orders fixture variants |
| `/customers` | `apps/ops-web/src/pages/CustomerLookupPage.tsx` | Unit, Integration, E2E | form-heavy + permission-sensitive + destructive action | search min length, no matches, detail load error, manage actions allowed/blocked, archive confirm cancel/accept branches | customers fixtures, permissions fixture, window.confirm mock |
| `/stock` | `apps/ops-web/src/pages/StockPage.tsx` | Integration, E2E | operational low-stock indicator | loading/error, low badge branch, normal row branch | stock fixture low/normal |
| `/reports` | `apps/ops-web/src/pages/ReportsPage.tsx`, `apps/ops-web/src/pages/reports/*` | Unit, Integration, E2E | dense-data and permission-sensitive reporting | daily load/error, rollup permission on/off, demand load/error, all table/list branches and empty states | report fixtures (daily/rollup/snapshot/demand) |
| `/reports/shift-handoff` | `apps/ops-web/src/pages/ShiftHandoffPage.tsx` | Integration, E2E | shift summary operational handoff | loading/error/empty, low-stock slice branch | daily report fixture |
| `/weekly-digest` | `apps/ops-web/src/pages/WeeklyDigestPage.tsx` | Integration, E2E | weekly trend and comparison tables | loading/error, no prior baseline, no discounts/orders branches | weekly digest fixture variants |
| `/menu` | `apps/ops-web/src/pages/MenuPage.tsx` | Unit, Integration, E2E | import flow with validation/apply branches | dry-run success/error, apply disabled/enabled, parse errors | menu fixture, import payload fixtures |
| `/setup` | `apps/ops-web/src/pages/SetupPage.tsx` | Unit, Integration, E2E | permission-sensitive setup + form workflows | forbidden path, ready/not-ready path, go-live ack, branch toggles, feedback submit success/error, QR preview branches | onboarding/config/commerce fixtures, mutation fixtures |
| `/m/:tenantSlug/:branchSlug/t/:token` | `apps/ops-web/src/pages/PublicMenuPage.tsx` | Integration, E2E | public flow and limited mobile support | invalid params, menu loading/error/empty, call waiter success/error | public menu fixture, call waiter mutation fixture |
| `/internal/support` | `apps/ops-web/src/pages/SupportConsolePage.tsx` | Unit, Integration, E2E | permission-sensitive internal operations and heavy forms | save-session, missing key, each action path success/error, audit query options branches | support API fixture map, sessionStorage fixture |
| `/internal/pilots` | `apps/ops-web/src/pages/PilotPortfolioPage.tsx` | Integration, E2E | pilot portfolio operational monitoring | missing key, empty list, populated table path, refresh path | support pilots fixture |
| `/internal/pilots/weekly` | `apps/ops-web/src/pages/PilotWeeklyPage.tsx` | Integration, E2E | dense weekly health table | missing key, loading/error, since param path, raw-json details path | weekly pilot fixture |
| `/internal/pilots/:tenantId` | `apps/ops-web/src/pages/PilotDetailPage.tsx` | Unit, Integration, E2E | largest internal form surface | load all path, submit feedback success/error, triage save/cancel, filters and onboarding branches | detailed pilot fixtures, operator header fixture |
| route fallback | `apps/ops-web/src/App.tsx` | Integration, Route, E2E | route guard and fallback correctness | unauth redirects, token-without-branch redirect, wildcard page, skip-link/main focus | auth store fixture |

## Shared Component Matrix

| File | Layers | Required Scenarios |
|---|---|---|
| `apps/ops-web/src/components/OperationalStrip.tsx` | Unit, Component | each row condition on/off, no-data null branch, status role |
| `apps/ops-web/src/components/CloseOfDayPanel.tsx` | Unit, Component | open-shift alert/no-alert, flags severity rendering, links |
| `apps/landing/src/components/*` | Component | prop variants, interactive controls, aria/semantic output |

## Hook/Utility Matrix

| File | Layers | Required Scenarios |
|---|---|---|
| `apps/ops-web/src/lib/api.ts` | Unit | every path builder/function and error parser branch |
| `apps/ops-web/src/lib/branch-realtime.tsx` | Unit, Integration | connect/disconnect, event invalidation, fallback behavior |
| `apps/ops-web/src/lib/offline-queue.ts` | Unit, Integration | enqueue/dequeue/retry, storage read/write fail branches |
| `apps/ops-web/src/lib/use-tab-visible.ts` | Unit | visibility true/false transitions |
| `apps/ops-web/src/lib/support-console-fetch.ts` | Unit | key selection read/write/legacy, headers, error branches |
| `apps/ops-web/src/lib/auth-store.ts` | Unit | set/clear/branch/tenant transitions |
| `apps/landing/src/i18n/context.tsx` | Unit, Component | language switch, direction branch, provider fallback |
| `packages/types/src/realtime.ts` | Unit | runtime-export branch and schema-adjacent checks |

## Special-Capability Coverage

- Permission-sensitive screens: `ReportsPage`, `SetupPage`, `CustomerLookupPage`, all `/internal/*` pages.
- Branch-context-sensitive screens: all guarded ops screens (`/floor`, `/kitchen`, `/bar`, `/orders`, `/reports`, `/setup`, `/stock`, `/customers`, `/weekly-digest`, `/menu`).
- Realtime-sensitive: `KitchenPage`, `OpenOrdersPage`, `FloorPage`, `OperationalStrip` provider interactions.
- Offline/reconnect-sensitive: `offline-queue.ts` unit/integration + E2E reconnect smoke for queued action replay.

## Required Shared Fixtures/Utils

- `renderWithAppProviders` (router + query + auth store + branch context)
- API fixture factories: auth, reports, orders, customers, support internal
- Permission and branch-context fixture builder
- Realtime socket mock harness with explicit event triggers
- Offline queue storage + network toggle harness
- Route guard helper for path+store assertions
