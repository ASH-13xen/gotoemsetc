import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { CheckCircle2, Clock3, ExternalLink, Loader2, Ticket, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TicketPlan, TrayItem } from '@/api/ticketPlans.api'
import { useMarkStep } from '@/hooks/useTicketPlans'
import { apiError, fmtDay, fmtDayLong, fmtMin, fmtRange } from './calendarUtils'
import { Chip, Sec, SidePanel } from './SidePanel'
import { dueText } from './TicketTray'

// Your planned ticket work, opened: what the ticket is waiting for, when
// you set the time aside (change the day, start and end here), the ticket
// itself, its step, and Remove. Only you see any of it.

const STEP = 5

export function PlanPanel({
  plan,
  info,
  days,
  grid,
  onClose,
  onChange,
  onRemove,
}: {
  plan: TicketPlan
  // Still waiting on you — else it has moved on.
  info: TrayItem | undefined
  // The days of the week on screen.
  days: string[]
  grid: { START: number; END: number }
  onClose: () => void
  onChange: (change: { day: string; startMin: number; endMin: number }) => void
  onRemove: () => void
}) {
  const mark = useMarkStep()
  const color = info?.color ?? '#94a3b8'
  const accent = { from: color, to: color, soft: `color-mix(in oklch, ${color} 16%, transparent)` }
  const length = plan.endMin - plan.startMin
  const starts: number[] = []
  for (let m = grid.START; m <= grid.END - 15; m += STEP) starts.push(m)
  const ends: number[] = []
  for (let m = plan.startMin + 15; m <= grid.END; m += STEP) ends.push(m)
  const dayOptions = days.includes(plan.day) ? days : [plan.day, ...days]
  const select = 'h-9 w-full min-w-0 rounded-lg border border-border bg-background px-2 text-sm tabular-nums'

  return (
    <SidePanel
      panelKey={`plan-${plan._id}`}
      accent={accent}
      eyebrow={
        <>
          <Chip style={{ background: color }}>Ticket work</Chip>
          {!info && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-3" /> Moved on
            </span>
          )}
        </>
      }
      title={
        <h2 className="text-2xl leading-tight font-black tracking-tight break-words text-foreground">
          <span className="mr-2 font-mono text-base text-muted-foreground">{plan.code}</span>
          {plan.title}
        </h2>
      }
      subtitle={
        <span className="flex items-center gap-1 font-semibold text-foreground">
          <Clock3 className="size-3.5" />
          {fmtDayLong(plan.day)} · {fmtRange(plan.startMin, plan.endMin)}
        </span>
      }
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="text-rose-600" onClick={onRemove}>
            <Trash2 className="size-3.5" /> Remove
          </Button>
          {info && (
            <Button asChild variant="outline" size="sm" className="ml-auto">
              <Link to={info.link}>
                <ExternalLink className="size-3.5" /> Open
              </Link>
            </Button>
          )}
          {info?.canMark && info.nextStepLabel && (
            <Button
              size="sm"
              disabled={mark.isPending}
              style={{ background: color }}
              className="text-white"
              onClick={() =>
                mark
                  .mutateAsync(info)
                  .then(() => toast.success(`Marked “${info.nextStepLabel}”`))
                  .catch((err) => toast.error(apiError(err, 'Could not mark it')))
              }
            >
              {mark.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
              Mark “{info.nextStepLabel}”
            </Button>
          )}
        </div>
      }
    >
      <Sec title="The ticket">
        {info ? (
          <div className="grid gap-1.5 text-sm">
            <p className="flex flex-wrap items-center gap-2">
              {info.stageLabel && (
                <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: color }}>
                  {info.stageLabel}
                </span>
              )}
              {info.nextStepLabel && <span className="text-muted-foreground">Next: <b className="text-foreground">{info.nextStepLabel}</b> — that's you</span>}
            </p>
            <p className={info.isOverdue ? 'font-semibold text-rose-600' : 'text-muted-foreground'}>
              {info.isOverdue ? 'Overdue — was due ' : 'Due '}
              {dueText(info.dueAt)}
            </p>
          </div>
        ) : (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Ticket className="mt-0.5 size-4 shrink-0" />
            It no longer waits on you — your step is done, or it moved to someone else. Remove this block whenever you like.
          </p>
        )}
      </Sec>

      <Sec title={`When · ${length >= 60 ? `${Math.floor(length / 60)}h${length % 60 ? ` ${length % 60}m` : ''}` : `${length}m`}`}>
        <div className="grid gap-2">
          <label className="grid gap-1 text-[11px] font-semibold text-muted-foreground">
            Day
            <select aria-label="Plan day" className={select} value={plan.day} onChange={(e) => onChange({ day: e.target.value, startMin: plan.startMin, endMin: plan.endMin })}>
              {dayOptions.map((d) => (
                <option key={d} value={d}>
                  {fmtDay(d)}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid min-w-0 gap-1 text-[11px] font-semibold text-muted-foreground">
              From
              <select
                aria-label="Plan starts"
                className={select}
                value={plan.startMin}
                onChange={(e) => {
                  const start = Number(e.target.value)
                  // Keeps its length where it can.
                  onChange({ day: plan.day, startMin: start, endMin: Math.min(grid.END, Math.max(start + 15, start + length)) })
                }}
              >
                {starts.map((m) => (
                  <option key={m} value={m}>
                    {fmtMin(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1 text-[11px] font-semibold text-muted-foreground">
              To
              <select aria-label="Plan ends" className={select} value={plan.endMin} onChange={(e) => onChange({ day: plan.day, startMin: plan.startMin, endMin: Number(e.target.value) })}>
                {ends.map((m) => (
                  <option key={m} value={m}>
                    {fmtMin(m)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Or drag the block on the calendar, and stretch it by its bottom edge. Only you see it — it can sit over meetings and never makes you busy.
          </p>
        </div>
      </Sec>
    </SidePanel>
  )
}
