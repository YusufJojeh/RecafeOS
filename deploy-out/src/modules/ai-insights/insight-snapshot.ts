/**
 * Redacted, versioned payload for LLM input — no PII (phones, full customer ids stripped).
 * Built only from aggregates already returned by ReportsService.daily().
 */
import type { ReportsService } from '../reports/reports.service';
import {
  DAILY_SUMMARY_PROMPT_VERSION,
  INSIGHT_SNAPSHOT_VERSION,
} from './llm.constants';
import { LlmTaskKind } from './llm.types';

export type DailyReportShape = Awaited<ReturnType<ReportsService['daily']>>;

export type InsightSnapshot = {
  snapshotVersion: typeof INSIGHT_SNAPSHOT_VERSION;
  taskKind: (typeof LlmTaskKind)['DAILY_SUMMARY_EXPLAIN'];
  promptVersion: typeof DAILY_SUMMARY_PROMPT_VERSION;
  branch: {
    id: string;
    name: string;
    timezone: string;
  };
  calendarDate: string;
  aggregates: {
    totalSalesMinor: number;
    orderCount: number;
    averageOrderValueMinor: number;
    salesByOrderType: Record<string, number>;
    orderCountByOrderType: Record<string, number>;
    topItems: Array<{ name: string; qty: number; revenueMinor: number }>;
    paymentsByMethod: Record<string, number>;
    hourlySales: Array<{
      hour: number;
      orderCount: number;
      salesMinor: number;
    }>;
    cancellations: { count: number; lostSubtotalMinor: number };
    discounts: {
      ordersWithDiscountCount: number;
      totalDiscountMinor: number;
      topReasons: Array<{ reason: string; count: number }>;
    };
    visits: {
      visitsRecorded: number;
      repeatVisitsAtBranch: number;
      firstTimeVisitsAtBranch: number;
    };
    stock: {
      lowStockItemCount: number;
      lowStockLabels: string[];
    };
    flags: Array<{ code: string; severity: string; message: string }>;
  };
};

export function buildDailyInsightSnapshot(
  daily: DailyReportShape,
  branch: { id: string; name: string; timezone: string },
): InsightSnapshot {
  const low = daily.stock.lowStockItems;
  return {
    snapshotVersion: INSIGHT_SNAPSHOT_VERSION,
    taskKind: LlmTaskKind.DAILY_SUMMARY_EXPLAIN,
    promptVersion: DAILY_SUMMARY_PROMPT_VERSION,
    branch: {
      id: branch.id,
      name: branch.name,
      timezone: branch.timezone,
    },
    calendarDate: daily.date,
    aggregates: {
      totalSalesMinor: daily.totalSalesMinor,
      orderCount: daily.orderCount,
      averageOrderValueMinor: daily.averageOrderValueMinor,
      salesByOrderType: daily.salesByOrderType,
      orderCountByOrderType: daily.orderCountByOrderType,
      topItems: daily.topItems.map((t) => ({
        name: t.name,
        qty: t.qty,
        revenueMinor: t.revenue,
      })),
      paymentsByMethod: daily.paymentsByMethod,
      hourlySales: daily.hourlySales,
      cancellations: daily.cancellations,
      discounts: daily.discounts,
      visits: daily.visits,
      stock: {
        lowStockItemCount: low.length,
        lowStockLabels: low.map((row) => row.name).slice(0, 20),
      },
      flags: daily.flags.map((f) => ({
        code: f.code,
        severity: f.severity,
        message: f.message,
      })),
    },
  };
}
