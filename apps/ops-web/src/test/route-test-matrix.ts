export type RouteStateCoverage = {
  route: string;
  page: string;
  states: Array<'loading' | 'error' | 'empty' | 'disabled' | 'forbidden' | 'stale' | 'reconnect'>;
  testFiles: string[];
};

/**
 * Living matrix used during frontend completeness hardening.
 * Keeps route-level UX state obligations tied to concrete tests.
 */
export const routeTestMatrix: RouteStateCoverage[] = [
  {
    route: '/login',
    page: 'LoginPage',
    states: ['error', 'disabled'],
    testFiles: [
      'src/pages/LoginPage.test.tsx',
      'src/App.test.tsx',
      'e2e/smoke.spec.ts',
      'e2e/route-matrix.spec.ts',
    ],
  },
  {
    route: '/branch',
    page: 'BranchSelectPage',
    states: ['loading', 'error', 'empty'],
    testFiles: [
      'src/pages/BranchSelectPage.test.tsx',
      'src/App.test.tsx',
      'e2e/route-matrix.spec.ts',
    ],
  },
  {
    route: '/m/:tenantSlug/:branchSlug/t/:token',
    page: 'PublicMenuPage',
    states: ['loading', 'error', 'empty', 'disabled'],
    testFiles: ['src/pages/PublicMenuPage.test.tsx', 'e2e/route-matrix.spec.ts'],
  },
  {
    route: '/floor',
    page: 'FloorPage',
    states: ['loading', 'error', 'empty', 'reconnect', 'stale'],
    testFiles: [
      'src/pages/FloorPage.test.tsx',
      'e2e/error-handling.spec.ts',
      'e2e/critical-path-dine-in.spec.ts',
      'e2e/retention-acceptance.spec.ts',
    ],
  },
  {
    route: '/menu',
    page: 'MenuPage',
    states: ['loading', 'error', 'disabled'],
    testFiles: ['src/pages/MenuPage.test.tsx', 'e2e/menu-management.spec.ts'],
  },
  {
    route: '/kitchen',
    page: 'KitchenPage',
    states: ['loading', 'error', 'empty', 'disabled', 'reconnect', 'stale'],
    testFiles: [
      'src/pages/KitchenPage.test.tsx',
      'e2e/error-handling.spec.ts',
      'e2e/critical-path-dine-in.spec.ts',
      'e2e/pilot-flow.spec.ts',
    ],
  },
  {
    route: '/bar',
    page: 'KitchenPage(BAR)',
    states: ['loading', 'error', 'empty', 'disabled', 'reconnect', 'stale'],
    testFiles: ['src/pages/KitchenPage.test.tsx', 'e2e/critical-path-dine-in.spec.ts'],
  },
  {
    route: '/reports',
    page: 'ReportsPage',
    states: ['loading', 'error', 'forbidden', 'empty'],
    testFiles: [
      'src/pages/ReportsPage.test.tsx',
      'src/pages/reports/DailyReportBody.test.tsx',
      'src/pages/reports/TenantRollupSection.test.tsx',
      'e2e/route-matrix.spec.ts',
      'e2e/retention-acceptance.spec.ts',
    ],
  },
  {
    route: '/reports/shift-handoff',
    page: 'ShiftHandoffPage',
    states: ['loading', 'error', 'empty'],
    testFiles: ['src/pages/ShiftHandoffPage.test.tsx', 'e2e/route-matrix.spec.ts'],
  },
  {
    route: '/stock',
    page: 'StockPage',
    states: ['loading', 'empty'],
    testFiles: [
      'src/pages/StockPage.test.tsx',
      'e2e/stock-management.spec.ts',
      'e2e/route-matrix.spec.ts',
    ],
  },
  {
    route: '/weekly-digest',
    page: 'WeeklyDigestPage',
    states: ['loading', 'error', 'empty'],
    testFiles: [
      'src/pages/WeeklyDigestPage.test.tsx',
      'e2e/route-matrix.spec.ts',
      'e2e/retention-acceptance.spec.ts',
    ],
  },
  {
    route: '/orders',
    page: 'OpenOrdersPage',
    states: ['loading', 'error', 'empty'],
    testFiles: ['src/pages/OpenOrdersPage.test.tsx', 'e2e/route-matrix.spec.ts'],
  },
  {
    route: '/customers',
    page: 'CustomerLookupPage',
    states: ['loading', 'error', 'empty', 'forbidden', 'disabled'],
    testFiles: ['src/pages/CustomerLookupPage.test.tsx', 'e2e/customer-lookup.spec.ts'],
  },
  {
    route: '/setup',
    page: 'SetupPage',
    states: ['loading', 'error', 'forbidden', 'disabled', 'empty'],
    testFiles: ['src/pages/SetupPage.test.tsx', 'e2e/route-matrix.spec.ts'],
  },
  {
    route: '/internal/support',
    page: 'SupportConsolePage',
    states: ['loading', 'error', 'disabled'],
    testFiles: ['src/pages/SupportConsolePage.test.tsx', 'e2e/internal-support.spec.ts'],
  },
  {
    route: '/internal/pilots',
    page: 'PilotPortfolioPage',
    states: ['loading', 'error', 'empty'],
    testFiles: ['src/pages/PilotPages.test.tsx', 'e2e/internal-support.spec.ts'],
  },
  {
    route: '/internal/pilots/weekly',
    page: 'PilotWeeklyPage',
    states: ['loading', 'error', 'empty'],
    testFiles: ['src/pages/PilotPages.test.tsx', 'e2e/internal-support.spec.ts'],
  },
  {
    route: '/internal/pilots/:tenantId',
    page: 'PilotDetailPage',
    states: ['loading', 'error', 'empty', 'disabled'],
    testFiles: ['src/pages/PilotPages.test.tsx', 'e2e/internal-support.spec.ts'],
  },
];
