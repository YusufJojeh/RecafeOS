# Frontend Coverage Report (Strict Plan Execution)

## Baseline vs After

### ops-web (`apps/ops-web`)

- Baseline: lines `84.25%`, statements `84.25%`, functions `61.85%`, branches `77.13%`
- After: lines `87.35%`, statements `87.35%`, functions `72.59%`, branches `79.20%`
- Net gain: `+3.10` lines/statements, `+10.74` functions, `+2.07` branches

### landing (`apps/landing`)

- Baseline: lines `98.25%`, statements `98.25%`, functions `89.28%`, branches `72.52%`
- After: lines `99.06%`, statements `99.06%`, functions `93.10%`, branches `79.41%`
- Net gain: `+0.81` lines/statements, `+3.82` functions, `+6.89` branches

## Tests Added by Area

- `apps/ops-web/src/lib/support-console-fetch.test.ts`
  - Added success, non-JSON, JSON-error, and fallback HTTP error branches
- `apps/ops-web/src/lib/api-paths.test.ts`
  - Added complete path-builder coverage across branch/tenant/customer helpers
- `apps/ops-web/src/App.test.tsx`
  - Added authenticated guarded route and app-shell accessibility wrapper checks
- `apps/ops-web/src/pages/PilotPages.test.tsx`
  - Added pilot portfolio populated state and weekly report raw-details state
- `apps/ops-web/e2e/route-matrix.spec.ts`
  - Added public-menu backend failure scenario
  - Added authenticated-without-branch redirect scenario
- `apps/landing/src/i18n/context.test.tsx`
  - Added provider-guard throw path and storage-failure behavior
- `apps/landing/src/components/AnimateOnScroll.test.tsx`
  - Added intersection and disconnect cleanup behavior
- `apps/landing/src/test/render-landing.test.tsx`
  - Added coverage for shared landing render helper

## Shared Test Utilities Added

- `apps/ops-web/src/test/render-app.tsx`
- `apps/ops-web/src/test/fixtures.ts`
- `apps/landing/src/test/render-landing.tsx`

## Coverage Gaps by File (Key Under-100 Files)

### P0

- `apps/ops-web/src/pages/SetupPage.tsx` (`81.45%` lines, `56.52%` funcs, `65.59%` branches)
- `apps/ops-web/src/pages/CustomerLookupPage.tsx` (`79.42%` lines, `53.33%` funcs, `71.21%` branches)
- `apps/ops-web/src/pages/KitchenPage.tsx` (`82.83%` lines, `75.86%` branches)
- `apps/ops-web/src/pages/WeeklyDigestPage.tsx` (`78.12%` lines, `52.63%` branches)
- `apps/ops-web/src/lib/branch-realtime.tsx` (`62.15%` lines, `57.69%` branches)

### P1

- `apps/ops-web/src/pages/PilotDetailPage.tsx` (`89.09%` lines, `36.66%` funcs)
- `apps/ops-web/src/pages/SupportConsolePage.tsx` (`88.39%` lines, `26.08%` funcs)
- `apps/ops-web/src/pages/reports/DailyReportBody.tsx` (`81.84%` lines, `50%` branches)
- `apps/ops-web/src/pages/reports/TenantRollupSection.tsx` (`83.76%` lines, `16.66%` funcs)

### P2

- `apps/landing/src/components/LanguageSwitcher.tsx` (`94.44%` lines, `50%` funcs)
- `apps/landing/src/components/Navbar.tsx` (`98.07%` lines, `66.66%` funcs)
- `apps/landing/src/components/Button.tsx` (`88.09%` lines)
- `apps/landing/src/sections/FinalCTA.tsx` (`97.56%` lines)

## Strict-Blocking Residuals (Why Not 100 Yet)

- High-density operational pages (`SetupPage`, `CustomerLookupPage`, `PilotDetailPage`, `SupportConsolePage`) have many nested mutation and conditional paths still requiring additional scenario fixtures and API response variants.
- `branch-realtime.tsx` branch completion requires expanded socket lifecycle simulation (connect error, reconnect cadence, full event matrix).
- Some branch-only UI paths in landing components require additional targeted interaction tests (`LanguageSwitcher`, `Navbar`, style-variant branches in `Button`).
- `packages/types/src` is pure type/const export surface and is not currently included in app-level Vitest coverage commands; it needs either dedicated package test wiring or explicit documented exclusion in strict policy.

## Implementation Order for Next Closure Pass

1. Add realtime harness matrix for `branch-realtime.tsx`.
2. Add scenario-focused suites for `SetupPage` and `CustomerLookupPage` (permission, failure, disabled/empty permutations).
3. Expand `PilotDetailPage` and `SupportConsolePage` branch tests with route-param and per-action outcome matrix.
4. Complete report module branch matrix (`DailyReportBody`, `TenantRollupSection`).
5. Add landing component branch completion (`LanguageSwitcher`, `Navbar`, `Button`, `FinalCTA`, `Hero`).
6. Wire `packages/types` into a dedicated Vitest package run or declare explicit strict exclusion rationale.
