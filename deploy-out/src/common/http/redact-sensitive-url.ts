/**
 * Removes high-entropy path segments (session tokens) from URLs before logging.
 * Public routes embed `publicToken` in the path; tokens must not appear in log drains.
 */
export function redactSensitiveRequestUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    return url;
  }
  let u = url;
  u = u.replace(
    /(\/api\/v1\/public\/tenants\/[^/]+\/branches\/[^/]+\/sessions\/)[^/?#]+/gi,
    '$1[session]',
  );
  u = u.replace(/(\/api\/v1\/public\/sessions\/)[^/?#]+/gi, '$1[session]');
  return u;
}
