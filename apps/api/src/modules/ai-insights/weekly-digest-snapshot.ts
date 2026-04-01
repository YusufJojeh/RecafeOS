import type { ReportsService } from '../reports/reports.service';
import {
  WEEKLY_DIGEST_PROMPT_VERSION,
  WEEKLY_DIGEST_SNAPSHOT_VERSION,
} from './llm.constants';
import { LlmTaskKind } from './llm.types';

export type WeeklyDigestShape = Awaited<
  ReturnType<ReportsService['weeklyBranchDigest']>
>;

export type WeeklyDigestInsightSnapshot = {
  snapshotVersion: typeof WEEKLY_DIGEST_SNAPSHOT_VERSION;
  taskKind: (typeof LlmTaskKind)['WEEKLY_DIGEST_EXPLAIN'];
  promptVersion: typeof WEEKLY_DIGEST_PROMPT_VERSION;
  weeklyDigest: WeeklyDigestShape;
};

export function buildWeeklyDigestInsightSnapshot(
  digest: WeeklyDigestShape,
): WeeklyDigestInsightSnapshot {
  return {
    snapshotVersion: WEEKLY_DIGEST_SNAPSHOT_VERSION,
    taskKind: LlmTaskKind.WEEKLY_DIGEST_EXPLAIN,
    promptVersion: WEEKLY_DIGEST_PROMPT_VERSION,
    weeklyDigest: digest,
  };
}
