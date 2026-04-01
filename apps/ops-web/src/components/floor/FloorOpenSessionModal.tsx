import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useLanguage } from "@/i18n/context"
import { apiFetch, branchPaths } from "@/lib/api"
import type { OpenTableSessionBody, TableSessionOpenResponse } from "@/lib/contract/staff-api"
import { toast } from "@/components/ui/sonner"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  branchId: string
  floorTableId: string
  tableLabel: string
  onSessionOpened?: (sessionId: string, tableLabel: string) => void
}

export function FloorOpenSessionModal({
  open,
  onOpenChange,
  branchId,
  floorTableId,
  tableLabel,
  onSessionOpened,
}: Props) {
  const { t } = useLanguage()
  const qc = useQueryClient()
  const [guestCount, setGuestCount] = useState("2")

  const m = useMutation({
    mutationFn: async () => {
      const n = Number.parseInt(guestCount, 10)
      if (!Number.isFinite(n) || n < 1 || n > 99) {
        throw new Error(t.floor.workflow.invalidGuestCount)
      }
      return apiFetch<TableSessionOpenResponse>(branchPaths.tableSessions(branchId), {
        method: "POST",
        body: JSON.stringify({ floorTableId, guestCount: n } satisfies OpenTableSessionBody),
      })
    },
    onSuccess: async (row) => {
      await qc.invalidateQueries({ queryKey: ["tables", branchId] })
      onOpenChange(false)
      onSessionOpened?.(row.id, tableLabel)
      toast.success(t.floor.workflow.sessionOpened)
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : t.floor.workflow.sessionFailed)
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
      aria-labelledby="floor-session-title"
    >
      <Card className="w-full max-w-md border-border/80 bg-card shadow-lg">
        <CardHeader>
          <CardTitle id="floor-session-title">
            {t.floor.workflow.startSession} — {tableLabel}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="floor-guest-count">
              {t.floor.workflow.guestCount}
            </label>
            <Input
              id="floor-guest-count"
              type="number"
              min={1}
              max={99}
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              data-testid="floor-session-guest-count"
            />
          </div>
          <div className="flex justify-end gap-2">
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
              disabled={m.isPending}
              data-testid="floor-session-submit"
            >
              {m.isPending ? t.floor.workflow.openingSession : t.floor.workflow.openSession}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
