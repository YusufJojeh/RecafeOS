/**
 * Staff REST shapes for operational hot paths (mobile-relevant + floor/cashier/kitchen).
 * Auth: `./auth-api.ts`. Public/guest: `./public-guest-api.ts`.
 *
 * Sources of truth: Nest controllers + Prisma selects (e.g. `OrderReadService`, `TablesService`,
 * `KitchenService`). Prefer `pnpm run contract:openapi:export` + codegen when you need exhaustive parity.
 */

import type {
  FloorTableStatus,
  OrderStatus,
  OrderType,
  PaymentStatus,
  PrepTicketStatus,
  TableSessionStatus,
} from '@restocafe/types'

// ─── Tenant / branch context ───────────────────────────────────────────────

/** `GET /tenants/branches` — `BranchesService.listForTenant`. */
export type StaffBranchSummary = {
  id: string
  name: string
  slug: string
}

export type CommerceReadModel = {
  limits: {
    maxBranches: number
    branchesInUse: number
  }
}

/** `GET …/ops-snapshot` — `BranchesService.getOpsSnapshot`. */
export type OpsSnapshot = {
  readyForGoLive: boolean
  blockingIncompleteCount: number
  lowStockCount: number
  openShiftPresent: boolean
}

// ─── Floor / table sessions ───────────────────────────────────────────────

/** `POST …/tables/sessions` body — `OpenSessionDto`. */
export type OpenTableSessionBody = {
  floorTableId: string
  guestCount: number
}

export type TableSessionOpenResponse = {
  id: string
}

/**
 * `GET …/tables` — `TablesService.listTables` (open sessions only on each table).
 */
export type StaffFloorTableRow = {
  id: string
  label: string
  status: FloorTableStatus
  sessions: Array<{ id: string; guestCount: number; status: TableSessionStatus }>
}

// ─── Menu (staff) ──────────────────────────────────────────────────────────

export type MenuCategoryWithItems = {
  id: string
  name: string
  items: { id: string; name: string; priceMinor: number }[]
}

/** `GET …/menu/categories` for menu management — items include availability. */
export type StaffMenuCategoryListRow = {
  id: string
  name: string
  items: Array<{
    id: string
    name: string
    priceMinor: number
    available: boolean
  }>
}

// ─── Orders (open list + cashier detail) ───────────────────────────────────

/** Payment method on stored payments — Prisma `PaymentMethod` enum as string. */
export type StaffOrderPaymentMethod = 'CASH' | 'CARD' | 'OTHER'

/** Open-orders list line item projection (`OrderRepository.listOpen`). */
export type StaffOpenOrderListLineItem = {
  id: string
  menuItemId: string
  quantity: number
  unitPriceMinor: number
  lineTotalMinor: number
  notes: string | null
}

export type StaffOpenOrderListItem = {
  id: string
  status: OrderStatus
  type: OrderType
  customerId: string | null
  returningGuest: boolean
  subtotalMinor: number
  totalMinor: number
  createdAt: string
  tableSession: {
    id: string
    guestCount: number
    status: TableSessionStatus
    floorTableId: string
  } | null
  /** API includes line items on list payload; list UI may ignore. */
  discountMinor?: number
  items?: StaffOpenOrderListLineItem[]
}

export type StaffOpenOrdersListResponse = {
  items: StaffOpenOrderListItem[]
  nextCursor: { createdAt: string; id: string } | null
}

export type StaffOrderDetail = {
  id: string
  status: OrderStatus
  type: OrderType
  customerId: string | null
  returningGuest: boolean
  subtotalMinor: number
  totalMinor: number
  discountMinor: number
  createdAt: string
  paidAt: string | null
  tableSession: {
    id: string
    guestCount: number
    status: TableSessionStatus
    floorTable: {
      id: string
      label: string
    }
  } | null
  items: Array<{
    id: string
    quantity: number
    unitPriceMinor: number
    lineTotalMinor: number
    notes: string | null
    menuItem: {
      id: string
      name: string
    }
  }>
  payments: Array<{
    id: string
    amountMinor: number
    method: StaffOrderPaymentMethod
    status: PaymentStatus
    createdAt: string
  }>
}

/** `POST …/orders` body — `CreateOrderDto`. */
export type StaffCreateOrderBody = {
  type: OrderType
  tableSessionId?: string
  customerId?: string
  sourceNote?: string
}

/** `POST …/orders/:orderId/items` body — `AddOrderItemDto`. */
export type StaffAddOrderItemBody = {
  menuItemId: string
  quantity: number
  notes?: string
  modifierOptionIds?: string[]
  expectedVersion?: number
}

/** `POST …/orders/:orderId/close` body — `CloseBillDto`. */
export type StaffCloseBillBody = {
  method: StaffOrderPaymentMethod
  customerPhone?: string
}

/** `POST …/tables/sessions/merge` body — `MergeSessionsDto`. */
export type StaffMergeTableSessionsBody = {
  targetSessionId: string
  sourceSessionId: string
}

/**
 * `POST …/orders` success — server returns full `Order` row; clients should rely on these fields minimum.
 */
export type StaffOrderCreateResponse = {
  id: string
  status: OrderStatus
  type: OrderType
}

/** `POST …/orders/:id/served` / `…/close` — full order row; hot-path clients use `status` (+ `paidAt` after close). */
export type StaffOrderWriteResult = {
  id: string
  status: OrderStatus
  paidAt?: string | Date | null
}

// ─── Kitchen / preparation ─────────────────────────────────────────────────

/** `GET …/kitchen/tickets` / `…/bar/tickets` — `KitchenService.listTickets` (subset used by ops-web). */
export type PreparationTicketListItem = {
  id: string
  status: PrepTicketStatus
  orderItem: { menuItem: { name: string } }
}

/** `PATCH …/tickets/:id` body — `PatchTicketDto`. */
export type PatchPreparationTicketBody = {
  status: PrepTicketStatus
}

// ─── Customers ───────────────────────────────────────────────────────────────

export type StaffCustomerSearchHit = {
  id: string
  phone: string
  name: string | null
  visitCount: number
}

export type StaffCustomerDetail = {
  id: string
  phone: string
  name: string | null
  notes: string | null
  tags: string[]
  visitCount: number
  visits: Array<{
    id: string
    visitedAt: string
    branch: { id: string; name: string; slug: string }
    order: {
      id: string
      totalMinor: number
      type: string
      status: string
      paidAt: string | null
    } | null
  }>
  noteEntries: Array<{
    id: string
    body: string
    category: string
    createdAt: string
    branch: { id: string; name: string } | null
    createdBy: { id: string; displayName: string } | null
  }>
  offers: Array<{
    id: string
    title: string
    kind: string
    redeemed: boolean
    validUntil: string | null
    eligible?: boolean
    eligibilityMessage?: string
  }>
  intelligence: {
    daysSinceLastVisit: number | null
    visitsLast90Days: number
    primaryBranch: { id: string; name: string } | null
    segment: string
  }
  suggestedActions: Array<{ type: string; message: string }>
}

export type StaffRepeatCustomersReport = {
  customers: Array<{
    customerId: string
    phone: string
    name: string | null
    paidOrderCount: number
    netPaidSalesMinor: number
  }>
  days: number
}

export type StaffArchiveStaleVisitsResponse = {
  deletedVisitRows: number
  years: number
  cutoffUtc: string
}

/** @deprecated Alias for `StaffOrderCreateResponse` — prefer the explicit name. */
export type OrderCreateResponse = StaffOrderCreateResponse
