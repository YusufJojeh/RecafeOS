/**
 * HTTP route → permission (single source of truth for audits).
 * Guards: JwtAuthGuard + BranchGuard (where :branchId) + PermissionsGuard + @RequirePermissions / @RequireAnyPermissions.
 * Auth-only routes list only JwtAuthGuard.
 */
export const routePermissions = {
  'POST /auth/login': ['ThrottlerGuard'],
  'POST /auth/refresh': ['ThrottlerGuard'],
  'POST /auth/logout': ['ThrottlerGuard'],
  'POST /auth/accept-invite': ['ThrottlerGuard'],
  'GET /auth/me': ['JwtAuthGuard'],
  'GET /tenants/commerce': ['JwtAuthGuard'],
  'POST /tenants/push-devices': ['JwtAuthGuard'],
  'GET /tenants/push-devices': ['JwtAuthGuard'],
  'POST /tenants/pilot-feedback': ['JwtAuthGuard'],
  'GET /tenants/invites': ['JwtAuthGuard', 'users.manage'],
  'POST /tenants/invites': ['JwtAuthGuard', 'users.manage'],
  'GET /tenants/branches': ['JwtAuthGuard'],
  'GET /tenants/branches/:branchId/setup-readiness': [
    'JwtAuthGuard',
    'BranchGuard',
  ],
  'GET /tenants/branches/:branchId/ops-snapshot': [
    'JwtAuthGuard',
    'BranchGuard',
  ],
  'GET /tenants/branches/:branchId/onboarding-status': [
    'JwtAuthGuard',
    'BranchGuard',
    'settings.manage',
  ],
  'GET /tenants/branches/:branchId/config-snapshot': [
    'JwtAuthGuard',
    'BranchGuard',
    'settings.manage',
  ],
  'PATCH /tenants/branches/:branchId': [
    'JwtAuthGuard',
    'BranchGuard',
    'settings.manage',
  ],
  'PATCH /tenants/branches/:branchId/onboarding-ui': [
    'JwtAuthGuard',
    'BranchGuard',
    'settings.manage',
  ],
  'POST /tenants/branches/:branchId/go-live-ack': [
    'JwtAuthGuard',
    'BranchGuard',
    'settings.manage',
  ],
  'GET /tenants/menu-branding': ['JwtAuthGuard', 'settings.manage'],
  'PATCH /tenants/menu-branding/draft': ['JwtAuthGuard', 'settings.manage'],
  'POST /tenants/menu-branding/publish': ['JwtAuthGuard', 'settings.manage'],
  'POST /tenants/menu-branding/logo': ['JwtAuthGuard', 'settings.manage'],
  'DELETE /tenants/menu-branding/logo': ['JwtAuthGuard', 'settings.manage'],
  'POST /tenants/menu-branding/analyze-logo': ['JwtAuthGuard', 'settings.manage'],
  'POST /tenants/menu-branding/apply-analysis': ['JwtAuthGuard', 'settings.manage'],
  'GET /tenants/menu-branding/draft-logo': ['JwtAuthGuard', 'settings.manage'],
  'GET /branches/:branchId/tables': [
    'JwtAuthGuard',
    'BranchGuard',
    'tables.manage',
  ],
  'POST /branches/:branchId/tables': [
    'JwtAuthGuard',
    'BranchGuard',
    'tables.manage',
  ],
  'PATCH /branches/:branchId/tables/:tableId': [
    'JwtAuthGuard',
    'BranchGuard',
    'tables.manage',
  ],
  'POST /branches/:branchId/tables/sessions': [
    'JwtAuthGuard',
    'BranchGuard',
    'tables.manage',
  ],
  'POST /branches/:branchId/tables/sessions/merge': [
    'JwtAuthGuard',
    'BranchGuard',
    'tables.manage',
  ],
  'GET /branches/:branchId/menu/categories': [
    'JwtAuthGuard',
    'BranchGuard',
    'ANY(menu.read, menu.manage, orders.create)',
  ],
  'POST /branches/:branchId/menu/categories': [
    'JwtAuthGuard',
    'BranchGuard',
    'menu.manage',
  ],
  'POST /branches/:branchId/menu/items': [
    'JwtAuthGuard',
    'BranchGuard',
    'menu.manage',
  ],
  'PATCH /branches/:branchId/menu/items/:itemId': [
    'JwtAuthGuard',
    'BranchGuard',
    'menu.manage',
  ],
  'POST /branches/:branchId/menu/modifier-groups': [
    'JwtAuthGuard',
    'BranchGuard',
    'menu.manage',
  ],
  'POST /branches/:branchId/menu/modifier-groups/:groupId/options': [
    'JwtAuthGuard',
    'BranchGuard',
    'menu.manage',
  ],
  'POST /branches/:branchId/menu/items/:itemId/modifier-groups/:groupId': [
    'JwtAuthGuard',
    'BranchGuard',
    'menu.manage',
  ],
  'POST /branches/:branchId/menu/import/dry-run': [
    'JwtAuthGuard',
    'BranchGuard',
    'menu.manage',
  ],
  'POST /branches/:branchId/menu/import/apply': [
    'JwtAuthGuard',
    'BranchGuard',
    'menu.manage',
  ],
  'GET /branches/:branchId/orders': [
    'JwtAuthGuard',
    'BranchGuard',
    'orders.edit',
  ],
  'GET /branches/:branchId/orders/:orderId': [
    'JwtAuthGuard',
    'BranchGuard',
    'orders.edit',
  ],
  'POST /branches/:branchId/orders': [
    'JwtAuthGuard',
    'BranchGuard',
    'orders.create',
  ],
  'POST /branches/:branchId/orders/:orderId/items': [
    'JwtAuthGuard',
    'BranchGuard',
    'orders.edit',
  ],
  'POST /branches/:branchId/orders/:orderId/items/:itemId/qty': [
    'JwtAuthGuard',
    'BranchGuard',
    'orders.edit',
  ],
  'POST /branches/:branchId/orders/:orderId/confirm': [
    'JwtAuthGuard',
    'BranchGuard',
    'orders.edit',
  ],
  'POST /branches/:branchId/orders/:orderId/send-to-preparation': [
    'JwtAuthGuard',
    'BranchGuard',
    'orders.edit',
  ],
  'POST /branches/:branchId/orders/:orderId/discount': [
    'JwtAuthGuard',
    'BranchGuard',
    'orders.discount',
  ],
  'POST /branches/:branchId/orders/:orderId/move-table': [
    'JwtAuthGuard',
    'BranchGuard',
    'orders.edit',
  ],
  'POST /branches/:branchId/orders/merge': [
    'JwtAuthGuard',
    'BranchGuard',
    'orders.edit',
  ],
  'POST /branches/:branchId/orders/:orderId/served': [
    'JwtAuthGuard',
    'BranchGuard',
    'orders.edit',
  ],
  'POST /branches/:branchId/orders/:orderId/close': [
    'JwtAuthGuard',
    'BranchGuard',
    'payments.close',
  ],
  'POST /branches/:branchId/orders/:orderId/cancel': [
    'JwtAuthGuard',
    'BranchGuard',
    'orders.cancel',
  ],
  'GET /branches/:branchId/kitchen/tickets': [
    'JwtAuthGuard',
    'BranchGuard',
    'kitchen.view',
  ],
  'PATCH /branches/:branchId/kitchen/tickets/:ticketId': [
    'JwtAuthGuard',
    'BranchGuard',
    'kitchen.view',
  ],
  'GET /branches/:branchId/bar/tickets': [
    'JwtAuthGuard',
    'BranchGuard',
    'bar.view',
  ],
  'PATCH /branches/:branchId/bar/tickets/:ticketId': [
    'JwtAuthGuard',
    'BranchGuard',
    'bar.view',
  ],
  'GET /branches/:branchId/reports/daily': [
    'JwtAuthGuard',
    'BranchGuard',
    'reports.view',
  ],
  'GET /branches/:branchId/reports/weekly-digest': [
    'JwtAuthGuard',
    'BranchGuard',
    'reports.view',
  ],
  'GET /branches/:branchId/reports/demand-profile': [
    'JwtAuthGuard',
    'BranchGuard',
    'reports.view',
  ],
  'GET /tenants/reports/tenant-rollup': [
    'JwtAuthGuard',
    'reports.tenant_rollups',
  ],
  'GET /tenants/reports/branch-snapshot': [
    'JwtAuthGuard',
    'reports.tenant_rollups',
  ],
  'GET /tenants/reports/repeat-customers': [
    'JwtAuthGuard',
    'reports.tenant_rollups',
  ],
  'POST /tenants/reports/archive-stale-customer-visits': [
    'JwtAuthGuard',
    'reports.tenant_rollups',
  ],
  'GET /branches/:branchId/insights/daily-summary': [
    'JwtAuthGuard',
    'BranchGuard',
    'insights.generate',
  ],
  'GET /branches/:branchId/insights/weekly-digest': [
    'JwtAuthGuard',
    'BranchGuard',
    'insights.generate',
  ],
  'GET /branches/:branchId/insights/low-stock': [
    'JwtAuthGuard',
    'BranchGuard',
    'insights.generate',
  ],
  'GET /branches/:branchId/insights/underperforming-items': [
    'JwtAuthGuard',
    'BranchGuard',
    'insights.generate',
  ],
  'GET /branches/:branchId/insights/branch-compare': [
    'JwtAuthGuard',
    'BranchGuard',
    'insights.generate',
  ],
  'GET /branches/:branchId/inventory/stock': [
    'JwtAuthGuard',
    'BranchGuard',
    'stock.manage',
  ],
  'POST /branches/:branchId/inventory/adjust': [
    'JwtAuthGuard',
    'BranchGuard',
    'stock.manage',
  ],
  'POST /branches/:branchId/inventory/recipes': [
    'JwtAuthGuard',
    'BranchGuard',
    'stock.manage',
  ],
  'GET /branches/:branchId/customers/search': [
    'JwtAuthGuard',
    'BranchGuard',
    'customers.view',
  ],
  'GET /branches/:branchId/customers/visit-signals': [
    'JwtAuthGuard',
    'BranchGuard',
    'reports.view',
  ],
  'GET /customers/search': ['JwtAuthGuard', 'customers.view'],
  'GET /customers/:id': ['JwtAuthGuard', 'customers.view'],
  'POST /customers': ['JwtAuthGuard', 'customers.manage'],
  'PATCH /customers/:id': ['JwtAuthGuard', 'customers.manage'],
  'POST /customers/:id/notes': ['JwtAuthGuard', 'customers.manage'],
  'POST /customers/:id/offers': ['JwtAuthGuard', 'customers.manage'],
  'GET /public/tenants/:tenantSlug/branches/:branchSlug/menu': [
    'PublicThrottle',
  ],
  'GET /public/tenants/:tenantSlug/branches/:branchSlug/sessions/:token/menu': [
    'PublicThrottle',
  ],
  'GET /public/tenant-assets/logos/:tenantSlug/:fileKey': ['PublicThrottle'],
  'POST /public/sessions/:token/call-waiter': ['PublicThrottle'],
  'POST /public/tenants/:tenantSlug/branches/:branchSlug/sessions/:token/order':
    ['PublicThrottle'],
  'GET /public/tenants/:tenantSlug/branches/:branchSlug/sessions/:token/orders/:orderId':
    ['PublicThrottle'],
  'GET /support/diagnostics': ['SupportApiKeyGuard'],
  'GET /support/pilots': ['SupportApiKeyGuard'],
  'GET /support/pilots/snapshots': ['SupportApiKeyGuard'],
  'GET /support/pilots/weekly-report': ['SupportApiKeyGuard'],
  'GET /support/lookup/tenant-slug/:slug': ['SupportApiKeyGuard'],
  'POST /support/tenants/provision': ['SupportApiKeyGuard'],
  'POST /support/tenants/:tenantId/members': ['SupportApiKeyGuard'],
  'POST /support/tenants/:tenantId/reset-demo': ['SupportApiKeyGuard'],
  'PATCH /support/tenants/:tenantId/commerce': ['SupportApiKeyGuard'],
  'POST /support/tenants/:tenantId/suspend': ['SupportApiKeyGuard'],
  'POST /support/tenants/:tenantId/reactivate': ['SupportApiKeyGuard'],
  'PATCH /support/tenants/:tenantId/metadata': ['SupportApiKeyGuard'],
  'GET /support/tenants/:tenantId/invoice-export-readiness': [
    'SupportApiKeyGuard',
  ],
  'POST /support/jobs/expire-trials': ['SupportApiKeyGuard'],
  'GET /support/tenants/:tenantId/summary': ['SupportApiKeyGuard'],
  'POST /support/tenants/:tenantId/pilot-feedback': ['SupportApiKeyGuard'],
  'GET /support/tenants/:tenantId/pilot-feedback': ['SupportApiKeyGuard'],
  'PATCH /support/tenants/:tenantId/pilot-feedback/:feedbackId': [
    'SupportApiKeyGuard',
  ],
  'POST /support/tenants/:tenantId/pilot-weekly-snapshot': [
    'SupportApiKeyGuard',
  ],
  'GET /support/tenants/:tenantId/branches': ['SupportApiKeyGuard'],
  'GET /support/tenants/:tenantId/branches/:branchId/onboarding-status': [
    'SupportApiKeyGuard',
  ],
  'POST /support/tenants/:tenantId/branches/:targetBranchId/clone-menu': [
    'SupportApiKeyGuard',
  ],
  'GET /support/tenants/:tenantId/audit-log': ['SupportApiKeyGuard'],
  'GET /support/tenants/:tenantId/orders/:orderId': ['SupportApiKeyGuard'],
  'GET /internal/support-ui/diagnostics': ['JwtAuthGuard', 'SupportUiGuard'],
  'GET /internal/support-ui/pilots': ['JwtAuthGuard', 'SupportUiGuard'],
  'GET /internal/support-ui/pilots/snapshots': [
    'JwtAuthGuard',
    'SupportUiGuard',
  ],
  'GET /internal/support-ui/pilots/weekly-report': [
    'JwtAuthGuard',
    'SupportUiGuard',
  ],
  'GET /internal/support-ui/lookup/tenant-slug/:slug': [
    'JwtAuthGuard',
    'SupportUiGuard',
  ],
  'POST /internal/support-ui/tenants/provision': [
    'JwtAuthGuard',
    'SupportUiGuard',
  ],
  'POST /internal/support-ui/tenants/:tenantId/members': [
    'JwtAuthGuard',
    'SupportUiGuard',
  ],
  'POST /internal/support-ui/tenants/:tenantId/reset-demo': [
    'JwtAuthGuard',
    'SupportUiGuard',
  ],
  'PATCH /internal/support-ui/tenants/:tenantId/commerce': [
    'JwtAuthGuard',
    'SupportUiGuard',
  ],
  'POST /internal/support-ui/tenants/:tenantId/suspend': [
    'JwtAuthGuard',
    'SupportUiGuard',
  ],
  'POST /internal/support-ui/tenants/:tenantId/reactivate': [
    'JwtAuthGuard',
    'SupportUiGuard',
  ],
  'PATCH /internal/support-ui/tenants/:tenantId/metadata': [
    'JwtAuthGuard',
    'SupportUiGuard',
  ],
  'GET /internal/support-ui/tenants/:tenantId/invoice-export-readiness': [
    'JwtAuthGuard',
    'SupportUiGuard',
  ],
  'POST /internal/support-ui/jobs/expire-trials': [
    'JwtAuthGuard',
    'SupportUiGuard',
  ],
  'GET /internal/support-ui/tenants/:tenantId/summary': [
    'JwtAuthGuard',
    'SupportUiGuard',
  ],
  'POST /internal/support-ui/tenants/:tenantId/pilot-feedback': [
    'JwtAuthGuard',
    'SupportUiGuard',
  ],
  'GET /internal/support-ui/tenants/:tenantId/pilot-feedback': [
    'JwtAuthGuard',
    'SupportUiGuard',
  ],
  'PATCH /internal/support-ui/tenants/:tenantId/pilot-feedback/:feedbackId': [
    'JwtAuthGuard',
    'SupportUiGuard',
  ],
  'POST /internal/support-ui/tenants/:tenantId/pilot-weekly-snapshot': [
    'JwtAuthGuard',
    'SupportUiGuard',
  ],
  'GET /internal/support-ui/tenants/:tenantId/branches': [
    'JwtAuthGuard',
    'SupportUiGuard',
  ],
  'GET /internal/support-ui/tenants/:tenantId/branches/:branchId/onboarding-status':
    ['JwtAuthGuard', 'SupportUiGuard'],
  'POST /internal/support-ui/tenants/:tenantId/branches/:targetBranchId/clone-menu':
    ['JwtAuthGuard', 'SupportUiGuard'],
  'GET /internal/support-ui/tenants/:tenantId/audit-log': [
    'JwtAuthGuard',
    'SupportUiGuard',
  ],
  'GET /internal/support-ui/tenants/:tenantId/orders/:orderId': [
    'JwtAuthGuard',
    'SupportUiGuard',
  ],
} as const;
