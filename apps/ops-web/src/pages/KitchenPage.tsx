import { useVirtualizer } from "@tanstack/react-virtual"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { memo, useRef } from "react"
import type { PrepTicketStatus } from "@restocafe/types"
import { PrepTicketStatus as TicketStatus } from "@restocafe/types"

import {
  ConnectionBadge,
  MetricCard,
  PageFrame,
  PageHeader,
  StatePanel,
} from "@/components/ConsoleUi"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useLanguage } from "@/i18n/context"
import { apiFetch, branchPaths } from "@/lib/api"
import { useBranchRealtimeConnected } from "@/lib/use-branch-realtime-connected"
import { useBranchId } from "@/lib/use-branch-id"
import { useOnlineStatus } from "@/lib/use-online-status"
import { useTabVisible } from "@/lib/use-tab-visible"
import type {
  PatchPreparationTicketBody,
  PreparationTicketListItem,
} from "@/lib/contract/staff-api"

const NEXT_PREP_STATUS: Partial<Record<PrepTicketStatus, PrepTicketStatus>> = {
  [TicketStatus.NEW]: TicketStatus.ACCEPTED,
  [TicketStatus.ACCEPTED]: TicketStatus.PREPARING,
  [TicketStatus.PREPARING]: TicketStatus.READY,
  [TicketStatus.READY]: TicketStatus.DELIVERED,
}

function nextPrepStatus(current: PrepTicketStatus): PrepTicketStatus {
  return NEXT_PREP_STATUS[current] ?? TicketStatus.DELIVERED
}

const TICKETS_VIRTUAL_THRESHOLD = 28

const TicketCard = memo(function TicketCard({
  ticket,
  onAdvance,
  pending,
  advanceLabel,
  deliverLabel,
  updatingLabel,
}: {
  ticket: PreparationTicketListItem
  onAdvance: (ticketId: string, status: PrepTicketStatus) => void
  pending: boolean
  advanceLabel: string
  deliverLabel: string
  updatingLabel: string
}) {
  return (
    <Card
      data-testid={`prep-ticket-${ticket.id}`}
      className="flex items-center justify-between gap-4 border-border/60 bg-card/80 px-4 py-4"
    >
      <div>
        <div className="font-semibold">{ticket.orderItem.menuItem.name}</div>
        <div className="mt-1 text-xs uppercase tracking-[0.22em] text-muted-foreground">
          {ticket.status}
        </div>
      </div>
      <Button
        type="button"
        data-testid="prep-ticket-advance"
        className="min-h-11 min-w-24 touch-manipulation"
        disabled={pending}
        aria-busy={pending}
        onClick={() => onAdvance(ticket.id, nextPrepStatus(ticket.status))}
      >
        {pending ? updatingLabel : ticket.status === TicketStatus.READY ? deliverLabel : advanceLabel}
      </Button>
    </Card>
  )
})

export function KitchenPage({ station }: { station: "KITCHEN" | "BAR" }) {
  const { t } = useLanguage()
  const stationCopy = station === "BAR" ? t.bar : t.kitchen
  const branchId = useBranchId()
  const listParentRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()
  const realtimeConnected = useBranchRealtimeConnected()
  const tabVisible = useTabVisible()
  const online = useOnlineStatus()

  const q = useQuery({
    queryKey: ["tickets", station, branchId],
    queryFn: () => {
      if (!branchId) {
        throw new Error(t.kitchen.noBranch)
      }
      const path =
        station === "BAR"
          ? branchPaths.barTickets(branchId)
          : branchPaths.kitchenTickets(branchId)
      return apiFetch<PreparationTicketListItem[]>(path)
    },
    enabled: !!branchId,
    staleTime: 8_000,
    refetchInterval:
      tabVisible && !realtimeConnected ? 12_000 : tabVisible && realtimeConnected ? 60_000 : false,
  })

  const advance = useMutation({
    mutationFn: async (payload: { ticketId: string; status: PrepTicketStatus }) => {
      if (!branchId) {
        throw new Error(t.kitchen.noBranch)
      }
      const patchPath =
        station === "BAR"
          ? branchPaths.barTicket(branchId, payload.ticketId)
          : branchPaths.kitchenTicket(branchId, payload.ticketId)
      await apiFetch(patchPath, {
        method: "PATCH",
        body: JSON.stringify({ status: payload.status } satisfies PatchPreparationTicketBody),
      })
    },
    onSuccess: () => {
      if (branchId) {
        void qc.invalidateQueries({ queryKey: ["tickets", station, branchId] })
      }
    },
  })

  const handleAdvance = (ticketId: string, status: PrepTicketStatus) =>
    advance.mutate({ ticketId, status })

  const rows = q.data ?? []
  const readyCount = rows.filter((ticket) => ticket.status === TicketStatus.READY).length
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => listParentRef.current,
    estimateSize: () => 96,
    overscan: 8,
  })
  const useVirtual = rows.length > TICKETS_VIRTUAL_THRESHOLD

  return (
    <PageFrame>
      <PageHeader
        eyebrow={stationCopy.eyebrow}
        title={stationCopy.title}
        description={stationCopy.description}
        status={<ConnectionBadge realtimeConnected={realtimeConnected} online={online} />}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <MetricCard
          label={stationCopy.metrics.tickets}
          value={rows.length || "--"}
          detail={stationCopy.metrics.ticketsDetail}
        />
        <MetricCard
          label={stationCopy.metrics.ready}
          value={readyCount}
          detail={stationCopy.metrics.readyDetail}
          tone={readyCount > 0 ? "amber" : "default"}
        />
        <MetricCard
          label={stationCopy.metrics.syncMode}
          value={realtimeConnected ? stationCopy.metrics.syncLive : stationCopy.metrics.syncPolling}
          detail={online ? stationCopy.metrics.syncHealthy : stationCopy.metrics.syncOffline}
          tone={online && realtimeConnected ? "emerald" : "amber"}
        />
      </div>

      {advance.isError ? (
        <StatePanel
          compact
          variant="error"
          title={stationCopy.states.advanceErrorTitle}
          description={(advance.error as Error).message}
        />
      ) : null}

      {q.isLoading ? (
        <StatePanel
          variant="loading"
          title={stationCopy.states.loadingTitle}
          description={stationCopy.states.loadingBody}
        />
      ) : null}

      {q.isError ? (
        <StatePanel
          variant="error"
          title={stationCopy.states.errorTitle}
          description={(q.error as Error).message}
          action={
            <Button type="button" variant="outline" onClick={() => void q.refetch()}>
              {t.common.retry}
            </Button>
          }
        />
      ) : null}

      {!q.isLoading && !q.isError && rows.length === 0 ? (
        <StatePanel
          variant="empty"
          title={stationCopy.states.emptyTitle}
          description={stationCopy.states.emptyBody}
        />
      ) : null}

      {!q.isLoading && !q.isError && rows.length > 0 ? (
        useVirtual ? (
          <div
            ref={listParentRef}
            className="max-h-[min(72vh,640px)] overflow-auto rounded-2xl border border-border/60 bg-card/70 p-3"
          >
            <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const ticket = rows[virtualItem.index]!
                return (
                  <div
                    key={ticket.id}
                    className="absolute left-0 top-0 w-full py-1.5"
                    style={{ transform: `translateY(${virtualItem.start}px)` }}
                  >
                    <TicketCard
                      ticket={ticket}
                      onAdvance={handleAdvance}
                      pending={advance.isPending && advance.variables?.ticketId === ticket.id}
                      advanceLabel={stationCopy.actions.advance}
                      deliverLabel={stationCopy.actions.deliver}
                      updatingLabel={stationCopy.actions.updating}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onAdvance={handleAdvance}
                pending={advance.isPending && advance.variables?.ticketId === ticket.id}
                advanceLabel={stationCopy.actions.advance}
                deliverLabel={stationCopy.actions.deliver}
                updatingLabel={stationCopy.actions.updating}
              />
            ))}
          </div>
        )
      ) : null}
    </PageFrame>
  )
}
