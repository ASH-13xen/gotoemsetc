import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Check, Loader2, MailX, Plus, Search, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { CalPerson, Occurrence } from '@/api/weeklyCalendar.api'
import { useBusyWeeks, useCalendarPeople } from '@/hooks/useWeeklyCalendar'
import { availabilityFor, avatarGradient, fmtWhen, initialsOf, weeksOf, type Availability } from './calendarUtils'

export function Avatar({ person, size = 'size-7', className }: { person: Pick<CalPerson, '_id' | 'name'>; size?: string; className?: string }) {
  return (
    <span
      title={person.name}
      className={cn('flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white', size, className)}
      style={{ background: avatarGradient(person._id) }}
    >
      {initialsOf(person)}
    </span>
  )
}

function statusText(a: Availability) {
  if (a.state === 'free') return 'Free'
  if (a.state === 'tentative') return a.title ? `Free · invited to ${a.title}` : 'Free · has a pending invite'
  if (a.state === 'leave') return `On leave · ${fmtWhen(a.when)}`
  return a.title ? `Busy · ${a.title}` : `Busy · ${fmtWhen(a.when)}`
}

// Pick people for a meeting. Only people free for every chosen slot can be
// picked — anyone busy (or on leave) is shown, greyed out, with why.
export function PeoplePicker({
  occurrences,
  selected,
  onChange,
  exclude = [],
  ignoreEventId,
}: {
  occurrences: Occurrence[]
  selected: string[]
  onChange: (ids: string[]) => void
  exclude?: string[]
  ignoreEventId?: string
}) {
  const { data } = useCalendarPeople()
  const weeks = useMemo(() => weeksOf(occurrences), [occurrences])
  const { busy, isLoading } = useBusyWeeks(weeks, undefined, occurrences.length > 0)
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const skip = new Set(exclude)
    const q = query.trim().toLowerCase()
    return (data?.people ?? [])
      .filter((p) => !skip.has(p._id))
      .filter((p) => !q || `${p.name} ${p.subtitle}`.toLowerCase().includes(q))
      .map((p) => ({ person: p, availability: availabilityFor(busy[p._id], occurrences, ignoreEventId) }))
      .sort((a, b) => {
        const rank = (x: Availability) => (x.state === 'free' ? 0 : x.state === 'tentative' ? 1 : 2)
        return rank(a.availability) - rank(b.availability) || a.person.name.localeCompare(b.person.name)
      })
  }, [data, busy, occurrences, exclude, query, ignoreEventId])

  const byId = useMemo(() => new Map(rows.map((r) => [r.person._id, r])), [rows])
  const selectedSet = new Set(selected)
  const freeCount = rows.filter((r) => r.availability.state === 'free' || r.availability.state === 'tentative').length

  const toggle = (id: string) => onChange(selectedSet.has(id) ? selected.filter((s) => s !== id) : [...selected, id])

  const addGroup = (userIds: string[], label: string) => {
    const skip = new Set(exclude)
    const candidates = userIds.filter((id) => !skip.has(id) && !selectedSet.has(id))
    const free = candidates.filter((id) => {
      const r = byId.get(id) ?? { availability: availabilityFor(busy[id], occurrences, ignoreEventId) }
      return r.availability.state === 'free' || r.availability.state === 'tentative'
    })
    const busyCount = candidates.length - free.length
    if (!free.length) return toast.info(busyCount ? `Everyone in ${label} is busy then` : `${label}: everyone is already added`)
    onChange([...selected, ...free])
    toast.success(`Added ${free.length} from ${label}${busyCount ? ` · ${busyCount} busy, skipped` : ''}`)
  }

  return (
    <div className="grid gap-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((id) => {
            const person = byId.get(id)?.person ?? data?.people.find((p) => p._id === id)
            if (!person) return null
            return (
              <span key={id} className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 py-0.5 pr-1 pl-0.5 text-xs font-semibold">
                <Avatar person={person} size="size-5" className="text-[8px]" />
                {person.name.split(' ')[0]}
                <button type="button" onClick={() => toggle(id)} className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground" aria-label={`Remove ${person.name}`}>
                  <X className="size-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}

      {data?.groups && data.groups.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.groups.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => addGroup(g.userIds, g.label)}
              className="flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Plus className="size-3" />
              {g.label}
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people…"
          className="h-9 w-full rounded-xl border border-border bg-background pr-3 pl-8 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        {isLoading && <Loader2 className="absolute top-1/2 right-3 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {freeCount} free for {occurrences.length === 1 ? 'this time' : `all ${occurrences.length} dates`} · busy people can't be invited
      </p>

      <div className="max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-border bg-background p-1">
        {rows.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">No one matches.</p>
        ) : (
          rows.map(({ person, availability }) => {
            const blocked = availability.state === 'busy' || availability.state === 'leave'
            const on = selectedSet.has(person._id)
            return (
              <button
                key={person._id}
                type="button"
                disabled={blocked}
                onClick={() => toggle(person._id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors',
                  blocked ? 'cursor-not-allowed opacity-50' : on ? 'bg-primary/10' : 'hover:bg-secondary'
                )}
              >
                <Avatar person={person} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 truncate text-sm font-medium text-foreground">
                    {person.name}
                    {!person.hasEmail && <MailX className="size-3 shrink-0 text-muted-foreground" aria-label="No company mail on file — in-app invite only" />}
                  </span>
                  <span
                    className={cn(
                      'block truncate text-[11px]',
                      availability.state === 'free' && 'text-emerald-600 dark:text-emerald-400',
                      availability.state === 'tentative' && 'text-amber-600 dark:text-amber-400',
                      blocked && 'text-rose-600 dark:text-rose-400'
                    )}
                  >
                    {statusText(availability)}
                    <span className="text-muted-foreground"> · {person.subtitle}</span>
                  </span>
                </span>
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                    on ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                  )}
                >
                  {on && <Check className="size-3.5" />}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
