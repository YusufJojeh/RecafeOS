import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { useLanguage } from "@/i18n/context"
import { OrderType, STAFF_HTTP_HEADER } from "@restocafe/types"
import { ApiError, apiFetch, branchPaths } from "@/lib/api"
import type {
  MenuCategoryWithItems,
  StaffAddOrderItemBody,
  StaffCreateOrderBody,
  StaffOrderCreateResponse,
} from "@/lib/contract/staff-api"
import { toast } from "@/components/ui/sonner"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  branchId: string
  tableSessionId: string
  tableLabel: string
}

export function FloorDineInOrderModal({
  open,
  onOpenChange,
  branchId,
  tableSessionId,
  tableLabel,
}: Props) {
  const { t } = useLanguage()
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  const menuQ = useQuery({
    queryKey: ["floor-dine-in-menu", branchId],
    queryFn: () =>
      apiFetch<MenuCategoryWithItems[]>(branchPaths.menuCategories(branchId)),
    enabled: open && !!branchId,
  })

  const flatItems = useMemo(() => {
    const rows: { id: string; name: string; priceMinor: number; category: string }[] = []
    for (const c of menuQ.data ?? []) {
      for (const it of c.items) {
        rows.push({
          id: it.id,
          name: it.name,
          priceMinor: it.priceMinor,
          category: c.name,
        })
      }
    }
    return rows
  }, [menuQ.data])

  const m = useMutation({
    mutationFn: async () => {
      const menuItemIds = Object.entries(selected)
        .filter(([, on]) => on)
        .map(([id]) => id)
      if (menuItemIds.length === 0) {
        throw new Error(t.floor.workflow.selectAtLeastOne)
      }

      const idemKey =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `floor-${Date.now()}`
      const createBody: StaffCreateOrderBody = {
        type: OrderType.DINE_IN,
        tableSessionId,
      }
      const order = await apiFetch<StaffOrderCreateResponse>(branchPaths.openOrders(branchId), {
        method: "POST",
        headers: { [STAFF_HTTP_HEADER.IDEMPOTENCY_KEY]: idemKey },
        body: JSON.stringify(createBody),
      })

      const oid = order.id

      for (const menuItemId of menuItemIds) {
        const lineBody: StaffAddOrderItemBody = { menuItemId, quantity: 1 }
        await apiFetch(`${branchPaths.openOrders(branchId)}/${oid}/items`, {
          method: "POST",
          body: JSON.stringify(lineBody),
        })
      }

      await apiFetch(`${branchPaths.openOrders(branchId)}/${oid}/confirm`, {
        method: "POST",
      })
      await apiFetch(`${branchPaths.openOrders(branchId)}/${oid}/send-to-preparation`, {
        method: "POST",
      })

      return oid
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["tables", branchId] }),
        qc.invalidateQueries({ queryKey: ["open-orders", branchId] }),
        qc.invalidateQueries({ queryKey: ["tickets", "KITCHEN", branchId] }),
        qc.invalidateQueries({ queryKey: ["tickets", "BAR", branchId] }),
      ])
      setSelected({})
      onOpenChange(false)
      toast.success(t.floor.workflow.dineInCreated)
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError) {
        toast.error(e.message)
        return
      }
      toast.error(e instanceof Error ? e.message : t.floor.workflow.flowError)
    },
  })

  if (!open) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="floor-dine-in-title"
    >
      <Card className="max-h-[min(90vh,640px)] w-full max-w-lg overflow-hidden border-border/80 bg-card shadow-lg">
        <CardHeader className="shrink-0">
          <CardTitle id="floor-dine-in-title">
            {t.floor.workflow.newDineInOrder} — {tableLabel}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t.floor.workflow.dineInBody}</p>
        </CardHeader>
        <CardContent className="flex max-h-[min(60vh,480px)] flex-col gap-4 overflow-y-auto">
          {menuQ.isLoading ? (
            <p className="text-sm text-muted-foreground">{t.common.loading}</p>
          ) : null}
          {menuQ.isError ? (
            <p className="text-sm text-destructive">{t.floor.workflow.loadMenuError}</p>
          ) : null}
          {menuQ.data ? (
            <div className="space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t.floor.workflow.pickItems}
              </div>
              {flatItems.map((it) => (
                <label
                  key={it.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
                >
                  <Checkbox
                    checked={!!selected[it.id]}
                    onCheckedChange={(c) =>
                      setSelected((s) => ({ ...s, [it.id]: c === true }))
                    }
                    data-testid={`floor-menu-pick-${it.id}`}
                  />
                  <span className="flex-1 text-sm">
                    <span className="font-medium">{it.name}</span>
                    <span className="ml-2 text-muted-foreground">
                      {(it.priceMinor / 100).toFixed(2)}
                    </span>
                    <span className="block text-xs text-muted-foreground">{it.category}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : null}
          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border/60 bg-card pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={m.isPending}
            >
              {t.floor.workflow.cancel}
            </Button>
            <Button
              type="button"
              onClick={() => m.mutate()}
              disabled={m.isPending || menuQ.isLoading || !!menuQ.isError}
              data-testid="floor-dine-in-submit"
            >
              {m.isPending ? t.floor.workflow.submittingDineIn : t.floor.workflow.submitDineIn}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
