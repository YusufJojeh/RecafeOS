/**
 * Public (unauthenticated) menu + guest order shapes — `PublicModule` + `PublicMenuPage`.
 * Staff shapes stay in `./staff-api.ts`.
 */

import type {
  OrderStatus,
  PublicGuestCustomerStatus,
  PublicMenuBrandingPayload,
} from '@restocafe/types'

export type PublicGuestModifierOption = {
  id: string
  name: string
  priceDelta: number
  sortOrder: number
}

export type PublicGuestModifierGroup = {
  id: string
  name: string
  minSelect: number
  maxSelect: number
  required: boolean
  options: PublicGuestModifierOption[]
}

export type PublicGuestMenuItem = {
  id: string
  name: string
  description?: string | null
  priceMinor: number
  imageUrl?: string | null
  available: boolean
  visible: boolean
  modifierGroups: { modifierGroup: PublicGuestModifierGroup }[]
}

/** Session-scoped or slug menu JSON — see `PublicService` menu builders. */
export type PublicGuestMenuResponse = {
  branch: { id?: string; name: string; slug?: string }
  tenant?: { slug: string }
  branding?: PublicMenuBrandingPayload | null
  categories: { name: string; items: PublicGuestMenuItem[] }[]
}

/** `POST …/sessions/:token/order` body — `PublicCreateOrderDto`. */
export type PublicGuestCreateOrderBody = {
  items: Array<{
    menuItemId: string
    quantity: number
    modifierOptionIds?: string[]
    notes?: string
  }>
}

/** `POST …/sessions/:token/order` success body (subset used by UI). */
export type PublicGuestOrderSummary = {
  orderId: string
  orderRef: string
  status: OrderStatus
  customerStatus: PublicGuestCustomerStatus
  totalMinor: number
  itemCount: number
  lines: { name: string; quantity: number; lineTotalMinor: number }[]
}

/** `GET …/sessions/:token/orders/:orderId` — polling shape. */
export type PublicGuestOrderStatusPayload = {
  orderId: string
  customerStatus: PublicGuestCustomerStatus
  status: OrderStatus
  orderRef: string
  totalMinor: number
}

/**
 * Paths under `/api/v1` for public guest menu (no staff JWT). Align with `PublicController`.
 */
export const publicGuestPaths = {
  branchMenu: (tenantSlug: string, branchSlug: string) =>
    `/public/tenants/${tenantSlug}/branches/${branchSlug}/menu`,
  sessionMenu: (tenantSlug: string, branchSlug: string, token: string) =>
    `/public/tenants/${tenantSlug}/branches/${branchSlug}/sessions/${token}/menu`,
  sessionOrder: (tenantSlug: string, branchSlug: string, token: string) =>
    `/public/tenants/${tenantSlug}/branches/${branchSlug}/sessions/${token}/order`,
  sessionOrderStatus: (
    tenantSlug: string,
    branchSlug: string,
    token: string,
    orderId: string,
  ) =>
    `/public/tenants/${tenantSlug}/branches/${branchSlug}/sessions/${token}/orders/${orderId}`,
} as const
