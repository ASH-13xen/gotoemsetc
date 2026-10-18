import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, List, Ticket } from 'lucide-react'
import { apiClient } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// The Task Calendar — every ticket on its due day and the content calendar's
// work on its scheduled day, each in its current step's colour (the server's
// palette, never typed here). The CEO and admin see everything; everyone
// else sees the tickets they raised or hold a step in.

interface Entry {
  kind: 'ticket' | 'calendar' | 'story'
  _id: string
  code: string
  title: string
  at: string
  color: string
  stageLabel: string
  nextStepLabel: string | null
  pipelineName: string
  status: 'open' | 'completed' | 'rejected'
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  isOverdue: boolean
  isSentBack: boolean
  raisedFor?: string | null
  team: string | null
  clientName: string | null
  mine: { raised: boolean; onPipeline: boolean; waitingOnMe: boolean }
  link: string
}

interface Overrides {
  sent_back: string
  rejected: string
  overdue: string
}

const TZ = 'Asia/Kolkata'
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const dayKey = (d: Date | string) => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ })
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true })

function inkOn(hex: string) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return '#111827'
  const n = parseInt(hex.slice(1), 16)
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return lum > 0.6 ? '#111827' : '#ffffff'
}

function useIsNarrow() {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return narrow
}

type Who = 'all' | 'waiting' | 'raised'
type Status = 'open' | 'done' | 'all'

function EntryRow({ e }: { e: Entry }) {
  return (
    <Link
      to={e.link}
      className="group relative flex items-center gap-3 overflow-hidden rounded-xl bg-card p-3 pl-4 ring-1 ring-border transition hover:-translate-y-px hover:shadow-md"
    >
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: e.color }} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
          <span className="font-mono font-bold text-foreground/75">{e.code}</span>
          <span>{e.pipelineName}</span>
          {e.kind !== 'ticket' && <span className="rounded bg-secondary px-1 text-[10px] font-semibold">content calendar</span>}
          {e.mine.waitingOnMe && <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">your step</span>}
          {e.mine.raised && <span className="rounded-full bg-secondary px-1.5 text-[10px] font-semibold">raised by you</span>}
        </p>
        <p className="truncate text-sm font-semibold text-foreground">{e.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="rounded-full px-2 py-px text-[10px] font-bold" style={{ background: e.color, color: inkOn(e.color) }}>
            {e.isSentBack && e.status === 'open' ? `${e.stageLabel} · sent back` : e.isOverdue ? `${e.stageLabel} · overdue` : e.stageLabel}
          </span>
          {e.nextStepLabel && (
            <span className="inline-flex items-center gap-0.5">
              <ArrowRight className="size-3" />
              {e.nextStepLabel}
            </span>
          )}
          {e.raisedFor && <span>· for {e.raisedFor}</span>}
          {(e.team || e.clientName) && <span>· {[e.clientName, e.team].filter(Boolean).join(' · ')}</span>}
        </p>
      </div>
      <span className="shrink-0 text-xs font-semibold text-muted-foreground">{timeOf(e.at)}</span>
    </Link>
  )
}

export default function TaskCalendarPage() {
  const narrow = useIsNarrow()
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [view, setView] = useState<'month' | 'list'>('month')
  const [who, setWho] = useState<Who>('all')
  const [status, setStatus] = useState<Status>('all')
  const [showContent, setShowContent] = useState(true)
  const [openDay, setOpenDay] = useState<string | null>(null)

  // Six full weeks around the month.
  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const start = new Date(first)
    start.setDate(first.getDate() - first.getDay())
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      d.setHours(12)
      return d
    })
  }, [cursor])
  const from = new Date(cells[0].getFullYear(), cells[0].getMonth(), cells[0].getDate(), 0, 0, 0)
  const to = new Date(cells[41].getFullYear(), cells[41].getMonth(), cells[41].getDate(), 23, 59, 59)

  const { data, isLoading, error } = useQuery({
    queryKey: ['tickets', 'task-calendar', from.toISOString(), to.toISOString()],
    queryFn: async () =>
      (await apiClient.get<{ seesEveryone: boolean; entries: Entry[] }>('/tickets/task-calendar', { params: { from: from.toISOString(), to: to.toISOString() } })).data,
    refetchInterval: 60_000,
  })
  const { data: meta } = useQuery({
    queryKey: ['tickets', 'meta'],
    queryFn: async () => (await apiClient.get<{ overrides: Overrides }>('/tickets/meta')).data,
    staleTime: 60_000,
  })

  const entries = (data?.entries || []).filter((e) => {
    if (!showContent && e.kind !== 'ticket') return false
    if (who === 'waiting' && !e.mine.waitingOnMe) return false
    if (who === 'raised' && !e.mine.raised) return false
    if (status === 'open' && e.status !== 'open') return false
    if (status === 'done' && e.status === 'open') return false
    return true
  })
  const byDay = useMemo(() => {
    const map = new Map<string, Entry[]>()
    for (const e of entries) {
      const k = dayKey(e.at)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(e)
    }
    return map
  }, [entries])

  const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
  const inMonth = entries.filter((e) => dayKey(e.at).startsWith(monthKey))
  const today = dayKey(new Date())
  const monthLabel = cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const listMode = view === 'list'
  const dayEntries = openDay ? byDay.get(openDay) || [] : []

  const chip = (active: boolean) =>
    cn('rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition', active ? 'bg-foreground text-background ring-foreground' : 'ring-border hover:bg-secondary')

  return (
    <div className="grid gap-5">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="inline-flex items-center gap-3 text-2xl font-black tracking-tight sm:text-3xl">
            <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-indigo-600 text-white shadow-sm">
              <CalendarRange className="size-5" />
            </span>
            Task Calendar
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {data?.seesEveryone
              ? 'Every ticket in the company, on the day it is due, in the colour of the step it is at.'
              : 'The tickets you raised or hold a step in, on the day they are due, in the colour of the step they are at.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ['This month', inMonth.length],
            ['Your step', inMonth.filter((e) => e.mine.waitingOnMe && e.status === 'open').length],
            ['Overdue', inMonth.filter((e) => e.isOverdue).length],
          ].map(([l, n]) => (
            <div key={l as string} className="min-w-[96px] rounded-2xl bg-card px-4 py-2.5 ring-1 ring-border">
              <p className="text-xl font-black">{n}</p>
              <p className="text-[11px] font-semibold text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card p-3 ring-1 ring-border">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[150px] text-center text-base font-bold">{monthLabel}</span>
          <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
            Today
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={chip(who === 'all')} onClick={() => setWho('all')}>
            {data?.seesEveryone ? 'Everyone' : 'All mine'}
          </button>
          <button type="button" className={chip(who === 'waiting')} onClick={() => setWho('waiting')}>
            Waiting on me
          </button>
          <button type="button" className={chip(who === 'raised')} onClick={() => setWho('raised')}>
            Raised by me
          </button>
          <span className="mx-1 h-5 w-px bg-border" />
          {(['all', 'open', 'done'] as Status[]).map((s) => (
            <button key={s} type="button" className={chip(status === s)} onClick={() => setStatus(s)}>
              {s === 'all' ? 'Any status' : s === 'open' ? 'Open' : 'Finished'}
            </button>
          ))}
          <label className="ml-1 inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-muted-foreground select-none">
            <input type="checkbox" checked={showContent} onChange={(e) => setShowContent(e.target.checked)} className="size-4 accent-primary" />
            Content calendar
          </label>
          <span className="mx-1 h-5 w-px bg-border" />
          <div className="flex rounded-lg bg-secondary/60 p-0.5">
            <button type="button" aria-label="Month view" onClick={() => setView('month')} className={cn('rounded-md px-2 py-1', !listMode && 'bg-card shadow-sm')}>
              <CalendarDays className="size-4" />
            </button>
            <button type="button" aria-label="List view" onClick={() => setView('list')} className={cn('rounded-md px-2 py-1', listMode && 'bg-card shadow-sm')}>
              <List className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* legend */}
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>Each ticket wears its current step's colour.</span>
        {meta && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: meta.overrides.sent_back }} /> sent back
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: meta.overrides.rejected }} /> rejected
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: meta.overrides.overdue }} /> overdue
            </span>
          </>
        )}
      </p>

      {isLoading ? (
        <Skeleton className="h-[520px] w-full rounded-2xl" />
      ) : error ? (
        <p className="rounded-2xl bg-card p-6 text-sm text-muted-foreground ring-1 ring-border">Could not load the calendar.</p>
      ) : listMode ? (
        // ---- list ----
        <div className="grid gap-5">
          {inMonth.length === 0 ? (
            <div className="grid place-items-center gap-2 rounded-2xl border-2 border-dashed border-border py-14 text-center text-sm text-muted-foreground">
              <Ticket className="size-8 -rotate-12 text-muted-foreground/30" />
              Nothing due in {monthLabel}.
            </div>
          ) : (
            [...new Set(inMonth.map((e) => dayKey(e.at)))].map((k) => (
              <section key={k} className="grid gap-2">
                <h2 className={cn('text-xs font-black uppercase tracking-[0.18em]', k === today ? 'text-primary' : 'text-muted-foreground')}>
                  {new Date(`${k}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                  {k === today && ' · today'}
                </h2>
                {(byDay.get(k) || []).map((e) => (
                  <EntryRow key={`${e.kind}-${e._id}`} e={e} />
                ))}
              </section>
            ))
          )}
        </div>
      ) : (
        // ---- month ----
        <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border">
          <div className="grid grid-cols-7 border-b border-border bg-secondary/40">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {narrow ? d[0] : d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((d) => {
              const k = dayKey(d)
              const list = byDay.get(k) || []
              const outside = d.getMonth() !== cursor.getMonth()
              const isToday = k === today
              const shown = narrow ? [] : list.slice(0, 3)
              return (
                <div
                  key={k}
                  role={list.length ? 'button' : undefined}
                  tabIndex={list.length ? 0 : undefined}
                  onClick={() => list.length && setOpenDay(k)}
                  onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && list.length && setOpenDay(k)}
                  className={cn(
                    'group relative flex min-h-[64px] flex-col gap-1 border-b border-r border-border p-1.5 text-left transition-colors md:min-h-[124px] md:p-2',
                    outside && 'bg-secondary/25',
                    list.length ? 'cursor-pointer hover:bg-primary/[0.04]' : 'cursor-default'
                  )}
                >
                  <span
                    className={cn(
                      'grid size-6 place-items-center rounded-full text-xs font-bold',
                      isToday ? 'bg-primary text-primary-foreground' : outside ? 'text-muted-foreground/50' : 'text-foreground'
                    )}
                  >
                    {d.getDate()}
                  </span>
                  {narrow ? (
                    list.length > 0 && (
                      <span className="flex flex-wrap gap-0.5">
                        {list.slice(0, 6).map((e) => (
                          <span key={`${e.kind}-${e._id}`} className="size-2 rounded-full" style={{ background: e.color }} />
                        ))}
                      </span>
                    )
                  ) : (
                    <>
                      {shown.map((e) => (
                        <Link
                          key={`${e.kind}-${e._id}`}
                          to={e.link}
                          onClick={(ev) => ev.stopPropagation()}
                          title={`${e.code} · ${e.title} — ${e.stageLabel}`}
                          className={cn(
                            'relative flex items-center gap-1.5 overflow-hidden rounded-md py-1 pr-1.5 pl-2.5 text-[11px] leading-tight transition hover:brightness-95',
                            e.status !== 'open' && 'opacity-60'
                          )}
                          style={{ background: `${e.color}26` }}
                        >
                          <span className="absolute inset-y-0 left-0 w-1" style={{ background: e.color }} />
                          {e.mine.waitingOnMe && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                          <span className="truncate font-semibold text-foreground">{e.title}</span>
                        </Link>
                      ))}
                      {list.length > shown.length && <span className="px-1 text-[11px] font-bold text-primary">+{list.length - shown.length} more</span>}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Dialog open={Boolean(openDay)} onOpenChange={(v) => !v && setOpenDay(null)}>
        <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{openDay ? new Date(`${openDay}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''}</DialogTitle>
            <DialogDescription>
              {dayEntries.length} due this day{data?.seesEveryone ? '' : ' that you raised or are part of'}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {dayEntries.map((e) => (
              <EntryRow key={`${e.kind}-${e._id}`} e={e} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
