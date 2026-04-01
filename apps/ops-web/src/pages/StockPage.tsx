import { useQuery } from "@tanstack/react-query"

import { MetricCard, PageFrame, PageHeader, StatePanel } from "@/components/ConsoleUi"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { apiFetch, branchPaths } from "@/lib/api"
import { useBranchId } from "@/lib/use-branch-id"

type Stock = { id: string; name: string; quantity: string; lowThreshold: string; unit: string }

export function StockPage() {
  const branchId = useBranchId()
  const q = useQuery({
    queryKey: ["stock", branchId],
    queryFn: () => apiFetch<Stock[]>(branchPaths.inventoryStock(branchId!)),
    enabled: !!branchId,
  })

  const items = q.data ?? []
  const lowCount = items.filter((item) => Number(item.quantity) <= Number(item.lowThreshold)).length

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Inventory"
        title="Stock"
        description="Monitor current branch stock levels and surface low-threshold risk quickly."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <MetricCard label="Stock items" value={items.length || "--"} detail="Tracked branch inventory rows" />
        <MetricCard
          label="Low stock"
          value={lowCount}
          detail="At or below threshold"
          tone={lowCount > 0 ? "danger" : "emerald"}
        />
        <MetricCard
          label="Coverage"
          value={items.length ? `${items.length - lowCount}` : "--"}
          detail="Items still above threshold"
        />
      </div>

      {q.isLoading ? (
        <StatePanel variant="loading" title="Loading stock" description="Fetching inventory balances for this branch." />
      ) : null}

      {q.isError ? (
        <StatePanel
          variant="error"
          title="Could not load stock"
          description={(q.error as Error).message}
          action={
            <Button type="button" variant="outline" onClick={() => void q.refetch()}>
              Retry
            </Button>
          }
        />
      ) : null}

      {!q.isLoading && !q.isError && items.length === 0 ? (
        <StatePanel
          variant="empty"
          title="No stock rows"
          description="Inventory is enabled, but this branch has no stock records yet."
        />
      ) : null}

      {!q.isLoading && !q.isError && items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => {
            const low = Number(item.quantity) <= Number(item.lowThreshold)
            return (
              <Card
                key={item.id}
                className={`flex items-center justify-between gap-4 border-border/60 bg-card/80 px-4 py-4 ${
                  low ? "border-red-500/40 bg-red-500/5" : ""
                }`}
              >
                <div>
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {item.quantity} {item.unit}
                  </div>
                </div>
                <div className="text-right">
                  <Badge
                    variant="outline"
                    className={low ? "border-red-500/40 text-red-200" : "border-border/60"}
                  >
                    {low ? "LOW" : "OK"}
                  </Badge>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Threshold {item.lowThreshold}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      ) : null}
    </PageFrame>
  )
}
