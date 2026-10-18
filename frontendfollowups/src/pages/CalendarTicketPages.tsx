import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, CalendarDays } from 'lucide-react'
import { TicketNav } from '@/components/layout/TicketNav'
import { TicketStub } from '@/components/tickets/TicketStub'
import { StepTrail } from '@/components/tickets/StepTrail'
import { TicketRecord } from '@/components/tickets/TicketRecord'
import { MoveButtons } from '@/components/tickets/TicketActions'
import { Skeleton } from '@/components/ui/skeleton'
import { actOnCalendarItem, errorMessage, type StoryDay } from '@/api/tickets.api'
import { useCalendarItem, useStories, useTicketMeta, useTicketMutation } from '@/hooks/useTickets'
import { calendarStub } from '@/lib/stubData'
import { fmtDate, fmtDateTime, inkOn } from '@/lib/ticketFormat'
import { cn } from '@/lib/utils'

const ROLE: Record<string, string> = { designer: 'Social Media Manager', shooter: 'Videographer', editor: 'Video Editor', contentManager: 'Content Manager' }

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TicketNav />
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6">
        <Link to="/tickets" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" />
          All tickets
        </Link>
        {children}
      </main>
    </>
  )
}

function useCalendarMoves(id: string) {
  const act = useTicketMutation(({ action, body }: { action: 'advance' | 'send-back' | 'reject'; body: { note?: string; reason?: string } }) => actOnCalendarItem(id, action, body))
  return {
    onAdvance: async (note: string) => {
      await act.mutateAsync({ action: 'advance', body: { note: note || undefined } })
      toast.success('Moved on')
    },
    onSendBack: async (note: string) => {
      await act.mutateAsync({ action: 'send-back', body: { note: note || undefined } })
      toast.success('Sent back')
    },
    onReject: async (reason: string) => {
      await act.mutateAsync({ action: 'reject', body: { reason } })
      toast.success('Rejected')
    },
  }
}

// A post, reel or festive story from the content calendar.
export function CalendarItemPage() {
  const { id } = useParams()
  const { data: t, isLoading, error } = useCalendarItem(id)
  const moves = useCalendarMoves(id!)
  if (isLoading) return <Shell><Skeleton className="h-64 rounded-2xl bg-secondary/50" /></Shell>
  if (!t) return <Shell><p className="text-sm text-muted-foreground">{errorMessage(error, 'Not found')}</p></Shell>
  const nextIdx = t.trail.findIndex((s) => s.current) + 1
  return (
    <Shell>
      <TicketStub d={{ ...calendarStub(t), clientName: t.clientName, waitingOn: t.waitingOn }} hero />
      <MoveButtons can={t.can} nextStepLabel={t.nextStepLabel} nextColor={t.trail[nextIdx]?.color} sendBackRequired={false} {...moves} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="grid gap-6">
          <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
            <h2 className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">From the content calendar</h2>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="font-semibold uppercase tracking-wider text-muted-foreground">Scheduled for</dt>
                <dd className="mt-0.5 font-medium">{fmtDateTime(t.dueAt)}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wider text-muted-foreground">Team</dt>
                <dd className="mt-0.5 font-medium">{t.team?.title || '—'}</dd>
              </div>
              {Object.entries(t.people)
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt className="font-semibold uppercase tracking-wider text-muted-foreground">{ROLE[k] || k}</dt>
                    <dd className="mt-0.5 font-medium">{v}</dd>
                  </div>
                ))}
              {Object.entries(t.brief || {})
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="col-span-2">
                    <dt className="font-semibold uppercase tracking-wider text-muted-foreground">{k.replace(/([A-Z])/g, ' $1')}</dt>
                    <dd className="mt-0.5 break-words font-medium">{v}</dd>
                  </div>
                ))}
            </dl>
          </section>
          <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
            <h2 className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Pipeline</h2>
            <StepTrail trail={t.trail} labels />
          </section>
        </div>
        <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
          <h2 className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">The record</h2>
          {t.record.length ? <TicketRecord record={t.record} /> : <p className="text-sm text-muted-foreground">Nothing has happened to it yet.</p>}
        </section>
      </div>
    </Shell>
  )
}

function DayPanel({ day }: { day: StoryDay }) {
  const moves = useCalendarMoves(day._id)
  const { data: meta } = useTicketMeta()
  // The story pipeline's own steps and colours, from the server.
  const trail = meta?.pipelines.find((p) => p.key === 'story')?.steps || []
  const idx = trail.findIndex((s) => s.key === day.stage)
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: day.color, color: inkOn(day.color) }}>
          {day.isRejected ? 'Rejected' : day.isSentBack ? `${day.stageLabel} · sent back` : day.isOverdue ? `${day.stageLabel} · overdue` : day.stageLabel}
        </span>
        <span className="text-sm font-semibold">{fmtDateTime(day.date)}</span>
      </div>
      <MoveButtons can={day.can} nextStepLabel={trail[idx + 1]?.label} nextColor={trail[idx + 1]?.color} sendBackRequired={false} {...moves} />
      {!day.can.act && day.waitingOnLabel && <p className="text-xs text-muted-foreground">Waiting on the {day.waitingOnLabel}.</p>}
      {day.record.length ? <TicketRecord record={day.record} /> : <p className="text-xs text-muted-foreground">Nothing has happened on this day yet.</p>}
    </div>
  )
}

// One ticket for a month of daily stories — a stub per day.
export function StoriesPage() {
  const { id } = useParams()
  const { data: t, isLoading, error } = useStories(id)
  const [selected, setSelected] = useState<string | null>(null)
  if (isLoading) return <Shell><Skeleton className="h-64 rounded-2xl bg-secondary/50" /></Shell>
  if (!t) return <Shell><p className="text-sm text-muted-foreground">{errorMessage(error, 'Not found')}</p></Shell>
  const day = t.days.find((d) => d._id === selected) || t.days.find((d) => d.can.act) || t.days[0]
  return (
    <Shell>
      <TicketStub d={calendarStub({ ...t, days: t.days })} hero />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
          <h2 className="mb-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
            <CalendarDays className="size-4" />
            Each day
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2">
            {t.days.map((d) => (
              <button
                key={d._id}
                type="button"
                onClick={() => setSelected(d._id)}
                className={cn('relative overflow-hidden rounded-xl p-2.5 text-left ring-1 ring-border transition hover:-translate-y-0.5', day?._id === d._id && 'ring-2 ring-foreground')}
              >
                <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: d.color }} />
                <p className="mt-1 text-sm font-black">{fmtDate(d.date)}</p>
                <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{d.stageLabel}</p>
                {d.can.act && <span className="mt-1 inline-block rounded-full bg-primary px-1.5 text-[9px] font-bold uppercase text-white">yours</span>}
              </button>
            ))}
          </div>
        </section>
        <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
          <h2 className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">{day ? `Story · ${fmtDate(day.date)}` : 'Story'}</h2>
          {day ? <DayPanel key={day._id} day={day} /> : <p className="text-sm text-muted-foreground">No days.</p>}
        </section>
      </div>
    </Shell>
  )
}
