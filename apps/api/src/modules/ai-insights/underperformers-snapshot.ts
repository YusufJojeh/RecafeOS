import type { ReportsService } from '../reports/reports.service';
import {
  UNDERPERFORMERS_PROMPT_VERSION,
  UNDERPERFORMERS_SNAPSHOT_VERSION,
} from './llm.constants';
import { LlmTaskKind } from './llm.types';

export type UnderperformersDataShape = Awaited<
  ReturnType<ReportsService['underperformingMenuItemCandidates']>
>;

export type UnderperformersInsightSnapshot = {
  snapshotVersion: typeof UNDERPERFORMERS_SNAPSHOT_VERSION;
  taskKind: (typeof LlmTaskKind)['UNDERPERFORMING_ITEMS'];
  promptVersion: typeof UNDERPERFORMERS_PROMPT_VERSION;
  branch: { id: string; name: string; timezone: string };
  data: UnderperformersDataShape;
};

export function buildUnderperformersInsightSnapshot(
  data: UnderperformersDataShape,
  branch: { id: string; name: string; timezone: string },
): UnderperformersInsightSnapshot {
  return {
    snapshotVersion: UNDERPERFORMERS_SNAPSHOT_VERSION,
    taskKind: LlmTaskKind.UNDERPERFORMING_ITEMS,
    promptVersion: UNDERPERFORMERS_PROMPT_VERSION,
    branch: {
      id: branch.id,
      name: branch.name,
      timezone: branch.timezone,
    },
    data,
  };
}
