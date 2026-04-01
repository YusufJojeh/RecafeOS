import type { DailyReport, TenantRollupReport } from './reports-types';

export function buildDailyOperatorCues(d: DailyReport): string[] {
  const cues: string[] = [];
  const gross = d.summary.grossSalesMinor;
  if (gross > 0) {
    const discShare = d.summary.totalDiscountMinor / gross;
    if (discShare >= 0.12) {
      cues.push(
        `Discounts are about ${(discShare * 100).toFixed(0)}% of gross sales — review discount reasons and margin.`,
      );
    }
  }
  if (
    d.orderCount > 0 &&
    d.discounts.ordersWithDiscountCount > 0 &&
    d.discounts.topReasons[0] &&
    d.discounts.ordersWithDiscountCount / d.orderCount >= 0.12
  ) {
    const topR = d.discounts.topReasons[0];
    cues.push(
      `Top discount reason today: "${topR.reason}" (${topR.count}×) — tighten policy if this is eroding margin.`,
    );
  }
  const hoursWithSales = d.hourlySales.filter((h) => h.salesMinor > 0);
  if (hoursWithSales.length > 0) {
    const minH = hoursWithSales.reduce((a, b) =>
      a.salesMinor <= b.salesMinor ? a : b,
    );
    cues.push(
      `Quietest sales hour: ${String(minH.hour).padStart(2, '0')}:00 — check staffing vs demand or promotions.`,
    );
    const maxH = hoursWithSales.reduce((a, b) =>
      a.salesMinor >= b.salesMinor ? a : b,
    );
    if (maxH.hour !== minH.hour || hoursWithSales.length > 1) {
      cues.push(
        `Busiest hour: ${String(maxH.hour).padStart(2, '0')}:00 — align staffing and prep with peak demand.`,
      );
    }
  }
  if (d.orderCount > 0 && d.cancellations.count / d.orderCount >= 0.08) {
    cues.push(
      'Cancellations are elevated vs orders — check kitchen load, timeouts, and guest communication.',
    );
  }
  if (d.stock.lowStockItems.length > 0) {
    cues.push(
      `Low stock: ${d.stock.lowStockItems.length} item(s) at or below threshold — restock before service.`,
    );
  }
  if (d.visits.visitsRecorded > 0) {
    const repShare =
      d.visits.repeatVisitsAtBranch / Math.max(d.visits.visitsRecorded, 1);
    if (repShare < 0.15 && d.visits.visitsRecorded >= 8) {
      cues.push(
        'Repeat visits are a small share of recorded visits — review service rhythm, bundles, and loyalty prompts.',
      );
    }
  }
  return cues;
}

export function buildRollupOperatorCues(r: TenantRollupReport): string[] {
  const cues: string[] = [];
  const net = r.netPaidSalesMinor;
  if (net > 0) {
    const discRatio = r.discountPressure.totalDiscountMinor / net;
    if (discRatio >= 0.1) {
      cues.push(
        `Discounts are a large share (~${(discRatio * 100).toFixed(0)}%) of net sales in this UTC window — compare to the prior period before changing pricing.`,
      );
    }
  }
  if (r.priorPeriod && r.priorPeriod.netPaidSalesMinor > 0) {
    const delta =
      (r.netPaidSalesMinor - r.priorPeriod.netPaidSalesMinor) /
      r.priorPeriod.netPaidSalesMinor;
    if (delta <= -0.2) {
      cues.push(
        'Net sales are down materially vs the prior UTC window — review weakest branches and discount mix.',
      );
    } else if (delta >= 0.2) {
      cues.push(
        'Net sales are up vs the prior UTC window — capture what worked (staffing, menu, promos) while it is fresh.',
      );
    }
  }
  const tops = r.topBranchesBySales;
  if (tops.length >= 2) {
    const hi = tops[0].netPaidSalesMinor;
    const lo = tops[tops.length - 1].netPaidSalesMinor;
    if (hi > 0 && lo >= 0 && hi / Math.max(lo, 1) >= 2) {
      cues.push(
        'Large spread between top and bottom branches by sales — prioritize coaching or an on-site visit at the lowest site.',
      );
    }
  }
  return cues;
}
