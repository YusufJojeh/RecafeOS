import type { Request } from 'express';

const HEADER = 'x-support-operator';
const MAX_LEN = 128;

/** Optional human id for support mutations (audit metadata). */
export function parseSupportOperatorHeader(req: Request): string | undefined {
  const raw = req.headers[HEADER];
  if (typeof raw !== 'string') {
    return undefined;
  }
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_LEN) {
    return undefined;
  }
  const stripped = Array.from(trimmed)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return (code >= 32 && code !== 127) || code > 127;
    })
    .join('');
  return stripped.length > 0 ? stripped : undefined;
}

export function mergeSupportAuditMetadata(
  metadata: Record<string, unknown>,
  supportOperator?: string,
): Record<string, unknown> {
  if (!supportOperator) {
    return metadata;
  }
  return { ...metadata, supportOperator };
}
