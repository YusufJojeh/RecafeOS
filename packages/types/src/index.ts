/** Shared enums — mirror Prisma enums for frontend bundles that cannot import @prisma/client */

export {
  REALTIME_CONTRACT_VERSION,
  BranchRealtimeEvent,
  type BranchRealtimeEventName,
  type BranchRealtimePayloads,
} from './realtime';

export const OrderStatus = {
  DRAFT: 'DRAFT',
  CONFIRMED: 'CONFIRMED',
  IN_PREPARATION: 'IN_PREPARATION',
  READY: 'READY',
  SERVED: 'SERVED',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const OrderType = {
  DINE_IN: 'DINE_IN',
  TAKEAWAY: 'TAKEAWAY',
  WHATSAPP_MANUAL: 'WHATSAPP_MANUAL',
  QR_REQUEST: 'QR_REQUEST',
} as const;
export type OrderType = (typeof OrderType)[keyof typeof OrderType];

export const PrepTicketStatus = {
  NEW: 'NEW',
  ACCEPTED: 'ACCEPTED',
  PREPARING: 'PREPARING',
  READY: 'READY',
  DELIVERED: 'DELIVERED',
} as const;
export type PrepTicketStatus = (typeof PrepTicketStatus)[keyof typeof PrepTicketStatus];

export const FloorTableStatus = {
  AVAILABLE: 'AVAILABLE',
  OCCUPIED: 'OCCUPIED',
  RESERVED: 'RESERVED',
  CLEANING: 'CLEANING',
} as const;
export type FloorTableStatus = (typeof FloorTableStatus)[keyof typeof FloorTableStatus];

/** Table session lifecycle — mirror `TableSessionStatus` in Prisma. */
export const TableSessionStatus = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
} as const;
export type TableSessionStatus =
  (typeof TableSessionStatus)[keyof typeof TableSessionStatus];

/** Payment row lifecycle — mirror `PaymentStatus` in Prisma. */
export const PaymentStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

/**
 * Guest-facing order phase for QR / public menu (`mapCustomerStatus` in `PublicGuestOrderService`).
 * Distinct from `OrderStatus`; lowercase wire values.
 */
export const PublicGuestCustomerStatus = {
  pending: 'pending',
  preparing: 'preparing',
  ready: 'ready',
  done: 'done',
  cancelled: 'cancelled',
} as const;
export type PublicGuestCustomerStatus =
  (typeof PublicGuestCustomerStatus)[keyof typeof PublicGuestCustomerStatus];

export const PrepStation = {
  KITCHEN: 'KITCHEN',
  BAR: 'BAR',
  BOTH: 'BOTH',
} as const;
export type PrepStation = (typeof PrepStation)[keyof typeof PrepStation];

export const PermissionCode = {
  MENU_READ: 'menu.read',
  MENU_MANAGE: 'menu.manage',
  TABLES_MANAGE: 'tables.manage',
  ORDERS_CREATE: 'orders.create',
  ORDERS_EDIT: 'orders.edit',
  ORDERS_DISCOUNT: 'orders.discount',
  ORDERS_CANCEL: 'orders.cancel',
  KITCHEN_VIEW: 'kitchen.view',
  BAR_VIEW: 'bar.view',
  PAYMENTS_CLOSE: 'payments.close',
  REPORTS_VIEW: 'reports.view',
  REPORTS_TENANT_ROLLUPS: 'reports.tenant_rollups',
  INSIGHTS_GENERATE: 'insights.generate',
  STOCK_MANAGE: 'stock.manage',
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_MANAGE: 'customers.manage',
  SETTINGS_MANAGE: 'settings.manage',
  USERS_MANAGE: 'users.manage',
} as const;
export type PermissionCode = (typeof PermissionCode)[keyof typeof PermissionCode];

export {
  MutationSafetyClass,
  MUTATION_SAFETY_BY_OPERATION,
  OfflineReplayPolicy,
  OFFLINE_REPLAY_BY_OPERATION,
  STAFF_API_CONTRACT_NOTE,
  type MutationSafetyKind,
  type OfflineReplayPolicyKind,
} from './mutation-safety';

export {
  MENU_BRANDING_PRESET_IDS,
  MENU_BRANDING_SURFACES,
  MENU_BRANDING_LAYOUTS,
  MENU_BRANDING_CARD_STYLES,
  MENU_BRANDING_BUTTON_STYLES,
  MENU_BRANDING_TYPOGRAPHY,
  MENU_BRANDING_COLOR_MODES,
  type MenuBrandingPresetId,
  type MenuBrandingSurface,
  type MenuBrandingLayout,
  type MenuBrandingCardStyle,
  type MenuBrandingButtonStyle,
  type MenuBrandingTypography,
  type MenuBrandingColorMode,
  type BrandToneHint,
  type PublicMenuBrandingTheme,
  type PublicMenuBrandingPayload,
  type AccessibleColorPair,
  type PaletteProposal,
  type VisualIdentityEstimate,
  type LogoAnalysisResult,
} from './public-menu-branding';

export {
  NotificationReadiness,
  type NotificationReadinessKey,
} from './notification-readiness';

export type {
  StaffPushDeliveryEnvelope,
  StaffPushDeviceTarget,
} from './staff-push-delivery';

export {
  STAFF_BRANCH_ACCESS_SCOPE,
  type StaffBranchAccessScope,
} from './staff-branch-session';

export {
  STAFF_AUTH_SCHEME,
  STAFF_HTTP_HEADER,
  STAFF_WS,
  STAFF_WS_HANDSHAKE_AUTH_TOKEN_KEY,
  getStaffBranchIdFromHeaders,
  staffAuthorizationBearer,
  staffHttpHeaderLower,
  staffWsBranchRoom,
  type StaffWsJoinBranchPayload,
} from './staff-client-protocol';
