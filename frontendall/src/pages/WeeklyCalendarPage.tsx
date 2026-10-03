import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import gsap from 'gsap'
import { toast } from 'sonner'
import {
  ArrowRight,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  Loader2,
  MousePointer2,
  Search,
  Sparkles,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { downloadWeekPdf, type CalEvent, type Occurrence } from '@/api/weeklyCalendar.api'
import { useCalendarPeople, useCopyWeek, useInvites, useWeek } from '@/hooks/useWeeklyCalendar'
import { WeekGrid, type Sections } from '@/components/weeklyCalendar/WeekGrid'
import { CreateEventPanel } from '@/components/weeklyCalendar/CreateEventPanel'
import { EventPanel } from '@/components/weeklyCalendar/EventPanel'
import { InvitesTray } from '@/components/weeklyCalendar/InvitesTray'
import { FindTimeDialog } from '@/components/weeklyCalendar/FindTimeDialog'
import { Avatar } from '@/components/weeklyCalendar/PeoplePicker'
import { EARLY_END, LATE_START, addDays, apiError, fmtDay, fmtRange, mondayOf, nowIst, weekLabel } from '@/components/weeklyCalendar/calendarUtils'
import '@/components/weeklyCalendar/weeklyCalendar.css'

const SECTIONS_KEY = 'weekly-calendar:sections'

function readSections(): Sections {
  try {
    const raw = localStorage.getItem(SECTIONS_KEY)
    if (raw) return { early: false, late: false, ...JSON.parse(raw) }
  } catch {
    // storage may be unavailable — the defaults are fine
  }
  return { early: false, late: false }
}

function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const last = useRef(0)
  useEffect(() => {
    const state = { v: last.current }
    const tween = gsap.to(state, { v: value, duration: 0.8, ease: 'power2.out', onUpdate: () => ref.current && (ref.current.textContent = String(Math.round(state.v))) })
    last.current = value
    return () => {
      tween.kill()
    }
  }, [value])
  return <span ref={ref}>0</span>
}

export default function WeeklyCalendarPage() {
  const { user } = useAuth()
  const viewerId = user?.id ?? ''
  const isAdmin = user?.role === 'admin'
  const [params, setParams] = useSearchParams()

  const weekStart = mondayOf(params.get('week') ?? nowIst().day)
  const viewUser = params.get('user') ?? undefined
  const openEventId = params.get('event')
  const viewingOther = Boolean(viewUser && viewUser !== viewerId)

  const setParam = useCallback(
    (patch: Record<string, string | null>) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k))
          return next
        },
        { replace: true }
      ),
    [setParams]
  )

  const { data: week, isLoading, isError, isFetching } = useWeek(weekStart, viewingOther ? viewUser : undefined)
  const { data: invites = [] } = useInvites()
  const { data: peopleData } = useCalendarPeople()
  const copyWeek = useCopyWeek()

  const [selections, setSelections] = useState<Occurrence[]>([])
  const [creating, setCreating] = useState<{ invitees: string[] } | null>(null)
  const [direction, setDirection] = useState(0)
  const [findOpen, setFindOpen] = useState(false)
  const [sections, setSections] = useState<Sections>(readSections)
  const [pdfBusy, setPdfBusy] = useState(false)

  // Open a folded stretch automatically when this week has something in it.
  const autoOpen = useMemo<Sections>(() => {
    const evs = week?.events ?? []
    return {
      early: evs.some((e) => e.startMin < EARLY_END),
      late: evs.some((e) => e.endMin > LATE_START),
    }
  }, [week])
  const effectiveSections = { early: sections.early || autoOpen.early, late: sections.late || autoOpen.late }

  const toggleSection = (key: keyof Sections) => {
    setSections((prev) => {
      const next = { ...prev, [key]: !effectiveSections[key] }
      try {
        localStorage.setItem(SECTIONS_KEY, JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
    if (effectiveSections[key] && autoOpen[key]) toast.info('This week has blocks there, so it stays open')
  }

  const goWeek = (delta: number) => {
    setDirection(delta)
    setSelections([])
    setParam({ week: delta === 0 ? null : addDays(weekStart, delta * 7), event: null })
  }
  const goToday = () => {
    setDirection(weekStart > mondayOf(nowIst().day) ? -1 : 1)
    setSelections([])
    setParam({ week: null, event: null })
  }

  // From the invites tray: jump to that event's week on your own calendar.
  const openEvent = (event: Pick<CalEvent, '_id' | 'day'>) => {
    setCreating(null)
    setSelections([])
    setParam({ event: event._id, week: mondayOf(event.day) === mondayOf(nowIst().day) ? null : mondayOf(event.day), user: null })
  }
  const closePanels = () => {
    setCreating(null)
    setParam({ event: null })
  }

  // Keyboard: ← → weeks, T today, Esc closes / clears.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable], [role="dialog"]')) return
      if (e.key === 'Escape') {
        if (creating || openEventId) closePanels()
        else setSelections([])
      } else if (e.key === 'ArrowRight') goWeek(1)
      else if (e.key === 'ArrowLeft') goWeek(-1)
      else if (e.key.toLowerCase() === 't') goToday()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ---- Stats ----
  const stats = useMemo(() => {
    const mine = (week?.events ?? []).filter((e) => e.busy || e.myRole === 'host' || e.myRole === 'accepted')
    const minutes = mine.reduce((sum, e) => sum + (e.endMin - e.startMin), 0)
    return { blocks: mine.length, hours: Math.round((minutes / 60) * 10) / 10, hosting: mine.filter((e) => e.myRole === 'host').length }
  }, [week])

  // ---- Header entrance ----
  const headerRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!headerRef.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo('.wc-head-item', { y: -14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, stagger: 0.06, ease: 'power3.out', clearProps: 'transform,opacity' })
    }, headerRef)
    return () => ctx.revert()
  }, [])

  // ---- Selection bar ----
  const barRef = useRef<HTMLDivElement>(null)
  const hasSelection = selections.length > 0 && !creating
  useLayoutEffect(() => {
    if (hasSelection && barRef.current) gsap.fromTo(barRef.current, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'back.out(1.6)', clearProps: 'transform,opacity' })
  }, [hasSelection])
  const totalMin = selections.reduce((s, x) => s + x.endMin - x.startMin, 0)

  const viewing = viewingOther ? peopleData?.people.find((p) => p._id === viewUser) ?? week?.person : null

  const exportPdf = async () => {
    setPdfBusy(true)
    try {
      await downloadWeekPdf(weekStart, viewingOther ? viewUser : undefined)
    } catch (err) {
      toast.error(apiError(err, 'Could not make the PDF'))
    } finally {
      setPdfBusy(false)
    }
  }

  const doCopy = (weeks: number) =>
    copyWeek
      .mutateAsync({ from: weekStart, to: addDays(weekStart, weeks * 7) })
      .then((r) => {
        toast.success(`Copied ${r.created} block${r.created === 1 ? '' : 's'} into the week of ${fmtDay(addDays(weekStart, weeks * 7))}`, {
          action: { label: 'Go there', onClick: () => goWeek(weeks) },
        })
        r.skipped.slice(0, 4).forEach((s) => toast.warning(`${s.title} (${fmtDay(s.day)}): ${s.reason}`))
      })
      .catch((err) => toast.error(apiError(err, 'Could not copy the week')))

  return (
    <div className="wc-page min-h-full">
      {/* Header */}
      <div ref={headerRef} className="mb-4 flex flex-wrap items-center gap-3">
        <div className="wc-head-item flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-lg shadow-indigo-500/25">
            <CalendarRange className="size-5 text-white" />
          </span>
          <div>
            <h1 className="text-2xl leading-none font-black tracking-tight">Weekly Calendar</h1>
            <p className="mt-1 text-xs text-muted-foreground">Meetings, events and blocked time — drag down a day to book slots.</p>
          </div>
        </div>

        <div className="wc-head-item wc-glass flex items-center gap-1 rounded-2xl p-1">
          <Button size="icon" variant="ghost" className="size-8 rounded-xl" onClick={() => goWeek(-1)} title="Previous week (←)">
            <ChevronLeft className="size-4" />
          </Button>
          <div className="min-w-[150px] px-1 text-center">
            <p className="text-sm font-black tabular-nums">{weekLabel(weekStart)}</p>
            <p className="text-[10px] font-semibold text-muted-foreground">
              {weekStart === mondayOf(nowIst().day) ? 'This week' : weekStart > mondayOf(nowIst().day) ? 'Upcoming' : 'Past — read only'}
              {isFetching && <Loader2 className="ml-1 inline size-3 animate-spin" />}
            </p>
          </div>
          <Button size="icon" variant="ghost" className="size-8 rounded-xl" onClick={() => goWeek(1)} title="Next week (→)">
            <ChevronRight className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" className="rounded-xl text-xs font-bold" onClick={goToday} title="Back to this week (T)">
            Today
          </Button>
          <label className="relative flex size-8 cursor-pointer items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground" title="Jump to a date">
            <CalendarDays className="size-4" />
            <input
              type="date"
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={(e) => {
                if (!e.target.value) return
                const target = mondayOf(e.target.value)
                setDirection(target > weekStart ? 1 : -1)
                setSelections([])
                setParam({ week: target, event: null })
              }}
            />
          </label>
        </div>

        <div className="wc-head-item wc-glass hidden items-stretch divide-x divide-border rounded-2xl lg:flex">
          {[
            { label: 'Blocks', value: stats.blocks, tone: 'text-foreground' },
            { label: 'Hours booked', value: stats.hours, tone: 'text-indigo-600 dark:text-indigo-300' },
            { label: 'Hosting', value: stats.hosting, tone: 'text-emerald-600 dark:text-emerald-400' },
            ...(!viewingOther ? [{ label: 'Pending invites', value: invites.length, tone: 'text-rose-600 dark:text-rose-400' }] : []),
          ].map((s) => (
            <div key={s.label} className="px-3.5 py-1.5">
              <p className={cn('text-lg leading-none font-black tabular-nums', s.tone)}>{Number.isInteger(s.value) ? <AnimatedNumber value={s.value} /> : s.value}</p>
              <p className="mt-0.5 text-[9.5px] font-semibold tracking-wider text-muted-foreground uppercase">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="wc-head-item ml-auto flex flex-wrap items-center gap-2">
          <PersonSwitcher
            viewerId={viewerId}
            value={viewingOther ? viewUser! : null}
            onChange={(id) => {
              setSelections([])
              closePanels()
              setParam({ user: id, event: null })
            }}
          />
          {!viewingOther && <InvitesTray onOpen={openEvent} />}
          {!viewingOther && week && (
            <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setFindOpen(true)}>
              <Sparkles className="size-4 text-violet-500" /> Find a time
            </Button>
          )}
          {!viewingOther && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-xl" title="Copy this week">
                  <Copy className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-3">
                <p className="text-sm font-bold">Copy this week</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Everything you host this week is copied, and the same people are re-invited (anyone busy then is skipped).
                </p>
                <div className="mt-3 grid gap-1.5">
                  {[1, 2, 3].map((w) => (
                    <Button key={w} size="sm" variant="secondary" className="justify-between" disabled={copyWeek.isPending} onClick={() => doCopy(w)}>
                      {w === 1 ? 'Into next week' : `Into ${w} weeks from now`}
                      <span className="text-[11px] text-muted-foreground">{weekLabel(addDays(weekStart, w * 7))}</span>
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
          <Button variant="outline" size="icon" className="rounded-xl" onClick={exportPdf} disabled={pdfBusy} title="Download this week as a PDF">
            {pdfBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          </Button>
        </div>
      </div>

      {viewingOther && viewing && (
        <div className="mb-3 flex items-center gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/[0.06] px-4 py-2.5">
          <Eye className="size-4 text-indigo-500" />
          <Avatar person={viewing} size="size-7" />
          <p className="flex-1 text-sm">
            <span className="font-bold">{viewing.name}'s week</span>
            <span className="text-muted-foreground"> · {isAdmin ? 'admin view — every detail is visible' : 'you only see when they’re busy'}</span>
          </p>
          <Button size="sm" variant="ghost" onClick={() => setParam({ user: null })}>
            Back to mine <X className="size-3.5" />
          </Button>
        </div>
      )}

      {isLoading || !week ? (
        <div className="flex h-[60vh] items-center justify-center rounded-3xl border border-border bg-card text-muted-foreground">
          {isError ? <p className="text-sm">Could not load the calendar.</p> : <Loader2 className="size-6 animate-spin" />}
        </div>
      ) : (
        <WeekGrid
          week={week}
          sections={effectiveSections}
          onToggleSection={toggleSection}
          selections={selections}
          onSelectionsChange={(next) => {
            setSelections(next)
            if (openEventId) setParam({ event: null })
          }}
          openEventId={openEventId}
          onOpenEvent={(id) => {
            setCreating(null)
            setSelections([])
            setParam({ event: id })
          }}
          readOnly={viewingOther}
          direction={direction}
        />
      )}

      {/* Legend + tip */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <MousePointer2 className="size-3.5" /> Drag down a day to pick slots · hold Ctrl to add another day
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded border-[1.5px] border-dashed border-indigo-500" /> Invite waiting for you
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded border-[1.5px] border-dotted border-amber-500" /> Open for all
        </span>
        <span className="flex items-center gap-1.5">
          <span className="wc-busy h-3 w-5 rounded border border-border" /> Busy
        </span>
      </div>

      {/* Floating selection bar */}
      {hasSelection && (
        <div ref={barRef} className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
          <div className="wc-glass flex items-center gap-3 rounded-2xl py-2 pr-2 pl-4 shadow-[0_24px_50px_-20px_rgba(79,70,229,0.55)]">
            <div className="text-sm">
              <p className="font-bold">
                {selections.length === 1 ? fmtDay(selections[0].day) : `${selections.length} days`} ·{' '}
                {selections.length === 1 ? fmtRange(selections[0].startMin, selections[0].endMin) : `${totalMin / 60}h total`}
              </p>
              <p className="text-[11px] text-muted-foreground">{totalMin / 30} slot{totalMin === 30 ? '' : 's'} picked</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSelections([])}>
              Clear
            </Button>
            <Button size="sm" className="gap-1.5 bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md hover:opacity-95" onClick={() => setCreating({ invitees: [] })}>
              Block time <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {creating && week && selections.length > 0 && (
        <CreateEventPanel
          week={week}
          viewerId={viewerId}
          selections={selections}
          onSelectionsChange={setSelections}
          initialInvitees={creating.invitees}
          onClose={() => setCreating(null)}
          onCreated={(id) => {
            setCreating(null)
            setSelections([])
            if (id) setParam({ event: id })
          }}
        />
      )}
      {openEventId && !creating && <EventPanel eventId={openEventId} onClose={() => setParam({ event: null })} />}

      {week && (
        <FindTimeDialog
          open={findOpen}
          onOpenChange={setFindOpen}
          week={week}
          viewerId={viewerId}
          onPick={(slot, invitees) => {
            setFindOpen(false)
            setParam({ event: null })
            setSelections([slot])
            setCreating({ invitees })
          }}
        />
      )}
    </div>
  )
}

// "My calendar" or any colleague's week (busy-only unless you're admin).
function PersonSwitcher({ viewerId, value, onChange }: { viewerId: string; value: string | null; onChange: (id: string | null) => void }) {
  const { data } = useCalendarPeople()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const people = (data?.people ?? []).filter((p) => p._id !== viewerId && (!query.trim() || `${p.name} ${p.subtitle}`.toLowerCase().includes(query.trim().toLowerCase())))
  const current = value ? data?.people.find((p) => p._id === value) : null
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 rounded-xl">
          {current ? <Avatar person={current} size="size-5" className="text-[8px]" /> : <Eye className="size-4" />}
          {current ? current.name.split(' ')[0] : 'My calendar'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <button
          type="button"
          onClick={() => (onChange(null), setOpen(false))}
          className={cn('mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-semibold hover:bg-secondary', !value && 'bg-primary/10')}
        >
          <CalendarRange className="size-4 text-primary" /> My calendar
        </button>
        <div className="relative mb-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="See a colleague's week…"
            className="h-8 w-full rounded-lg border border-border bg-background pr-2 pl-7 text-xs outline-none"
          />
        </div>
        <div className="max-h-64 overflow-y-auto">
          {people.map((p) => (
            <button
              key={p._id}
              type="button"
              onClick={() => (onChange(p._id), setOpen(false))}
              className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-secondary', value === p._id && 'bg-primary/10')}
            >
              <Avatar person={p} size="size-6" className="text-[9px]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{p.name}</span>
                <span className="block truncate text-[10.5px] text-muted-foreground">{p.subtitle}</span>
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
