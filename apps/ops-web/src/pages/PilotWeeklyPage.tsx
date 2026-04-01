import { useCallback, useEffect, useMemo, useState } from "react"

import {
  MetricCard,
  PageFrame,
  PageHeader,
  SectionCard,
  StatePanel,
} from "@/components/ConsoleUi"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supportFetch } from "@/lib/support-console-fetch"

type WeeklyTenant = {
  tenantId: string
  name: string
  slug: string
  pilot?: { venueStatus?: string; pilotHealth?: string }
  summary: {
    ordersLast24h?: number
    onboardingRollup?: unknown
    pilotFeedbackCount?: number
  }
  window: {
    feedbackNewCount: number
    feedbackByTheme: Record<string, number>
    feedbackByType: Record<string, number>
    supportAuditActionsCount: number
    openBlockersCount: number
  }
}

type WeeklyReport = {
  since: string
  until: string
  tenants: WeeklyTenant[]
}

export function PilotWeeklyPage() {
  const [since, setSince] = useState("")
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const query = since.trim() ? `?since=${encodeURIComponent(since.trim())}` : ""
      const data = (await supportFetch(`/support/pilots/weekly-report${query}`)) as WeeklyReport
      setReport(data)
    } catch (error) {
      setErr(error instanceof Error ? error.message : String(error))
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [since])

  useEffect(() => {
    void load()
  }, [load])

  const tenantCount = report?.tenants.length ?? 0
  const blockerCount = useMemo(
    () => report?.tenants.reduce((count, row) => count + row.window.openBlockersCount, 0) ?? 0,
    [report]
  )
  const newFeedbackCount = useMemo(
    () => report?.tenants.reduce((count, row) => count + row.window.feedbackNewCount, 0) ?? 0,
    [report]
  )
  const supportAuditCount = useMemo(
    () => report?.tenants.reduce((count, row) => count + row.window.supportAuditActionsCount, 0) ?? 0,
    [report]
  )

  return (
    <PageFrame size="wide">
      <PageHeader
        eyebrow="Pilot cadence"
        title="Weekly pilot health"
        description="Operational weekly health rollup from the secured server-side support gateway. Default window is the last 7 days."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Pilot tenants" value={report ? tenantCount : "--"} detail="Rows in this weekly window" />
        <MetricCard
          label="New feedback"
          value={report ? newFeedbackCount : "--"}
          detail="Structured feedback items opened"
          tone={newFeedbackCount > 0 ? "amber" : "default"}
        />
        <MetricCard
          label="Open blockers"
          value={report ? blockerCount : "--"}
          detail="Critical unresolved issues"
          tone={blockerCount > 0 ? "danger" : "default"}
        />
        <MetricCard label="Support audits" value={report ? supportAuditCount : "--"} detail="Support actions in the weekly window" />
      </div>

      <SectionCard
        title="Window controls"
        description="Use an ISO timestamp to override the default start point for the weekly report."
        actions={
          <Button type="button" disabled={loading} onClick={() => void load()}>
            Refresh
          </Button>
        }
      >
        <label className="text-sm">
          <span className="text-muted-foreground">since (ISO optional)</span>
          <Input
            className="mt-2 block w-full max-w-sm font-mono text-sm"
            value={since}
            onChange={(event) => setSince(event.target.value)}
            placeholder="2025-03-15T00:00:00.000Z"
          />
        </label>
      </SectionCard>

      {err ? <StatePanel className="mt-6" variant="error" title="Weekly report failed" description={err} /> : null}

      {report ? (
        <SectionCard className="mt-6" title="Weekly report" description={`Window: ${report.since} to ${report.until}`}>
          <div className="overflow-x-auto rounded-xl border border-border/60 bg-muted/20">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-border/60 bg-muted/30 text-muted-foreground">
                <tr>
                  <th className="px-3 py-3">Venue</th>
                  <th className="px-3 py-3">Health</th>
                  <th className="px-3 py-3">Orders24h</th>
                  <th className="px-3 py-3">New FB</th>
                  <th className="px-3 py-3">Open blockers</th>
                  <th className="px-3 py-3">Support audits</th>
                  <th className="px-3 py-3">Top themes</th>
                </tr>
              </thead>
              <tbody>
                {report.tenants.map((tenant) => {
                  const themes = Object.entries(tenant.window.feedbackByTheme)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([key, value]) => `${key}:${value}`)
                    .join(", ")

                  return (
                    <tr key={tenant.tenantId} className="border-b border-border/60 last:border-b-0">
                      <td className="px-3 py-3">
                        <div className="font-medium">{tenant.name}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{tenant.slug}</div>
                      </td>
                      <td className="px-3 py-3">{tenant.pilot?.pilotHealth ?? "-"}</td>
                      <td className="px-3 py-3 tabular-nums">{tenant.summary.ordersLast24h ?? "-"}</td>
                      <td className="px-3 py-3 tabular-nums">{tenant.window.feedbackNewCount}</td>
                      <td className="px-3 py-3 tabular-nums">{tenant.window.openBlockersCount}</td>
                      <td className="px-3 py-3 tabular-nums">{tenant.window.supportAuditActionsCount}</td>
                      <td className="max-w-[220px] px-3 py-3 text-muted-foreground">{themes || "-"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <details className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-4">
            <summary className="cursor-pointer text-muted-foreground">Raw JSON</summary>
            <pre className="mt-3 max-h-[320px] overflow-auto text-[10px] text-muted-foreground">
              {JSON.stringify(report, null, 2)}
            </pre>
          </details>
        </SectionCard>
      ) : null}

      {loading ? (
        <StatePanel className="mt-6" compact variant="loading" title="Loading..." description="Fetching weekly pilot report." />
      ) : null}
    </PageFrame>
  )
}
