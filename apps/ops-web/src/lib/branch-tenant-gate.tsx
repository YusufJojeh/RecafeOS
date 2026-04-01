import { useQuery } from "@tanstack/react-query"
import { type ReactNode, useEffect } from "react"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/i18n/context"
import { apiFetch } from "@/lib/api"
import { useAuthStore } from "@/lib/auth-store"
import type { StaffBranchSummary } from "@/lib/contract/staff-api"

function StaleBranchClear() {
  const clearBranch = useAuthStore((s) => s.clearBranch)
  useEffect(() => {
    clearBranch()
  }, [clearBranch])
  return null
}

/**
 * After login, `branchId` lives only on the client (`X-Branch-Id`). If the tenant’s branch
 * list changes (delete, different device), clear stale ids so the user re-selects.
 *
 * **Policy:** Does not replace server enforcement (`BranchGuard`); reduces confusing 403 loops.
 */
export function BranchTenantGate({ children }: { children: ReactNode }) {
  const { t } = useLanguage()
  const tenantId = useAuthStore((s) => s.tenantId)
  const branchId = useAuthStore((s) => s.branchId)

  const q = useQuery({
    queryKey: ["branches", tenantId],
    queryFn: () => apiFetch<StaffBranchSummary[]>("/tenants/branches"),
    enabled: Boolean(tenantId && branchId),
  })

  if (!branchId) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        {t.common.loading}
      </div>
    )
  }

  if (q.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        {t.common.loading}
      </div>
    )
  }

  if (q.isError) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4">
        <Card className="max-w-md border-border/60 p-6 text-center text-sm">
          <p className="text-muted-foreground">{(q.error as Error).message}</p>
          <Button type="button" className="mt-4" variant="secondary" onClick={() => void q.refetch()}>
            {t.common.retry}
          </Button>
        </Card>
      </div>
    )
  }

  if (q.isSuccess && q.data && !q.data.some((b) => b.id === branchId)) {
    return <StaleBranchClear />
  }

  return <>{children}</>
}
