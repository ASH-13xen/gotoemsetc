import type { TrailStep } from '@/api/tickets.api'
import { fmtDuration } from '@/lib/ticketFormat'

// How long the ticket sat at each step, as bars in each step's colour.
export function StepDurations({ trail, stepMs }: { trail: TrailStep[]; stepMs: Record<string, number> }) {
  const rows = trail.map((s) => ({ ...s, ms: stepMs[s.key] || 0 })).filter((r) => r.ms > 0)
  const max = Math.max(1, ...rows.map((r) => r.ms))
  if (!rows.length) return <p className="text-xs text-muted-foreground">Nothing timed yet — times appear once the ticket moves.</p>
  return (
    <div className="grid gap-2">
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[110px_1fr_64px] items-center gap-2 text-xs">
          <span className="truncate font-medium" title={r.label}>
            at {r.label}
          </span>
          <span className="h-2.5 overflow-hidden rounded-full bg-secondary">
            <span className="block h-full rounded-full" style={{ width: `${Math.max(4, (r.ms / max) * 100)}%`, background: r.color }} />
          </span>
          <span className="text-right font-mono text-[11px] text-muted-foreground">{fmtDuration(r.ms)}</span>
        </div>
      ))}
    </div>
  )
}
