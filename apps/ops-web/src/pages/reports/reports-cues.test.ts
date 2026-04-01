import { describe, expect, it } from 'vitest';
import { buildDailyOperatorCues, buildRollupOperatorCues } from './reports-cues';
import type { DailyReport, TenantRollupReport } from './reports-types';

function makeDaily(overrides: Partial<DailyReport> = {}): DailyReport {
  return {
    totalSalesMinor: 0,
    orderCount: 0,
    averageOrderValueMinor: 0,
    sameWeekdayBenchmark: {
      priorSameWeekdaysSampled: 0,
      medianNetSalesMinor: 0,
      medianOrderCount: 0,
    },
    salesByOrderType: {},
    orderCountByOrderType: {},
    topItems: [],
    salesByCategory: [],
    paymentsByMethod: {},
    summary: { grossSalesMinor: 0, netSalesMinor: 0, totalDiscountMinor: 0 },
    hourlySales: [],
    cancellations: { count: 0, lostSubtotalMinor: 0, byReason: [] },
    discounts: { ordersWithDiscountCount: 0, totalDiscountMinor: 0, topReasons: [] },
    cashiers: [],
    shifts: [],
    topCustomers: [],
    visits: { visitsRecorded: 0, repeatVisitsAtBranch: 0, firstTimeVisitsAtBranch: 0 },
    stock: { lowStockItems: [] },
    flags: [],
    ...overrides,
  };
}

function makeRollup(overrides: Partial<TenantRollupReport> = {}): TenantRollupReport {
  return {
    semantics: 'utc_window',
    fromUtc: '2026-03-17',
    toUtcInclusive: '2026-03-23',
    paidAtWindow: { start: '2026-03-17T00:00:00Z', endExclusive: '2026-03-24T00:00:00Z' },
    branchLimit: 5,
    branchIdsIncluded: [],
    branchesInScope: [],
    netPaidSalesMinor: 0,
    paidOrderCount: 0,
    averageTicketMinor: 0,
    salesByOrderType: {},
    orderCountByOrderType: {},
    topBranchesBySales: [],
    discountPressure: { totalDiscountMinor: 0, ordersWithDiscountCount: 0 },
    priorPeriod: null,
    ...overrides,
  };
}

describe('buildDailyOperatorCues', () => {
  it('returns empty array when no data triggers cues', () => {
    expect(buildDailyOperatorCues(makeDaily())).toEqual([]);
  });

  it('adds discount cue when discount share >= 12% of gross', () => {
    const d = makeDaily({
      summary: { grossSalesMinor: 1000, netSalesMinor: 880, totalDiscountMinor: 120 },
    });
    const cues = buildDailyOperatorCues(d);
    expect(cues.some((c) => c.includes('Discount'))).toBe(true);
  });

  it('does NOT add discount cue when share is below 12%', () => {
    const d = makeDaily({
      summary: { grossSalesMinor: 1000, netSalesMinor: 950, totalDiscountMinor: 50 },
    });
    const cues = buildDailyOperatorCues(d);
    expect(cues.some((c) => c.includes('Discount'))).toBe(false);
  });

  it('adds top discount reason cue when discount ratio >= 12%', () => {
    const d = makeDaily({
      orderCount: 10,
      discounts: {
        ordersWithDiscountCount: 2,
        totalDiscountMinor: 200,
        topReasons: [{ reason: 'staff_meal', count: 2 }],
      },
    });
    const cues = buildDailyOperatorCues(d);
    expect(cues.some((c) => c.includes('staff_meal'))).toBe(true);
  });

  it('does not add top reason cue when topReasons is empty', () => {
    const d = makeDaily({
      orderCount: 10,
      discounts: { ordersWithDiscountCount: 2, totalDiscountMinor: 200, topReasons: [] },
    });
    const cues = buildDailyOperatorCues(d);
    expect(cues.some((c) => c.includes('discount reason'))).toBe(false);
  });

  it('adds quietest/busiest hour cues when hourly data present', () => {
    const d = makeDaily({
      hourlySales: [
        { hour: 12, orderCount: 5, salesMinor: 5000 },
        { hour: 15, orderCount: 1, salesMinor: 500 },
      ],
    });
    const cues = buildDailyOperatorCues(d);
    expect(cues.some((c) => c.includes('Quietest'))).toBe(true);
    expect(cues.some((c) => c.includes('Busiest'))).toBe(true);
  });

  it('does not add hour cues when no hourly sales', () => {
    const cues = buildDailyOperatorCues(makeDaily({ hourlySales: [] }));
    expect(cues.some((c) => c.includes('hour'))).toBe(false);
  });

  it('does not add busiest hour cue when only one hour has sales', () => {
    const d = makeDaily({
      hourlySales: [{ hour: 12, orderCount: 5, salesMinor: 5000 }],
    });
    const cues = buildDailyOperatorCues(d);
    // Only one hour — quietest and busiest are the same, busiest cue omitted
    expect(cues.some((c) => c.includes('Busiest'))).toBe(false);
  });

  it('adds cancellation cue when cancellation rate >= 8%', () => {
    const d = makeDaily({
      orderCount: 10,
      cancellations: { count: 1, lostSubtotalMinor: 0, byReason: [] },
    });
    const cues = buildDailyOperatorCues(d);
    expect(cues.some((c) => c.includes('Cancellations'))).toBe(true);
  });

  it('does not add cancellation cue below 8% threshold', () => {
    const d = makeDaily({
      orderCount: 100,
      cancellations: { count: 5, lostSubtotalMinor: 0, byReason: [] },
    });
    const cues = buildDailyOperatorCues(d);
    expect(cues.some((c) => c.includes('Cancellations'))).toBe(false);
  });

  it('adds low stock cue when items at threshold', () => {
    const d = makeDaily({
      stock: {
        lowStockItems: [
          { id: '1', name: 'Coffee', quantity: '0.5', lowThreshold: '1', unit: 'kg', severityRatio: 0.5, linkedToTopSeller: true },
        ],
      },
    });
    const cues = buildDailyOperatorCues(d);
    expect(cues.some((c) => c.includes('Low stock'))).toBe(true);
  });

  it('adds repeat visits cue when repeat share < 15% with 8+ visits', () => {
    const d = makeDaily({
      visits: { visitsRecorded: 10, repeatVisitsAtBranch: 1, firstTimeVisitsAtBranch: 9 },
    });
    const cues = buildDailyOperatorCues(d);
    expect(cues.some((c) => c.includes('Repeat visits'))).toBe(true);
  });

  it('does not add repeat cue when fewer than 8 visits recorded', () => {
    const d = makeDaily({
      visits: { visitsRecorded: 5, repeatVisitsAtBranch: 0, firstTimeVisitsAtBranch: 5 },
    });
    const cues = buildDailyOperatorCues(d);
    expect(cues.some((c) => c.includes('Repeat visits'))).toBe(false);
  });
});

describe('buildRollupOperatorCues', () => {
  it('returns empty array when no data triggers cues', () => {
    expect(buildRollupOperatorCues(makeRollup())).toEqual([]);
  });

  it('adds discount cue when discount >= 10% of net sales', () => {
    const r = makeRollup({
      netPaidSalesMinor: 1000,
      discountPressure: { totalDiscountMinor: 100, ordersWithDiscountCount: 5 },
    });
    const cues = buildRollupOperatorCues(r);
    expect(cues.some((c) => c.includes('Discount'))).toBe(true);
  });

  it('adds down-sales cue when delta <= -20% vs prior period', () => {
    const r = makeRollup({
      netPaidSalesMinor: 800,
      priorPeriod: {
        semantics: 'same_duration_utc_immediately_before',
        paidAtWindow: { start: '2026-03-10T00:00:00Z', endExclusive: '2026-03-17T00:00:00Z' },
        netPaidSalesMinor: 1000,
        paidOrderCount: 20,
      },
    });
    const cues = buildRollupOperatorCues(r);
    expect(cues.some((c) => c.includes('down'))).toBe(true);
  });

  it('adds up-sales cue when delta >= +20% vs prior period', () => {
    const r = makeRollup({
      netPaidSalesMinor: 1200,
      priorPeriod: {
        semantics: 'same_duration_utc_immediately_before',
        paidAtWindow: { start: '2026-03-10T00:00:00Z', endExclusive: '2026-03-17T00:00:00Z' },
        netPaidSalesMinor: 1000,
        paidOrderCount: 20,
      },
    });
    const cues = buildRollupOperatorCues(r);
    expect(cues.some((c) => c.includes('up'))).toBe(true);
  });

  it('does not add delta cue when prior period is null', () => {
    const r = makeRollup({ netPaidSalesMinor: 500, priorPeriod: null });
    const cues = buildRollupOperatorCues(r);
    expect(cues.some((c) => c.includes('prior UTC window'))).toBe(false);
  });

  it('adds branch spread cue when top branch is 2x bottom', () => {
    const r = makeRollup({
      topBranchesBySales: [
        { branchId: 'a', name: 'A', netPaidSalesMinor: 2000, paidOrderCount: 20 },
        { branchId: 'b', name: 'B', netPaidSalesMinor: 800, paidOrderCount: 8 },
      ],
    });
    const cues = buildRollupOperatorCues(r);
    expect(cues.some((c) => c.includes('spread'))).toBe(true);
  });

  it('does not add spread cue with only one branch', () => {
    const r = makeRollup({
      topBranchesBySales: [
        { branchId: 'a', name: 'A', netPaidSalesMinor: 2000, paidOrderCount: 20 },
      ],
    });
    const cues = buildRollupOperatorCues(r);
    expect(cues.some((c) => c.includes('spread'))).toBe(false);
  });
});
