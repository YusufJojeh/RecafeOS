import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { ArrowRight, Building2 } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { MetricCard, PageFrame, PageHeader, StatePanel } from "@/components/ConsoleUi"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/i18n/context"
import { apiFetch, tenantPaths } from "@/lib/api"
import { STAFF_ME_QUERY_KEY } from "@/lib/staff-permissions"
import type { StaffAuthMeResponse } from "@/lib/contract/auth-api"
import type { CommerceReadModel, StaffBranchSummary } from "@/lib/contract/staff-api"
import { useAuthStore } from "@/lib/auth-store"

export function BranchSelectPage() {
  const nav = useNavigate()
  const { t } = useLanguage()
  const tenantId = useAuthStore((s) => s.tenantId)
  const setBranch = useAuthStore((s) => s.setBranch)
  const q = useQuery({
    queryKey: ["branches", tenantId],
    queryFn: () => apiFetch<StaffBranchSummary[]>("/tenants/branches"),
  })

  const commerceQ = useQuery({
    queryKey: ["tenant-commerce", tenantId],
    queryFn: () => apiFetch<CommerceReadModel>(tenantPaths.commerce()),
  })

  const meQ = useQuery({
    queryKey: STAFF_ME_QUERY_KEY,
    queryFn: () => apiFetch<StaffAuthMeResponse>("/auth/me"),
  })

  const branchRows = useMemo(() => {
    const list = q.data ?? []
    const pref = meQ.data?.defaultBranchId
    if (!pref) return list
    return [...list].sort((a, b) => {
      if (a.id === pref) return -1
      if (b.id === pref) return 1
      return 0
    })
  }, [q.data, meQ.data?.defaultBranchId])

  const branchesRemaining = commerceQ.data
    ? Math.max(0, commerceQ.data.limits.maxBranches - commerceQ.data.limits.branchesInUse)
    : null

  const showExpansionHint =
    (q.data?.length ?? 0) > 1 &&
    (meQ.data?.permissions?.includes("reports.tenant_rollups") ?? false)

  const atBranchCap = branchesRemaining === 0 && (q.data?.length ?? 0) > 0

  return (
    <PageFrame size="narrow" className="min-h-screen flex items-center">
      <div className="w-full space-y-6">
        <PageHeader
          eyebrow={t.branch.eyebrow}
          title={t.branch.title}
          description={t.branch.description}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <MetricCard
            label={t.branch.branchesInUse}
            value={commerceQ.data ? commerceQ.data.limits.branchesInUse : "--"}
            detail={
              commerceQ.data
                ? `${commerceQ.data.limits.maxBranches} ${t.branch.branchesAllowed}`
                : t.common.loading
            }
            tone="emerald"
          />
          <MetricCard
            label={t.branch.rolloutSlots}
            value={branchesRemaining ?? "--"}
            detail={t.branch.rolloutHint}
            tone={branchesRemaining === 0 ? "amber" : "default"}
          />
        </div>

        {atBranchCap ? (
          <StatePanel
            compact
            variant="info"
            title={t.branch.planLimitTitle}
            description={t.branch.planLimitBody}
          />
        ) : null}

        {showExpansionHint ? (
          <StatePanel
            compact
            variant="info"
            title={t.branch.crossSiteTitle}
            description={t.branch.crossSiteBody}
          />
        ) : null}

        {q.isLoading ? (
          <StatePanel variant="loading" title={t.branch.loading} description={t.branch.loadingBody} />
        ) : null}

        {q.isError ? (
          <StatePanel
            variant="error"
            title={t.branch.error}
            description={(q.error as Error).message}
            action={
              <Button type="button" variant="outline" onClick={() => void q.refetch()}>
                {t.common.retry}
              </Button>
            }
          />
        ) : null}

        {!q.isLoading && !q.isError && (q.data?.length ?? 0) === 0 ? (
          <StatePanel
            variant="empty"
            title={t.branch.noBranches}
            description={t.branch.noBranchesBody}
          />
        ) : null}

        {branchRows.length ? (
          <div className="space-y-3">
            {branchRows.map((b, index) => (
              <Button
                key={b.id}
                type="button"
                data-testid={`branch-option-${b.slug}`}
                variant="outline"
                className="h-auto w-full justify-between gap-4 rounded-2xl border-border/60 bg-card/70 px-5 py-4 text-left"
                onClick={() => {
                  setBranch(b.id)
                  nav("/floor")
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="rounded-2xl border border-border/60 bg-muted/40 p-3 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-base font-semibold">{b.name}</div>
                    <div className="text-sm text-muted-foreground">{b.slug}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Badge variant="outline" className="border-border/60">
                    {t.branch.branchLabel} {index + 1}
                  </Badge>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </PageFrame>
  )
}
