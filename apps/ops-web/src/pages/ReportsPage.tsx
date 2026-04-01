import { useQuery } from "@tanstack/react-query"
import { lazy, Suspense, useMemo, useState } from "react"

import { PageFrame, PageHeader, StatePanel } from "@/components/ConsoleUi"
import { OperationalStrip, type OpsSnapshot } from "@/components/OperationalStrip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiFetch, branchPaths, isApiError, tenantPaths } from "@/lib/api"
import { useAuthStore } from "@/lib/auth-store"
import { useStaffPermissions } from "@/lib/staff-permissions"
import { useBranchId } from "@/lib/use-branch-id"
import { DailyReportBody } from "./reports/DailyReportBody"
import { buildDailyOperatorCues, buildRollupOperatorCues } from "./reports/reports-cues"
import { todayIsoDate } from "./reports/reports-utils"
import type {
  BranchSnapshotReport,
  BranchVisitSignals,
  DailyReport,
  DemandProfile,
  TenantRollupReport,
} from "./reports/reports-types"

export type { DailyReport, TenantRollupReport } from "./reports/reports-types"

const TenantRollupSection = lazy(() =>
  import("./reports/TenantRollupSection").then((m) => ({ default: m.TenantRollupSection }))
)

export function ReportsPage() {
  const tenantId = useAuthStore((s) => s.tenantId)
  const branchId = useBranchId()
  const { permissions } = useStaffPermissions()
  const [date, setDate] = useState(todayIsoDate)
  const [rollupFrom, setRollupFrom] = useState("")
  const [rollupTo, setRollupTo] = useState("")
  const [branchSnapDate, setBranchSnapDate] = useState(todayIsoDate)

  const canTenantRollup = permissions.includes("reports.tenant_rollups")

  const rollupQ = useQuery({
    queryKey: ["reports", "tenant-rollup", tenantId, rollupFrom, rollupTo],
    queryFn: () =>
      apiFetch<TenantRollupReport>(
        tenantPaths.tenantRollup(rollupFrom.trim() || undefined, rollupTo.trim() || undefined)
      ),
    enabled: canTenantRollup,
  })

  const visitSignalsQ = useQuery({
    queryKey: ["reports", "visit-signals", branchId],
    queryFn: () => apiFetch<BranchVisitSignals>(branchPaths.customerVisitSignals(branchId!)),
    enabled: !!branchId,
  })

  const opsQ = useQuery({
    queryKey: ["ops-snapshot", branchId],
    queryFn: () => apiFetch<OpsSnapshot>(branchPaths.opsSnapshot(branchId!)),
    enabled: !!branchId,
    retry: false,
  })

  const q = useQuery({
    queryKey: ["reports", branchId, date],
    queryFn: () => apiFetch<DailyReport>(branchPaths.reportsDaily(branchId!, date)),
    enabled: !!branchId,
  })

  const typeEntries = useMemo(() => {
    const report = q.data
    if (!report) {
      return []
    }
    return Object.entries(report.salesByOrderType).sort((a, b) => b[1] - a[1])
  }, [q.data])

  const maxHourly = useMemo(() => {
    if (!q.data?.hourlySales?.length) {
      return 1
    }
    return Math.max(1, ...q.data.hourlySales.map((hour) => hour.salesMinor))
  }, [q.data])

  const maxType = useMemo(() => {
    if (!typeEntries.length) {
      return 1
    }
    return Math.max(1, ...typeEntries.map(([, value]) => value))
  }, [typeEntries])

  const demandQ = useQuery({
    queryKey: ["reports", "demand-profile", branchId, 28],
    queryFn: () => apiFetch<DemandProfile>(branchPaths.reportsDemandProfile(branchId!, 28)),
    enabled: !!branchId,
  })

  const branchSnapQ = useQuery({
    queryKey: ["tenant", "branch-snapshot", tenantId, branchSnapDate],
    queryFn: () => apiFetch<BranchSnapshotReport>(tenantPaths.branchSnapshot(branchSnapDate)),
    enabled: canTenantRollup && !!branchSnapDate,
  })

  const dailyOperatorCues = useMemo(() => (q.data ? buildDailyOperatorCues(q.data) : []), [q.data])

  const rollupOperatorCues = useMemo(
    () => (rollupQ.data ? buildRollupOperatorCues(rollupQ.data) : []),
    [rollupQ.data]
  )
  const reportForbidden = q.isError && isApiError(q.error) && q.error.status === 403

  return (
    <PageFrame size="wide">
      <PageHeader
        eyebrow="Reporting"
        title="Operational report"
        description="Branch day snapshot aligned to the selected branch calendar day and timezone."
        actions={
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Date</span>
            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-9 w-auto"
            />
          </label>
        }
      />

      <OperationalStrip data={opsQ.data} />

      {canTenantRollup ? (
        <Suspense
          fallback={
            <StatePanel
              className="mb-8"
              compact
              variant="loading"
              title="Loading tenant rollup"
              description="Preparing cross-branch metrics and operator cues."
            />
          }
        >
          <TenantRollupSection
            rollupFrom={rollupFrom}
            setRollupFrom={setRollupFrom}
            rollupTo={rollupTo}
            setRollupTo={setRollupTo}
            rollupQ={rollupQ}
            rollupOperatorCues={rollupOperatorCues}
            branchSnapDate={branchSnapDate}
            setBranchSnapDate={setBranchSnapDate}
            branchSnapQ={branchSnapQ}
          />
        </Suspense>
      ) : null}

      {q.isLoading ? (
        <StatePanel variant="loading" title="Loading report" description="Fetching the selected branch-day report." />
      ) : null}

      {q.isError ? (
        <StatePanel
          variant={reportForbidden ? "empty" : "error"}
          title={reportForbidden ? "Report access is limited" : "Could not load report."}
          description={
            reportForbidden
              ? "This screen requires reports.view. Ask an admin to enable reporting access for this operator."
              : "Retry with another date or refresh the page."
          }
          action={
            !reportForbidden ? (
              <Button type="button" variant="outline" onClick={() => void q.refetch()}>
                Retry
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {q.data ? (
        <DailyReportBody
          report={q.data}
          dailyOperatorCues={dailyOperatorCues}
          visitSignals={visitSignalsQ.data}
          demand={demandQ.data}
          demandLoading={demandQ.isLoading}
          demandError={demandQ.isError}
          typeEntries={typeEntries}
          maxHourly={maxHourly}
          maxType={maxType}
        />
      ) : null}
    </PageFrame>
  )
}
