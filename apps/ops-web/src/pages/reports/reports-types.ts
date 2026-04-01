export type ReportFlag = {
  code: string;
  severity: 'info' | 'warn' | 'risk';
  message: string;
};

export type TenantRollupPriorPeriod = {
  semantics: 'same_duration_utc_immediately_before';
  paidAtWindow: { start: string; endExclusive: string };
  netPaidSalesMinor: number;
  paidOrderCount: number;
};

export type TenantRollupReport = {
  semantics: string;
  fromUtc: string;
  toUtcInclusive: string;
  paidAtWindow: { start: string; endExclusive: string };
  branchLimit: number;
  branchIdsIncluded: string[];
  branchesInScope: Array<{ branchId: string; name: string; slug: string }>;
  netPaidSalesMinor: number;
  paidOrderCount: number;
  averageTicketMinor: number;
  salesByOrderType: Record<string, number>;
  orderCountByOrderType: Record<string, number>;
  topBranchesBySales: Array<{
    branchId: string;
    name: string;
    netPaidSalesMinor: number;
    paidOrderCount: number;
  }>;
  discountPressure: {
    totalDiscountMinor: number;
    ordersWithDiscountCount: number;
  };
  priorPeriod: TenantRollupPriorPeriod | null;
};

export type BranchVisitSignals = {
  windowDays: number;
  since: string;
  branchId: string;
  visitsRecorded: number;
  uniqueVisitors: number;
  repeatVisitors: number;
  singleVisitVisitors: number;
};

export type DemandProfile = {
  semantics: string;
  branchTimezone: string;
  window: {
    startDay: string;
    endDay: string;
    days: number;
  };
  totalSalesMinor: number;
  paidOrderCount: number;
  hourlySales: Array<{
    hour: number;
    orderCount: number;
    salesMinor: number;
  }>;
  peakContiguousHours: {
    startHour: number;
    endHourExclusive: number;
    salesMinor: number;
    shareOfWindowSalesPct: number;
  };
};

export type BranchSnapshotReport = {
  semantics: string;
  date: string;
  branchLimit: number;
  branches: Array<{
    branchId: string;
    name: string;
    slug: string;
    branchTimezone: string;
    netPaidSalesMinor: number;
    paidOrderCount: number;
  }>;
};

export type DailyReport = {
  totalSalesMinor: number;
  orderCount: number;
  averageOrderValueMinor: number;
  sameWeekdayBenchmark: {
    priorSameWeekdaysSampled: number;
    medianNetSalesMinor: number;
    medianOrderCount: number;
  };
  salesByOrderType: Record<string, number>;
  orderCountByOrderType: Record<string, number>;
  topItems: { name: string; qty: number; revenue: number }[];
  salesByCategory: Array<{ name: string; revenueMinor: number; qty: number }>;
  paymentsByMethod: Record<string, number>;
  summary: {
    grossSalesMinor: number;
    netSalesMinor: number;
    totalDiscountMinor: number;
  };
  hourlySales: Array<{ hour: number; orderCount: number; salesMinor: number }>;
  cancellations: {
    count: number;
    lostSubtotalMinor: number;
    byReason: Array<{
      reason: string;
      count: number;
      lostSubtotalMinor: number;
    }>;
  };
  discounts: {
    ordersWithDiscountCount: number;
    totalDiscountMinor: number;
    topReasons: Array<{ reason: string; count: number }>;
  };
  cashiers: Array<{
    userId: string | null;
    displayName: string;
    paymentsTotalMinor: number;
    orderCount: number;
  }>;
  shifts: Array<{
    id: string;
    openedAt: string;
    closedAt: string | null;
    orderCount: number;
    salesMinor: number;
  }>;
  topCustomers: Array<{
    customerId: string;
    phone: string;
    name: string | null;
    ordersCount: number;
    revenueMinor: number;
  }>;
  visits: {
    visitsRecorded: number;
    repeatVisitsAtBranch: number;
    firstTimeVisitsAtBranch: number;
  };
  stock: {
    lowStockItems: Array<{
      id: string;
      name: string;
      quantity: string;
      lowThreshold: string;
      unit: string;
      severityRatio: number;
      linkedToTopSeller: boolean;
    }>;
  };
  flags: ReportFlag[];
};
