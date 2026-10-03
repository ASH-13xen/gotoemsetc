import { useMemo, useState } from 'react'
import { Check, Loader2, Search, Sparkles } from 'lucide-react'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Occurrence, WeekData } from '@/api/weeklyCalendar.api'
import { useBusyWeeks, useCalendarPeople } from '@/hooks/useWeeklyCalendar'
import { ddmmyy, dowShort, fmtMin, fmtRange, nowIst, overlaps } from './calendarUtils'
import { Avatar } from './PeoplePicker'

const DURATIONS = [30, 60, 90, 120]

// Pick people and a length; the week lights up where everyone is free.
// Click a time to start a meeting there with those people already invited.
export function FindTimeDialog({
  open,
  onOpenChange,
  week,
  viewerId,
  onPick,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  week: WeekData
  viewerId: string
  onPick: (slot: Occurrence, invitees: string[]) => void
}) {
  const { data } = useCalendarPeople()
  const [picked, setPicked] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [duration, setDuration] = useState(60)
  const everyone = useMemo(() => [viewerId, ...picked], [viewerId, picked])
  const { busy, isLoading } = useBusyWeeks([week.start], everyone, open && picked.length > 0)
  const g = week.grid
  const now = nowIst()

  const people = (data?.people ?? []).filter((p) => p._id !== viewerId && (!query.trim() || p.name.toLowerCase().includes(query.trim().toLowerCase())))
  const nameOf = (id: string) => (id === viewerId ? 'You' : data?.people.find((p) => p._id === id)?.name.split(' ')[0] ?? '—')

  const starts = useMemo(() => {
    const out: number[] = []
    for (let m = g.START; m + duration <= g.END; m += g.SLOT) {
      if (m < g.LUNCH_END && g.LUNCH_START < m + duration) continue
      out.push(m)
    }
    return out
  }, [g, duration])

  const cell = (day: string, start: number) => {
    const slot = { day, startMin: start, endMin: start + duration }
    if (day < now.day || (day === now.day && start <= now.min)) return { past: true, busyIds: [] as string[], slot }
    const busyIds = everyone.filter((id) => (busy[id] ?? []).some((b) => b.kind !== 'tentative' && overlaps(b, slot)))
    return { past: false, busyIds, slot }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden p-0 sm:max-w-5xl">
        <div className="grid max-h-[92vh] grid-cols-1 md:grid-cols-[280px_1fr]">
          <div className="border-b border-border p-5 md:border-r md:border-b-0">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-black">
                <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white">
                  <Sparkles className="size-4" />
                </span>
                Find a time
              </DialogTitle>
              <DialogDescription>Pick who needs to be there — green means everyone's free.</DialogDescription>
            </DialogHeader>
            <div className="mt-4 flex gap-1 rounded-xl bg-secondary/60 p-1">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={cn('flex-1 rounded-lg py-1 text-xs font-bold transition-all', duration === d ? 'bg-card shadow-sm' : 'text-muted-foreground')}
                >
                  {d < 60 ? `${d}m` : `${d / 60}h`}
                </button>
              ))}
            </div>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people…"
                className="h-9 w-full rounded-xl border border-border bg-background pr-3 pl-8 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="mt-2 max-h-[46vh] overflow-y-auto pr-1">
              {people.map((p) => {
                const on = picked.includes(p._id)
                return (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => setPicked(on ? picked.filter((x) => x !== p._id) : [...picked, p._id])}
                    className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left', on ? 'bg-primary/10' : 'hover:bg-secondary')}
                  >
                    <Avatar person={p} size="size-6" className="text-[9px]" />
                    <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                    {on && <Check className="size-3.5 text-primary" />}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="overflow-auto p-4">
            {picked.length === 0 ? (
              <div className="flex h-full min-h-60 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                <Sparkles className="size-8 opacity-40" />
                <p className="text-sm">Pick at least one person on the left.</p>
              </div>
            ) : (
              <>
                <div className="mb-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                  {isLoading && <Loader2 className="size-3.5 animate-spin" />}
                  <span className="flex items-center gap-1">
                    <span className="size-3 rounded bg-emerald-500" /> Everyone free
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-3 rounded bg-amber-400" /> Some busy
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-3 rounded bg-rose-400/50" /> Mostly busy
                  </span>
                </div>
                <div className="grid grid-cols-[62px_repeat(7,minmax(58px,1fr))] gap-1">
                  <div />
                  {week.days.map((day) => (
                    <div key={day} className="pb-1 text-center">
                      <p className="text-[10px] font-black tracking-wider text-muted-foreground">{dowShort(day)}</p>
                      <p className="text-[11px] font-semibold tabular-nums">{ddmmyy(day)}</p>
                    </div>
                  ))}
                  {starts.map((start) => (
                    <FragmentRow key={start} start={start}>
                      {week.days.map((day) => {
                        const c = cell(day, start)
                        const freeShare = 1 - c.busyIds.length / everyone.length
                        const tone = c.past
                          ? 'bg-secondary/40'
                          : c.busyIds.length === 0
                            ? 'bg-emerald-500 text-white'
                            : freeShare >= 0.5
                              ? 'bg-amber-400 text-amber-950'
                              : 'bg-rose-400/50 text-rose-950 dark:text-rose-100'
                        return (
                          <button
                            key={day}
                            type="button"
                            disabled={c.past || c.busyIds.includes(viewerId)}
                            title={
                              c.past
                                ? 'Already passed'
                                : `${fmtRange(start, start + duration)}${c.busyIds.length ? ` — busy: ${c.busyIds.map(nameOf).join(', ')}` : ' — everyone free'}`
                            }
                            onClick={() => {
                              const free = picked.filter((id) => !c.busyIds.includes(id))
                              onPick(c.slot, free)
                            }}
                            className={cn('wc-heat-cell relative h-7 rounded-md text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-60', tone)}
                          >
                            {!c.past && c.busyIds.length > 0 && c.busyIds.length < everyone.length ? `${everyone.length - c.busyIds.length}/${everyone.length}` : ''}
                          </button>
                        )
                      })}
                    </FragmentRow>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Click a time to start a {duration}-minute meeting there — the people free at that time are invited for you.
                </p>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function FragmentRow({ start, children }: { start: number; children: React.ReactNode }) {
  return (
    <>
      <div className="flex h-7 items-center justify-end pr-1 text-[10.5px] font-semibold text-muted-foreground tabular-nums">{fmtMin(start)}</div>
      {children}
    </>
  )
}
