import { Link } from "react-router-dom"

import { SectionCard, StatePanel } from "@/components/ConsoleUi"
import { CloseOfDayPanel } from "@/components/CloseOfDayPanel"
import type { BranchVisitSignals, DailyReport, DemandProfile } from "./reports-types"
import { BarRow, Kpi, OperatorFocusList } from "./reports-shared"
import { formatMoneyMinor, pctDeltaLabel } from "./reports-utils"

export type DailyReportBodyProps = {
  report: DailyReport
  dailyOperatorCues: string[]
  visitSignals: BranchVisitSignals | undefined
  demand: DemandProfile | undefined
  demandLoading: boolean
  demandError: boolean
  typeEntries: [string, number][]
  maxHourly: number
  maxType: number
}

export function DailyReportBody({
  report,
  dailyOperatorCues,
  visitSignals,
  demand,
  demandLoading,
  demandError,
  typeEntries,
  maxHourly,
  maxType,
}: DailyReportBodyProps) {
  const paymentEntries = Object.entries(report.paymentsByMethod)

  return (
    <div className="space-y-8">
      <OperatorFocusList cues={dailyOperatorCues} />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Net sales" value={formatMoneyMinor(report.totalSalesMinor)} />
        <Kpi label="Orders" value={String(report.orderCount)} />
        <Kpi label="AOV" value={formatMoneyMinor(report.averageOrderValueMinor)} />
        <Kpi label="Discounts" value={formatMoneyMinor(report.summary.totalDiscountMinor)} />
        <Kpi label="Gross (pre-discount)" value={formatMoneyMinor(report.summary.grossSalesMinor)} />
        <Kpi
          label="Cancellations"
          value={String(report.cancellations.count)}
          hint={
            report.cancellations.count > 0
              ? `Estimated lost subtotal ${formatMoneyMinor(report.cancellations.lostSubtotalMinor)}`
              : undefined
          }
        />
      </section>

      <SectionCard
        title="Same weekday baseline"
        description="Decide whether today is off the usual weekday rhythm before changing staffing or menu tactics."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Kpi
            label="Median net (prior same weekdays)"
            value={formatMoneyMinor(report.sameWeekdayBenchmark.medianNetSalesMinor)}
          />
          <Kpi label="Median orders" value={String(report.sameWeekdayBenchmark.medianOrderCount)} />
        </div>
        {report.sameWeekdayBenchmark.medianNetSalesMinor > 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Today vs median:{" "}
            <span className="text-foreground">
              {pctDeltaLabel(report.totalSalesMinor, report.sameWeekdayBenchmark.medianNetSalesMinor)}
            </span>
          </p>
        ) : (
          <StatePanel
            compact
            className="mt-4"
            variant="empty"
            title="Not enough history"
            description="A median baseline is not available yet for this branch and weekday."
          />
        )}
      </SectionCard>

      <CloseOfDayPanel report={report} />

      {visitSignals ? (
        <SectionCard
          title={`Visit signals (${visitSignals.windowDays}d, this branch)`}
          description={`Rolling window since ${new Date(visitSignals.since).toLocaleString()}. Repeat visitors had two or more recorded visits at this branch in the window.`}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Visits recorded" value={String(visitSignals.visitsRecorded)} />
            <Kpi label="Unique visitors" value={String(visitSignals.uniqueVisitors)} />
            <Kpi label="Repeat visitors" value={String(visitSignals.repeatVisitors)} />
            <Kpi label="Single-visit only" value={String(visitSignals.singleVisitVisitors)} />
          </div>

          {visitSignals.uniqueVisitors > 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Repeat share:{" "}
              <span className="text-foreground">
                {((visitSignals.repeatVisitors / visitSignals.uniqueVisitors) * 100).toFixed(0)}%
              </span>{" "}
              of unique visitors returned at least twice in the window.
            </p>
          ) : null}

          <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Operator plays (no PII)
            </h3>
            <ul className="list-inside list-disc space-y-1.5 text-sm leading-6 text-muted-foreground">
              <li>
                If repeat share is low, tighten service quality and review{" "}
                <Link className="text-primary underline" to="/menu">
                  menu
                </Link>{" "}
                pricing or bundles.
              </li>
              <li>
                If single-visit traffic dominates, check{" "}
                <Link className="text-primary underline" to="/setup">
                  setup and QR visibility
                </Link>{" "}
                and test a quiet-hour offer.
              </li>
              <li>
                For named regulars, use{" "}
                <Link className="text-primary underline" to="/orders">
                  Open bills
                </Link>{" "}
                for live follow-up while this report stays aggregate-only.
              </li>
            </ul>
          </div>
        </SectionCard>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Hourly demand (sales)">
          {report.hourlySales.length > 0 ? (
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {report.hourlySales.map((hour) => (
                <BarRow
                  key={hour.hour}
                  label={`${String(hour.hour).padStart(2, "0")}:00`}
                  value={hour.salesMinor}
                  max={maxHourly}
                  sub={`${hour.orderCount} orders`}
                />
              ))}
            </div>
          ) : (
            <StatePanel
              compact
              variant="empty"
              title="No hourly demand yet"
              description="This branch-day has no hourly sales buckets."
            />
          )}
        </SectionCard>

        <SectionCard title="Sales by order type">
          {typeEntries.length > 0 ? (
            <div className="space-y-2">
              {typeEntries.map(([type, salesMinor]) => (
                <BarRow
                  key={type}
                  label={type}
                  value={salesMinor}
                  max={maxType}
                  sub={`${report.orderCountByOrderType[type] ?? 0} orders`}
                />
              ))}
            </div>
          ) : (
            <StatePanel
              compact
              variant="empty"
              title="No paid orders"
              description="Order-type performance appears after paid orders are recorded."
            />
          )}
        </SectionCard>
      </section>

      <SectionCard
        title="Top items"
        description="Decide prep focus and menu emphasis using each item share of total day net sales."
      >
        {report.topItems.length > 0 ? (
          <div className="space-y-2">
            {report.topItems.map((item) => {
              const share =
                report.totalSalesMinor > 0
                  ? ((item.revenue / report.totalSalesMinor) * 100).toFixed(0)
                  : "0"

              return (
                <div
                  key={item.name}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm"
                >
                  <span className="text-foreground">{item.name}</span>
                  <span className="text-muted-foreground">
                    {item.qty} sold / {formatMoneyMinor(item.revenue)}{" "}
                    <span className="text-muted-foreground">({share}% of day net)</span>
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <StatePanel
            compact
            variant="empty"
            title="No top-item data"
            description="Top items appear once paid item revenue is available for the selected day."
          />
        )}
      </SectionCard>

      <SectionCard
        title="Sales by category"
        description="Use this breakdown to decide promo focus and prep-station load."
      >
        {report.salesByCategory.length === 0 ? (
          <StatePanel
            compact
            variant="empty"
            title="No category sales this day"
            description="Category rollups appear when paid category revenue is available."
          />
        ) : (
          <ul className="space-y-2 text-sm">
            {report.salesByCategory.map((category) => (
              <li
                key={category.name}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3"
              >
                <span className="text-foreground">{category.name}</span>
                <span className="text-muted-foreground">
                  {category.qty} sold / {formatMoneyMinor(category.revenueMinor)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title={`Rolling demand (last ${demand?.window.days ?? 28} local days)`}
        description="Use the peak contiguous hours to tune opening windows, break timing, and staffing."
      >
        {demandLoading ? (
          <StatePanel
            compact
            variant="loading"
            title="Loading demand profile"
            description="Aggregating recent local-day sales into an hourly demand profile."
          />
        ) : null}
        {demandError ? (
          <StatePanel
            compact
            className={demandLoading ? "mt-3" : undefined}
            variant="error"
            title="Could not load demand profile."
            description="Retry the report or return later once demand profiling is available."
          />
        ) : null}
        {demand ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Strongest contiguous hours:{" "}
              <span className="text-foreground">
                {String(demand.peakContiguousHours.startHour).padStart(2, "0")}:00-
                {String(demand.peakContiguousHours.endHourExclusive).padStart(2, "0")}:00
              </span>{" "}
              ({demand.peakContiguousHours.shareOfWindowSalesPct.toFixed(0)}% of window net)
            </p>
            <p className="text-xs text-muted-foreground">
              Window: {demand.window.startDay} to {demand.window.endDay} ({demand.branchTimezone})
            </p>
          </div>
        ) : null}
        {!demandLoading && !demandError && !demand ? (
          <StatePanel
            compact
            variant="empty"
            title="No rolling demand profile"
            description="Demand profiling has not been generated for this branch yet."
          />
        ) : null}
      </SectionCard>

      <section className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Payments by method">
          {paymentEntries.length === 0 ? (
            <StatePanel
              compact
              variant="empty"
              title="No payment rows"
              description="Payment-method totals appear after payments are recorded."
            />
          ) : (
            <dl className="space-y-2 text-sm">
              {paymentEntries.map(([method, value]) => (
                <div
                  key={method}
                  className="flex justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3"
                >
                  <dt className="text-muted-foreground">{method}</dt>
                  <dd className="text-foreground">{formatMoneyMinor(value)}</dd>
                </div>
              ))}
            </dl>
          )}
        </SectionCard>

        <SectionCard title="Discount detail">
          <p className="text-sm text-muted-foreground">
            {report.discounts.ordersWithDiscountCount} orders with a discount / total{" "}
            {formatMoneyMinor(report.discounts.totalDiscountMinor)}
          </p>
          {report.discounts.topReasons.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {report.discounts.topReasons.map((reason) => (
                <li
                  key={reason.reason}
                  className="flex justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3"
                >
                  <span className="text-muted-foreground">{reason.reason}</span>
                  <span className="text-foreground">{reason.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <StatePanel
              compact
              className="mt-3"
              variant="empty"
              title="No discount reasons"
              description="Discount reasons appear when discount metadata is present on orders."
            />
          )}
        </SectionCard>
      </section>

      {report.cancellations.byReason.length > 0 ? (
        <SectionCard
          title="Cancellation reasons"
          description="Repeated reasons indicate staff training or operational fixes worth prioritizing."
        >
          <ul className="space-y-2 text-sm text-muted-foreground">
            {report.cancellations.byReason.map((reason) => (
              <li
                key={reason.reason}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3"
              >
                <span className="text-muted-foreground">{reason.reason}</span>
                <span className="text-foreground">
                  {reason.count} / est. lost {formatMoneyMinor(reason.lostSubtotalMinor)}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Cashiers (payments recorded)">
          {report.cashiers.length === 0 ? (
            <StatePanel
              compact
              variant="empty"
              title="No payment rows"
              description="Cashier performance appears after payment rows are recorded."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[520px] w-full text-left text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="pb-2 pr-2">Name</th>
                    <th className="pb-2 pr-2">Orders</th>
                    <th className="pb-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.cashiers.map((cashier, index) => (
                    <tr
                      key={`${cashier.userId ?? "null"}-${cashier.displayName}-${index}`}
                      className="border-t border-border/60"
                    >
                      <td className="py-2 pr-2">{cashier.displayName}</td>
                      <td className="py-2 pr-2">{cashier.orderCount}</td>
                      <td className="py-2">{formatMoneyMinor(cashier.paymentsTotalMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Shifts (sales in window)">
          {report.shifts.length === 0 ? (
            <StatePanel
              compact
              variant="empty"
              title="No shifts overlapping this day"
              description="Shift rows appear when staffed shift windows overlap the selected branch day."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[560px] w-full text-left text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="pb-2 pr-2">Opened</th>
                    <th className="pb-2 pr-2">Orders</th>
                    <th className="pb-2">Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {report.shifts.map((shift) => (
                    <tr key={shift.id} className="border-t border-border/60">
                      <td className="py-2 pr-2 font-mono text-xs text-muted-foreground">
                        {new Date(shift.openedAt).toLocaleString()}
                        {shift.closedAt ? (
                          <>
                            <br />
                            to {new Date(shift.closedAt).toLocaleString()}
                          </>
                        ) : (
                          <span className="text-amber-400"> (open)</span>
                        )}
                      </td>
                      <td className="py-2 pr-2">{shift.orderCount}</td>
                      <td className="py-2">{formatMoneyMinor(shift.salesMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Top customers">
          {report.topCustomers.length === 0 ? (
            <StatePanel
              compact
              variant="empty"
              title="No customer-linked orders this day"
              description="Customer-linked revenue appears once guest records are associated with orders."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[520px] w-full text-left text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="pb-2 pr-2">Customer</th>
                    <th className="pb-2 pr-2">Orders</th>
                    <th className="pb-2">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topCustomers.map((customer) => (
                    <tr key={customer.customerId} className="border-t border-border/60">
                      <td className="py-2 pr-2">
                        <div>{customer.name ?? "--"}</div>
                        <div className="text-xs text-muted-foreground">{customer.phone}</div>
                      </td>
                      <td className="py-2 pr-2">{customer.ordersCount}</td>
                      <td className="py-2">{formatMoneyMinor(customer.revenueMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Visits">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
              <dt className="text-muted-foreground">Visits recorded</dt>
              <dd className="text-foreground">{report.visits.visitsRecorded}</dd>
            </div>
            <div className="flex justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
              <dt className="text-muted-foreground">Repeat (this branch)</dt>
              <dd className="text-foreground">{report.visits.repeatVisitsAtBranch}</dd>
            </div>
            <div className="flex justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
              <dt className="text-muted-foreground">First-time (this branch)</dt>
              <dd className="text-foreground">{report.visits.firstTimeVisitsAtBranch}</dd>
            </div>
          </dl>
        </SectionCard>
      </section>

      <SectionCard
        title="Low stock"
        description="Reorder before service risk escalates. Items linked to today's top sellers are flagged."
      >
        {report.stock.lowStockItems.length === 0 ? (
          <StatePanel
            compact
            variant="empty"
            title="Nothing at or below threshold"
            description="No current low-stock warnings for the selected branch day."
          />
        ) : (
          <ul className="space-y-2 text-sm">
            {report.stock.lowStockItems.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3"
              >
                <span>
                  {item.name}
                  {item.linkedToTopSeller ? (
                    <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-100">
                      top-menu linked
                    </span>
                  ) : null}
                </span>
                <span className="text-red-200">
                  {item.quantity} {item.unit} (threshold {item.lowThreshold}) / severity{" "}
                  {(item.severityRatio * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}
