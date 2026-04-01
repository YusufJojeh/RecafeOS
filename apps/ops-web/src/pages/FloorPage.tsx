import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Link } from "react-router-dom"

import { FloorDineInOrderModal } from "@/components/floor/FloorDineInOrderModal"
import { FloorOpenSessionModal } from "@/components/floor/FloorOpenSessionModal"
import {
  ConnectionBadge,
  MetricCard,
  PageFrame,
  PageHeader,
  StatePanel,
} from "@/components/ConsoleUi"
import { OperationalStrip } from "@/components/OperationalStrip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useLanguage } from "@/i18n/context"
import { FloorTableStatus } from "@restocafe/types"
import { apiFetch, branchPaths } from "@/lib/api"
import { useBranchId } from "@/lib/use-branch-id"
import { useBranchRealtimeConnected } from "@/lib/use-branch-realtime-connected"
import { useOnlineStatus } from "@/lib/use-online-status"
import { useTabVisible } from "@/lib/use-tab-visible"
import type { OpsSnapshot, StaffFloorTableRow } from "@/lib/contract/staff-api"

export function FloorPage() {
  const { t } = useLanguage()
  const branchId = useBranchId()
  const [sessionModal, setSessionModal] = useState<{
    floorTableId: string
    label: string
  } | null>(null)
  const [dineInModal, setDineInModal] = useState<{
    sessionId: string
    label: string
  } | null>(null)
  const realtimeConnected = useBranchRealtimeConnected()
  const tabVisible = useTabVisible()
  const online = useOnlineStatus()

  const branchRefetchInterval =
    tabVisible && !realtimeConnected ? 12_000 : tabVisible && realtimeConnected ? 60_000 : false

  const q = useQuery({
    queryKey: ["tables", branchId],
    queryFn: () => apiFetch<StaffFloorTableRow[]>(branchPaths.tables(branchId!)),
    enabled: !!branchId,
    staleTime: 8_000,
    refetchInterval: branchRefetchInterval,
  })

  const opsQ = useQuery({
    queryKey: ["ops-snapshot", branchId],
    queryFn: () => apiFetch<OpsSnapshot>(branchPaths.opsSnapshot(branchId!)),
    enabled: !!branchId,
    retry: false,
    staleTime: 8_000,
    refetchInterval: branchRefetchInterval,
  })

  const tables = q.data ?? []
  const occupiedCount = tables.filter(
    (table) => table.status === FloorTableStatus.OCCUPIED || table.sessions.length > 0
  ).length
  const activeSessions = tables.reduce((count, table) => count + table.sessions.length, 0)

  return (
    <PageFrame>
      {branchId && sessionModal ? (
        <FloorOpenSessionModal
          open
          branchId={branchId}
          floorTableId={sessionModal.floorTableId}
          tableLabel={sessionModal.label}
          onOpenChange={(open) => {
            if (!open) {
              setSessionModal(null)
            }
          }}
          onSessionOpened={(sessionId, label) => {
            setDineInModal({ sessionId, label })
          }}
        />
      ) : null}
      {branchId && dineInModal ? (
        <FloorDineInOrderModal
          open
          branchId={branchId}
          tableSessionId={dineInModal.sessionId}
          tableLabel={dineInModal.label}
          onOpenChange={(open) => {
            if (!open) {
              setDineInModal(null)
            }
          }}
        />
      ) : null}
      <PageHeader
        eyebrow={t.floor.eyebrow}
        title={t.floor.title}
        description={t.floor.description}
        status={<ConnectionBadge realtimeConnected={realtimeConnected} online={online} />}
      />

      <OperationalStrip data={opsQ.data} />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t.floor.metrics.tables}
          value={tables.length || "--"}
          detail={t.floor.metrics.tablesDetail}
        />
        <MetricCard
          label={t.floor.metrics.occupied}
          value={occupiedCount}
          detail={t.floor.metrics.occupiedDetail.replace(
            "{count}",
            String(Math.max(tables.length - occupiedCount, 0))
          )}
          tone={occupiedCount > 0 ? "amber" : "default"}
        />
        <MetricCard
          label={t.floor.metrics.liveSessions}
          value={activeSessions}
          detail={t.floor.metrics.sessionsDetail}
          tone={activeSessions > 0 ? "emerald" : "default"}
        />
        <MetricCard
          label={t.floor.metrics.syncMode}
          value={realtimeConnected ? t.floor.metrics.syncLive : t.floor.metrics.syncPolling}
          detail={online ? t.floor.metrics.syncHealthy : t.floor.metrics.syncOffline}
          tone={online && realtimeConnected ? "emerald" : "amber"}
        />
      </div>

      {q.isLoading ? (
        <StatePanel
          variant="loading"
          title={t.floor.states.loadingTitle}
          description={t.floor.states.loadingBody}
        />
      ) : null}

      {q.isError ? (
        <StatePanel
          variant="error"
          title={t.floor.states.errorTitle}
          description={(q.error as Error).message}
          action={
            <Button type="button" variant="outline" onClick={() => void q.refetch()}>
              {t.common.retry}
            </Button>
          }
        />
      ) : null}

      {!q.isLoading && !q.isError && tables.length === 0 ? (
        <StatePanel
          variant="empty"
          title={t.floor.states.emptyTitle}
          description={t.floor.states.emptyBody}
          action={
            <Button asChild>
              <Link to="/setup">{t.floor.states.openSetup}</Link>
            </Button>
          }
        />
      ) : null}

      {!q.isLoading && !q.isError && tables.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tables.map((table) => {
            const occupied = table.status === FloorTableStatus.OCCUPIED || table.sessions.length > 0
            const session = table.sessions[0]
            return (
              <Card
                key={table.id}
                data-testid={`floor-table-${table.label}`}
                className={`min-h-52 border-border/60 bg-card/80 p-5 ${
                  occupied ? "border-amber-500/40 bg-amber-500/5" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                      {t.floor.tableCard.tableLabel}
                    </div>
                    <div className="mt-2 text-2xl font-semibold tracking-tight">
                      {table.label}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      occupied
                        ? "border-amber-500/40 text-amber-200"
                        : "border-border/60"
                    }
                  >
                    {table.status}
                  </Badge>
                </div>
                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>{t.floor.tableCard.sessionCount}</span>
                    <span className="font-medium text-foreground">
                      {table.sessions.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>{t.floor.tableCard.guests}</span>
                    <span className="font-medium text-foreground">
                      {session
                        ? t.floor.tableCard.guestsValue.replace(
                            "{count}",
                            String(session.guestCount)
                          )
                        : t.floor.tableCard.waiting}
                    </span>
                  </div>
                </div>
                <div className="mt-5 h-1.5 touch-none overflow-hidden rounded-full bg-muted/50">
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ${
                      occupied ? "bg-amber-400/85" : "bg-emerald-400/70"
                    }`}
                    style={{ width: occupied ? "78%" : "28%" }}
                  />
                </div>
                {!occupied ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-4 w-full touch-manipulation"
                    data-testid={`floor-start-session-${table.label}`}
                    onClick={() =>
                      setSessionModal({ floorTableId: table.id, label: table.label })
                    }
                  >
                    {t.floor.workflow.startSession}
                  </Button>
                ) : null}
                {occupied && session ? (
                  <div className="mt-4 flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="w-full touch-manipulation"
                      data-testid={`floor-new-dine-in-${table.label}`}
                      onClick={() =>
                        setDineInModal({ sessionId: session.id, label: table.label })
                      }
                    >
                      {t.floor.workflow.newDineInOrder}
                    </Button>
                    <Button asChild variant="outline" size="sm" className="w-full touch-manipulation">
                      <Link
                        to={`/orders?${new URLSearchParams({
                          tableId: table.id,
                          tableLabel: table.label,
                        }).toString()}`}
                      >
                        {t.floor.tableCard.openBills}
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </Card>
            )
          })}
        </div>
      ) : null}
    </PageFrame>
  )
}
