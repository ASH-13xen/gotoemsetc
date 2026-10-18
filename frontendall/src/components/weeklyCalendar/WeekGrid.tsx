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
  isLunch,
  nowIst,
} from './calendarUtils'

// ---------------------------------------------------------------------------
// The week, laid out like the CEO planner: dates across, 30-minute rows
// down, and the early (6:30–9:00) and late (6:30–8:30 pm) stretches folded
// into one row each until you open them. Lunch is tinted but bookable.
//
// It always fits the width — the columns stretch, and below ~640px it shows
// one day at a time with a Mon–Sun strip to switch days.
//
// Drag down a day to pick slots; hold Ctrl/⌘ (or Shift) to add another —
// on another day or the same one.
// ---------------------------------------------------------------------------

const ROW_H = 48
const FOLDED_H = 46
const NARROW_AT = 640

interface Row {
  start: number
  end: number
  top: number
  h: number
  kind: 'slot' | 'early' | 'late'
  lunch: boolean
}

export interface Sections {
  early: boolean
  late: boolean
}

function buildRows(grid: WeekData['grid'], open: Sections): Row[] {
  const rows: Row[] = []
  let top = 0
  const push = (start: number, end: number, h: number, kind: Row['kind']) => {
    rows.push({ start, end, top, h, kind, lunch: kind === 'slot' && isLunch(start, grid) })
    top += h
  }
  for (let t = grid.START; t < grid.END; ) {
    if (t === grid.START && !open.early) {
      push(grid.START, EARLY_END, FOLDED_H, 'early')
      t = EARLY_END
    } else if (t === LATE_START && !open.late) {
      push(LATE_START, grid.END, FOLDED_H, 'late')
      t = grid.END
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

// What takes up time on this calendar: a whole event, or — for a guest who
// has a slice of it — just their slice.
interface Piece {
  key: string
  event: CalEvent
  startMin: number
  endMin: number
  slice: boolean
}

const piecesOf = (event: CalEvent): Piece[] =>
  event.held?.length
    ? event.held.map((h) => ({ key: `${event._id}:${h.startMin}`, event, startMin: h.startMin, endMin: h.endMin, slice: true }))
    : [{ key: event._id, event, startMin: event.startMin, endMin: event.endMin, slice: false }]

// Side-by-side lanes for blocks that overlap (an invite over a meeting).
function layoutLanes(pieces: Piece[]) {
  const sorted = [...pieces].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)
  const placed: { piece: Piece; lane: number; lanes: number }[] = []
  let cluster: typeof placed = []
  let clusterEnd = -1
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1))
    cluster.forEach((c) => (c.lanes = lanes))
    placed.push(...cluster)
    cluster = []
  }
  for (const piece of sorted) {
    if (piece.startMin >= clusterEnd && cluster.length) flush()
    const laneEnds: number[] = []
    cluster.forEach((c) => (laneEnds[c.lane] = Math.max(laneEnds[c.lane] ?? 0, c.piece.endMin)))
    let lane = laneEnds.findIndex((end) => end <= piece.startMin)
    if (lane === -1) lane = laneEnds.length
    cluster.push({ piece, lane, lanes: 1 })
    clusterEnd = Math.max(clusterEnd, piece.endMin)
  }
  if (cluster.length) flush()
  return placed
}

const holdsTime = (e: CalEvent) => e.busy || e.myRole === 'host' || e.myRole === 'accepted'
const REPEAT_SHORT = { weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' } as const

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
  const cardRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [now, setNow] = useState(nowIst)
  const [drag, setDrag] = useState<{ day: string; anchor: number; current: number; additive: boolean } | null>(null)

  // ---- Fit the width: all seven days, or one at a time when narrow ----
  const [width, setWidth] = useState(1200)
  useLayoutEffect(() => {
    const el = cardRef.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const narrow = width < NARROW_AT
  const tight = width < 900
  const [focusDay, setFocusDay] = useState<string | null>(null)
  const shownDay = focusDay && week.days.includes(focusDay) ? focusDay : week.days.includes(now.day) ? now.day : week.days[0]
  const days = narrow ? [shownDay] : week.days
  const gutter = narrow ? 52 : 64
  const columns = `${gutter}px repeat(${days.length}, minmax(0, 1fr))`

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
  }, [week.start, week.person._id, narrow && shownDay]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Slot picking ----
  const isPastSlot = useCallback(
    (day: string, start: number) => day < now.day || (day === now.day && start + grid.SLOT <= now.min),
    [now, grid.SLOT]
  )

  const slotAt = useCallback(
    (day: string, clientY: number) => {
      const col = columnRefs.current[day]
      if (!col) return null
      const y = clientY - col.getBoundingClientRect().top
      const row = rows.find((r) => y >= r.top && y < r.top + r.h) ?? (y < 0 ? rows[0] : rows[rows.length - 1])
      if (row.kind !== 'slot') return { min: null, row }
      return { min: row.start, row }
    },
    [rows]
  )

  // Keep a drag inside one stretch of free-to-book slots: never across a
  // folded stretch or into the past.
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

  // A new pick replaces everything — or, when adding, just the picks it overlaps.
  const merge = useCallback(
    (picked: Occurrence, additive: boolean) => {
      const rest = additive ? selections.filter((s) => !(s.day === picked.day && s.startMin < picked.endMin && picked.startMin < s.endMin)) : []
      return [...rest, picked].sort((a, b) => a.day.localeCompare(b.day) || a.startMin - b.startMin)
    },
    [selections]
  )

  useEffect(() => {
    if (!drag) return
    const onMove = (e: PointerEvent) => {
      const hit = slotAt(drag.day, e.clientY)
      if (hit?.min != null && hit.min !== drag.current) setDrag((d) => (d ? { ...d, current: hit.min as number } : d))
    }
    const onUp = () => {
      onSelectionsChange(merge({ day: drag.day, ...clampRange(drag.day, drag.anchor, drag.current) }, drag.additive))
      setDrag(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [drag, slotAt, clampRange, merge, onSelectionsChange])

  const startDrag = (e: React.PointerEvent, day: string) => {
    if (e.button !== 0) return
    const hit = slotAt(day, e.clientY)
    if (!hit) return
    if (hit.row.kind === 'early' || hit.row.kind === 'late') return onToggleSection(hit.row.kind)
    if (readOnly) return
    if (hit.min == null || isPastSlot(day, hit.min)) return
    e.preventDefault()
    setDrag({ day, anchor: hit.min, current: hit.min, additive: e.ctrlKey || e.metaKey || e.shiftKey })
  }

  const liveSelections = useMemo(() => {
    if (!drag) return selections
    return merge({ day: drag.day, ...clampRange(drag.day, drag.anchor, drag.current) }, drag.additive)
  }, [drag, selections, clampRange, merge])

  // Pop the selection when it's first drawn.
  const selectionKey = liveSelections.map((s) => `${s.day}:${s.startMin}`).join(',')
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
    return (eventsByDay.get(day) ?? []).flatMap(piecesOf).filter((p) => p.startMin < b && a < p.endMin).length
  }
  const nowInGrid = now.min >= grid.START && now.min < grid.END

  return (
    <div ref={cardRef} className="wc-card relative overflow-hidden rounded-3xl border border-border bg-card shadow-[0_24px_60px_-34px_rgba(15,23,42,0.45)]">
      {/* One day at a time on a narrow screen: pick it here. */}
      {narrow && (
        <div className="grid grid-cols-7 gap-1 border-b border-border p-1.5">
          {week.days.map((day) => {
            const count = (eventsByDay.get(day) ?? []).length
            const on = day === shownDay
            return (
              <button
                key={day}
                type="button"
                onClick={() => setFocusDay(day)}
                className={cn(
                  'flex flex-col items-center rounded-xl py-1.5 transition-colors',
                  on ? 'wc-today-pill text-white' : day === week.today ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary'
                )}
              >
                <span className="text-[9.5px] font-black tracking-wider">{dowShort(day).slice(0, 3)}</span>
                <span className="text-sm leading-tight font-bold tabular-nums">{Number(day.slice(8))}</span>
                <span className={cn('mt-0.5 size-1 rounded-full', count ? (on ? 'bg-white' : 'bg-primary') : 'bg-transparent')} />
              </button>
            )
          })}
        </div>
      )}

      {/* …and its holiday / leave note, which the strip has no room for. */}
      {narrow && (holidayByDay.get(shownDay) || leave.has(shownDay)) && (
        <div className="flex flex-wrap justify-center gap-1 border-b border-border px-2 py-1.5">
          {holidayByDay.get(shownDay) && (
            <span className="truncate rounded-full bg-amber-500/15 px-2 text-[10px] font-bold text-amber-700 dark:text-amber-300">{holidayByDay.get(shownDay)!.label}</span>
          )}
          {leave.has(shownDay) && <span className="rounded-full bg-rose-500/15 px-2 text-[10px] font-bold text-rose-600 dark:text-rose-300">On leave</span>}
        </div>
      )}

      <div className="max-h-[calc(100vh-15rem)] min-h-[420px] overflow-x-hidden overflow-y-auto overscroll-contain">
        {/* Header — the strip above does this job on a narrow screen */}
        <div className={cn('sticky top-0 z-30 grid border-b border-border bg-card/95 backdrop-blur', narrow && 'hidden')} style={{ gridTemplateColumns: columns }}>
          <div className="flex min-w-0 flex-col justify-center border-r border-border px-2 py-2">
            <span className="truncate text-[10px] font-black tracking-wider text-muted-foreground uppercase">{week.person.name.split(' ')[0]}</span>
            <span className="text-[10px] text-muted-foreground/70">IST</span>
          </div>
          {days.map((day) => {
            const isToday = day === week.today
            const holiday = holidayByDay.get(day)
            return (
              <div key={day} className={cn('relative min-w-0 border-r border-border/60 px-1 py-2 text-center last:border-r-0', day < week.today && 'opacity-55')}>
                <p className={cn('text-[11px] font-black tracking-[0.14em]', isToday ? 'text-primary' : 'text-muted-foreground')}>{dowShort(day)}</p>
                <p
                  className={cn(
                    'mx-auto mt-0.5 w-fit rounded-full px-2 py-0.5 font-bold tabular-nums',
                    tight && !narrow ? 'text-xs' : 'text-sm',
                    isToday ? 'wc-today-pill text-white' : 'text-foreground'
                  )}
                >
                  {tight && !narrow ? ddmmyy(day).slice(0, 5) : ddmmyy(day)}
                </p>
                <div className="mt-1 flex min-h-4 flex-wrap justify-center gap-1">
                  {holiday && (
                    <span className="max-w-full truncate rounded-full bg-amber-500/15 px-1.5 text-[9.5px] font-bold text-amber-700 dark:text-amber-300" title={holiday.label}>
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
        <div ref={bodyRef} className="relative grid" style={{ gridTemplateColumns: columns, height }}>
          {/* Time gutter */}
          <div className="relative border-r border-border">
            {rows.map((row) => (
              <div
                key={row.start}
                className={cn(
                  'absolute inset-x-0 flex flex-col justify-center border-b border-border/50 px-2',
                  row.lunch && 'wc-lunch-gutter',
                  (row.kind === 'early' || row.kind === 'late') && 'cursor-pointer hover:bg-secondary/60'
                )}
                style={{ top: row.top, height: row.h }}
                onClick={() => (row.kind === 'early' || row.kind === 'late') && onToggleSection(row.kind)}
              >
                <span className="flex items-baseline gap-0.5 text-[12px] leading-none font-bold whitespace-nowrap text-foreground tabular-nums">
                  {row.lunch && <Utensils className="size-2.5 shrink-0 self-center text-amber-600 dark:text-amber-300" />}
                  {fmtMin(row.start, false)}
                  {!narrow && <span className="text-[9px] font-semibold text-muted-foreground">{row.start < 720 ? 'am' : 'pm'}</span>}
                </span>
                <span className="mt-0.5 flex items-center gap-0.5 text-[10px] whitespace-nowrap text-muted-foreground tabular-nums">
                  – {fmtMin(row.end, false)}
                  {row.kind !== 'slot' && <ChevronDown className="size-3" />}
                </span>
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
            {days.includes(now.day) && nowInGrid && (
              <span
                className="absolute right-0.5 z-20 -translate-y-1/2 rounded-full bg-rose-500 px-1 py-0.5 text-[9px] font-bold whitespace-nowrap text-white tabular-nums shadow"
                style={{ top: yOf(rows, now.min) }}
              >
                {fmtMin(now.min, !narrow)}
              </span>
            )}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const past = day < now.day
            const placed = layoutLanes((eventsByDay.get(day) ?? []).flatMap(piecesOf))
            const daySelections = liveSelections.filter((s) => s.day === day)
            const firstLunch = rows.find((r) => r.lunch)
            return (
              <div
                key={day}
                data-day={day}
                ref={(el) => {
                  columnRefs.current[day] = el
                }}
                className={cn(
                  'relative min-w-0 border-r border-border/60 last:border-r-0',
                  day === now.day && 'wc-today-col',
                  past && 'wc-past',
                  leave.has(day) && 'wc-leave',
                  !readOnly && !past && 'cursor-cell'
                )}
                onPointerDown={(e) => startDrag(e, day)}
              >
                {rows.map((row) => {
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
                        row.lunch && 'wc-lunch-slot',
                        pastSlot ? 'wc-slot-past' : !readOnly && 'wc-slot'
                      )}
                      style={{ top: row.top, height: row.h }}
                    />
                  )
                })}

                {/* Lunch is marked, not blocked. */}
                {firstLunch && (
                  <span
                    className="pointer-events-none absolute inset-x-0 z-0 text-center text-[9.5px] font-black tracking-[0.18em] text-amber-700/60 dark:text-amber-300/60"
                    style={{ top: firstLunch.top + 4 }}
                  >
                    LUNCH
                  </span>
                )}

                {/* Selections */}
                {daySelections.map((selection) => {
                  const clash = (eventsByDay.get(day) ?? [])
                    .filter(holdsTime)
                    .flatMap(piecesOf)
                    .some((p) => p.startMin < selection.endMin && selection.startMin < p.endMin)
                  const top = yOf(rows, selection.startMin)
                  const h = yOf(rows, selection.endMin) - top
                  return (
                    <div
                      key={`${selection.startMin}`}
                      className={cn('wc-selection pointer-events-none absolute inset-x-1 z-20 rounded-xl', clash && 'wc-selection-clash')}
                      style={{ top: top + 1, height: h - 2 }}
                    >
                      <span className="absolute top-1.5 left-1.5 max-w-[calc(100%-12px)] truncate rounded-md bg-white/85 px-1.5 py-0.5 text-[10px] font-bold text-primary shadow-sm dark:bg-black/50 dark:text-white">
                        {fmtRange(selection.startMin, selection.endMin)}
                      </span>
                    </div>
                  )
                })}

                {/* Blocks */}
                {placed.map(({ piece, lane, lanes }) => {
                  const top = yOf(rows, piece.startMin)
                  const h = Math.max(22, yOf(rows, piece.endMin) - top)
                  return (
                    <EventBlock
                      key={piece.key}
                      piece={piece}
                      rows={rows}
                      own={!readOnly}
                      roomy={!tight}
                      style={{ top: top + 2, height: h - 4, left: `calc(${(lane / lanes) * 100}% + 3px)`, width: `calc(${100 / lanes}% - 6px)` }}
                      height={h - 4}
                      active={openEventId === piece.event._id}
                      onOpen={() => !piece.event.busy && onOpenEvent(piece.event._id)}
                    />
                  )
                })}

                {/* Now line */}
                {day === now.day && nowInGrid && (
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
  )
}

function EventBlock({
  piece,
  rows,
  own,
  roomy,
  style,
  height,
  active,
  onOpen,
}: {
  piece: Piece
  rows: Row[]
  own: boolean
  roomy: boolean
  style: React.CSSProperties
  height: number
  active: boolean
  onOpen: () => void
}) {
  const { event } = piece
  const compact = height < 50
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
  // The meeting's slices, drawn inside the block (not on a guest's own slice).
  const slices = !piece.slice && height >= 40 ? (event.segments ?? []) : []
  const top0 = yOf(rows, event.startMin)

  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onOpen}
      title={`${event.title} · ${fmtRange(piece.startMin, piece.endMin)}${piece.slice ? (own ? ' · your slot' : ' · their slot') : ''}`}
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

      <div className={cn('relative flex h-full flex-col pr-1 pl-2', compact ? 'justify-center py-0.5' : 'py-1.5')}>
        <div className="flex min-w-0 items-center gap-1">
          {event.isPersonal && <Lock className="size-3 shrink-0" style={{ color: meta.ink }} />}
          {event.openForAll && <Megaphone className="size-3 shrink-0" style={{ color: meta.ink }} />}
          {!event.repeat && (event.seriesSize ?? 1) > 1 && <Repeat className="size-3 shrink-0 opacity-60" style={{ color: meta.ink }} />}
          <p className="truncate text-[12px] leading-tight font-bold dark:!text-foreground" style={{ color: meta.ink }}>
            {event.title}
          </p>
        </div>
        {!compact && (
          <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground tabular-nums">
            {fmtRange(piece.startMin, piece.endMin)}
            {event.location ? ` · ${event.location}` : ''}
          </p>
        )}
        {(piece.slice || event.repeat) && !compact && (
          <div className="mt-0.5 flex min-w-0 flex-wrap gap-1">
            {piece.slice && (
              <span className="rounded-full px-1.5 text-[9px] leading-[15px] font-black tracking-wide text-white uppercase" style={{ background: meta.from }}>
                {own ? 'Your slot' : 'Their slot'}
              </span>
            )}
            {event.repeat && (
              <span className="flex items-center gap-0.5 rounded-full bg-background/70 px-1.5 text-[9px] leading-[15px] font-bold text-muted-foreground">
                <Repeat className="size-2.5" />
                {REPEAT_SHORT[event.repeat.repeat]}
              </span>
            )}
          </div>
        )}
        {(tentative || open) && !compact && (
          <span
            className="mt-auto mb-0.5 w-fit max-w-full truncate rounded-full px-1.5 py-px text-[9.5px] font-black tracking-wide text-white uppercase"
            style={{ background: meta.from }}
          >
            {tentative ? 'Invite · respond' : 'Open · join'}
          </span>
        )}
        {!compact && !tentative && !open && !slices.length && going.length > 1 && height >= 80 && (
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

      {/* Each slice: a dashed line where it starts, and whose it is. */}
      {slices.map((s, i) => {
        const y = yOf(rows, s.startMin) - top0
        const h = yOf(rows, s.endMin) - yOf(rows, s.startMin)
        const atTop = s.startMin === event.startMin
        return (
          <span
            key={s._id ?? i}
            className="pointer-events-none absolute right-0 left-1 border-t border-dashed"
            style={{ top: y, height: h, borderColor: atTop ? 'transparent' : `color-mix(in oklch, ${meta.from} 50%, transparent)` }}
          >
            {roomy && h >= 16 && (s.user || s.label) && (
              <span
                className="absolute right-1 bottom-0.5 max-w-[60%] truncate rounded px-1 text-[9px] leading-3.25 font-bold text-white shadow-sm"
                style={{ background: s.user ? avatarGradient(s.user._id) : meta.from }}
              >
                {s.user ? s.user.name.split(' ')[0] : s.label}
              </span>
            )}
          </span>
        )
      })}
    </button>
  )
}
