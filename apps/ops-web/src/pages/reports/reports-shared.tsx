import { MetricCard, SectionCard } from "@/components/ConsoleUi"
import { formatMoneyMinor } from "./reports-utils"

export function OperatorFocusList({ cues }: { cues: string[] }) {
  if (cues.length === 0) {
    return null
  }

  return (
    <SectionCard
      className="mb-4 border-amber-500/40 bg-amber-500/10"
      title="Suggested focus (from this report)"
    >
      <ul className="list-inside list-disc space-y-1.5 text-sm leading-6 text-amber-100/90">
        {cues.map((cue, index) => (
          <li key={index}>{cue}</li>
        ))}
      </ul>
    </SectionCard>
  )
}

export function BarRow({
  label,
  value,
  max,
  sub,
}: {
  label: string
  value: number
  max: number
  sub?: string
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0

  return (
    <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-3">
      <div className="flex justify-between gap-3 text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="text-right">
          {formatMoneyMinor(value)}
          {sub ? ` / ${sub}` : ""}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted/50">
        <div className="h-full rounded-full bg-emerald-500/80" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <MetricCard label={label} value={value} detail={hint} />
}
