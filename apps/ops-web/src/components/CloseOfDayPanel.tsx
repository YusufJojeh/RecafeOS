import { Link } from "react-router-dom"

import { SectionCard, StatePanel, MetricCard } from "@/components/ConsoleUi"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/i18n/context"

type ReportFlag = {
  code: string
  severity: "info" | "warn" | "risk"
  message: string
}

type DailyLike = {
  totalSalesMinor: number
  orderCount: number
  shifts: Array<{
    id: string
    openedAt: string
    closedAt: string | null
    orderCount: number
    salesMinor: number
  }>
  flags: ReportFlag[]
}

export function CloseOfDayPanel({ report }: { report: DailyLike }) {
  const { t } = useLanguage()
  const openShifts = report.shifts.filter((shift) => !shift.closedAt)
  const openShiftsPanelTitle =
    openShifts.length === 1
      ? t.closeOfDay.openShiftsTitle
      : t.closeOfDay.openShiftsTitlePlural.replace("{count}", String(openShifts.length))

  return (
    <SectionCard
      title={t.closeOfDay.title}
      description={t.closeOfDay.description}
      actions={
        <>
          <Button asChild variant="outline" size="sm">
            <Link to="/stock">{t.closeOfDay.stock}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/setup">{t.closeOfDay.setup}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/orders">{t.closeOfDay.openBills}</Link>
          </Button>
        </>
      }
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <MetricCard
          label={t.closeOfDay.netSales}
          value={(report.totalSalesMinor / 100).toFixed(2)}
        />
        <MetricCard label={t.closeOfDay.paidOrders} value={report.orderCount} />
        <MetricCard label={t.closeOfDay.openShifts} value={openShifts.length} />
      </div>

      {openShifts.length > 0 ? (
        <StatePanel
          compact
          variant="info"
          title={openShiftsPanelTitle}
          description={t.closeOfDay.openShiftsDescription}
        />
      ) : null}

      {report.flags.length > 0 ? (
        <div className="mt-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {t.closeOfDay.flagsHeading}
          </h3>
          <ul className="space-y-2">
            {report.flags.map((flag) => (
              <li
                key={flag.code}
                className={`rounded-xl border px-4 py-3 text-sm ${
                  flag.severity === "risk"
                    ? "border-red-500/40 bg-red-500/10 text-red-100"
                    : flag.severity === "warn"
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
                      : "border-border/60 bg-muted/30 text-foreground"
                }`}
              >
                <span className="font-mono text-xs text-muted-foreground">{flag.code}</span>
                <div className="mt-1">{flag.message}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t.closeOfDay.noFlags}</p>
      )}
    </SectionCard>
  )
}
