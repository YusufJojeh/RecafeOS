# RestoCafe OS Frontend Public Audit and Inventory

## Scope

- Apps inspected:
  - `apps/ops-web` (staff operations + guest menu public route)
  - `apps/landing` (marketing/public single-page app)
- Primary public targets:
  - `/login`
  - `/m/:tenantSlug/:branchSlug/t/:token`
  - wildcard fallback (`*`) and root redirect (`/`)
  - landing sections/nav/footer links

## 1) Complete Route Map

### `apps/ops-web` routes

| Route | Component | Guard | Classification | Notes |
|---|---|---|---|---|
| `/` | `Navigate -> /floor` | None | Public entry redirect | Lands unauth users at login via `/floor` guard chain |
| `/login` | `LoginPage` | None | Public | Staff login + invite acceptance |
| `/branch` | `BranchSelectPage` | `RequireToken` | Semi-protected | Requires token, no branch required |
| `/m/:tenantSlug/:branchSlug/t/:token` | `PublicMenuPage` | None | Public | Guest QR menu/call-waiter flow |
| `/floor` | `FloorPage` | `RequireAuth` | Private | Requires token + branch |
| `/menu` | `MenuPage` | `RequireAuth` | Private | Lazy-loaded |
| `/kitchen` | `KitchenPage(station=KITCHEN)` | `RequireAuth` | Private | Lazy route wrapper |
| `/bar` | `KitchenPage(station=BAR)` | `RequireAuth` | Private | Lazy route wrapper |
| `/reports` | `ReportsPage` | `RequireAuth` | Private | Lazy-loaded |
| `/reports/shift-handoff` | `ShiftHandoffPage` | `RequireAuth` | Private | Lazy-loaded |
| `/stock` | `StockPage` | `RequireAuth` | Private | Lazy-loaded |
| `/weekly-digest` | `WeeklyDigestPage` | `RequireAuth` | Private | Lazy-loaded |
| `/orders` | `OpenOrdersPage` | `RequireAuth` | Private | |
| `/customers` | `CustomerLookupPage` | `RequireAuth` | Private | Lazy-loaded |
| `/setup` | `SetupPage` | `RequireAuth` | Private | Lazy-loaded |
| `/internal/support` | `SupportConsolePage` | Env flag route registration only | Internal | Only when `VITE_SUPPORT_CONSOLE=true/1` |
| `/internal/pilots` | `PilotPortfolioPage` | Env flag | Internal | |
| `/internal/pilots/weekly` | `PilotWeeklyPage` | Env flag | Internal | |
| `/internal/pilots/:tenantId` | `PilotDetailPage` | Env flag | Internal | |
| `*` | Inline `NotFoundPage` | None | Public fallback | Global not-found UX |

### `apps/landing` routes

- No router paths; single-page composed by `App.tsx` sections (`Hero`, `Features`, `FAQ`, `FinalCTA`, etc.).

## 2) Page Inventory Table

| Page/Surface | Layout/Chrome | Auth Requirement | Branch/Tenant Dependency | Primary Purpose | Key Actions | Backend Dependencies | Completeness Status |
|---|---|---|---|---|---|---|---|
| `LoginPage` | Self-contained card layout | None | Tenant optional at login response | Staff sign-in/invite acceptance | Sign in, invite accept, tenant pick | `/auth/login`, `/auth/accept-invite` | Strong; now covered for invite success/failure and redirect branches |
| `PublicMenuPage` | Public white card/mobile-first | None | URL params tenant/branch/token | Guest menu browse and waiter call | Call waiter, browse categories/items | Public menu GET + public call waiter POST | Improved: explicit empty state + invalid-link handling + disabled waiter button |
| `NotFoundPage` (`*`) | Minimal centered fallback | None | None | Recover from unknown URLs | “Go to Floor” link | None | Functional; links to guarded route chain |
| Root redirect (`/`) | Route redirect | None | None | Default entry normalization | Auto redirect | None | Correct chain to login for unauth users |
| Landing SPA (`apps/landing`) | Shared `Navbar` + sections + `Footer` | None | Locale context | Marketing/lead capture | Anchor navigation, CTA, WhatsApp, mailto | None (static content) | Visually complete; no automated tests currently |

## 3) Orphan / Incomplete / Unreachable Surfaces

### Orphan/unreachable

- No obvious orphan page components in `apps/ops-web/src/pages` relative to route registration.
- Internal routes are intentionally unreachable when `VITE_SUPPORT_CONSOLE` is off.

### Incomplete/weak

- Landing app has no test runner or test suite configured (`apps/landing/package.json` has no `test` script).
- Public not-found action always points to `/floor`; for unauth users this bounces to login (works, but messaging could be more explicit).
- `PublicMenuPage` lacked explicit empty-state UX before this pass (added).

## 4) Public / Private / Internal Classification

- Public: `/login`, `/m/:tenantSlug/:branchSlug/t/:token`, wildcard `*`, root redirect chain
- Semi-protected: `/branch` (token required, branch not required)
- Private: all `RequireAuth` ops routes (`/floor` through `/setup`)
- Internal: `/internal/*` gated by env route inclusion
- Public (separate app): landing SPA sections and anchors

## 5) Pages Requiring Deeper Audit First

1. `PublicMenuPage` (guest-facing, token-driven flow, mutation edge cases)
2. `LoginPage` (multi-branch auth UX + invite + tenant selection)
3. Fallback/redirect chain in `App.tsx` (`/`, `*`, `/branch`)
4. Landing navbar/footer CTA/link integrity and accessibility polish

## 6) Missing UX States Matrix (Focused)

| Surface | Loading | Error | Empty | Invalid Token/Param | Disabled | Retry/Reconnect | Notes |
|---|---|---|---|---|---|---|---|
| `LoginPage` | Pending button labels | API error shown | N/A | N/A | Pending disables actions | No explicit retry UI (manual retry via button) | Good baseline |
| `PublicMenuPage` | Loading text present | Error text present | Added “No items available” | Added invalid-link guard text/button disable | Call waiter disabled pending/invalid link | No explicit reconnect banner | Acceptable baseline |
| `NotFoundPage` | N/A | N/A | N/A | N/A | N/A | N/A | Minimal static fallback |
| Landing SPA | N/A | N/A | N/A | N/A | Mobile menu stateful | N/A | Static content app |

## 7) UX Problems and Correctness Issues

- Landing:
  - Placeholder WhatsApp number constant remains (`966500000000`) and should be production-configured.
  - No automated checks for anchor navigation, mobile menu behavior, or CTA link integrity.
- Public menu:
  - No explicit reconnect/stale semantics; relies on default React Query behavior.
- Fallback UX:
  - NotFound call-to-action text says “Go to Floor” even when many users are unauthenticated and will end up at login.

## 8) Required Tests (Public and Inventory-Driven)

### Implemented in this pass

- `apps/ops-web/src/pages/PublicMenuPage.test.tsx`
  - empty menu state
  - invalid session link disables waiter action
- `apps/ops-web/src/pages/LoginPage.test.tsx`
  - invite accept success
  - invite failure
  - authenticated redirect to `/floor` or `/branch`
- `apps/ops-web/src/App.test.tsx`
  - root redirect chain behavior
  - fallback action navigation behavior

### Still required

- Landing app:
  - navbar desktop/mobile anchor navigation
  - mobile menu open/close and `aria-expanded` behavior
  - footer external links (`wa.me`, `mailto`) integrity
- Public route deep-link e2e sweep:
  - unknown path -> not-found
  - public menu valid + invalid token param permutations

## 9) Implementation/Fix Plan (Next Pass)

1. Add landing test harness (Vitest + Testing Library) in `apps/landing` and cover navbar/footer/CTA anchor behavior.
2. Add Playwright public-route matrix cases for:
   - `/login`
   - `/m/...` valid token
   - `/m/...` invalid token/session
   - unknown path fallback
3. Improve not-found CTA copy to be auth-aware (optional minimal UX patch).
4. Add reconnect/retry affordance on `PublicMenuPage` if public API reliability requires explicit user feedback.
