import type { Request } from 'express';
import { STAFF_HTTP_HEADER, staffHttpHeaderLower } from '@restocafe/types';

/** Low-cardinality fields safe for structured logs and metrics labels. */
export function httpLogFields(req: Request): Record<string, unknown> {
  const route = req.route as { path?: string } | undefined;
  const branchKey = staffHttpHeaderLower(STAFF_HTTP_HEADER.BRANCH_ID);
  const headerBranch =
    typeof req.headers[branchKey] === 'string' ? req.headers[branchKey] : undefined;
  return {
    requestId: req.requestId,
    method: req.method,
    path: typeof route?.path === 'string' ? route.path : req.path,
    tenantId: req.user?.tenantId,
    userId: req.user?.userId,
    branchId: req.branchId ?? headerBranch,
  };
}
