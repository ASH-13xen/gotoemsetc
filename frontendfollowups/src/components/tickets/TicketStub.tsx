import type { ReactNode } from 'react'
import { Link, useHref } from 'react-router-dom'
import { ArrowRight, CalendarClock, Clock, User2 } from 'lucide-react'
import type { Priority, TrailStep } from '@/api/tickets.api'
import { cn } from '@/lib/utils'
import { PRIORITY_CLASS, PRIORITY_LABEL, dueText, fmtDateTime, inkOn, tint } from '@/lib/ticketFormat'
import { StepTrail } from './StepTrail'
import { QrCode } from './QrCode'

export interface StubData {
  id: string
  code: string
  title: string
  pipelineName: string
  priority?: Priority
  color: string
  stageLabel?: string
  trail: TrailStep[]
  clientName?: string
  teamTitle?: string | null
  raisedByName?: string | null
  raisedForName?: string | null
  dueAt: string
  status: 'open' | 'completed' | 'rejected'
  isOverdue?: boolean
  isSentBack?: boolean
  isRejected?: boolean
  waitingOnLabel?: string | null
  nextStepLabel?: string | null
  waitingOn?: string[]
  days?: { _id: string; color: string; date: string; stageLabel: string }[]
  doneCount?: number
  total?: number
  auto?: boolean
}

// A bar code made from the ticket number — decorative, but the same ticket
// always gets the same bars.
function Barcode({ code, className }: { code: string; className?: string }) {
  const bars: number[] = []
  for (const ch of code.replace(/[^A-Z0-9]/gi, '')) {
    const n = ch.charCodeAt(0)
    bars.push((n % 3) + 1, ((n >> 2) % 2) + 1, (n % 4) + 1)
  }
  return (
    <div className={cn('flex h-9 items-stretch gap-[2px]', className)} aria-hidden>
      {bars.slice(0, 26).map((w, i) => (
        <span key={i} className={i % 2 ? 'bg-transparent' : 'bg-foreground/80'} style={{ width: w }} />
      ))}
    </div>
  )
}

function Stamp({ status, isSentBack }: { status: StubData['status']; isSentBack?: boolean }) {
  const look =
    status === 'rejected'
      ? { text: 'Rejected', color: '#ef4444' }
      : status === 'completed'
        ? { text: 'Completed', color: '#16a34a' }
        : isSentBack
          ? { text: 'Reverted', color: '#db2777' }
          : null
  if (!look) return null
  return (
    <span
      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 -rotate-12 select-none rounded-md border-[3px] px-3 py-1 text-lg font-black uppercase tracking-[0.2em] opacity-[0.22]"
      style={{ borderColor: look.color, color: look.color }}
    >
      {look.text}
    </span>
  )
}

function StatusPill({ d }: { d: StubData }) {
  if (d.status === 'rejected') return <span className="rounded-full bg-red-500/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-600">Rejected</span>
  if (d.status === 'completed') return <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">Completed</span>
  if (d.isSentBack) return <span className="rounded-full bg-pink-500/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-pink-600">Sent back</span>
  if (d.isOverdue) return <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">Overdue</span>
  return null
}

// The ticket. `hero` is the big one at the top of a ticket's page.
export function TicketStub({ d, to, hero = false, footer }: { d: StubData; to?: string; hero?: boolean; footer?: ReactNode }) {
  const qrHref = useHref(to || '.')
  const qrValue = typeof window !== 'undefined' ? `${window.location.origin}${qrHref}` : qrHref
  const ink = inkOn(d.color)

  const body = (
    <div
      className={cn(
        'group relative flex overflow-hidden rounded-2xl bg-card ring-1 ring-border transition-all duration-300',
        to && 'hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-12px_rgba(20,15,10,0.25)]',
        hero ? 'shadow-[0_20px_45px_-20px_rgba(20,15,10,0.35)]' : 'shadow-sm'
      )}
    >
      {/* the colour of the step it is at */}
      <span className={cn('absolute inset-y-0 left-0', hero ? 'w-2.5' : 'w-1.5')} style={{ background: d.color }} />
      <span className="absolute inset-x-0 top-0 h-px opacity-60" style={{ background: d.color }} />

      <div className={cn('relative min-w-0 flex-1', hero ? 'p-6 pl-8 sm:p-8 sm:pl-10' : 'p-4 pl-5')}>
        <Stamp status={d.status} isSentBack={d.isSentBack} />
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn('font-mono font-bold tracking-wider text-foreground', hero ? 'text-sm' : 'text-xs')}>{d.code}</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {d.pipelineName}
            {d.auto ? ' · from the calendar' : ''}
          </span>
          {d.priority && d.priority !== 'normal' && (
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', PRIORITY_CLASS[d.priority])}>{PRIORITY_LABEL[d.priority]}</span>
          )}
          <span className="ml-auto">
            <StatusPill d={d} />
          </span>
        </div>

        <h3 className={cn('mt-2 wrap-break-word font-extrabold leading-tight tracking-tight text-foreground', hero ? 'text-xl sm:text-3xl' : 'line-clamp-2 text-base')}>{d.title}</h3>
        {(d.clientName || d.teamTitle) && (
          <p className="mt-1 text-xs font-medium text-muted-foreground">{[d.clientName, d.teamTitle].filter(Boolean).join(' · ')}</p>
        )}

        <div className={cn('flex flex-wrap items-center gap-2', hero ? 'mt-5' : 'mt-3')}>
          {d.stageLabel && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: d.color, color: ink }}>
              {d.stageLabel}
            </span>
          )}
          {d.status === 'open' && d.nextStepLabel && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <ArrowRight className="size-3" />
              next: <span className="font-semibold text-foreground">{d.nextStepLabel}</span>
              {d.waitingOnLabel ? <span>({d.waitingOn?.length ? d.waitingOn.slice(0, 2).join(', ') : d.waitingOnLabel})</span> : null}
            </span>
          )}
          {d.days && (
            <span className="text-[11px] font-semibold text-muted-foreground">
              {d.doneCount}/{d.total} days done
            </span>
          )}
        </div>

        {d.days ? (
          <div className="mt-3 flex flex-wrap gap-1">
            {d.days.map((day) => (
              <span key={day._id} title={`${fmtDateTime(day.date)} · ${day.stageLabel}`} className="h-4 w-2.5 rounded-sm" style={{ background: day.color }} />
            ))}
          </div>
        ) : (
          <StepTrail trail={d.trail} className={hero ? 'mt-4' : 'mt-3'} />
        )}

        <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground', hero ? 'mt-5' : 'mt-3')}>
          {(d.raisedByName || d.raisedForName) && (
            <span className="inline-flex items-center gap-1">
              <User2 className="size-3" />
              {d.raisedByName && <span className="font-medium text-foreground/80">{d.raisedByName}</span>}
              {d.raisedByName && d.raisedForName && <ArrowRight className="size-3" />}
              {d.raisedForName && <span className="font-medium text-foreground/80">{d.raisedForName}</span>}
            </span>
          )}
          <span className={cn('inline-flex items-center gap-1', d.isOverdue && d.status === 'open' && 'font-semibold text-slate-700')}>
            {d.isOverdue && d.status === 'open' ? <Clock className="size-3" /> : <CalendarClock className="size-3" />}
            {d.status === 'open' ? dueText(d.dueAt) : `Due ${fmtDateTime(d.dueAt)}`}
          </span>
        </div>
        {footer && <div className="mt-4">{footer}</div>}
      </div>

      {/* tear line */}
      <div className="relative w-0 shrink-0 border-l-2 border-dashed border-border">
        <span className="absolute -left-[11px] -top-[10px] size-5 rounded-full bg-background ring-1 ring-border" />
        <span className="absolute -bottom-[10px] -left-[11px] size-5 rounded-full bg-background ring-1 ring-border" />
      </div>

      {/* the stub */}
      <div
        className={cn('relative flex shrink-0 flex-col items-center justify-between gap-2', hero ? 'w-[92px] p-3 sm:w-44 sm:p-5' : 'w-[84px] p-3 sm:w-24')}
        style={{ background: tint(d.color, 0.16) }}
      >
        <span className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">{d.auto ? 'Calendar' : 'Ticket'}</span>
        {hero ? (
          <div className="rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-black/5 sm:p-2">
            <QrCode value={qrValue} className="size-[64px] sm:size-[112px]" />
          </div>
        ) : (
          <span className="font-mono text-[11px] font-black tracking-wider text-foreground [writing-mode:vertical-rl] rotate-180">{d.code}</span>
        )}
        <Barcode code={d.code} className={hero ? 'h-10' : 'h-6'} />
      </div>
    </div>
  )

  return to ? (
    <Link to={to} className="block rounded-2xl outline-none focus-visible:ring-4 focus-visible:ring-primary/20">
      {body}
    </Link>
  ) : (
    body
  )
}
