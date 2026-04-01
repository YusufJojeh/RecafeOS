import type { ReportsService } from '../reports/reports.service';
import {
  BRANCH_COMPARE_PROMPT_VERSION,
  BRANCH_COMPARE_SNAPSHOT_VERSION,
} from './llm.constants';
import { LlmTaskKind } from './llm.types';

export type BranchLocalDaySnapshotShape = Awaited<
  ReturnType<ReportsService['branchLocalDaySnapshot']>
>;

export type BranchCompareInsightSnapshot = {
  snapshotVersion: typeof BRANCH_COMPARE_SNAPSHOT_VERSION;
  taskKind: (typeof LlmTaskKind)['BRANCH_COMPARE_COMMENT'];
  promptVersion: typeof BRANCH_COMPARE_PROMPT_VERSION;
  snapshot: BranchLocalDaySnapshotShape;
};

export function buildBranchCompareInsightSnapshot(
  snapshot: BranchLocalDaySnapshotShape,
): BranchCompareInsightSnapshot {
  return {
    snapshotVersion: BRANCH_COMPARE_SNAPSHOT_VERSION,
    taskKind: LlmTaskKind.BRANCH_COMPARE_COMMENT,
    promptVersion: BRANCH_COMPARE_PROMPT_VERSION,
    snapshot,
  };
}
