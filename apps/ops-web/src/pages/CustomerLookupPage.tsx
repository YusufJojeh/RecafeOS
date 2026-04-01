import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"

import {
  MetricCard,
  PageFrame,
  PageHeader,
  SectionCard,
  StatePanel,
} from "@/components/ConsoleUi"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiFetch, branchPaths, customerPaths, tenantPaths } from "@/lib/api"
import { useAuthStore } from "@/lib/auth-store"
import { useStaffPermissions } from "@/lib/staff-permissions"
import { useBranchId } from "@/lib/use-branch-id"
import type { StaffCustomerDetail, StaffCustomerSearchHit } from "@/lib/contract/staff-api"

const NOTE_CATS = ["GENERAL", "PREFERENCE", "ALLERGY", "COMPLAINT"] as const

function money(minor: number): string {
  return (minor / 100).toFixed(2)
}

export function CustomerLookupPage() {
  const tenantId = useAuthStore((s) => s.tenantId)
  const branchId = useBranchId()
  const { permissions } = useStaffPermissions()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const qParam = searchParams.get("q") ?? ""
  const idParam = searchParams.get("id") ?? ""

  const [localQ, setLocalQ] = useState(qParam)
  const [tagInput, setTagInput] = useState("")
  const [stickyNote, setStickyNote] = useState("")
  const [noteBody, setNoteBody] = useState("")
  const [noteCat, setNoteCat] = useState<string>("GENERAL")
  const [offerTitle, setOfferTitle] = useState("")
  const [offerDesc, setOfferDesc] = useState("")
  const [offerUntil, setOfferUntil] = useState("")
  const [retentionYears, setRetentionYears] = useState(7)
  const [archiveConfirmArmed, setArchiveConfirmArmed] = useState(false)

  useEffect(() => {
    setLocalQ(qParam)
  }, [qParam])

  const canManage = permissions.includes("customers.manage")
  const canRollup = permissions.includes("reports.tenant_rollups")
  const canSearch = localQ.trim().length === 0 || localQ.trim().length >= 2

  const searchQ = useQuery({
    queryKey: ["customers-branch-search", branchId, qParam],
    queryFn: () => apiFetch<StaffCustomerSearchHit[]>(branchPaths.customersBranchSearch(branchId!, qParam)),
    enabled: !!branchId && qParam.trim().length >= 2,
  })

  const detailQ = useQuery({
    queryKey: ["customer-detail", tenantId, idParam],
    queryFn: () => apiFetch<StaffCustomerDetail>(customerPaths.detail(idParam)),
    enabled: !!idParam,
  })

  const repeatQ = useQuery({
    queryKey: ["repeat-customers", tenantId, 90],
    queryFn: () =>
      apiFetch<{
        customers: Array<{
          customerId: string
          phone: string
          name: string | null
          paidOrderCount: number
          netPaidSalesMinor: number
        }>
        days: number
      }>(tenantPaths.repeatCustomers(90)),
    enabled: canRollup,
  })

  useEffect(() => {
    if (!detailQ.data) {
      return
    }
    setTagInput(detailQ.data.tags.join(", "))
    setStickyNote(detailQ.data.notes ?? "")
  }, [detailQ.data])

  const patchM = useMutation({
    mutationFn: (body: { tags?: string[]; notes?: string }) =>
      apiFetch(customerPaths.patch(idParam), {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["customer-detail"] })
    },
  })

  const noteM = useMutation({
    mutationFn: (body: { body: string; category: string }) =>
      apiFetch(customerPaths.addNote(idParam), {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setNoteBody("")
      void queryClient.invalidateQueries({ queryKey: ["customer-detail"] })
    },
  })

  const offerM = useMutation({
    mutationFn: (body: { title: string; description?: string; validUntil?: string; kind?: string }) =>
      apiFetch(customerPaths.addOffer(idParam), {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setOfferTitle("")
      setOfferDesc("")
      setOfferUntil("")
      void queryClient.invalidateQueries({ queryKey: ["customer-detail"] })
    },
  })

  const archiveM = useMutation({
    mutationFn: () =>
      apiFetch<{ deletedVisitRows: number; years: number; cutoffUtc: string }>(
        tenantPaths.archiveStaleCustomerVisits(retentionYears),
        { method: "POST" }
      ),
    onSuccess: () => {
      setArchiveConfirmArmed(false)
      void queryClient.invalidateQueries({ queryKey: ["customer-detail"] })
      void queryClient.invalidateQueries({ queryKey: ["repeat-customers"] })
    },
  })

  const runSearch = () => {
    if (!canSearch) {
      return
    }
    const next = new URLSearchParams(searchParams)
    if (localQ.trim()) {
      next.set("q", localQ.trim())
    } else {
      next.delete("q")
    }
    next.delete("id")
    setSearchParams(next)
  }

  return (
    <PageFrame size="wide">
      <PageHeader
        eyebrow="Customer CRM"
        title="Customers"
        description="Search recent and repeat guests for the current branch, then manage notes, offers, and retention data in one surface."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Branch search"
          value={qParam.trim() ? "Active" : "Idle"}
          detail="Guest lookup by name or phone"
        />
        <MetricCard
          label="Manage access"
          value={canManage ? "Enabled" : "Read only"}
          detail="Tags, notes, and offers"
          tone={canManage ? "emerald" : "default"}
        />
        <MetricCard
          label="Rollup tools"
          value={canRollup ? "Enabled" : "Hidden"}
          detail="Repeat spend and retention actions"
          tone={canRollup ? "amber" : "default"}
        />
      </div>

      <SectionCard
        className="mb-6"
        title="Search guests"
        description="Search by phone or name. Minimum 2 characters for queries."
      >
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="customer-search">
            Search customers by phone or name
          </label>
          <Input
            id="customer-search"
            type="search"
            value={localQ}
            onChange={(e) => setLocalQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="Phone or name..."
            className="min-w-[220px] flex-1"
          />
          <Button type="button" onClick={runSearch} disabled={!canSearch}>
            Search
          </Button>
        </div>
        {localQ.trim().length === 1 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Enter at least 2 characters to search.
          </p>
        ) : null}
      </SectionCard>

      {searchQ.isFetching ? (
        <StatePanel
          compact
          variant="loading"
          title="Searching customers"
          description="Looking up guest history for this branch."
          className="mb-6"
        />
      ) : null}

      {searchQ.isError ? (
        <StatePanel
          compact
          variant="error"
          title="Search failed"
          description="Need customers.view for this branch."
          className="mb-6"
        />
      ) : null}

      {searchQ.data && qParam.trim().length >= 2 ? (
        <SectionCard
          className="mb-8"
          title="Search results"
          description={`${searchQ.data.length} match${searchQ.data.length === 1 ? "" : "es"}`}
        >
          {searchQ.data.length === 0 ? (
            <p className="text-muted-foreground">No matches.</p>
          ) : (
            <ul className="space-y-2">
              {searchQ.data.map((customer) => (
                <li key={customer.id}>
                  <Button
                    type="button"
                    variant="outline"
                    className={`h-auto w-full justify-start rounded-xl px-4 py-3 text-left ${
                      idParam === customer.id ? "border-emerald-500/40 bg-emerald-500/10" : ""
                    }`}
                    onClick={() => {
                      const next = new URLSearchParams(searchParams)
                      next.set("id", customer.id)
                      setSearchParams(next)
                    }}
                  >
                    <span className="font-semibold">{customer.name ?? "-"}</span>
                    <span className="ml-2 text-muted-foreground">{customer.phone}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {customer.visitCount} visits
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      ) : null}

      {detailQ.isLoading && idParam ? (
        <StatePanel
          compact
          variant="loading"
          title="Loading profile"
          description="Fetching customer detail, history, and offers."
          className="mb-6"
        />
      ) : null}

      {detailQ.isError ? (
        <StatePanel
          compact
          variant="error"
          title="Could not load customer"
          description="Retry the search or refresh the profile."
          className="mb-6"
        />
      ) : null}

      {detailQ.data ? (
        <div className="space-y-6">
          <SectionCard
            title={
              <>
                {detailQ.data.name ?? "Guest"}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  {detailQ.data.phone}
                </span>
              </>
            }
            description="Profile summary and recommended actioning for this guest."
            actions={
              <Badge variant="outline" className="uppercase tracking-[0.18em]">
                {detailQ.data.intelligence.segment.replace(/_/g, " ")}
              </Badge>
            }
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard
                label="Days since last visit"
                value={detailQ.data.intelligence.daysSinceLastVisit ?? "-"}
                detail="Branch-relative recency"
              />
              <MetricCard
                label="Visits (90d)"
                value={detailQ.data.intelligence.visitsLast90Days}
                detail="Recent visit density"
              />
              <MetricCard
                label="Primary branch"
                value={detailQ.data.intelligence.primaryBranch?.name ?? "-"}
                detail="Most frequent recent branch"
              />
            </div>
            {detailQ.data.suggestedActions.length > 0 ? (
              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-amber-100/90">
                {detailQ.data.suggestedActions.map((action) => (
                  <li key={action.type + action.message.slice(0, 20)}>{action.message}</li>
                ))}
              </ul>
            ) : null}
          </SectionCard>

          {canManage ? (
            <SectionCard title="Tags and sticky note" description="Shared FoH context for this guest profile.">
              <div className="space-y-3 text-sm">
                <label className="block text-muted-foreground">
                  Tags (comma-separated, max 5)
                  <Input className="mt-2" value={tagInput} onChange={(e) => setTagInput(e.target.value)} />
                </label>
                <label className="block text-muted-foreground">
                  Sticky note (FoH)
                  <textarea
                    className="mt-2 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
                    rows={3}
                    value={stickyNote}
                    onChange={(e) => setStickyNote(e.target.value)}
                  />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  disabled={patchM.isPending}
                  onClick={() => {
                    const tags = tagInput
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean)
                    patchM.mutate({ tags, notes: stickyNote })
                  }}
                >
                  {patchM.isPending ? "Saving..." : "Save profile fields"}
                </Button>
                {patchM.isSuccess ? <p className="text-xs text-emerald-400">Profile fields saved.</p> : null}
                {patchM.isError ? <p className="text-xs text-red-400">Could not save profile fields.</p> : null}
              </div>
            </SectionCard>
          ) : null}

          {canManage ? (
            <SectionCard title="Add note" description="Structured service notes feed into future guest context.">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <select
                  value={noteCat}
                  onChange={(e) => setNoteCat(e.target.value)}
                  className="rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
                >
                  {NOTE_CATS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <Input
                  aria-label="New note text"
                  className="min-w-[220px] flex-1"
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="Short note..."
                />
                <Button
                  type="button"
                  disabled={noteM.isPending || !noteBody.trim()}
                  onClick={() => noteM.mutate({ body: noteBody, category: noteCat })}
                >
                  {noteM.isPending ? "Adding..." : "Add"}
                </Button>
              </div>
              {noteM.isSuccess ? <p className="mt-2 text-xs text-emerald-400">Note added.</p> : null}
              {noteM.isError ? <p className="mt-2 text-xs text-red-400">Could not add note.</p> : null}
            </SectionCard>
          ) : null}

          {canManage ? (
            <SectionCard title="New offer" description="Create a manual offer for this guest profile.">
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  aria-label="Offer title"
                  placeholder="Title"
                  value={offerTitle}
                  onChange={(e) => setOfferTitle(e.target.value)}
                />
                <Input
                  aria-label="Offer description"
                  placeholder="Description"
                  value={offerDesc}
                  onChange={(e) => setOfferDesc(e.target.value)}
                />
                <Input type="date" value={offerUntil} onChange={(e) => setOfferUntil(e.target.value)} />
                <Button
                  type="button"
                  disabled={offerM.isPending || !offerTitle.trim()}
                  onClick={() =>
                    offerM.mutate({
                      title: offerTitle,
                      description: offerDesc || undefined,
                      validUntil: offerUntil || undefined,
                      kind: "MANUAL",
                    })
                  }
                >
                  {offerM.isPending ? "Creating..." : "Create"}
                </Button>
              </div>
              {offerM.isSuccess ? <p className="mt-2 text-xs text-emerald-400">Offer created.</p> : null}
              {offerM.isError ? <p className="mt-2 text-xs text-red-400">Could not create offer.</p> : null}
            </SectionCard>
          ) : null}

          <SectionCard title="Visit history" description="Paid or linked guest visit timeline.">
            <ul className="space-y-2 text-sm">
              {detailQ.data.visits.length === 0 ? (
                <li className="text-muted-foreground">No visits recorded.</li>
              ) : (
                detailQ.data.visits.map((visit) => (
                  <li
                    key={visit.id}
                    className="flex flex-wrap justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3"
                  >
                    <span className="text-muted-foreground">{new Date(visit.visitedAt).toLocaleString()}</span>
                    <span className="text-muted-foreground">{visit.branch.name}</span>
                    <span className="text-muted-foreground">
                      {visit.order ? `${money(visit.order.totalMinor)} / ${visit.order.type}` : "No order link"}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </SectionCard>

          <SectionCard title="Notes timeline" description="Structured notes recorded across visits and branches.">
            <ul className="space-y-2 text-sm">
              {detailQ.data.noteEntries.length === 0 ? (
                <li className="text-muted-foreground">No structured notes yet.</li>
              ) : (
                detailQ.data.noteEntries.map((entry) => (
                  <li key={entry.id} className="rounded-xl border border-border/60 px-4 py-3">
                    <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {entry.category}
                    </span>
                    <p className="mt-2 text-foreground">{entry.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                      {entry.createdBy ? ` / ${entry.createdBy.displayName}` : ""}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </SectionCard>

          <SectionCard title="Offers" description="Offer eligibility and redemption status for this guest.">
            <ul className="space-y-2 text-sm">
              {detailQ.data.offers.length === 0 ? (
                <li className="text-muted-foreground">No offers.</li>
              ) : (
                detailQ.data.offers.map((offer) => (
                  <li
                    key={offer.id}
                    className="flex flex-wrap justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3"
                  >
                    <span>{offer.title}</span>
                    <span className="text-muted-foreground">
                      {offer.redeemed ? "Redeemed" : offer.eligibilityMessage ?? ""}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </SectionCard>
        </div>
      ) : null}

      {canRollup ? (
        <SectionCard
          className="mt-10"
          title="Visit data retention"
          description="Permanently deletes visit history older than the chosen years, then recalculates visit counts."
        >
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="text-muted-foreground">
              Years
              <Input
                type="number"
                min={1}
                max={30}
                className="ml-2 w-20"
                value={retentionYears}
                onChange={(e) => {
                  setRetentionYears(Math.min(30, Math.max(1, Number(e.target.value) || 7)))
                  setArchiveConfirmArmed(false)
                }}
              />
            </label>
            {!archiveConfirmArmed ? (
              <Button
                type="button"
                variant="outline"
                disabled={archiveM.isPending}
                onClick={() => setArchiveConfirmArmed(true)}
              >
                Confirm archive
              </Button>
            ) : (
              <>
                <Button type="button" disabled={archiveM.isPending} onClick={() => archiveM.mutate()}>
                  {archiveM.isPending ? "Running..." : "Run archive"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={archiveM.isPending}
                  onClick={() => setArchiveConfirmArmed(false)}
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
          {archiveConfirmArmed ? (
            <p className="mt-3 text-xs text-amber-200">
              This permanently deletes visit rows older than {retentionYears} year(s).
            </p>
          ) : null}
          {archiveM.isSuccess && archiveM.data ? (
            <p className="mt-3 text-xs text-emerald-400">
              Removed {archiveM.data.deletedVisitRows} visit row(s); cutoff{" "}
              {new Date(archiveM.data.cutoffUtc).toLocaleDateString()}.
            </p>
          ) : null}
          {archiveM.isError ? <p className="mt-3 text-xs text-red-400">Archive failed.</p> : null}
        </SectionCard>
      ) : null}

      {canRollup && repeatQ.data ? (
        <SectionCard
          className="mt-10"
          title={`Top repeat spend (tenant, ${repeatQ.data.days}d)`}
          description="Manager view. Tap a phone to search and open the profile."
        >
          <ul className="space-y-2 text-sm">
            {repeatQ.data.customers.slice(0, 10).map((row) => (
              <li
                key={row.customerId}
                className="flex justify-between gap-3 border-t border-border/60 pt-2 first:border-t-0 first:pt-0"
              >
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-left text-emerald-200"
                  onClick={() => {
                    setLocalQ(row.phone)
                    const next = new URLSearchParams()
                    next.set("q", row.phone)
                    next.set("id", row.customerId)
                    setSearchParams(next)
                  }}
                >
                  {row.name ?? row.phone}
                </Button>
                <span className="text-muted-foreground">
                  {money(row.netPaidSalesMinor)} / {row.paidOrderCount} orders
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}
    </PageFrame>
  )
}
