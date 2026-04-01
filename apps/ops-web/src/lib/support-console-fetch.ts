import { apiFetch } from './api';

const internalBase = '/internal/support-ui';

export async function supportFetch(
  path: string,
  init: RequestInit = {},
  options?: { supportOperator?: string },
): Promise<unknown> {
  const method = init.method ?? 'GET';
  const headers = new Headers(init.headers);
  const op = options?.supportOperator?.trim();
  if (op && !['GET', 'HEAD'].includes((method || 'GET').toUpperCase())) {
    headers.set('x-support-operator', op);
  }
  const normalizedPath = path.startsWith('/support/')
    ? path.slice('/support'.length)
    : path;
  return apiFetch(`${internalBase}${normalizedPath}`, { ...init, headers });
}
