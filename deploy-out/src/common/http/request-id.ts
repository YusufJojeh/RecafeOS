import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Resolve or generate a request correlation id (for logs and tracing). */
export function resolveRequestId(req: IncomingMessage): string {
  const incoming = req.headers[REQUEST_ID_HEADER];
  return typeof incoming === 'string' && incoming.trim().length > 0
    ? incoming.trim()
    : randomUUID();
}

/**
 * Assign `requestId` on the request and echo the header on the response.
 * Use from Pino `genReqId` so one code path owns correlation IDs.
 */
export function assignRequestId(
  req: IncomingMessage & { requestId?: string },
  res: ServerResponse,
): string {
  const id = resolveRequestId(req);
  req.requestId = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  return id;
}
