import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Link } from "react-router-dom"

import {
  MetricCard,
  PageFrame,
  PageHeader,
  SectionCard,
  StatePanel,
} from "@/components/ConsoleUi"
import { CloseOfDayPanel } from "@/components/CloseOfDayPanel"
import { OperationalStrip, type OpsSnapshot } from "@/components/OperationalStrip"
import { Button } from "@/components/ui/button"
import { apiFetch, branchPaths, isApiError } from "@/lib/api"
import { useBranchId } from "@/lib/use-branch-id"
import type { DailyReport } from "./reports/reports-types"

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function money(minor: number): string {
  return (minor / 100).toFixed(2)
}

export function ShiftHandoffPage() {
  const branchId = useBranchId()
  const [date] = useState(() => todayIsoDate())

  const opsQ = useQuery({
    queryKey: ["ops-snapshot", branchId],
    queryFn: () => apiFetch<OpsSnapshot>(branchPaths.opsSnapshot(branchId!)),
    enabled: !!branchId,
    retry: false,
  })

  const q = useQuery({
    queryKey: ["reports", "shift-handoff", branchId, date],
    queryFn: () => apiFetch<DailyReport>(branchPaths.reportsDaily(branchId!, date)),
    enabled: !!branchId,
  })
  const handoffForbidden = q.isError && isApiError(q.error) && q.error.status === 403

  return (
    <PageFrame size="wide">
      <PageHeader
        eyebrow="Shift close"
        title="Shift handoff"
        description={`Compact close-of-shift view for ${date} in the current branch timezone.`}
      />

      <OperationalStrip data={opsQ.data} />

      {q.isLoading ? (
        <StatePanel
          variant="loading"
          title="Loading shift handoff"
          description="Preparing the branch close-of-shift summary."
        />
      ) : null}

      {q.isError ? (
        <StatePanel
          variant={handoffForbidden ? "empty" : "error"}
          title={handoffForbidden ? "Shift handoff access is limited" : "Could not load report."}
          description={
            handoffForbidden
              ? "This screen requires reports.view. Ask an admin to enable reporting access for this operator."
              : "Retry the shift summary or open the full report."
          }
          action={
            !handoffForbidden ? (
              <Button type="button" variant="outline" onClick={() => void q.refetch()}>
                Retry
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {q.data ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Net sales" value={money(q.data.totalSalesMinor)} detail="Current local day" />
            <MetricCard label="Orders" value={q.data.orderCount} detail="Completed or active order count" />
            <MetricCard
              label="Cancellations"
              value={q.data.cancellations.count}
              detail="Orders cancelled during this day"
              tone={q.data.cancellations.count > 0 ? "amber" : "default"}
            />
            <MetricCard
              label="Discounts"
              value={money(q.data.summary.totalDiscountMinor)}
              detail="Total discount value for the day"
            />
          </div>

          <CloseOfDayPanel report={q.data} />

          <SectionCard
            title={`Low stock (${q.data.stock.lowStockItems.length})`}
            description="Quick handoff view of low-threshold items that could affect the next shift."
          >
            {q.data.stock.lowStockItems.length === 0 ? (
              <StatePanel
                compact
                variant="empty"
                title="No low-stock alerts"
                description="Nothing is currently at or below threshold for the next shift."
              />
            ) : (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {q.data.stock.lowStockItems.slice(0, 8).map((item) => (
                  <li key={item.id}>
                    {item.name}
                    {item.linkedToTopSeller ? (
                      <span className="text-amber-200/90"> / top-menu</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <Button asChild variant="link" className="mt-3 px-0 text-sm text-primary">
              <Link to="/stock">Open stock</Link>
            </Button>
          </SectionCard>
        </div>
      ) : null}
    </PageFrame>
  )
}
