import type { TrailStep } from '@/api/tickets.api'
import { cn } from '@/lib/utils'
import { tint } from '@/lib/ticketFormat'

// Every step of the ticket's pipeline in its own colour — reached steps
// filled, the current one ringed, the rest faint. The colours are the
// calendar's own, straight from the server.
export function StepTrail({ trail, labels = false, className }: { trail: TrailStep[]; labels?: boolean; className?: string }) {
  if (!labels) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        {trail.map((s, i) => (
          <div key={s.key} className="flex items-center gap-1">
            {i > 0 && <span className="h-0.5 w-2.5 rounded-full" style={{ background: s.reached ? s.color : tint(s.color, 0.35) }} />}
            <span
              title={`${s.label}${s.actorLabel ? ` · ${s.actorLabel}` : ''}`}
              className={cn('block rounded-full', s.current ? 'size-3.5 ring-2 ring-offset-2 ring-offset-card' : 'size-2.5')}
              style={{
                background: s.reached ? s.color : tint(s.color, 0.25),
                ...(s.current ? { ['--tw-ring-color' as string]: s.color } : {}),
              }}
            />
          </div>
        ))}
      </div>
    )
  }
  return (
    <ol className={cn('flex items-start overflow-x-auto pb-1', className)}>
      {trail.map((s, i) => (
        <li key={s.key} className="flex min-w-[92px] flex-1 flex-col items-center text-center">
          <div className="flex w-full items-center">
            <span className="h-1 flex-1 rounded-full" style={{ background: i === 0 ? 'transparent' : s.reached ? s.color : tint(s.color, 0.3) }} />
            <span
              className={cn('grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-black', s.current && 'ring-4')}
              style={{
                background: s.reached ? s.color : tint(s.color, 0.2),
                color: s.reached ? '#111827' : 'transparent',
                ...(s.current ? { ['--tw-ring-color' as string]: tint(s.color, 0.35) } : {}),
              }}
            >
              {i + 1}
            </span>
            <span
              className="h-1 flex-1 rounded-full"
              style={{ background: i === trail.length - 1 ? 'transparent' : trail[i + 1].reached ? trail[i + 1].color : tint(trail[i + 1].color, 0.3) }}
            />
          </div>
          <span className={cn('mt-1.5 px-1 text-[11px] leading-tight', s.current ? 'font-bold text-foreground' : 'text-muted-foreground')}>{s.label}</span>
          {s.people && s.people.length > 0 && i > 0 && (
            <span className="mt-0.5 px-1 text-[10px] leading-tight text-muted-foreground/80">
              {s.people.slice(0, 2).join(', ')}
              {s.people.length > 2 ? ` +${s.people.length - 2}` : ''}
            </span>
          )}
          {s.vacantFor && i > 0 && <span className="text-[9px] uppercase tracking-wide text-amber-600">box vacant</span>}
        </li>
      ))}
    </ol>
  )
}
