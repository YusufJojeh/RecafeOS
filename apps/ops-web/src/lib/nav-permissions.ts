/**
 * Maps dashboard paths to staff permission checks aligned with
 * apps/api/src/common/security/permissions.map.ts (branch-scoped GETs).
 */
type PermTest = (perms: Set<string>) => boolean;

const ENTRIES: Array<{ prefix: string; test: PermTest }> = [
  { prefix: '/reports/shift-handoff', test: (p) => p.has('reports.view') },
  { prefix: '/branding/menu', test: (p) => p.has('settings.manage') },
  { prefix: '/weekly-digest', test: (p) => p.has('reports.view') },
  { prefix: '/floor', test: (p) => p.has('tables.manage') },
  { prefix: '/orders', test: (p) => p.has('orders.edit') },
  {
    prefix: '/menu',
    test: (p) =>
      p.has('menu.read') || p.has('menu.manage') || p.has('orders.create'),
  },
  { prefix: '/customers', test: (p) => p.has('customers.view') },
  { prefix: '/kitchen', test: (p) => p.has('kitchen.view') },
  { prefix: '/bar', test: (p) => p.has('bar.view') },
  { prefix: '/reports', test: (p) => p.has('reports.view') },
  { prefix: '/stock', test: (p) => p.has('stock.manage') },
  { prefix: '/setup', test: (p) => p.has('settings.manage') },
];

const SORTED = [...ENTRIES].sort((a, b) => b.prefix.length - a.prefix.length);

/** Whether the user may open this pathname (exact or nested under a registered prefix). */
export function canAccessRoute(pathname: string, permissions: string[]): boolean {
  const p = new Set(permissions);
  for (const { prefix, test } of SORTED) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return test(p);
    }
  }
  return true;
}

/** Sidebar visibility uses the same rules as route access for branch-scoped areas. */
export function canSeeNavPath(pathname: string, permissions: string[]): boolean {
  return canAccessRoute(pathname, permissions);
}
