import type { UseQueryResult } from "@tanstack/react-query"

import { SectionCard, StatePanel } from "@/components/ConsoleUi"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { BranchSnapshotReport, TenantRollupReport } from "./reports-types"
import { formatMoneyMinor, pctDeltaLabel, utcCalendarDateOffsetDays } from "./reports-utils"
import { Kpi, OperatorFocusList } from "./reports-shared"

export type TenantRollupSectionProps = {
  rollupFrom: string
  setRollupFrom: (v: string) => void
  rollupTo: string
  setRollupTo: (v: string) => void
  rollupQ: UseQueryResult<TenantRollupReport, Error>
  rollupOperatorCues: string[]
  branchSnapDate: string
  setBranchSnapDate: (v: string) => void
  branchSnapQ: UseQueryResult<BranchSnapshotReport, Error>
}

export function TenantRollupSection({
  rollupFrom,
  setRollupFrom,
  rollupTo,
  setRollupTo,
  rollupQ,
  rollupOperatorCues,
  branchSnapDate,
  setBranchSnapDate,
  branchSnapQ,
}: TenantRollupSectionProps) {
  return (
    <SectionCard
      className="mb-8"
      title="All branches (tenant rollup)"
      description={
        <>
          <strong className="text-muted-foreground">Decision use:</strong> compare sites, spot discount
          pressure, and prioritize coaching where branches diverge.{" "}
          <strong className="text-muted-foreground">UTC window:</strong> paid orders use{" "}
          <code className="text-emerald-300">paidAt</code> in UTC for the selected range. Prior period comparisons
          use the same UTC duration immediately before your range. Up to {rollupQ.data?.branchLimit ?? "..."} branches
          per plan. Leave dates empty for the last 7 UTC days.{" "}
          <strong className="text-muted-foreground">Branches in scope</strong> match the exact set listed below.
        </>
      }
      actions={
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted-foreground">
            <span>From (UTC)</span>
            <Input
              type="date"
              value={rollupFrom}
              onChange={(event) => setRollupFrom(event.target.value)}
              className="mt-2 h-9 w-auto"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            <span>To (UTC)</span>
            <Input
              type="date"
              value={rollupTo}
              onChange={(event) => setRollupTo(event.target.value)}
              className="mt-2 h-9 w-auto"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setRollupFrom(utcCalendarDateOffsetDays(-6))
              setRollupTo(utcCalendarDateOffsetDays(0))
            }}
          >
            Last 7 UTC days
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const yesterday = utcCalendarDateOffsetDays(-1)
              setRollupFrom(yesterday)
              setRollupTo(yesterday)
            }}
          >
            Yesterday UTC
          </Button>
        </div>
      }
    >
      {rollupQ.isLoading ? (
        <StatePanel
          compact
          variant="loading"
          title="Loading rollup"
          description="Preparing tenant-wide sales, discounts, and branch ranking."
        />
      ) : null}

      {rollupQ.isError ? (
        <StatePanel
          compact
          className={rollupQ.isLoading ? "mt-3" : undefined}
          variant="error"
          title="Could not load tenant rollup."
          description="Retry later or narrow the UTC window."
        />
      ) : null}

      {rollupQ.data ? (
        <>
          <OperatorFocusList cues={rollupOperatorCues} />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Net sales (all in scope)"
              value={formatMoneyMinor(rollupQ.data.netPaidSalesMinor)}
              hint={
                rollupQ.data.priorPeriod
                  ? pctDeltaLabel(
                      rollupQ.data.netPaidSalesMinor,
                      rollupQ.data.priorPeriod.netPaidSalesMinor
                    )
                  : undefined
              }
            />
            <Kpi
              label="Paid orders"
              value={String(rollupQ.data.paidOrderCount)}
              hint={
                rollupQ.data.priorPeriod
                  ? pctDeltaLabel(
                      rollupQ.data.paidOrderCount,
                      rollupQ.data.priorPeriod.paidOrderCount
                    )
                  : undefined
              }
            />
            <Kpi label="Avg ticket" value={formatMoneyMinor(rollupQ.data.averageTicketMinor)} />
            <Kpi
              label="Discount pressure"
              value={formatMoneyMinor(rollupQ.data.discountPressure.totalDiscountMinor)}
            />
          </div>

          {rollupQ.data.priorPeriod ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Prior UTC window: {rollupQ.data.priorPeriod.paidAtWindow.start.slice(0, 16)} to{" "}
              {rollupQ.data.priorPeriod.paidAtWindow.endExclusive.slice(0, 16)} (exclusive end)
            </p>
          ) : null}

          {rollupQ.data.branchesInScope.length > 0 ? (
            <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              <strong className="text-foreground">Included branch IDs / names:</strong>{" "}
              {rollupQ.data.branchesInScope.map((branch) => branch.name).join(" / ")}
            </div>
          ) : (
            <StatePanel
              compact
              className="mt-4"
              variant="empty"
              title="No branches in scope"
              description="The selected UTC window did not return any branches for this rollup."
            />
          )}

          {rollupQ.data.topBranchesBySales.length > 0 ? (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold">Top branches by sales</h3>
              <p className="mb-3 text-sm text-muted-foreground">
                Use this ranking to decide which site needs coaching first when the spread is hurting the group.
              </p>
              <ul className="space-y-2 text-sm">
                {rollupQ.data.topBranchesBySales.map((branch) => (
                  <li
                    key={branch.branchId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3"
                  >
                    <span>{branch.name}</span>
                    <span className="text-muted-foreground">
                      {formatMoneyMinor(branch.netPaidSalesMinor)} / {branch.paidOrderCount} orders
                    </span>
                  </li>
                ))}
              </ul>
              {rollupQ.data.topBranchesBySales.length >= 2 ? (
                <p className="mt-3 text-sm text-amber-200/90">
                  Weakest site in this UTC window:{" "}
                  <strong>
                    {rollupQ.data.topBranchesBySales[rollupQ.data.topBranchesBySales.length - 1]!.name}
                  </strong>{" "}
                  ({formatMoneyMinor(
                    rollupQ.data.topBranchesBySales[
                      rollupQ.data.topBranchesBySales.length - 1
                    ]!.netPaidSalesMinor
                  )}{" "}
                  net). Prioritize a visit if the spread versus top sites is widening.
                </p>
              ) : null}
            </div>
          ) : (
            <StatePanel
              compact
              className="mt-6"
              variant="empty"
              title="No ranked branches"
              description="Branch ranking appears once rollup sales are available."
            />
          )}
        </>
      ) : null}

      {!rollupQ.isLoading && !rollupQ.isError && !rollupQ.data ? (
        <StatePanel
          compact
          variant="empty"
          title="No tenant rollup data"
          description="Pick a different UTC range or confirm reporting permission for this account."
        />
      ) : null}

      <div className="mt-6 border-t border-border/60 pt-6">
        <SectionCard
          className="border-border/60 bg-transparent p-0 shadow-none"
          title="Branch snapshot (local calendar day)"
          description="Compare branches on the same local calendar date. This section uses each branch timezone instead of the UTC rollup window above."
          actions={
            <label className="text-xs text-muted-foreground">
              <span>Date</span>
              <Input
                type="date"
                value={branchSnapDate}
                onChange={(event) => setBranchSnapDate(event.target.value)}
                className="mt-2 h-9 w-auto"
              />
            </label>
          }
        >
          {branchSnapQ.isLoading ? (
            <StatePanel
              compact
              variant="loading"
              title="Loading snapshot"
              description="Fetching local-day branch comparisons."
            />
          ) : null}

          {branchSnapQ.isError ? (
            <StatePanel
              compact
              className={branchSnapQ.isLoading ? "mt-3" : undefined}
              variant="error"
              title="Could not load branch snapshot."
              description="Retry the local-day comparison with another date."
            />
          ) : null}

          {branchSnapQ.data?.branches.length ? (
            <ul className="space-y-2 text-sm">
              {branchSnapQ.data.branches.map((branch) => (
                <li
                  key={branch.branchId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3"
                >
                  <span>{branch.name}</span>
                  <span className="text-muted-foreground">
                    {formatMoneyMinor(branch.netPaidSalesMinor)} / {branch.paidOrderCount} orders
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {!branchSnapQ.isLoading && !branchSnapQ.isError && !branchSnapQ.data?.branches.length ? (
            <StatePanel
              compact
              variant="empty"
              title="No branch snapshot rows"
              description="No local-day branch summary is available for the selected date."
            />
          ) : null}
        </SectionCard>
      </div>
    </SectionCard>
  )
}
