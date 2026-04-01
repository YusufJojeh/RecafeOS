import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import {
  MetricCard,
  PageFrame,
  PageHeader,
  SectionCard,
  StatePanel,
} from "@/components/ConsoleUi"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useLanguage } from "@/i18n/context"
import { ApiError, apiFetch, branchPaths } from "@/lib/api"
import { useBranchId } from "@/lib/use-branch-id"
import type { StaffMenuCategoryListRow } from "@/lib/contract/staff-api"

type ImportPayload = {
  categories: Array<{
    name: string
    items: Array<{ name: string; priceMinor: number }>
  }>
}

const SAMPLE_IMPORT = `{
  "categories": [
    {
      "name": "Imported",
      "items": [
        { "name": "Example item", "priceMinor": 999, "prepStation": "KITCHEN" }
      ]
    }
  ]
}`

function parseImportJson(source: string): ImportPayload {
  try {
    return JSON.parse(source) as ImportPayload
  } catch {
    throw new Error("Import JSON is not valid JSON. Fix the syntax, then dry-run again.")
  }
}

function formatMutationError(error: unknown): string {
  if (error instanceof ApiError && error.body && typeof error.body === "object") {
    return JSON.stringify(error.body)
  }
  return error instanceof Error ? error.message : "Request failed."
}

export function MenuPage() {
  const { t } = useLanguage()
  const branchId = useBranchId()
  const queryClient = useQueryClient()
  const [importJson, setImportJson] = useState(SAMPLE_IMPORT)

  const q = useQuery({
    queryKey: ["menu", branchId],
    queryFn: () => apiFetch<StaffMenuCategoryListRow[]>(branchPaths.menuCategories(branchId!)),
    enabled: !!branchId,
  })

  const dryRun = useMutation({
    mutationFn: async () => {
      const body = parseImportJson(importJson)
      return apiFetch<{
        ok: boolean
        itemCount: number
        categoryCount: number
        errors: string[]
      }>(branchPaths.menuImportDryRun(branchId!), {
        method: "POST",
        body: JSON.stringify(body),
      })
    },
  })

  const apply = useMutation({
    mutationFn: async () => {
      const body = parseImportJson(importJson)
      return apiFetch<{ categoriesCreated: number; itemsCreated: number }>(
        branchPaths.menuImportApply(branchId!),
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      )
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["menu", branchId] })
    },
  })

  const categoryCount = q.data?.length ?? 0
  const itemCount = q.data?.reduce((count, category) => count + category.items.length, 0) ?? 0

  return (
    <PageFrame>
      <PageHeader
        eyebrow={t.menu.eyebrow}
        title={t.menu.title}
        description={t.menu.description}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <MetricCard
          label={t.menu.metrics.categories}
          value={categoryCount || "--"}
          detail={t.menu.metrics.categoriesDetail}
        />
        <MetricCard
          label={t.menu.metrics.items}
          value={itemCount || "--"}
          detail={t.menu.metrics.itemsDetail}
        />
        <MetricCard
          label={t.menu.metrics.importGate}
          value={dryRun.data?.ok ? t.menu.metrics.importReady : t.menu.metrics.importValidate}
          detail={t.menu.metrics.importDetail}
          tone={dryRun.data?.ok ? "emerald" : "amber"}
        />
      </div>

      <SectionCard
        className="mb-8"
        title={t.menu.import.title}
        description={t.menu.import.description}
      >
        <textarea
          className="mb-4 min-h-[220px] w-full rounded-md border border-border/60 bg-background px-4 py-3 font-mono text-xs text-foreground"
          value={importJson}
          onChange={(e) => setImportJson(e.target.value)}
          spellCheck={false}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={dryRun.isPending || !importJson.trim()}
            onClick={() => dryRun.mutate()}
          >
            {dryRun.isPending ? t.menu.import.validating : t.menu.import.dryRun}
          </Button>
          <Button
            type="button"
            disabled={apply.isPending || !dryRun.data?.ok}
            onClick={() => apply.mutate()}
          >
            {apply.isPending ? t.menu.import.applying : t.menu.import.apply}
          </Button>
        </div>

        {dryRun.data ? (
          <Card className="mt-4 border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {t.menu.import.validationTitle}
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap text-xs">
              {JSON.stringify(dryRun.data, null, 2)}
            </pre>
          </Card>
        ) : null}

        {dryRun.isError ? (
          <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
            {formatMutationError(dryRun.error)}
          </div>
        ) : null}

        {apply.data ? (
          <div className="mt-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {t.menu.import.applied.replace("{categories}", String(apply.data.categoriesCreated)).replace(
              "{items}",
              String(apply.data.itemsCreated)
            )}
          </div>
        ) : null}

        {apply.isError ? (
          <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
            {formatMutationError(apply.error)}
          </div>
        ) : null}
      </SectionCard>

      {q.isLoading ? (
        <StatePanel
          variant="loading"
          title={t.menu.states.loadingTitle}
          description={t.menu.states.loadingBody}
        />
      ) : null}

      {q.isError ? (
        <StatePanel
          variant="error"
          title={t.menu.states.errorTitle}
          description={(q.error as Error).message}
          action={
            <Button type="button" variant="outline" onClick={() => void q.refetch()}>
              {t.common.retry}
            </Button>
          }
        />
      ) : null}

      {!q.isLoading && !q.isError && categoryCount === 0 ? (
        <StatePanel
          variant="empty"
          title={t.menu.states.emptyTitle}
          description={t.menu.states.emptyBody}
        />
      ) : null}

      {!q.isLoading && !q.isError && categoryCount > 0 ? (
        <div className="space-y-6">
          {q.data?.map((category) => (
            <SectionCard
              key={category.id}
              title={category.name}
              description={t.menu.categoryCount.replace(
                "{count}",
                String(category.items.length)
              )}
            >
              <div className="space-y-3">
                {category.items.map((item) => (
                  <Card
                    key={item.id}
                    className="flex items-center justify-between gap-3 border-border/60 bg-card/80 px-4 py-3"
                  >
                    <div>
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.available ? t.menu.available : t.menu.unavailable}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={item.available ? "text-emerald-200" : "text-muted-foreground"}
                      >
                        {item.available ? t.menu.available : t.menu.unavailable}
                      </Badge>
                      <div className="text-sm font-medium">
                        {(item.priceMinor / 100).toFixed(2)}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </SectionCard>
          ))}
        </div>
      ) : null}
    </PageFrame>
  )
}
