import { useCallback, useMemo, useState } from "react"

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

export function SupportConsolePage() {
  const [supportOperator, setSupportOperator] = useState("")
  const [slug, setSlug] = useState("")
  const [tenantId, setTenantId] = useState("")
  const [orderId, setOrderId] = useState("")
  const [branchIdReset, setBranchIdReset] = useState("")
  const [branchIdOnboarding, setBranchIdOnboarding] = useState("")
  const [auditLimit, setAuditLimit] = useState(50)
  const [auditPrefix, setAuditPrefix] = useState("")
  const [auditBranchFilter, setAuditBranchFilter] = useState("")
  const [ackProduction, setAckProduction] = useState(false)
  const [out, setOut] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const hasOperator = supportOperator.trim().length > 0

  const run = useCallback(async (label: string, fn: () => Promise<unknown>) => {
    setLoading(true)
    setErr(null)
    setOut(null)
    try {
      const data = await fn()
      setOut(`${label}\n${JSON.stringify(data, null, 2)}`)
    } catch (error) {
      setErr(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }, [])

  const op = useMemo(() => ({ supportOperator }), [supportOperator])

  return (
    <PageFrame size="wide">
      <PageHeader
        eyebrow="Internal tools"
        title="Internal support"
        description="Support-only API console backed by a server-side gateway. The browser never stores or sends support API keys."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Gateway" value="Server-side" detail="Support secrets stay on the API host" tone="emerald" />
        <MetricCard
          label="Operator id"
          value={hasOperator ? "Tagged" : "Unset"}
          detail="Attached to mutating support actions"
          tone={hasOperator ? "emerald" : "default"}
        />
        <MetricCard label="Mode" value={loading ? "Running" : "Idle"} detail="Single-action support console" tone={loading ? "amber" : "default"} />
      </div>

      <SectionCard
        title="Operator tag"
        description="Mutating support actions can still carry a human operator id for audit trails, but no support secrets are ever stored in the browser."
      >
        <label className="block text-sm font-medium">Operator id (optional)</label>
        <p className="mb-2 text-xs text-muted-foreground">
          Sent as <code className="text-muted-foreground">x-support-operator</code> on mutating calls.
        </p>
        <Input
          type="text"
          autoComplete="off"
          value={supportOperator}
          onChange={(event) => setSupportOperator(event.target.value)}
          placeholder="e.g. on-call alias"
        />
      </SectionCard>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SectionCard title="Lookup" description="Resolve a public tenant slug to the internal tenant identifier.">
          <div className="flex flex-wrap gap-2">
            <Input
              className="min-w-[180px] flex-1"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="tenant slug"
            />
            <Button
              type="button"
              variant="outline"
              disabled={loading || !slug.trim()}
              onClick={() =>
                run("Lookup", () =>
                  supportFetch(`/support/lookup/tenant-slug/${encodeURIComponent(slug.trim())}`)
                )
              }
            >
              Resolve slug
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title="Tenant summary"
          description="Loads commercial limits, access codes, metadata block reasons, and pilot fields for the selected tenant id."
        >
          <div className="flex flex-wrap gap-2">
            <Input
              className="min-w-[220px] flex-1 font-mono"
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
              placeholder="tenant id (cuid)"
            />
            <Button
              type="button"
              variant="outline"
              disabled={loading || !tenantId.trim()}
              onClick={() => run("Summary", () => supportFetch(`/support/tenants/${tenantId.trim()}/summary`))}
            >
              Load summary
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title="Branches and onboarding"
          description="Uses the tenant id above. Onboarding matches the same blocking and recommended logic as the staff Setup screen."
        >
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={loading || !tenantId.trim()}
              onClick={() => run("Branches", () => supportFetch(`/support/tenants/${tenantId.trim()}/branches`))}
            >
              List branches
            </Button>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Input
              className="min-w-[200px] flex-1 font-mono"
              value={branchIdOnboarding}
              onChange={(event) => setBranchIdOnboarding(event.target.value)}
              placeholder="branch id for onboarding"
            />
            <Button
              type="button"
              variant="outline"
              disabled={loading || !tenantId.trim() || !branchIdOnboarding.trim()}
              onClick={() =>
                run("Onboarding", () =>
                  supportFetch(
                    `/support/tenants/${tenantId.trim()}/branches/${encodeURIComponent(branchIdOnboarding.trim())}/onboarding-status`
                  )
                )
              }
            >
              Load onboarding status
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Audit log" description="Read-only tail. Use actionPrefix to narrow support actions and branchId to isolate a single site.">
          <div className="mb-2 flex flex-wrap gap-2">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">limit</span>
              <Input
                type="number"
                min={1}
                max={200}
                className="w-20"
                value={auditLimit}
                onChange={(event) => setAuditLimit(Number(event.target.value) || 50)}
              />
            </label>
            <Input
              className="min-w-[160px] flex-1"
              value={auditPrefix}
              onChange={(event) => setAuditPrefix(event.target.value)}
              placeholder="actionPrefix (optional)"
            />
            <Input
              className="min-w-[160px] flex-1 font-mono"
              value={auditBranchFilter}
              onChange={(event) => setAuditBranchFilter(event.target.value)}
              placeholder="branchId filter (optional)"
            />
            <Button
              type="button"
              variant="outline"
              disabled={loading || !tenantId.trim()}
              onClick={() => {
                const tid = tenantId.trim()
                const query = new URLSearchParams()
                query.set("limit", String(Math.min(Math.max(auditLimit, 1), 200)))
                if (auditPrefix.trim()) {
                  query.set("actionPrefix", auditPrefix.trim())
                }
                if (auditBranchFilter.trim()) {
                  query.set("branchId", auditBranchFilter.trim())
                }
                void run("Audit log", () => supportFetch(`/support/tenants/${tid}/audit-log?${query.toString()}`))
              }}
            >
              Load audit log
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Order lookup" description="Inspect a single order using tenant and order id.">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Input
              className="min-w-[200px] flex-1 font-mono"
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
              placeholder="tenant id"
            />
            <Input
              className="min-w-[200px] flex-1 font-mono"
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
              placeholder="order id"
            />
            <Button
              type="button"
              variant="outline"
              disabled={loading || !tenantId.trim() || !orderId.trim()}
              onClick={() =>
                run("Order", () => supportFetch(`/support/tenants/${tenantId.trim()}/orders/${orderId.trim()}`))
              }
            >
              Load order
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          className="border-amber-500/40"
          title="Reset demo branch"
          description="Demo-tagged tenants only, unless you explicitly acknowledge a production reset."
        >
          <div className="flex flex-col gap-2">
            <Input className="font-mono" value={tenantId} onChange={(event) => setTenantId(event.target.value)} placeholder="tenant id" />
            <Input className="font-mono" value={branchIdReset} onChange={(event) => setBranchIdReset(event.target.value)} placeholder="branch id" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={ackProduction} onChange={(event) => setAckProduction(event.target.checked)} />
              acknowledgeProductionReset (non-demo tenants)
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={loading || !tenantId.trim() || !branchIdReset.trim()}
              onClick={() =>
                run(
                  "Reset demo",
                  () =>
                    supportFetch(
                      `/support/tenants/${tenantId.trim()}/reset-demo`,
                      {
                        method: "POST",
                        body: JSON.stringify({
                          branchId: branchIdReset.trim(),
                          acknowledgeProductionReset: ackProduction || undefined,
                        }),
                      },
                      op
                    )
                )
              }
            >
              Reset transactional data
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Diagnostics" description="Ping the server-side support gateway without exposing support secrets to the browser.">
          <Button type="button" variant="outline" disabled={loading} onClick={() => run("Diagnostics", () => supportFetch("/support/diagnostics"))}>
            GET /support/diagnostics
          </Button>
        </SectionCard>
      </div>

      {err ? <StatePanel className="mt-6" variant="error" title="Support action failed" description={err} /> : null}

      {out ? (
        <SectionCard className="mt-6" title="Response payload" description="Latest support console output.">
          <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-xl border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground">
            {out}
          </pre>
        </SectionCard>
      ) : null}

      {loading ? (
        <StatePanel className="mt-6" compact variant="loading" title="Loading..." description="Waiting for support API response." />
      ) : null}
    </PageFrame>
  )
}
