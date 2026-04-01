import type { ReactNode } from "react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { useLanguage } from "@/i18n/context"

import type { OpsSnapshot } from "@/lib/contract/staff-api"

export type { OpsSnapshot }

export function OperationalStrip({ data }: { data: OpsSnapshot | undefined }) {
  const { t } = useLanguage()

  if (!data) {
    return null
  }

  const rows: { key: string; node: ReactNode }[] = []

  if (!data.readyForGoLive && data.blockingIncompleteCount > 0) {
    rows.push({
      key: "setup",
      node: (
        <>
          {t.floor.signals.setupIncomplete.replace(
            "{count}",
            String(data.blockingIncompleteCount)
          )}{" "}
          <Link className="text-primary underline" to="/setup">
            {t.floor.signals.openSetup}
          </Link>
        </>
      ),
    })
  }

  if (data.lowStockCount > 0) {
    rows.push({
      key: "stock",
      node: (
        <>
          {t.floor.signals.lowStock.replace(
            "{count}",
            String(data.lowStockCount)
          )}{" "}
          <Link className="text-primary underline" to="/stock">
            {t.floor.signals.reviewStock}
          </Link>
        </>
      ),
    })
  }

  if (data.openShiftPresent) {
    rows.push({
      key: "shift",
      node: (
        <>
          {t.floor.signals.shiftOpen}{" "}
          <Link className="text-primary underline" to="/reports">
            {t.floor.signals.reviewReports}
          </Link>
          .
        </>
      ),
    })
  }

  if (rows.length === 0) {
    return null
  }

  return (
    <Card className="mb-6 border-border/60 bg-card/70 p-4" role="status">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {t.floor.signals.title}
        </div>
        <Badge variant="outline" className="border-border/60 text-xs">
          {t.floor.signals.active.replace("{count}", String(rows.length))}
        </Badge>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {rows.map((row) => (
          <div
            key={row.key}
            className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground"
          >
            {row.node}
          </div>
        ))}
      </div>
    </Card>
  )
}
