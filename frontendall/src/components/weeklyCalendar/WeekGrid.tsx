import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ChevronDown, ChevronUp, Lock, Megaphone, Repeat, Users, Utensils } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { CalEvent, Occurrence, WeekData } from '@/api/weeklyCalendar.api'
import {
  CATEGORY,
  EARLY_END,
  LATE_START,
  PERSONAL,
  avatarGradient,
  ddmmyy,
  dowShort,
  fmtMin,
  fmtRange,
  initialsOf,
  nowIst,
} from './calendarUtils'

// ---------------------------------------------------------------------------
// The week, laid out like the CEO planner: dates across, 30-minute rows
// down, a LUNCH TIME band, and the early (6:30–9:00) and late (6:30–8:30 pm)
// stretches folded into one row each until you open them.
//
// Drag down a day to pick slots; hold Ctrl/⌘ to add another day.
// ---------------------------------------------------------------------------

const ROW_H = 48
const FOLDED_H = 46
const LUNCH_H = 44

interface Row {
  start: number
  end: number
  top: number
  h: number
  kind: 'slot' | 'early' | 'late' | 'lunch'
}

export interface Sections {
  early: boolean
  late: boolean
}

function buildRows(grid: WeekData['grid'], open: Sections): Row[] {
  const rows: Row[] = []
  let top = 0
  const push = (start: number, end: number, h: number, kind: Row['kind']) => {
    rows.push({ start, end, top, h, kind })
    top += h
  }
  for (let t = grid.START; t < grid.END; ) {
    if (t === grid.START && !open.early) {
      push(grid.START, EARLY_END, FOLDED_H, 'early')
      t = EARLY_END
    } else if (t === LATE_START && !open.late) {
      push(LATE_START, grid.END, FOLDED_H, 'late')
      t = grid.END
    } else if (t === grid.LUNCH_START) {
      push(grid.LUNCH_START, grid.LUNCH_END, LUNCH_H, 'lunch')
      t = grid.LUNCH_END
    } else {
      push(t, t + grid.SLOT, ROW_H, 'slot')
      t += grid.SLOT
    }
  }
  return rows
}

function yOf(rows: Row[], min: number) {
  const last = rows[rows.length - 1]
  if (min >= last.end) return last.top + last.h
  const row = rows.find((r) => min >= r.start && min < r.end) ?? rows[0]
  return row.top + ((min - row.start) / (row.end - row.start)) * row.h
}

// Side-by-side lanes for blocks that overlap (an invite over a meeting).
function layoutLanes(events: CalEvent[]) {
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)
  const placed: { event: CalEvent; lane: number; lanes: number }[] = []
  let cluster: typeof placed = []
  let clusterEnd = -1
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1))
    cluster.forEach((c) => (c.lanes = lanes))
    placed.push(...cluster)
    cluster = []
  }
  for (const event of sorted) {
    if (event.startMin >= clusterEnd && cluster.length) flush()
    const laneEnds: number[] = []
    cluster.forEach((c) => (laneEnds[c.lane] = Math.max(laneEnds[c.lane] ?? 0, c.event.endMin)))
    let lane = laneEnds.findIndex((end) => end <= event.startMin)
    if (lane === -1) lane = laneEnds.length
    cluster.push({ event, lane, lanes: 1 })
    clusterEnd = Math.max(clusterEnd, event.endMin)
  }
  if (cluster.length) flush()
  return placed
}

const holdsTime = (e: CalEvent) => e.busy || e.myRole === 'host' || e.myRole === 'accepted'

export function WeekGrid({
  week,
  sections,
  onToggleSection,
  selections,
  onSelectionsChange,
  openEventId,
  onOpenEvent,
  readOnly,
  direction,
}: {
  week: WeekData
  sections: Sections
  onToggleSection: (key: keyof Sections) => void
  selections: Occurrence[]
  onSelectionsChange: (next: Occurrence[]) => void
  openEventId: string | null
  onOpenEvent: (id: string) => void
  readOnly: boolean
  direction: number
}) {
  const grid = week.grid
  const rows = useMemo(() => buildRows(grid, sections), [grid, sections])
  const height = rows[rows.length - 1].top + rows[rows.length - 1].h
  const bodyRef = useRef<HTMLDivElement>(null)
  const columnRefs = useRef<(HTMLDivElement | null)[]>([])
  const [now, setNow] = useState(nowIst)
  const [drag, setDrag] = useState<{ day: string; anchor: number; current: number; additive: boolean } | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(nowIst()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    for (const e of week.events) map.set(e.day, [...(map.get(e.day) ?? []), e])
    return map
  }, [week.events])

  // ---- Animations: the week slides in from the side you moved towards;
  // blocks pop in with a little stagger. ----
  useLayoutEffect(() => {
    if (!bodyRef.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo(bodyRef.current, { x: direction * 36, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: 'power3.out', clearProps: 'transform,opacity' })
      gsap.fromTo(
        '.wc-block',
        { opacity: 0, scale: 0.92, y: 8 },
        { opacity: 1, scale: 1, y: 0, duration: 0.45, stagger: 0.025, delay: 0.1, ease: 'back.out(1.7)', clearProps: 'transform,opacity' }
      )
    }, bodyRef)
    return () => ctx.revert()
  }, [week.start, week.person._id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Slot picking ----
  const isPastSlot = useCallback(
    (day: string, start: number) => day < now.day || (day === now.day && start + grid.SLOT <= now.min),
    [now, grid.SLOT]
  )

  const slotAt = useCallback(
    (dayIndex: number, clientY: number) => {
      const col = columnRefs.current[dayIndex]
      if (!col) return null
      const y = clientY - col.getBoundingClientRect().top
      const row = rows.find((r) => y >= r.top && y < r.top + r.h) ?? (y < 0 ? rows[0] : rows[rows.length - 1])
      if (row.kind !== 'slot') return { min: null, row }
      return { min: row.start, row }
    },
    [rows]
  )

  // Keep a drag inside one stretch of free-to-book slots: never across
  // lunch, a folded stretch or into the past.
  const clampRange = useCallback(
    (day: string, anchor: number, current: number) => {
      let lo = Math.min(anchor, current)
      let hi = Math.max(anchor, current)
      const blocked = (m: number) => {
        const row = rows.find((r) => m >= r.start && m < r.end)
        return !row || row.kind !== 'slot' || isPastSlot(day, m)
      }
      for (let m = anchor; m >= lo; m -= grid.SLOT) if (blocked(m)) { lo = m + grid.SLOT; break } // prettier-ignore
      for (let m = anchor; m <= hi; m += grid.SLOT) if (blocked(m)) { hi = m - grid.SLOT; break } // prettier-ignore
      return { startMin: lo, endMin: hi + grid.SLOT }
    },
    [rows, isPastSlot, grid.SLOT]
  )

  useEffect(() => {
    if (!drag) return
    const dayIndex = week.days.indexOf(drag.day)
    const onMove = (e: PointerEvent) => {
      const hit = slotAt(dayIndex, e.clientY)
      if (hit?.min != null && hit.min !== drag.current) setDrag((d) => (d ? { ...d, current: hit.min as number } : d))
    }
    const onUp = () => {
      const range = clampRange(drag.day, drag.anchor, drag.current)
      const rest = drag.additive ? selections.filter((s) => s.day !== drag.day) : []
      onSelectionsChange([...rest, { day: drag.day, ...range }].sort((a, b) => a.day.localeCompare(b.day)))
      setDrag(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [drag, week.days, slotAt, clampRange, selections, onSelectionsChange])

  const startDrag = (e: React.PointerEvent, day: string, dayIndex: number) => {
    if (e.button !== 0) return
    const hit = slotAt(dayIndex, e.clientY)
    if (!hit) return
    if (hit.row.kind === 'early' || hit.row.kind === 'late') return onToggleSection(hit.row.kind)
    if (readOnly) return
    if (hit.min == null || isPastSlot(day, hit.min)) return
    e.preventDefault()
    setDrag({ day, anchor: hit.min, current: hit.min, additive: e.ctrlKey || e.metaKey || e.shiftKey })
  }

  const liveSelections = useMemo(() => {
    if (!drag) return selections
    const range = { day: drag.day, ...clampRange(drag.day, drag.anchor, drag.current) }
    const rest = drag.additive ? selections.filter((s) => s.day !== drag.day) : []
    return [...rest, range]
  }, [drag, selections, clampRange])

  // Pop the selection when it's first drawn.
  const selectionKey = liveSelections.map((s) => s.day).join(',')
  useLayoutEffect(() => {
    if (!bodyRef.current) return
    gsap.fromTo(
      bodyRef.current.querySelectorAll('.wc-selection'),
      { scaleX: 0.94, opacity: 0.4 },
      { scaleX: 1, opacity: 1, duration: 0.3, ease: 'back.out(2)', clearProps: 'transform,opacity' }
    )
  }, [selectionKey])

  const holidayByDay = useMemo(() => new Map(week.holidays.map((h) => [h.day, h])), [week.holidays])
  const leave = useMemo(() => new Set(week.leaveDays), [week.leaveDays])
  const folded = (kind: 'early' | 'late', day: string) => {
    const [a, b] = kind === 'early' ? [grid.START, EARLY_END] : [LATE_START, grid.END]
    return (eventsByDay.get(day) ?? []).filter((e) => e.startMin < b && a < e.endMin).length
  }

  return (
    <div className="wc-card relative overflow-hidden rounded-3xl border border-border bg-card shadow-[0_24px_60px_-34px_rgba(15,23,42,0.45)]">
      <div className="max-h-[calc(100vh-15rem)] min-h-[420px] overflow-auto overscroll-contain">
        <div className="min-w-[1020px]">
          {/* Header */}
          <div className="sticky top-0 z-30 grid grid-cols-[92px_repeat(7,minmax(0,1fr))] border-b border-border bg-card/95 backdrop-blur">
            <div className="flex flex-col justify-center border-r border-border px-3 py-2">
              <span className="truncate text-[10px] font-black tracking-wider text-muted-foreground uppercase">{week.person.name}</span>
              <span className="text-[10px] text-muted-foreground/70">IST</span>
            </div>
            {week.days.map((day) => {
              const isToday = day === week.today
              const holiday = holidayByDay.get(day)
              return (
                <div key={day} className={cn('relative border-r border-border/60 px-2 py-2.5 text-center last:border-r-0', day < week.today && 'opacity-55')}>
                  <p className={cn('text-[11px] font-black tracking-[0.14em]', isToday ? 'text-primary' : 'text-muted-foreground')}>{dowShort(day)}</p>
                  <p className={cn('mx-auto mt-0.5 w-fit rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums', isToday ? 'wc-today-pill text-white' : 'text-foreground')}>
                    {ddmmyy(day)}
                  </p>
                  <div className="mt-1 flex min-h-4 flex-wrap justify-center gap-1">
                    {holiday && (
                      <span className="rounded-full bg-amber-500/15 px-1.5 text-[9.5px] font-bold text-amber-700 dark:text-amber-300" title={holiday.label}>
                        {holiday.type === 'holiday' ? 'Holiday' : holiday.type === 'half_day' ? 'Half day' : 'SL day'} · {holiday.label}
                      </span>
                    )}
                    {leave.has(day) && <span className="rounded-full bg-rose-500/15 px-1.5 text-[9.5px] font-bold text-rose-600 dark:text-rose-300">On leave</span>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Body */}
          <div ref={bodyRef} className="relative grid grid-cols-[92px_repeat(7,minmax(0,1fr))]" style={{ height }}>
            {/* Time gutter */}
            <div className="relative border-r border-border">
              {rows.map((row) => (
                <div
                  key={row.start}
                  className={cn(
                    'absolute inset-x-0 flex flex-col justify-center border-b border-border/50 px-3',
                    row.kind === 'lunch' && 'wc-lunch-gutter',
                    (row.kind === 'early' || row.kind === 'late') && 'cursor-pointer hover:bg-secondary/60'
                  )}
                  style={{ top: row.top, height: row.h }}
                  onClick={() => (row.kind === 'early' || row.kind === 'late') && onToggleSection(row.kind)}
                >
                  {row.kind === 'lunch' ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                      <Utensils className="size-3" /> {fmtMin(row.start, false)}
                    </span>
                  ) : (
                    <>
                      <span className="text-[12px] leading-none font-bold text-foreground tabular-nums">{fmtMin(row.start, false)}</span>
                      <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground tabular-nums">
                        – {fmtMin(row.end)}
                        {row.kind !== 'slot' && <ChevronDown className="size-3" />}
                      </span>
                    </>
                  )}
                </div>
              ))}
              {/* Fold controls for open stretches */}
              {sections.early && (
                <button
                  type="button"
                  onClick={() => onToggleSection('early')}
                  className="absolute top-1 right-1 z-10 rounded-full bg-secondary p-0.5 text-muted-foreground hover:text-foreground"
                  title="Fold 6:30 – 9:00 am"
                >
                  <ChevronUp className="size-3" />
                </button>
              )}
              {sections.late && (
                <button
                  type="button"
                  onClick={() => onToggleSection('late')}
                  className="absolute right-1 z-10 rounded-full bg-secondary p-0.5 text-muted-foreground hover:text-foreground"
                  style={{ top: yOf(rows, LATE_START) + 4 }}
                  title="Fold 6:30 – 8:30 pm"
                >
                  <ChevronUp className="size-3" />
                </button>
              )}
              {week.days.includes(now.day) && now.min >= grid.START && now.min < grid.END && (
                <span
                  className="absolute right-1 z-20 -translate-y-1/2 rounded-full bg-rose-500 px-1.5 py-0.5 text-[9.5px] font-bold text-white tabular-nums shadow"
                  style={{ top: yOf(rows, now.min) }}
                >
                  {fmtMin(now.min)}
                </span>
              )}
            </div>

            {/* Day columns */}
            {week.days.map((day, dayIndex) => {
              const past = day < now.day
              const placed = layoutLanes(eventsByDay.get(day) ?? [])
              const selection = liveSelections.find((s) => s.day === day)
              const clash = selection && (eventsByDay.get(day) ?? []).some((e) => holdsTime(e) && e.startMin < selection.endMin && selection.startMin < e.endMin)
              return (
                <div
                  key={day}
                  data-day={day}
                  ref={(el) => {
                    columnRefs.current[dayIndex] = el
                  }}
                  className={cn(
                    'relative border-r border-border/60 last:border-r-0',
                    day === now.day && 'wc-today-col',
                    past && 'wc-past',
                    leave.has(day) && 'wc-leave',
                    !readOnly && !past && 'cursor-cell'
                  )}
                  onPointerDown={(e) => startDrag(e, day, dayIndex)}
                >
                  {rows.map((row) => {
                    if (row.kind === 'lunch') {
                      return (
                        <div key={row.start} className="wc-lunch absolute inset-x-0 flex items-center justify-center border-b border-border/50" style={{ top: row.top, height: row.h }}>
                          <span className="text-[10px] font-black tracking-[0.18em] text-amber-700/80 dark:text-amber-300/80">LUNCH TIME</span>
                        </div>
                      )
                    }
                    if (row.kind !== 'slot') {
                      const count = folded(row.kind, day)
                      return (
                        <div
                          key={row.start}
                          className="wc-folded absolute inset-x-0 flex cursor-pointer items-center justify-center border-b border-border/50"
                          style={{ top: row.top, height: row.h }}
                        >
                          {count > 0 ? (
                            <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-bold text-primary">
                              {count} {count === 1 ? 'block' : 'blocks'}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/50">· · ·</span>
                          )}
                        </div>
                      )
                    }
                    const pastSlot = isPastSlot(day, row.start)
                    return (
                      <div
                        key={row.start}
                        className={cn(
                          'absolute inset-x-0 border-b border-border/40',
                          row.start % 60 === 0 && 'border-border/25',
                          pastSlot ? 'wc-slot-past' : !readOnly && 'wc-slot'
                        )}
                        style={{ top: row.top, height: row.h }}
                      />
                    )
                  })}

                  {/* Selection */}
                  {selection && (
                    <div
                      className={cn('wc-selection pointer-events-none absolute inset-x-1 z-20 rounded-xl', clash && 'wc-selection-clash')}
                      style={{ top: yOf(rows, selection.startMin) + 1, height: yOf(rows, selection.endMin) - yOf(rows, selection.startMin) - 2 }}
                    >
                      <span className="absolute top-1.5 left-2 rounded-md bg-white/85 px-1.5 py-0.5 text-[10px] font-bold text-primary shadow-sm dark:bg-black/50 dark:text-white">
                        {fmtRange(selection.startMin, selection.endMin)}
                      </span>
                    </div>
                  )}

                  {/* Blocks */}
                  {placed.map(({ event, lane, lanes }) => {
                    const top = yOf(rows, event.startMin)
                    const h = Math.max(22, yOf(rows, event.endMin) - top)
                    return (
                      <EventBlock
                        key={event._id}
                        event={event}
                        style={{ top: top + 2, height: h - 4, left: `calc(${(lane / lanes) * 100}% + 4px)`, width: `calc(${100 / lanes}% - 8px)` }}
                        compact={h < 54}
                        active={openEventId === event._id}
                        onOpen={() => !event.busy && onOpenEvent(event._id)}
                      />
                    )
                  })}

                  {/* Now line */}
                  {day === now.day && now.min >= grid.START && now.min < grid.END && (
                    <div className="pointer-events-none absolute inset-x-0 z-30" style={{ top: yOf(rows, now.min) }}>
                      <div className="wc-now-dot absolute -top-[5px] -left-[5px] size-2.5 rounded-full bg-rose-500" />
                      <div className="h-[2px] bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.7)]" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function EventBlock({
  event,
  style,
  compact,
  active,
  onOpen,
}: {
  event: CalEvent
  style: React.CSSProperties
  compact: boolean
  active: boolean
  onOpen: () => void
}) {
  if (event.busy) {
    return (
      <div className="wc-block wc-busy absolute z-10 flex items-center justify-center rounded-xl border border-border/80 text-[11px] font-bold tracking-wider text-muted-foreground" style={style}>
        BUSY
      </div>
    )
  }
  const meta = event.isPersonal ? PERSONAL : CATEGORY[event.category ?? 'other']
  const tentative = event.myRole === 'invited'
  const open = event.myRole === 'open'
  const going = [event.host, ...(event.attendees ?? []).filter((a) => a.status === 'accepted').map((a) => a.user)].filter(Boolean) as NonNullable<CalEvent['host']>[]

  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onOpen}
      className={cn(
        'wc-block group absolute z-10 overflow-hidden rounded-xl text-left transition-[box-shadow,transform] duration-200 hover:z-20 hover:-translate-y-px hover:shadow-[0_12px_28px_-14px_rgba(15,23,42,0.55)]',
        tentative && 'wc-tentative',
        open && 'wc-open',
        active && 'ring-2 ring-primary ring-offset-2 ring-offset-card'
      )}
      style={{
        ...style,
        background: tentative || open ? `color-mix(in oklch, var(--card) 88%, ${meta.from})` : `linear-gradient(135deg, ${meta.soft}, color-mix(in oklch, var(--card) 70%, ${meta.from} 8%))`,
        borderColor: meta.from,
        ['--wc-accent' as string]: meta.from,
      }}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: `linear-gradient(${meta.from}, ${meta.to})` }} />
      <div className={cn('flex h-full flex-col pl-2.5 pr-1.5', compact ? 'justify-center py-0.5' : 'py-1.5')}>
        <div className="flex min-w-0 items-center gap-1">
          {event.isPersonal && <Lock className="size-3 shrink-0" style={{ color: meta.ink }} />}
          {event.openForAll && <Megaphone className="size-3 shrink-0" style={{ color: meta.ink }} />}
          {(event.seriesSize ?? 1) > 1 && <Repeat className="size-3 shrink-0 opacity-60" style={{ color: meta.ink }} />}
          <p className="truncate text-[12px] leading-tight font-bold dark:!text-foreground" style={{ color: meta.ink }}>
            {event.title}
          </p>
        </div>
        {!compact && (
          <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground tabular-nums">
            {fmtRange(event.startMin, event.endMin)}
            {event.location ? ` · ${event.location}` : ''}
          </p>
        )}
        {(tentative || open) && (
          <span
            className="mt-auto mb-0.5 w-fit rounded-full px-1.5 py-px text-[9.5px] font-black tracking-wide text-white uppercase"
            style={{ background: meta.from }}
          >
            {tentative ? 'Invite · respond' : 'Open · join'}
          </span>
        )}
        {!compact && !tentative && !open && going.length > 1 && (
          <div className="mt-auto flex items-center gap-1 pb-0.5">
            <div className="flex -space-x-1.5">
              {going.slice(0, 4).map((p) => (
                <span
                  key={p._id}
                  title={p.name}
                  className="flex size-5 items-center justify-center rounded-full text-[8px] font-bold text-white ring-2 ring-card"
                  style={{ background: avatarGradient(p._id) }}
                >
                  {initialsOf(p)}
                </span>
              ))}
            </div>
            {going.length > 4 && <span className="text-[10px] font-semibold text-muted-foreground">+{going.length - 4}</span>}
            <Users className="ml-auto size-3 text-muted-foreground" />
          </div>
        )}
      </div>
    </button>
  )
}
