import type { Request } from 'express';

/** Low-cardinality fields safe for structured logs and metrics labels. */
export function httpLogFields(req: Request): Record<string, unknown> {
  const route = req.route as { path?: string } | undefined;
  const headerBranch =
    typeof req.headers['x-branch-id'] === 'string'
      ? req.headers['x-branch-id']
      : undefined;
  return {
    requestId: req.requestId,
    method: req.method,
    path: typeof route?.path === 'string' ? route.path : req.path,
    tenantId: req.user?.tenantId,
    userId: req.user?.userId,
    branchId: req.branchId ?? headerBranch,
  };
}
