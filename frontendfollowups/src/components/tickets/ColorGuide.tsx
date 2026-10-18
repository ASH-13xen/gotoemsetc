import { useState } from 'react'
import { ChevronDown, Palette } from 'lucide-react'
import type { TicketMeta } from '@/api/tickets.api'
import { cn } from '@/lib/utils'

// What every colour means — read from the server, so it is always the
// pipelines' own palette.
export function ColorGuide({ meta }: { meta: TicketMeta }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl bg-card ring-1 ring-border">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
        <span className="inline-flex items-center gap-2 text-sm font-bold">
          <Palette className="size-4 text-muted-foreground" />
          Colour guide
        </span>
        <span className="flex items-center gap-2">
          <span className="hidden gap-1 sm:flex">
            {meta.pipelines
              .find((p) => p.key === 'reel')
              ?.steps.map((s) => <span key={s.key} className="size-2.5 rounded-full" style={{ background: s.color }} />)}
          </span>
          <ChevronDown className={cn('size-4 text-muted-foreground transition', open && 'rotate-180')} />
        </span>
      </button>
      {open && (
        <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-2 xl:grid-cols-3">
          {meta.pipelines
            .filter((p) => p.steps.length)
            .map((p) => (
              <div key={p.key}>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{p.name}</p>
                <ul className="grid gap-1.5">
                  {p.steps.map((s) => (
                    <li key={s.key} className="flex items-center gap-2 text-xs">
                      <span className="size-3.5 shrink-0 rounded-full ring-1 ring-black/5" style={{ background: s.color }} />
                      <span className="font-medium">{s.label}</span>
                      {s.actorLabel && <span className="text-muted-foreground">· {s.actorLabel}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">On top of any step</p>
            <ul className="grid gap-1.5 text-xs">
              <li className="flex items-center gap-2">
                <span className="size-3.5 rounded-full" style={{ background: meta.overrides.sent_back }} />
                <span className="font-medium">Sent back</span>
                <span className="text-muted-foreground">· until it moves forward again</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="size-3.5 rounded-full" style={{ background: meta.overrides.rejected }} />
                <span className="font-medium">Rejected</span>
                <span className="text-muted-foreground">· stops for everyone</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="size-3.5 rounded-full" style={{ background: meta.overrides.overdue }} />
                <span className="font-medium">Overdue</span>
                <span className="text-muted-foreground">· past its due date</span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
