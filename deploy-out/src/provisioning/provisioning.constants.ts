/**
 * Global RBAC codes — keep in sync with prisma seed and packages/types PermissionCode.
 *
 * Role templates (below) define default bundles for new tenants:
 * - owner: full access (invite users, billing-style settings).
 * - manager: day-to-day ops without user administration.
 * - cashier: floor + orders + payments + light CRM/reporting.
 * - kitchen: KDS/bar ticket views only (no menu or discount).
 */
export const GLOBAL_PERMISSION_CODES = [
  'menu.read',
  'menu.manage',
  'tables.manage',
  'orders.create',
  'orders.edit',
  'orders.discount',
  'orders.cancel',
  'kitchen.view',
  'bar.view',
  'payments.close',
  'reports.view',
  'reports.tenant_rollups',
  'insights.generate',
  'stock.manage',
  'customers.view',
  'customers.manage',
  'settings.manage',
  'users.manage',
] as const;

export type RoleTemplateName = 'owner' | 'manager' | 'cashier' | 'kitchen';

/** Permission subsets per template role (owner uses full GLOBAL_PERMISSION_CODES). */
export const ROLE_TEMPLATE_PERMISSIONS: Record<
  RoleTemplateName,
  readonly string[]
> = {
  owner: [...GLOBAL_PERMISSION_CODES],
  manager: GLOBAL_PERMISSION_CODES.filter((c) => c !== 'users.manage'),
  cashier: [
    'menu.read',
    'orders.create',
    'orders.edit',
    'orders.discount',
    'orders.cancel',
    'payments.close',
    'tables.manage',
    'customers.view',
    'reports.view',
  ],
  kitchen: ['kitchen.view', 'bar.view'],
};
