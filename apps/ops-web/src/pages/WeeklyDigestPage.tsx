import { useQuery } from "@tanstack/react-query"

import {
  MetricCard,
  PageFrame,
  PageHeader,
  SectionCard,
  StatePanel,
} from "@/components/ConsoleUi"
import { Button } from "@/components/ui/button"
import { apiFetch, branchPaths, isApiError } from "@/lib/api"
import { useBranchId } from "@/lib/use-branch-id"

type WeeklyDigest = {
  semantics: string
  branchId: string
  branchName: string
  branchTimezone: string
  calendarWindow: {
    startDay: string
    endDay: string
    startUtc: string
    endUtc: string
  }
  priorCalendarWindow: {
    startDay: string
    endDay: string
    startUtc: string
    endUtc: string
  }
  netPaidSalesMinor: number
  paidOrderCount: number
  priorPeriod: {
    netPaidSalesMinor: number
    paidOrderCount: number
    salesDeltaPct: number | null
  }
  setup: { readyForGoLive: boolean; blockingIncompleteCount: number }
  topIssue: { kind: string; message: string } | null
  weekdayComparison: Array<{
    dow: number
    netSalesMinor: number
    priorNetSalesMinor: number
    orderCount: number
    priorOrderCount: number
  }>
  orderTypeMix: {
    current: {
      salesByOrderType: Record<string, number>
      orderCountByOrderType: Record<string, number>
    }
    prior: {
      salesByOrderType: Record<string, number>
      orderCountByOrderType: Record<string, number>
    }
  }
  discountTrends: {
    current: Array<{ reason: string; count: number; discountMinor: number }>
    prior: Array<{ reason: string; count: number; discountMinor: number }>
  }
}

const DOW_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

function money(minor: number): string {
  return (minor / 100).toFixed(2)
}

function formatLine(value: number, count: number): string {
  return `${money(value)} / ${count} orders`
}

export function WeeklyDigestPage() {
  const branchId = useBranchId()
  const q = useQuery({
    queryKey: ["reports", "weekly-digest", branchId],
    queryFn: () => apiFetch<WeeklyDigest>(branchPaths.reportsWeeklyDigest(branchId!)),
    enabled: !!branchId,
  })
  const digestForbidden = q.isError && isApiError(q.error) && q.error.status === 403

  return (
    <PageFrame size="wide">
      <PageHeader
        eyebrow="Weekly view"
        title="Weekly digest"
        description="Last 7 calendar days in this branch timezone versus the prior 7 days."
      />

      {q.isLoading ? (
        <StatePanel
          variant="loading"
          title="Loading weekly digest"
          description="Calculating recent branch performance against the prior period."
        />
      ) : null}

      {q.isError ? (
        <StatePanel
          variant={digestForbidden ? "empty" : "error"}
          title={digestForbidden ? "Digest access is limited" : "Could not load digest"}
          description={
            digestForbidden
              ? "This screen requires reports.view. Ask an admin to enable reporting access for this operator."
              : "Retry the weekly digest when the reporting service is available."
          }
          action={
            !digestForbidden ? (
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
            <MetricCard
              label="Net sales (7d)"
              value={money(q.data.netPaidSalesMinor)}
              detail={
                q.data.priorPeriod.salesDeltaPct != null
                  ? `${q.data.priorPeriod.salesDeltaPct >= 0 ? "+" : ""}${q.data.priorPeriod.salesDeltaPct}% vs prior window`
                  : "No prior baseline"
              }
              tone={
                q.data.priorPeriod.salesDeltaPct != null && q.data.priorPeriod.salesDeltaPct >= 0
                  ? "emerald"
                  : "default"
              }
            />
            <MetricCard
              label="Paid orders"
              value={q.data.paidOrderCount}
              detail={`Prior week: ${q.data.priorPeriod.paidOrderCount}`}
            />
            <MetricCard
              label="Setup"
              value={q.data.setup.readyForGoLive ? "Ready" : "Incomplete"}
              detail={
                q.data.setup.blockingIncompleteCount > 0
                  ? `${q.data.setup.blockingIncompleteCount} blocking item(s)`
                  : "No blocking steps"
              }
              tone={q.data.setup.readyForGoLive ? "emerald" : "amber"}
            />
            <MetricCard
              label="Highlight"
              value={q.data.topIssue ? "Attention" : "Stable"}
              detail={q.data.topIssue?.message ?? "No major alert this week."}
              tone={q.data.topIssue ? "amber" : "default"}
            />
          </div>

          <SectionCard
            title={q.data.branchName}
            description={`Window: ${q.data.calendarWindow.startDay} to ${q.data.calendarWindow.endDay} (${q.data.branchTimezone}).`}
          >
            <p className="text-xs text-muted-foreground">
              Paid orders use <code className="text-emerald-300">paidAt</code> between the UTC
              instants for this local-day window, not the tenant UTC rollup semantics.
            </p>
          </SectionCard>

          <SectionCard
            title="Net sales by weekday"
            description="Compare matching weekdays across the current and prior windows to decide staffing and campaign timing."
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="pb-2 pr-2">Day</th>
                    <th className="pb-2 pr-2">This window</th>
                    <th className="pb-2">Prior window</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.weekdayComparison.map((row) => (
                    <tr key={row.dow} className="border-t border-border/60">
                      <td className="py-2 pr-2">{DOW_LABEL[row.dow]}</td>
                      <td className="py-2 pr-2">{formatLine(row.netSalesMinor, row.orderCount)}</td>
                      <td className="py-2 text-muted-foreground">
                        {formatLine(row.priorNetSalesMinor, row.priorOrderCount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard
            title="Order-type mix"
            description="If channel mix shifted, align labor, prep, and promotions to the current demand profile."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-medium text-muted-foreground">Current 7 local days</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {Object.keys(q.data.orderTypeMix.current.salesByOrderType).length === 0 ? (
                    <li>
                      <StatePanel
                        compact
                        variant="empty"
                        title="No paid orders"
                        description="Current-window order-type mix appears once paid orders are recorded."
                      />
                    </li>
                  ) : (
                    Object.entries(q.data.orderTypeMix.current.salesByOrderType)
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, value]) => (
                        <li key={type} className="flex justify-between gap-3">
                          <span className="text-muted-foreground">{type}</span>
                          <span>
                            {money(value)} ({q.data.orderTypeMix.current.orderCountByOrderType[type] ?? 0} orders)
                          </span>
                        </li>
                      ))
                  )}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-medium text-muted-foreground">Prior 7 local days</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {Object.keys(q.data.orderTypeMix.prior.salesByOrderType).length === 0 ? (
                    <li>
                      <StatePanel
                        compact
                        variant="empty"
                        title="No paid orders"
                        description="Prior-window order-type mix appears once paid orders are recorded."
                      />
                    </li>
                  ) : (
                    Object.entries(q.data.orderTypeMix.prior.salesByOrderType)
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, value]) => (
                        <li key={type} className="flex justify-between gap-3">
                          <span className="text-muted-foreground">{type}</span>
                          <span>
                            {money(value)} ({q.data.orderTypeMix.prior.orderCountByOrderType[type] ?? 0} orders)
                          </span>
                        </li>
                      ))
                  )}
                </ul>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Discount trends by reason"
            description="Use this to tighten comps, approval rules, or training where discount dollars moved week over week."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-medium text-muted-foreground">Current window</h3>
                {q.data.discountTrends.current.length === 0 ? (
                  <StatePanel
                    compact
                    variant="empty"
                    title="No discount reasons"
                    description="No discount-reason breakdown is available for the current window."
                  />
                ) : (
                  <ul className="space-y-1 text-sm">
                    {q.data.discountTrends.current.map((reason) => (
                      <li key={reason.reason} className="flex justify-between gap-3">
                        <span className="text-muted-foreground">{reason.reason}</span>
                        <span>
                          {money(reason.discountMinor)} / {reason.count}x
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="mb-2 text-xs font-medium text-muted-foreground">Prior window</h3>
                {q.data.discountTrends.prior.length === 0 ? (
                  <StatePanel
                    compact
                    variant="empty"
                    title="No discount reasons"
                    description="No discount-reason breakdown is available for the prior window."
                  />
                ) : (
                  <ul className="space-y-1 text-sm">
                    {q.data.discountTrends.prior.map((reason) => (
                      <li key={reason.reason} className="flex justify-between gap-3">
                        <span className="text-muted-foreground">{reason.reason}</span>
                        <span>
                          {money(reason.discountMinor)} / {reason.count}x
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Comparison window metadata" description="Useful when validating whether staff are interpreting the right reporting window.">
            <p className="mb-1 text-xs text-muted-foreground">
              <strong className="text-muted-foreground">Prior comparison window:</strong>{" "}
              {q.data.priorCalendarWindow.startDay} to {q.data.priorCalendarWindow.endDay}
            </p>
            <p className="text-xs text-muted-foreground">
              Semantics: <code className="text-foreground">{q.data.semantics}</code>
            </p>
          </SectionCard>
        </div>
      ) : null}
    </PageFrame>
  )
}
