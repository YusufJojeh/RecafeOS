/**
 * Redacted payload for low-stock commentary — only fields needed to explain urgency vs system thresholds.
 */
import type { DailyReportShape } from './insight-snapshot';
import {
  LOW_STOCK_PROMPT_VERSION,
  LOW_STOCK_SNAPSHOT_VERSION,
} from './llm.constants';
import { LlmTaskKind } from './llm.types';

export type LowStockInsightSnapshot = {
  snapshotVersion: typeof LOW_STOCK_SNAPSHOT_VERSION;
  taskKind: (typeof LlmTaskKind)['STOCK_RISK_HINT'];
  promptVersion: typeof LOW_STOCK_PROMPT_VERSION;
  branch: { id: string; name: string; timezone: string };
  calendarDate: string;
  items: Array<{
    name: string;
    unit: string;
    quantityLabel: string;
    lowThresholdLabel: string;
    linkedToTopSeller: boolean;
    /** Higher means more urgent vs threshold (system-computed). */
    severityRatio: number;
  }>;
};

export function buildLowStockInsightSnapshot(
  daily: DailyReportShape,
  branch: { id: string; name: string; timezone: string },
): LowStockInsightSnapshot {
  const items = daily.stock.lowStockItems.map((row) => ({
    name: row.name.slice(0, 200),
    unit: row.unit,
    quantityLabel: String(row.quantity).slice(0, 32),
    lowThresholdLabel: String(row.lowThreshold).slice(0, 32),
    linkedToTopSeller: row.linkedToTopSeller,
    severityRatio: Math.round((row.severityRatio ?? 0) * 1000) / 1000,
  }));
  return {
    snapshotVersion: LOW_STOCK_SNAPSHOT_VERSION,
    taskKind: LlmTaskKind.STOCK_RISK_HINT,
    promptVersion: LOW_STOCK_PROMPT_VERSION,
    branch: {
      id: branch.id,
      name: branch.name,
      timezone: branch.timezone,
    },
    calendarDate: daily.date,
    items,
  };
}
