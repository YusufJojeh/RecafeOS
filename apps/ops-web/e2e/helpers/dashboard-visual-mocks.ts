import type { Page, Route } from '@playwright/test';

const ALL_PERMISSIONS = [
  'reports.view',
  'reports.tenant_rollups',
  'customers.view',
  'customers.manage',
  'settings.manage',
];

const BRANCH_LIST = [
  { id: 'branch_main', name: 'Main Branch', slug: 'main' },
  { id: 'branch_patio', name: 'Patio Branch', slug: 'patio' },
];

const OPS_SNAPSHOT = {
  readyForGoLive: false,
  blockingIncompleteCount: 2,
  lowStockCount: 3,
  openShiftPresent: true,
};

const TABLES = [
  {
    id: 'table_t1',
    label: 'T1',
    status: 'AVAILABLE',
    sessions: [],
  },
  {
    id: 'table_t2',
    label: 'T2',
    status: 'OCCUPIED',
    sessions: [{ id: 'session_t2', guestCount: 3 }],
  },
  {
    id: 'table_t3',
    label: 'T3',
    status: 'AVAILABLE',
    sessions: [],
  },
  {
    id: 'table_t4',
    label: 'T4',
    status: 'OCCUPIED',
    sessions: [{ id: 'session_t4', guestCount: 2 }],
  },
];

const OPEN_ORDERS = {
  items: [
    {
      id: 'order_live_1',
      status: 'READY',
      type: 'DINE_IN',
      customerId: 'customer_1',
      returningGuest: true,
      subtotalMinor: 3850,
      totalMinor: 4200,
      createdAt: '2026-03-30T09:15:00.000Z',
      tableSession: {
        id: 'session_t2',
        guestCount: 3,
        status: 'OPEN',
        floorTableId: 'table_t2',
      },
    },
    {
      id: 'order_live_2',
      status: 'SERVED',
      type: 'TAKEAWAY',
      customerId: null,
      returningGuest: false,
      subtotalMinor: 2400,
      totalMinor: 2400,
      createdAt: '2026-03-30T10:30:00.000Z',
      tableSession: null,
    },
  ],
  nextCursor: null,
};

const MENU_CATEGORIES = [
  {
    id: 'cat_mains',
    name: 'Mains',
    items: [
      { id: 'item_burger', name: 'Classic Burger', priceMinor: 1299, available: true },
      { id: 'item_pasta', name: 'Truffle Pasta', priceMinor: 1499, available: true },
    ],
  },
  {
    id: 'cat_drinks',
    name: 'Cold Drinks',
    items: [
      { id: 'item_cola', name: 'Cola', priceMinor: 350, available: true },
      { id: 'item_iced_tea', name: 'Iced Tea', priceMinor: 425, available: false },
    ],
  },
];

const KITCHEN_TICKETS = [
  {
    id: 'kt_1',
    status: 'NEW',
    orderItem: { menuItem: { name: 'Classic Burger' } },
  },
  {
    id: 'kt_2',
    status: 'PREPARING',
    orderItem: { menuItem: { name: 'Truffle Pasta' } },
  },
  {
    id: 'kt_3',
    status: 'READY',
    orderItem: { menuItem: { name: 'Cheesecake Slice' } },
  },
];

const BAR_TICKETS = [
  {
    id: 'bt_1',
    status: 'NEW',
    orderItem: { menuItem: { name: 'Cola' } },
  },
  {
    id: 'bt_2',
    status: 'READY',
    orderItem: { menuItem: { name: 'Fresh Lime Soda' } },
  },
];

const DAILY_REPORT = {
  totalSalesMinor: 452300,
  orderCount: 126,
  averageOrderValueMinor: 3590,
  sameWeekdayBenchmark: {
    priorSameWeekdaysSampled: 4,
    medianNetSalesMinor: 398400,
    medianOrderCount: 114,
  },
  salesByOrderType: {
    DINE_IN: 278100,
    TAKEAWAY: 118400,
    DELIVERY: 55800,
  },
  orderCountByOrderType: {
    DINE_IN: 72,
    TAKEAWAY: 34,
    DELIVERY: 20,
  },
  topItems: [
    { name: 'Classic Burger', qty: 26, revenue: 33774 },
    { name: 'Truffle Pasta', qty: 18, revenue: 26982 },
    { name: 'Cola', qty: 42, revenue: 14700 },
  ],
  salesByCategory: [
    { name: 'Mains', revenueMinor: 262000, qty: 56 },
    { name: 'Drinks', revenueMinor: 86300, qty: 64 },
    { name: 'Desserts', revenueMinor: 31200, qty: 18 },
  ],
  paymentsByMethod: {
    CASH: 127500,
    CARD: 301600,
    OTHER: 23200,
  },
  summary: {
    grossSalesMinor: 478900,
    netSalesMinor: 452300,
    totalDiscountMinor: 26600,
  },
  hourlySales: [
    { hour: 8, orderCount: 6, salesMinor: 13200 },
    { hour: 9, orderCount: 10, salesMinor: 22800 },
    { hour: 10, orderCount: 12, salesMinor: 31200 },
    { hour: 11, orderCount: 16, salesMinor: 48600 },
    { hour: 12, orderCount: 21, salesMinor: 72100 },
    { hour: 13, orderCount: 24, salesMinor: 89400 },
    { hour: 14, orderCount: 13, salesMinor: 40100 },
    { hour: 15, orderCount: 9, salesMinor: 25400 },
    { hour: 16, orderCount: 5, salesMinor: 14800 },
    { hour: 17, orderCount: 10, salesMinor: 33800 },
    { hour: 18, orderCount: 22, salesMinor: 66400 },
    { hour: 19, orderCount: 24, salesMinor: 78200 },
  ],
  cancellations: {
    count: 3,
    lostSubtotalMinor: 5400,
    byReason: [
      { reason: 'Kitchen delay', count: 2, lostSubtotalMinor: 3600 },
      { reason: 'Customer changed mind', count: 1, lostSubtotalMinor: 1800 },
    ],
  },
  discounts: {
    ordersWithDiscountCount: 12,
    totalDiscountMinor: 26600,
    topReasons: [
      { reason: 'Loyalty comp', count: 5 },
      { reason: 'Staff recovery', count: 4 },
      { reason: 'Promo hour', count: 3 },
    ],
  },
  cashiers: [
    {
      userId: 'cashier_1',
      displayName: 'Layla N',
      paymentsTotalMinor: 258900,
      orderCount: 66,
    },
    {
      userId: 'cashier_2',
      displayName: 'Omar H',
      paymentsTotalMinor: 193400,
      orderCount: 60,
    },
  ],
  shifts: [
    {
      id: 'shift_am',
      openedAt: '2026-03-30T05:30:00.000Z',
      closedAt: '2026-03-30T13:00:00.000Z',
      orderCount: 58,
      salesMinor: 201200,
    },
    {
      id: 'shift_pm',
      openedAt: '2026-03-30T13:00:00.000Z',
      closedAt: null,
      orderCount: 68,
      salesMinor: 251100,
    },
  ],
  topCustomers: [
    {
      customerId: 'customer_1',
      phone: '+155555501',
      name: 'Aisha Kareem',
      ordersCount: 4,
      revenueMinor: 18600,
    },
    {
      customerId: 'customer_2',
      phone: '+155555502',
      name: 'Karim Salem',
      ordersCount: 3,
      revenueMinor: 14900,
    },
  ],
  visits: {
    visitsRecorded: 87,
    repeatVisitsAtBranch: 29,
    firstTimeVisitsAtBranch: 58,
  },
  stock: {
    lowStockItems: [
      {
        id: 'stock_1',
        name: 'Burger buns',
        quantity: '12',
        lowThreshold: '18',
        unit: 'pcs',
        severityRatio: 0.67,
        linkedToTopSeller: true,
      },
      {
        id: 'stock_2',
        name: 'Cola cans',
        quantity: '10',
        lowThreshold: '20',
        unit: 'pcs',
        severityRatio: 0.5,
        linkedToTopSeller: true,
      },
      {
        id: 'stock_3',
        name: 'Lime juice',
        quantity: '2',
        lowThreshold: '6',
        unit: 'ltr',
        severityRatio: 0.33,
        linkedToTopSeller: false,
      },
    ],
  },
  flags: [
    {
      code: 'OPEN_SHIFT',
      severity: 'warn',
      message: 'One shift remains open and should be closed before final sign-off.',
    },
    {
      code: 'LOW_STOCK_TOP_ITEM',
      severity: 'risk',
      message: 'Top-selling items are linked to low stock and need replenishment.',
    },
  ],
};

const VISIT_SIGNALS = {
  windowDays: 30,
  since: '2026-03-01T00:00:00.000Z',
  branchId: 'branch_main',
  visitsRecorded: 412,
  uniqueVisitors: 268,
  repeatVisitors: 96,
  singleVisitVisitors: 172,
};

const DEMAND_PROFILE = {
  semantics: 'branch_local_window',
  branchTimezone: 'Europe/Istanbul',
  window: {
    startDay: '2026-03-02',
    endDay: '2026-03-29',
    days: 28,
  },
  totalSalesMinor: 11240000,
  paidOrderCount: 2840,
  hourlySales: [
    { hour: 8, orderCount: 88, salesMinor: 312000 },
    { hour: 9, orderCount: 120, salesMinor: 458000 },
    { hour: 10, orderCount: 130, salesMinor: 501000 },
    { hour: 11, orderCount: 154, salesMinor: 628000 },
    { hour: 12, orderCount: 232, salesMinor: 994000 },
    { hour: 13, orderCount: 268, salesMinor: 1145000 },
    { hour: 18, orderCount: 244, salesMinor: 1032000 },
    { hour: 19, orderCount: 287, salesMinor: 1226000 },
  ],
  peakContiguousHours: {
    startHour: 12,
    endHourExclusive: 14,
    salesMinor: 2139000,
    shareOfWindowSalesPct: 19.03,
  },
};

const TENANT_ROLLUP = {
  semantics: 'tenant_paid_orders_utc_window',
  fromUtc: '2026-03-24T00:00:00.000Z',
  toUtcInclusive: '2026-03-30T23:59:59.999Z',
  paidAtWindow: {
    start: '2026-03-24T00:00:00.000Z',
    endExclusive: '2026-03-31T00:00:00.000Z',
  },
  branchLimit: 10,
  branchIdsIncluded: ['branch_main', 'branch_patio'],
  branchesInScope: [
    { branchId: 'branch_main', name: 'Main Branch', slug: 'main' },
    { branchId: 'branch_patio', name: 'Patio Branch', slug: 'patio' },
  ],
  netPaidSalesMinor: 824500,
  paidOrderCount: 231,
  averageTicketMinor: 3569,
  salesByOrderType: {
    DINE_IN: 496300,
    TAKEAWAY: 215700,
    DELIVERY: 112500,
  },
  orderCountByOrderType: {
    DINE_IN: 124,
    TAKEAWAY: 71,
    DELIVERY: 36,
  },
  topBranchesBySales: [
    {
      branchId: 'branch_main',
      name: 'Main Branch',
      netPaidSalesMinor: 552300,
      paidOrderCount: 149,
    },
    {
      branchId: 'branch_patio',
      name: 'Patio Branch',
      netPaidSalesMinor: 272200,
      paidOrderCount: 82,
    },
  ],
  discountPressure: {
    totalDiscountMinor: 42200,
    ordersWithDiscountCount: 21,
  },
  priorPeriod: {
    semantics: 'same_duration_utc_immediately_before',
    paidAtWindow: {
      start: '2026-03-17T00:00:00.000Z',
      endExclusive: '2026-03-24T00:00:00.000Z',
    },
    netPaidSalesMinor: 761400,
    paidOrderCount: 216,
  },
};

const BRANCH_SNAPSHOT = {
  semantics: 'branch_day_snapshot',
  date: '2026-03-30',
  branchLimit: 10,
  branches: [
    {
      branchId: 'branch_main',
      name: 'Main Branch',
      slug: 'main',
      branchTimezone: 'Europe/Istanbul',
      netPaidSalesMinor: 452300,
      paidOrderCount: 126,
    },
    {
      branchId: 'branch_patio',
      name: 'Patio Branch',
      slug: 'patio',
      branchTimezone: 'Europe/Istanbul',
      netPaidSalesMinor: 216100,
      paidOrderCount: 64,
    },
  ],
};

const WEEKLY_DIGEST = {
  semantics: 'branch_local_7_calendar_days_vs_prior_7',
  branchId: 'branch_main',
  branchName: 'Main Branch',
  branchTimezone: 'Europe/Istanbul',
  calendarWindow: {
    startDay: '2026-03-24',
    endDay: '2026-03-30',
    startUtc: '2026-03-23T21:00:00.000Z',
    endUtc: '2026-03-30T21:00:00.000Z',
  },
  priorCalendarWindow: {
    startDay: '2026-03-17',
    endDay: '2026-03-23',
    startUtc: '2026-03-16T21:00:00.000Z',
    endUtc: '2026-03-23T21:00:00.000Z',
  },
  netPaidSalesMinor: 824500,
  paidOrderCount: 231,
  priorPeriod: {
    netPaidSalesMinor: 761400,
    paidOrderCount: 216,
    salesDeltaPct: 8.29,
  },
  setup: { readyForGoLive: false, blockingIncompleteCount: 2 },
  topIssue: {
    kind: 'stock_risk',
    message: 'Top-selling beverages are linked to low stock.',
  },
  weekdayComparison: [
    { dow: 2, netSalesMinor: 102200, priorNetSalesMinor: 96800, orderCount: 29, priorOrderCount: 27 },
    { dow: 3, netSalesMinor: 114500, priorNetSalesMinor: 107900, orderCount: 31, priorOrderCount: 30 },
    { dow: 4, netSalesMinor: 109400, priorNetSalesMinor: 103600, orderCount: 30, priorOrderCount: 28 },
    { dow: 5, netSalesMinor: 128300, priorNetSalesMinor: 120200, orderCount: 34, priorOrderCount: 32 },
    { dow: 6, netSalesMinor: 142700, priorNetSalesMinor: 131000, orderCount: 39, priorOrderCount: 37 },
    { dow: 0, netSalesMinor: 119100, priorNetSalesMinor: 110500, orderCount: 33, priorOrderCount: 31 },
    { dow: 1, netSalesMinor: 108300, priorNetSalesMinor: 91400, orderCount: 35, priorOrderCount: 31 },
  ],
  orderTypeMix: {
    current: {
      salesByOrderType: { DINE_IN: 496300, TAKEAWAY: 215700, DELIVERY: 112500 },
      orderCountByOrderType: { DINE_IN: 124, TAKEAWAY: 71, DELIVERY: 36 },
    },
    prior: {
      salesByOrderType: { DINE_IN: 462400, TAKEAWAY: 204300, DELIVERY: 94700 },
      orderCountByOrderType: { DINE_IN: 118, TAKEAWAY: 68, DELIVERY: 30 },
    },
  },
  discountTrends: {
    current: [
      { reason: 'Loyalty comp', count: 6, discountMinor: 13800 },
      { reason: 'Service recovery', count: 4, discountMinor: 9400 },
    ],
    prior: [
      { reason: 'Loyalty comp', count: 5, discountMinor: 11000 },
      { reason: 'Promo hour', count: 3, discountMinor: 7200 },
    ],
  },
};

const STOCK_ROWS = [
  { id: 'stock_1', name: 'Burger buns', quantity: '12', lowThreshold: '18', unit: 'pcs' },
  { id: 'stock_2', name: 'Ground beef', quantity: '24', lowThreshold: '16', unit: 'kg' },
  { id: 'stock_3', name: 'Cola cans', quantity: '10', lowThreshold: '20', unit: 'pcs' },
  { id: 'stock_4', name: 'Lime juice', quantity: '2', lowThreshold: '6', unit: 'ltr' },
];

const ONBOARDING_STATUS = {
  branchSlug: 'main',
  tenantSlug: 'demo',
  publicMenuUrlTemplate: 'https://app.restocafe.test/m/demo/main/t/{sessionToken}',
  appPublicUrlConfigured: true,
  steps: [
    {
      id: 'catalog',
      label: 'Menu catalog verified',
      done: true,
      tier: 'blocking',
      why: 'Guests need a complete menu before opening service.',
      nextPath: '/menu',
    },
    {
      id: 'staff',
      label: 'Staff invites sent',
      done: true,
      tier: 'blocking',
      why: 'Service roles need live credentials before launch.',
      nextPath: '/setup',
    },
    {
      id: 'inventory',
      label: 'Inventory thresholds reviewed',
      done: false,
      tier: 'blocking',
      why: 'Low-stock alerting needs realistic thresholds to be useful.',
      nextPath: '/stock',
    },
    {
      id: 'session',
      label: 'Pilot dry run completed',
      done: false,
      tier: 'recommended',
      why: 'A live table session validates the guest QR path before launch.',
      nextPath: '/floor',
      snoozedUntil: null,
      dismissed: false,
    },
  ],
  progressPercent: 68,
  blockingIncompleteCount: 1,
  readyForGoLive: false,
  goLiveAcknowledgedAt: null,
};

const CONFIG_SNAPSHOT = {
  branch: {
    id: 'branch_main',
    name: 'Main Branch',
    slug: 'main',
    timezone: 'Europe/Istanbul',
    currency: 'USD',
    settings: { qrOrderingEnabled: true, qrCallWaiterEnabled: true },
  },
  environment: {
    appPublicUrlConfigured: true,
    publicMenuUrlTemplate: 'https://app.restocafe.test/m/demo/main/t/{sessionToken}',
  },
};

const COMMERCE = {
  subscriptionPlan: 'pilot',
  billingStatus: 'active',
  trialEndsAt: null,
  maxBranches: 3,
  branchesInUse: 2,
  maxUsers: 12,
  usersInUse: 7,
  menuItemsInCatalog: 44,
  features: {
    qrOrdering: true,
    inventory: true,
    apiAccess: true,
    aiDailySummary: true,
    aiWeeklyDigest: true,
    aiLowStockCommentary: true,
    aiUnderperformingItems: true,
    aiBranchCompare: true,
    aiPromotionIdeas: true,
    aiSocialDrafts: false,
  },
  access: { ok: true },
  limits: {
    maxBranches: 3,
    branchesInUse: 2,
    maxUsers: 12,
    usersInUse: 7,
  },
};

const REPEAT_CUSTOMERS = {
  days: 90,
  customers: [
    {
      customerId: 'customer_1',
      phone: '+155555501',
      name: 'Aisha Kareem',
      paidOrderCount: 8,
      netPaidSalesMinor: 42600,
    },
    {
      customerId: 'customer_2',
      phone: '+155555502',
      name: 'Karim Salem',
      paidOrderCount: 6,
      netPaidSalesMinor: 31900,
    },
  ],
};

function json(body: unknown): string {
  return JSON.stringify(body);
}

async function fulfillJson(route: Route, body: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: json(body),
  });
}

export async function seedDashboardSession(page: Page, branchId = 'branch_main'): Promise<void> {
  await page.addInitScript((value: string) => {
    localStorage.setItem('accessToken', 'visual-test-token');
    localStorage.setItem('refreshToken', 'visual-test-refresh');
    localStorage.setItem('tenantId', 'tenant_demo');
    localStorage.setItem('preferredTenantSlug', 'demo');
    localStorage.setItem('branchId', value);
  }, branchId);
}

export async function installDashboardMocks(page: Page): Promise<void> {
  await page.route('**/api/v1/auth/me', async (route) => {
    await fulfillJson(route, {
      userId: 'visual-user',
      email: 'visual@test',
      displayName: 'Visual',
      tenantId: 'tenant_demo',
      permissions: ALL_PERMISSIONS,
      defaultBranchId: null,
      branchAccessScope: 'ALL_TENANT_BRANCHES',
    });
  });

  await page.route('**/api/v1/tenants/branches', async (route) => {
    await fulfillJson(route, BRANCH_LIST);
  });

  await page.route('**/api/v1/tenants/commerce', async (route) => {
    await fulfillJson(route, COMMERCE);
  });

  await page.route('**/api/v1/tenants/branches/**/ops-snapshot', async (route) => {
    await fulfillJson(route, OPS_SNAPSHOT);
  });

  await page.route('**/api/v1/branches/**/tables', async (route) => {
    await fulfillJson(route, TABLES);
  });

  await page.route('**/api/v1/branches/**/orders', async (route) => {
    await fulfillJson(route, OPEN_ORDERS);
  });

  await page.route('**/api/v1/branches/**/menu/categories', async (route) => {
    await fulfillJson(route, MENU_CATEGORIES);
  });

  await page.route('**/api/v1/branches/**/kitchen/tickets**', async (route) => {
    await fulfillJson(route, KITCHEN_TICKETS);
  });

  await page.route('**/api/v1/branches/**/bar/tickets**', async (route) => {
    await fulfillJson(route, BAR_TICKETS);
  });

  await page.route('**/api/v1/branches/**/reports/daily**', async (route) => {
    await fulfillJson(route, DAILY_REPORT);
  });

  await page.route('**/api/v1/branches/**/reports/weekly-digest', async (route) => {
    await fulfillJson(route, WEEKLY_DIGEST);
  });

  await page.route('**/api/v1/branches/**/reports/demand-profile**', async (route) => {
    await fulfillJson(route, DEMAND_PROFILE);
  });

  await page.route('**/api/v1/branches/**/customers/visit-signals', async (route) => {
    await fulfillJson(route, VISIT_SIGNALS);
  });

  await page.route('**/api/v1/tenants/reports/tenant-rollup**', async (route) => {
    await fulfillJson(route, TENANT_ROLLUP);
  });

  await page.route('**/api/v1/tenants/reports/branch-snapshot**', async (route) => {
    await fulfillJson(route, BRANCH_SNAPSHOT);
  });

  await page.route('**/api/v1/tenants/reports/repeat-customers**', async (route) => {
    await fulfillJson(route, REPEAT_CUSTOMERS);
  });

  await page.route('**/api/v1/branches/**/inventory/stock', async (route) => {
    await fulfillJson(route, STOCK_ROWS);
  });

  await page.route('**/api/v1/tenants/branches/**/onboarding-status', async (route) => {
    await fulfillJson(route, ONBOARDING_STATUS);
  });

  await page.route('**/api/v1/tenants/branches/**/config-snapshot', async (route) => {
    await fulfillJson(route, CONFIG_SNAPSHOT);
  });
}
