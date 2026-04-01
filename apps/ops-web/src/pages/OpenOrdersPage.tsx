import { useVirtualizer } from "@tanstack/react-virtual"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { memo, useMemo, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"

import {
  ConnectionBadge,
  MetricCard,
  PageFrame,
  PageHeader,
  StatePanel,
} from "@/components/ConsoleUi"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toast } from "@/components/ui/sonner"
import { Input } from "@/components/ui/input"
import { useLanguage } from "@/i18n/context"
import { OrderStatus, STAFF_HTTP_HEADER } from "@restocafe/types"
import { ApiError, apiFetch, branchPaths, isNetworkError } from "@/lib/api"
import { describeApiError } from "@/lib/api-error-copy"
import { enqueueMutation } from "@/lib/offline-queue"
import { useBranchRealtimeConnected } from "@/lib/use-branch-realtime-connected"
import { useBranchId } from "@/lib/use-branch-id"
import { useOnlineStatus } from "@/lib/use-online-status"
import { useTabVisible } from "@/lib/use-tab-visible"
import type {
  StaffCloseBillBody,
  StaffOpenOrderListItem,
  StaffOpenOrdersListResponse,
  StaffOrderDetail,
  StaffOrderPaymentMethod,
  StaffOrderWriteResult,
} from "@/lib/contract/staff-api"

type CashierNotice = {
  orderId: string
  method: StaffOrderPaymentMethod
  totalMinor: number
  mode: "closed" | "queued"
}

const OPEN_ORDERS_VIRTUAL_THRESHOLD = 28

function formatMinor(minor: number): string {
  return (minor / 100).toFixed(2)
}

function isPayableStatus(status: OrderStatus): boolean {
  return status === OrderStatus.READY || status === OrderStatus.SERVED
}

function buildIdempotencyKey(orderId: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `cashier-close:${orderId}:${crypto.randomUUID()}`
  }
  return `cashier-close:${orderId}:${Date.now()}`
}

function formatCloseBillError(error: unknown, t: ReturnType<typeof useLanguage>["t"]): string {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return t.orders.errors.closeBillForbidden
    }
    if (error.status === 409) {
      return t.orders.errors.closeBillConflict
    }
    if (error.status === 422) {
      return t.orders.errors.closeBillInvalid
    }
    if (error.status >= 500) {
      return t.orders.errors.closeBillServer
    }
  }
  return error instanceof Error ? error.message : t.orders.errors.closeBillFallback
}

function formatServedError(error: unknown, t: ReturnType<typeof useLanguage>["t"]): string {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return t.orders.errors.servedForbidden
    }
    if (error.status === 409) {
      return t.orders.errors.servedConflict
    }
    if (error.status >= 500) {
      return t.orders.errors.servedServer
    }
  }
  return error instanceof Error ? error.message : t.orders.errors.servedFallback
}

function formatDetailError(error: unknown, t: ReturnType<typeof useLanguage>["t"]): string {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return t.orders.errors.detailNotFound
    }
    if (error.status === 401 || error.status === 403) {
      return t.orders.errors.detailForbidden
    }
  }
  return error instanceof Error ? error.message : t.orders.errors.detailFallback
}

const OrderRow = memo(function OrderRow({
  order,
  onCashier,
  t,
}: {
  order: StaffOpenOrderListItem
  onCashier: (order: StaffOpenOrderListItem) => void
  t: ReturnType<typeof useLanguage>["t"]
}) {
  const payable = isPayableStatus(order.status)

  return (
    <Card data-testid={`open-order-row-${order.id}`} className="border-border/60 bg-card/80 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {order.id.slice(0, 8)}...
            </span>
            <Badge variant="outline" className="text-[11px] uppercase tracking-[0.18em]">
              {order.status}
            </Badge>
            <span className="text-xs text-muted-foreground">{order.type}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {new Date(order.createdAt).toLocaleString()}
            {order.tableSession
              ? ` - ${t.orders.rows.guests.replace(
                  "{count}",
                  String(order.tableSession.guestCount)
                )}`
              : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold">{formatMinor(order.totalMinor)}</div>
          <div className="text-xs text-muted-foreground">{t.orders.rows.amountDue}</div>
        </div>
      </div>
      {order.customerId && order.returningGuest ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-emerald-200">
          <span>{t.orders.rows.returningGuest}</span>
          <Link
            className="text-emerald-200 underline"
            to={`/customers?id=${encodeURIComponent(order.customerId)}`}
          >
            {t.orders.rows.viewCustomer}
          </Link>
        </div>
      ) : order.customerId ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{t.orders.rows.guestLinked}</span>
          <Link
            className="text-emerald-200 underline"
            to={`/customers?id=${encodeURIComponent(order.customerId)}`}
          >
            {t.orders.rows.viewCustomer}
          </Link>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
        <div className="text-xs text-muted-foreground">
          {payable ? t.orders.rows.readyForCashier : t.orders.rows.notPayable}
        </div>
        <Button
          type="button"
          data-testid={`open-cashier-${order.id}`}
          variant={payable ? "default" : "outline"}
          className="min-h-11"
          onClick={() => onCashier(order)}
        >
          {t.orders.rows.openCashier}
        </Button>
      </div>
    </Card>
  )
})

function CashierDialog({
  branchId,
  order,
  onDismiss,
  onClosed,
  onQueued,
}: {
  branchId: string
  order: StaffOpenOrderListItem
  onDismiss: () => void
  onClosed: (notice: CashierNotice) => void
  onQueued: (notice: CashierNotice) => void
}) {
  const { t } = useLanguage()
  const qc = useQueryClient()
  const online = useOnlineStatus()
  const [paymentMethod, setPaymentMethod] = useState<StaffOrderPaymentMethod>("CASH")
  const [customerPhone, setCustomerPhone] = useState("")
  const idempotencyKeyRef = useRef<string | null>(null)

  const detailQuery = useQuery({
    queryKey: ["order-detail", branchId, order.id],
    queryFn: () => apiFetch<StaffOrderDetail>(branchPaths.orderDetail(branchId, order.id)),
    enabled: !!branchId,
    retry: false,
    refetchInterval: 4_000,
  })

  const markServed = useMutation({
    mutationFn: () =>
      apiFetch<StaffOrderWriteResult>(branchPaths.orderServed(branchId, order.id), { method: "POST" }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["open-orders", branchId] }),
        detailQuery.refetch(),
      ])
    },
  })

  const closeBill = useMutation({
    mutationFn: async (payload: StaffCloseBillBody) => {
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = buildIdempotencyKey(order.id)
      }
      return apiFetch<StaffOrderWriteResult>(branchPaths.orderClose(branchId, order.id), {
        method: "POST",
        headers: { [STAFF_HTTP_HEADER.IDEMPOTENCY_KEY]: idempotencyKeyRef.current },
        body: JSON.stringify(payload),
      })
    },
    onSuccess: async (_result, variables) => {
      const totalMinor = detailQuery.data?.totalMinor ?? order.totalMinor
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["open-orders", branchId] }),
        qc.invalidateQueries({ queryKey: ["tables", branchId] }),
      ])
      onClosed({
        orderId: order.id,
        method: variables.method,
        totalMinor,
        mode: "closed",
      })
    },
  })

  const detail = detailQuery.data
  const currentStatus = detail?.status ?? order.status
  const canMarkServed = currentStatus === OrderStatus.READY
  const canCloseBill = isPayableStatus(currentStatus)
  const amountDueMinor = detail?.totalMinor ?? order.totalMinor
  const lineItems = detail?.items ?? []
  const tableLabel = detail?.tableSession?.floorTable.label
  const guestCount = detail?.tableSession?.guestCount ?? order.tableSession?.guestCount ?? null

  const buildClosePayload = () => {
    const trimmedPhone = customerPhone.trim()
    return {
      method: paymentMethod,
      customerPhone: trimmedPhone.length > 0 ? trimmedPhone : undefined,
    }
  }

  const queueCloseRetry = async () => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = buildIdempotencyKey(order.id)
    }
    try {
      await enqueueMutation({
        kind: "close-bill",
        label: `${t.orders.cashier.label} ${order.id.slice(0, 8)}`,
        path: branchPaths.orderClose(branchId, order.id),
        method: "POST",
        headers: {
          [STAFF_HTTP_HEADER.IDEMPOTENCY_KEY]: idempotencyKeyRef.current,
          [STAFF_HTTP_HEADER.BRANCH_ID]: branchId,
        },
        body: JSON.stringify(buildClosePayload()),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(t.orders.cashier.offlineQueueFailed.replace("{reason}", msg))
      return
    }
    onQueued({
      orderId: order.id,
      method: paymentMethod,
      totalMinor: amountDueMinor,
      mode: "queued",
    })
  }

  const submitClose = () => {
    if (!online) {
      void queueCloseRetry()
      return
    }
    closeBill.mutate(buildClosePayload())
  }

  const paymentOptions: Array<{ value: StaffOrderPaymentMethod; label: string; detail: string }> = [
    { value: "CASH", label: t.orders.payment.cash, detail: t.orders.payment.cashDetail },
    { value: "CARD", label: t.orders.payment.card, detail: t.orders.payment.cardDetail },
    { value: "OTHER", label: t.orders.payment.other, detail: t.orders.payment.otherDetail },
  ]

  return (
    <div className="fixed inset-0 z-40 bg-background/80 p-4 backdrop-blur-sm sm:p-6">
      <div className="mx-auto flex min-h-full max-w-3xl items-end justify-center sm:items-center">
        <Card
          role="dialog"
          aria-modal="true"
          aria-labelledby="cashier-dialog-title"
          data-testid="cashier-dialog"
          className="w-full border-border/60 bg-card/95 p-5 shadow-2xl sm:p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                {t.orders.cashier.label}
              </div>
              <h2 id="cashier-dialog-title" className="text-2xl font-semibold tracking-tight">
                {t.orders.cashier.title}
              </h2>
              <div className="text-sm text-muted-foreground">
                {t.orders.cashier.orderLabel.replace("{id}", order.id.slice(0, 8))}
                {tableLabel
                  ? ` - ${t.orders.cashier.tableLabel.replace("{table}", tableLabel)}`
                  : ` - ${order.type}`}
              </div>
            </div>
            <Button type="button" variant="ghost" onClick={onDismiss}>
              {t.common.back}
            </Button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <MetricCard
              label={t.orders.cashier.amountDue}
              value={formatMinor(amountDueMinor)}
              detail={t.orders.cashier.amountDetail}
            />
            <MetricCard
              label={t.orders.cashier.status}
              value={currentStatus}
              detail={t.orders.cashier.statusDetail}
            />
            <MetricCard
              label={t.orders.cashier.guests}
              value={guestCount ?? "--"}
              detail={
                detail?.createdAt
                  ? new Date(detail.createdAt).toLocaleString()
                  : new Date(order.createdAt).toLocaleString()
              }
            />
          </div>

          {detailQuery.isLoading ? (
            <StatePanel
              className="mt-5"
              variant="loading"
              compact
              title={t.orders.cashier.loadingTitle}
              description={t.orders.cashier.loadingBody}
            />
          ) : null}

          {detailQuery.isError ? (
            <StatePanel
              className="mt-5"
              variant="error"
              title={t.orders.cashier.errorTitle}
              description={formatDetailError(detailQuery.error, t)}
              action={
                <Button type="button" variant="outline" onClick={() => void detailQuery.refetch()}>
                  {t.common.retry}
                </Button>
              }
            />
          ) : null}

          {!detailQuery.isLoading && !detailQuery.isError ? (
            <>
              <Card className="mt-5 border-border/60 bg-muted/20 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">{t.orders.cashier.linesTitle}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.orders.cashier.linesCount.replace("{count}", String(lineItems.length))}
                  </div>
                </div>
                {lineItems.length > 0 ? (
                  <ul className="space-y-3">
                    {lineItems.map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/60 bg-background px-4 py-3"
                      >
                        <div>
                          <div className="font-medium">
                            {item.quantity} x {item.menuItem.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t.orders.cashier.unitLabel.replace(
                              "{price}",
                              formatMinor(item.unitPriceMinor)
                            )}
                            {item.notes ? ` - ${item.notes}` : ""}
                          </div>
                        </div>
                        <div className="text-sm font-medium">
                          {formatMinor(item.lineTotalMinor)}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {t.orders.cashier.linesEmpty}
                  </div>
                )}
              </Card>

              {markServed.isError ? (
                <StatePanel
                  className="mt-5"
                  compact
                  variant="error"
                  title={t.orders.cashier.servedErrorTitle}
                  description={formatServedError(markServed.error, t)}
                />
              ) : null}

              {closeBill.isError ? (
                <StatePanel
                  className="mt-5"
                  compact
                  variant="error"
                  title={t.orders.cashier.closeErrorTitle}
                  description={formatCloseBillError(closeBill.error, t)}
                  action={
                    isNetworkError(closeBill.error) ? (
                      <Button type="button" variant="outline" onClick={() => void queueCloseRetry()}>
                        {t.orders.cashier.queueRetry}
                      </Button>
                    ) : undefined
                  }
                />
              ) : null}

              {!online ? (
                <StatePanel
                  className="mt-5"
                  compact
                  variant="info"
                  title={t.orders.cashier.offlineTitle}
                  description={t.orders.cashier.offlineBody}
                />
              ) : null}

              {!canCloseBill ? (
                <StatePanel
                  className="mt-5"
                  variant="info"
                  title={t.orders.cashier.notPayableTitle}
                  description={t.orders.cashier.notPayableBody}
                  action={
                    <Button type="button" variant="outline" onClick={() => void detailQuery.refetch()}>
                      {t.orders.cashier.refreshStatus}
                    </Button>
                  }
                />
              ) : null}

              <Card className="mt-5 border-border/60 bg-muted/20 p-4">
                <div className="mb-3 text-sm font-semibold">{t.orders.cashier.paymentTitle}</div>
                <div className="grid gap-3 md:grid-cols-3">
                  {paymentOptions.map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer gap-3 rounded-xl border border-border/60 bg-background px-4 py-3 text-sm text-foreground"
                    >
                      <input
                        type="radio"
                        name="payment-method"
                        value={option.value}
                        checked={paymentMethod === option.value}
                        onChange={() => setPaymentMethod(option.value)}
                        disabled={closeBill.isPending}
                      />
                      <span>
                        <span className="block font-medium">{option.label}</span>
                        <span className="block text-xs text-muted-foreground">{option.detail}</span>
                      </span>
                    </label>
                  ))}
                </div>

                <div className="mt-4">
                  <label htmlFor="cashier-customer-phone" className="mb-2 block text-sm font-medium">
                    {t.orders.cashier.phoneLabel}
                  </label>
                  <Input
                    id="cashier-customer-phone"
                    type="tel"
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    placeholder={t.orders.cashier.phonePlaceholder}
                    disabled={closeBill.isPending}
                  />
                </div>
              </Card>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-5">
                <div className="text-xs text-muted-foreground">{t.orders.cashier.idempotency}</div>
                <div className="flex flex-wrap gap-2">
                  {canMarkServed ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => markServed.mutate()}
                      disabled={markServed.isPending || closeBill.isPending}
                    >
                      {markServed.isPending ? t.orders.cashier.markingServed : t.orders.cashier.markServed}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    data-testid="cashier-close-bill"
                    className="min-h-11"
                    onClick={submitClose}
                    disabled={!canCloseBill || closeBill.isPending || markServed.isPending || detailQuery.isLoading}
                    aria-busy={closeBill.isPending}
                  >
                    {closeBill.isPending ? t.orders.cashier.closingBill : t.orders.cashier.closeBill}
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </Card>
      </div>
    </div>
  )
}

export function OpenOrdersPage() {
  const { t } = useLanguage()
  const branchId = useBranchId()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeOrder, setActiveOrder] = useState<StaffOpenOrderListItem | null>(null)
  const [cashierNotice, setCashierNotice] = useState<CashierNotice | null>(null)
  const realtimeConnected = useBranchRealtimeConnected()
  const listParentRef = useRef<HTMLDivElement>(null)
  const tabVisible = useTabVisible()
  const online = useOnlineStatus()

  const tableFilterId = searchParams.get("tableId")?.trim() || null
  const tableFilterLabel = searchParams.get("tableLabel")?.trim() || null

  const q = useQuery({
    queryKey: ["open-orders", branchId],
    queryFn: () => apiFetch<StaffOpenOrdersListResponse>(branchPaths.openOrders(branchId!)),
    enabled: !!branchId,
    staleTime: 8_000,
    refetchInterval:
      tabVisible && !realtimeConnected ? 12_000 : tabVisible && realtimeConnected ? 60_000 : false,
  })

  const items = useMemo(() => q.data?.items ?? [], [q.data?.items])
  const displayedItems = useMemo(() => {
    if (!tableFilterId) return items
    return items.filter((o) => o.tableSession?.floorTableId === tableFilterId)
  }, [items, tableFilterId])
  const returningGuestCount = items.filter((item) => item.returningGuest).length
  const virtualizer = useVirtualizer({
    count: displayedItems.length,
    getScrollElement: () => listParentRef.current,
    estimateSize: () => 136,
    overscan: 6,
  })
  const useVirtual = displayedItems.length > OPEN_ORDERS_VIRTUAL_THRESHOLD
  const openCashier = (selectedOrder: StaffOpenOrderListItem) => {
    setCashierNotice(null)
    setActiveOrder(selectedOrder)
  }

  const clearTableFilter = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete("tableId")
      next.delete("tableLabel")
      return next
    })
  }

  const filterLabelDisplay = tableFilterLabel ?? tableFilterId ?? ""

  return (
    <PageFrame>
      <PageHeader
        eyebrow={t.orders.eyebrow}
        title={t.orders.title}
        description={t.orders.description}
        status={<ConnectionBadge realtimeConnected={realtimeConnected} online={online} />}
      />

      {tableFilterId ? (
        <StatePanel
          className="mb-6"
          compact
          variant="info"
          title={t.orders.tableFilter.bannerTitle}
          description={t.orders.tableFilter.bannerBody.replace("{label}", filterLabelDisplay)}
          action={
            <Button type="button" variant="outline" onClick={clearTableFilter}>
              {t.orders.tableFilter.clearFilter}
            </Button>
          }
        />
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <MetricCard
          label={t.orders.metrics.openOrders}
          value={items.length || "--"}
          detail={t.orders.metrics.openOrdersDetail}
        />
        <MetricCard
          label={t.orders.metrics.returningGuests}
          value={returningGuestCount}
          detail={t.orders.metrics.returningGuestsDetail}
          tone={returningGuestCount > 0 ? "emerald" : "default"}
        />
        <MetricCard
          label={t.orders.metrics.syncMode}
          value={realtimeConnected ? t.orders.metrics.syncLive : t.orders.metrics.syncPolling}
          detail={online ? t.orders.metrics.syncHealthy : t.orders.metrics.syncOffline}
          tone={online && realtimeConnected ? "emerald" : "amber"}
        />
      </div>

      {cashierNotice ? (
        <StatePanel
          className="mb-6"
          compact
          variant={cashierNotice.mode === "queued" ? "info" : "success"}
          title={
            cashierNotice.mode === "queued"
              ? t.orders.noticeQueued.title
              : t.orders.notice.title
          }
          description={
            cashierNotice.mode === "queued"
              ? t.orders.noticeQueued.description
                  .replace("{id}", cashierNotice.orderId.slice(0, 8))
                  .replace("{method}", cashierNotice.method)
                  .replace("{amount}", formatMinor(cashierNotice.totalMinor))
              : t.orders.notice.description
                  .replace("{id}", cashierNotice.orderId.slice(0, 8))
                  .replace("{method}", cashierNotice.method)
                  .replace("{amount}", formatMinor(cashierNotice.totalMinor))
          }
        />
      ) : null}

      {q.isLoading ? (
        <StatePanel
          variant="loading"
          title={t.orders.states.loadingTitle}
          description={t.orders.states.loadingBody}
        />
      ) : null}

      {q.isError ? (
        <StatePanel
          variant="error"
          title={t.orders.states.errorTitle}
          description={describeApiError(q.error, {
            fallback: t.orders.states.errorFallback,
            byStatus: {
              401: t.orders.states.error401,
              403: t.orders.states.error403,
              429: t.orders.states.error429,
              500: t.orders.states.error500,
            },
          })}
          action={
            <Button type="button" variant="outline" onClick={() => void q.refetch()}>
              {t.common.retry}
            </Button>
          }
        />
      ) : null}

      {!q.isLoading && !q.isError && items.length === 0 ? (
        <StatePanel
          variant="empty"
          title={t.orders.states.emptyTitle}
          description={t.orders.states.emptyBody}
        />
      ) : null}

      {!q.isLoading && !q.isError && tableFilterId && items.length > 0 && displayedItems.length === 0 ? (
        <StatePanel
          variant="empty"
          title={t.orders.tableFilter.emptyTitle}
          description={t.orders.tableFilter.emptyBody}
          action={
            <Button type="button" variant="outline" onClick={clearTableFilter}>
              {t.orders.tableFilter.clearFilter}
            </Button>
          }
        />
      ) : null}

      {!q.isLoading && !q.isError && displayedItems.length > 0 ? (
        useVirtual ? (
          <div
            ref={listParentRef}
            className="max-h-[min(72vh,700px)] overflow-auto rounded-2xl border border-border/60 bg-card/70 p-3"
          >
            <ul className="relative w-full list-none p-0" style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const order = displayedItems[virtualItem.index]!
                return (
                  <li
                    key={order.id}
                    className="absolute inset-s-0 top-0 w-full py-1.5"
                    style={{ transform: `translateY(${virtualItem.start}px)` }}
                  >
                    <OrderRow order={order} onCashier={openCashier} t={t} />
                  </li>
                )
              })}
            </ul>
          </div>
        ) : (
          <ul className="space-y-3">
            {displayedItems.map((order) => (
              <li key={order.id}>
                <OrderRow order={order} onCashier={openCashier} t={t} />
              </li>
            ))}
          </ul>
        )
      ) : null}

      {branchId && activeOrder ? (
        <CashierDialog
          key={activeOrder.id}
          branchId={branchId}
          order={activeOrder}
          onDismiss={() => setActiveOrder(null)}
          onClosed={(notice) => {
            setCashierNotice(notice)
            setActiveOrder(null)
          }}
          onQueued={(notice) => {
            setCashierNotice(notice)
            setActiveOrder(null)
          }}
        />
      ) : null}
    </PageFrame>
  )
}
