import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"

import {
  MetricCard,
  PageFrame,
  PageHeader,
  SectionCard,
  StatePanel,
} from "@/components/ConsoleUi"
import { Button } from "@/components/ui/button"
import { supportFetch } from "@/lib/support-console-fetch"

type PilotRow = {
  tenantId: string
  name: string
  slug: string
  branchCount: number
  pilotFeedbackCount: number
  pilot?: {
    venueStatus?: string
    pilotPhase?: string
    pilotHealth?: string
    goLiveDate?: string
    goLiveDateActual?: string
  }
}

type PilotsResponse = { items: PilotRow[] }

export function PilotPortfolioPage() {
  const [items, setItems] = useState<PilotRow[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const data = (await supportFetch("/support/pilots")) as PilotsResponse
      setItems(data.items ?? [])
    } catch (error) {
      setErr(error instanceof Error ? error.message : String(error))
      setItems(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const totalBranches = useMemo(() => (items ?? []).reduce((count, item) => count + item.branchCount, 0), [items])
  const totalFeedback = useMemo(() => (items ?? []).reduce((count, item) => count + item.pilotFeedbackCount, 0), [items])
  const healthyCount = useMemo(
    () => (items ?? []).filter((item) => (item.pilot?.pilotHealth ?? "").toLowerCase() === "green").length,
    [items]
  )

  return (
    <PageFrame size="wide">
      <PageHeader
        eyebrow="Pilot operations"
        title="Pilot portfolio"
        description="Portfolio view for tenants tagged with `metadata.commercialEngagement = pilot`, using the secured server-side support gateway."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Pilot tenants"
          value={items?.length ?? "--"}
          detail="Loaded portfolio rows"
          tone={items && items.length > 0 ? "emerald" : "default"}
        />
        <MetricCard label="Branches" value={items ? totalBranches : "--"} detail="Sites in active pilot set" />
        <MetricCard label="Feedback items" value={items ? totalFeedback : "--"} detail="Structured pilot feedback count" />
        <MetricCard
          label="Healthy pilots"
          value={items ? healthyCount : "--"}
          detail="Rows tagged green"
          tone={healthyCount > 0 ? "emerald" : "default"}
        />
      </div>

      <SectionCard
        title="Portfolio control"
        description="Refresh pulls the current pilot list through the server-side support gateway."
        actions={
          <Button type="button" disabled={loading} onClick={() => void load()}>
            Refresh
          </Button>
        }
      >
        {loading ? (
          <StatePanel compact variant="loading" title="Loading..." description="Fetching pilot portfolio." />
        ) : null}
        {err ? <StatePanel compact variant="error" title="Portfolio request failed" description={err} /> : null}
      </SectionCard>

      {items && items.length === 0 ? (
        <StatePanel
          className="mt-6"
          variant="empty"
          title="No pilot tenants found"
          description='Tag paid pilots with `PATCH .../metadata` and `commercialEngagement: "pilot"` to include them in this view.'
        />
      ) : null}

      {items && items.length > 0 ? (
        <SectionCard className="mt-6" title="Pilot tenants" description="Operational status, health, branch count, and feedback volume.">
          <div className="overflow-x-auto rounded-xl border border-border/60 bg-muted/20">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border/60 bg-muted/30 text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-medium">Venue</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Health</th>
                  <th className="px-3 py-3 font-medium">Branches</th>
                  <th className="px-3 py-3 font-medium">Feedback</th>
                  <th className="px-3 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.tenantId} className="border-b border-border/60 last:border-b-0">
                    <td className="px-3 py-3">
                      <div className="font-medium">{row.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{row.slug}</div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {row.pilot?.venueStatus ?? row.pilot?.pilotPhase ?? "-"}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{row.pilot?.pilotHealth ?? "-"}</td>
                    <td className="px-3 py-3 tabular-nums">{row.branchCount}</td>
                    <td className="px-3 py-3 tabular-nums">{row.pilotFeedbackCount}</td>
                    <td className="px-3 py-3">
                      <Button variant="link" asChild className="px-0 text-emerald-200">
                        <Link to={`/internal/pilots/${row.tenantId}`}>Open</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}
    </PageFrame>
  )
}
