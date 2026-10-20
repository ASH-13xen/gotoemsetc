import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, CalendarPlus, Copy, Link2, Loader2, Lock, MapPin, Megaphone, Plus, Repeat, Scissors, Send, Trash2, Users, Wand2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { Occurrence, Repeat as RepeatKind, SliceInput, WeekData, WeeklyCategory } from '@/api/weeklyCalendar.api'
import { useCalendarPeople, useCreateCalEvent } from '@/hooks/useWeeklyCalendar'
import {
  CATEGORY,
  CATEGORY_KEYS,
  PERSONAL,
  REPEAT_CHOICES,
  addDays,
  apiError,
  avatarGradient,
  dowShort,
  evenSlices,
  fmtDay,
  fmtMin,
  fmtRange,
  fmtWhen,
  gridTimes,
  namesShort,
  nowIst,
  overlaps,
  repeatDates,
  repeatLabel,
  repeatSkipNote,
} from './calendarUtils'
import { PeoplePicker } from './PeoplePicker'
import { SidePanel, Sec, Chip } from './SidePanel'

export type EventKind = 'meeting' | 'personal' | 'open'

// What "Duplicate" carries over from an existing event.
export interface CreatePrefill {
  title: string
  description: string
  category: WeeklyCategory
  kind: EventKind
  location: string
  link: string
  invitees: string[]
  slices: SliceInput[]
  from: string // the original's title, for the header
}

const SLICE_LENGTHS = [10, 15, 20, 30]
const byTime = (a: Occurrence, b: Occurrence) => a.day.localeCompare(b.day) || a.startMin - b.startMin

export function CreateEventPanel({
  week,
  viewerId,
  selections,
  onSelectionsChange,
  initialInvitees = [],
  prefill,
  onClose,
  onCreated,
}: {
  week: WeekData
  viewerId: string
  selections: Occurrence[]
  onSelectionsChange: (next: Occurrence[]) => void
  initialInvitees?: string[]
  prefill?: CreatePrefill | null
  onClose: () => void
  onCreated: (firstEventId: string | null) => void
}) {
  const create = useCreateCalEvent()
  const { data: peopleData } = useCalendarPeople()
  const [title, setTitle] = useState(prefill?.title ?? '')
  const [description, setDescription] = useState(prefill?.description ?? '')
  const [category, setCategory] = useState<WeeklyCategory>(prefill?.category ?? 'team')
  const [kind, setKind] = useState<EventKind>(prefill?.kind ?? 'meeting')
  const [location, setLocation] = useState(prefill?.location ?? '')
  const [link, setLink] = useState(prefill?.link ?? '')
  const [repeat, setRepeat] = useState<RepeatKind | 'none'>('none')
  const [invitees, setInvitees] = useState<string[]>(prefill?.invitees ?? initialInvitees)
  const [slices, setSlices] = useState<SliceInput[]>(prefill?.slices ?? [])
  const [splitting, setSplitting] = useState((prefill?.slices.length ?? 0) > 0)
  const [sliceLen, setSliceLen] = useState(15)

  const accent = kind === 'personal' ? PERSONAL : CATEGORY[category]
  const now = nowIst()
  const times = gridTimes(week.grid)
  const nameOf = (id: string) => (id === viewerId ? 'You' : (peopleData?.people.find((p) => p._id === id)?.name ?? 'Someone'))

  // ---- When ----
  const sorted = useMemo(() => [...selections].sort(byTime), [selections])
  const base = sorted[0]
  const sameTime = sorted.length > 0 && sorted.every((s) => s.startMin === base.startMin && s.endMin === base.endMin)
  const lengths = sorted.map((s) => s.endMin - s.startMin)
  const meetingLength = lengths.length && lengths.every((l) => l === lengths[0]) ? lengths[0] : null

  const replaceSlot = (i: number, next: Occurrence) => onSelectionsChange(sorted.map((s, j) => (j === i ? next : s)).sort(byTime))
  const removeSlot = (i: number) => onSelectionsChange(sorted.filter((_, j) => j !== i))
  const addSlot = () => {
    const last = sorted[sorted.length - 1]
    let next: Occurrence
    if (last) next = { day: addDays(last.day, 1), startMin: last.startMin, endMin: last.endMin }
    else {
      const start = times.find((m) => m > now.min && m + 30 <= week.grid.END)
      next = start != null ? { day: now.day, startMin: start, endMin: start + 30 } : { day: addDays(now.day, 1), startMin: 600, endMin: 630 }
    }
    onSelectionsChange([...sorted, next].sort(byTime))
  }
  const toggleDay = (day: string) => {
    if (!base) return
    const has = sorted.some((s) => s.day === day && s.startMin === base.startMin)
    if (has && sorted.length === 1) return
    onSelectionsChange(has ? sorted.filter((s) => !(s.day === day && s.startMin === base.startMin)) : [...sorted, { day, startMin: base.startMin, endMin: base.endMin }].sort(byTime))
  }

  const pastSlots = sorted.filter((s) => s.day < now.day || (s.day === now.day && s.endMin <= now.min))
  const overlapping = sorted.some((s, i) => i > 0 && overlaps(sorted[i - 1], s))
  const selfClashes = useMemo(
    () =>
      sorted.flatMap((s) =>
        week.events
          .filter((e) => e.myRole === 'host' || e.myRole === 'accepted')
          .filter((e) => (e.held?.length ? e.held : [e]).some((p) => overlaps({ day: e.day, ...p }, s)))
          .map((e) => `${e.title} (${fmtWhen(e)})`)
      ),
    [sorted, week.events]
  )

  // ---- Repeat ----
  const repeatDays = sorted.map((s) => s.day)
  const upcoming = useMemo(() => {
    if (repeat === 'none' || !sorted.length) return []
    return sorted
      .flatMap((s) => repeatDates(s.day, repeat, 4).map((day) => ({ ...s, day })))
      .sort(byTime)
      .slice(0, 4)
  }, [repeat, sorted])

  // ---- Slices ----
  const fitting = meetingLength ? slices.filter((s) => s.end <= meetingLength) : []
  const guests = kind === 'personal' ? [] : invitees
  // Cut the meeting into equal slices — keeping who had which, in order.
  const fillEven = (each: number, groups?: string[][]) => {
    if (!meetingLength) return
    setSliceLen(each)
    const cut = evenSlices(meetingLength, each)
    const who = groups ?? (slices.some((s) => s.users.length) ? slices.map((s) => s.users) : guests.map((g) => [g]))
    setSlices(cut.map((s, i) => ({ ...s, users: who[i] ?? [], label: slices[i]?.label ?? '' })))
  }
  const startSplit = () => {
    if (!meetingLength) return toast.info('Give every picked time the same length to split it')
    setSplitting(true)
    if (!slices.length) fillEven(sliceLen)
  }
  const setSlice = (i: number, patch: Partial<SliceInput>) => {
    const fresh = (patch.users ?? []).filter((u) => u !== viewerId && !invitees.includes(u))
    if (fresh.length) setInvitees([...invitees, ...fresh])
    setSlices(slices.map((s, j) => (j === i ? { ...s, ...patch } : s)).sort((a, b) => a.start - b.start))
  }
  // A new slice starts where the last one ends (leave a gap by changing its start).
  const addSlice = () => {
    if (!meetingLength) return
    const start = slices.length ? Math.max(...slices.map((s) => s.end)) : 0
    if (start + 5 > meetingLength) return toast.info('The slices already reach the end of the meeting')
    setSlices([...slices, { start, end: Math.min(start + sliceLen, meetingLength), users: [], label: '' }])
  }
  const sliceClash = fitting.some((s, i) => i > 0 && s.start < fitting[i - 1].end)
  // A guest with a slice only has to be free for their slice.
  const windowsFor = (id: string) => {
    const mine = fitting.filter((s) => s.users.includes(id))
    return mine.length ? sorted.flatMap((o) => mine.map((s) => ({ day: o.day, startMin: o.startMin + s.start, endMin: o.startMin + s.end }))) : undefined
  }

  const submit = async () => {
    if (!title.trim()) return toast.error('Give it a title')
    if (!sorted.length) return toast.error('Pick a time — drag on the calendar or add a slot')
    if (pastSlots.length) return toast.error(`${fmtWhen(pastSlots[0])} has already passed`)
    if (overlapping) return toast.error('Two of the picked times overlap')
    if (repeat !== 'none' && sorted.length > 7) return toast.error('A repeating event can have up to 7 times')
    if (splitting && sliceClash) return toast.error('Two slices overlap — change one of their times')
    try {
      const result = await create.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        isPersonal: kind === 'personal',
        openForAll: kind === 'open',
        location: location.trim() || undefined,
        link: link.trim() || undefined,
        slots: sorted,
        repeat,
        invitees: kind === 'personal' ? [] : invitees,
        slices: kind !== 'personal' && splitting ? fitting.map((s) => ({ start: s.start, end: s.end, label: s.label?.trim() || undefined, users: s.users.filter(Boolean) })) : [],
      })
      const invited = kind === 'personal' ? 0 : invitees.length
      toast.success(
        `${kind === 'personal' ? 'Time blocked' : 'Created'}${repeat !== 'none' ? ` · ${repeatLabel(repeat, repeatDays).toLowerCase()}` : result.count > 1 ? ` on ${result.count} dates` : ''}${
          invited ? ` · ${invited} invite${invited === 1 ? '' : 's'} sent` : ''
        }`
      )
      result.skipped.slice(0, 3).forEach((s) => toast.warning(s))
      if (result.skipped.length > 3) toast.warning(`…and ${result.skipped.length - 3} more`)
      onCreated(result.events[0]?._id ?? null)
    } catch (err) {
      toast.error(apiError(err, 'Could not create it'))
    }
  }

  const everyoneElse = (peopleData?.people ?? []).filter((p) => p._id !== viewerId && !invitees.includes(p._id))

  return (
    <SidePanel
      panelKey={prefill ? `dup-${prefill.from}` : 'create'}
      accent={accent}
      eyebrow={
        <>
          <Chip style={{ background: `linear-gradient(90deg, ${accent.from}, ${accent.to})` }}>{prefill ? 'Duplicate' : kind === 'personal' ? 'Personal block' : 'New event'}</Chip>
          <span className="text-[11px] font-semibold text-muted-foreground">
            {repeat !== 'none' ? (
              <span className="flex items-center gap-1">
                <Repeat className="size-3" /> {repeatLabel(repeat, repeatDays)}
              </span>
            ) : (
              `${sorted.length} ${sorted.length === 1 ? 'time' : 'times'}`
            )}
          </span>
        </>
      }
      title={
        <textarea
          autoFocus
          rows={1}
          value={title}
          // One line of text that wraps as it grows — never scrolls sideways.
          onChange={(e) => setTitle(e.target.value.replace(/\s*\n\s*/g, ' '))}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            if (e.metaKey || e.ctrlKey) submit()
          }}
          placeholder={kind === 'personal' ? 'e.g. Doctor appointment' : 'e.g. ALPHA TEAM MEETING'}
          className="block w-full resize-none overflow-hidden rounded-lg bg-transparent text-2xl leading-tight font-black tracking-tight break-words text-foreground outline-none [field-sizing:content] placeholder:text-muted-foreground/40"
          aria-label="Title"
        />
      }
      subtitle={
        prefill ? (
          <span className="flex items-center gap-1">
            <Copy className="size-3" /> A copy of “{prefill.from}” — pick where it goes.
          </span>
        ) : undefined
      }
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button className="ml-auto" onClick={submit} disabled={create.isPending || !sorted.length}>
            {create.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : kind !== 'personal' && invitees.length ? (
              <Send className="size-4" />
            ) : (
              <CalendarPlus className="size-4" />
            )}
            {kind === 'personal' ? 'Block time' : invitees.length ? `Create & invite ${invitees.length}` : 'Create'}
          </Button>
        </div>
      }
    >
      <Sec title={`When${sorted.length > 1 ? ` · ${sorted.length} times` : ''}`}>
        {sorted.length === 0 && (
          <p className="rounded-xl border border-dashed border-primary/40 bg-primary/4 px-3 py-2.5 text-xs text-muted-foreground">
            Drag on the calendar where it should go, or add a time below.
          </p>
        )}
        <div className="grid gap-1.5">
          {sorted.map((s, i) => (
            <SlotRow
              key={`${s.day}:${s.startMin}:${i}`}
              slot={s}
              times={times}
              end={week.grid.END}
              past={pastSlots.includes(s)}
              removable={sorted.length > 1}
              onChange={(next) => replaceSlot(i, next)}
              onRemove={() => removeSlot(i)}
            />
          ))}
        </div>
        <button type="button" onClick={addSlot} className="flex w-fit items-center gap-1 text-xs font-semibold text-primary hover:underline">
          <Plus className="size-3.5" /> Add another time
        </button>
        {sameTime && base && (
          <div>
            <p className="mb-1.5 text-[11px] text-muted-foreground">Same time ({fmtRange(base.startMin, base.endMin)}) this week on</p>
            <div className="flex gap-1">
              {week.days.map((day) => {
                const on = sorted.some((s) => s.day === day && s.startMin === base.startMin)
                const past = day < now.day || (day === now.day && base.endMin <= now.min)
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={past}
                    onClick={() => toggleDay(day)}
                    className={cn(
                      'flex-1 rounded-lg py-1.5 text-[10.5px] font-black tracking-wide transition-all',
                      on ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-secondary/60 text-muted-foreground hover:text-foreground',
                      past && 'opacity-35'
                    )}
                  >
                    {dowShort(day).slice(0, 2)}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="grid gap-1.5 rounded-2xl border border-border bg-secondary/25 p-2.5">
          <label className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Repeat className="size-3.5 text-muted-foreground" />
            Repeat
            <select
              value={repeat}
              onChange={(e) => setRepeat(e.target.value as RepeatKind | 'none')}
              className="ml-auto h-8 rounded-lg border border-border bg-background px-2 text-xs font-semibold text-foreground"
              aria-label="Repeat"
            >
              {REPEAT_CHOICES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          {repeat !== 'none' && sorted.length > 0 && (
            <div className="text-[11px] text-muted-foreground">
              <p className="font-semibold text-foreground">
                {repeatLabel(repeat, repeatDays)} · until you stop it
              </p>
              {repeatSkipNote(repeat, repeatDays) && <p className="mt-0.5 text-amber-700 dark:text-amber-300">{repeatSkipNote(repeat, repeatDays)}</p>}
              <p className="mt-0.5">Next: {upcoming.map((o) => fmtDay(o.day)).join(' · ')} …</p>
              <p className="mt-0.5">Stop it any time with “Cancel → this & all upcoming”.</p>
            </div>
          )}
        </div>
        {overlapping && (
          <p className="flex items-start gap-1.5 rounded-xl bg-rose-500/10 px-3 py-2 text-[11px] text-rose-700 dark:text-rose-300">
            <AlertTriangle className="mt-px size-3.5 shrink-0" /> Two of these times overlap.
          </p>
        )}
        {selfClashes.length > 0 && (
          <p className="flex items-start gap-1.5 rounded-xl bg-rose-500/10 px-3 py-2 text-[11px] text-rose-700 dark:text-rose-300">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            You're already in {selfClashes.join(', ')}.
          </p>
        )}
      </Sec>

      <Sec title="Type">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-secondary/60 p-1">
          {(
            [
              { key: 'meeting', label: 'Meeting', icon: Users },
              { key: 'open', label: 'Open for all', icon: Megaphone },
              { key: 'personal', label: 'Personal', icon: Lock },
            ] as const
          ).map((k) => (
            <button
              key={k.key}
              type="button"
              onClick={() => setKind(k.key)}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all',
                kind === k.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <k.icon className="size-3.5" />
              {k.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {kind === 'personal'
            ? 'Only you (and admin) see what this is — everyone else just sees "Busy".'
            : kind === 'open'
              ? 'Shows on everyone’s calendar — anyone can join with one click. You can still invite people.'
              : 'Invite the people who should be there; it’s blocked for each of them once they accept.'}
        </p>
        {kind !== 'personal' && (
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all',
                  category === key ? 'border-transparent text-white shadow-sm' : 'border-border text-muted-foreground hover:text-foreground'
                )}
                style={category === key ? { background: `linear-gradient(90deg, ${CATEGORY[key].from}, ${CATEGORY[key].to})` } : undefined}
              >
                {category !== key && <span className="size-2 rounded-full" style={{ background: CATEGORY[key].from }} />}
                {CATEGORY[key].label}
              </button>
            ))}
          </div>
        )}
      </Sec>

      <Sec title="Details">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Agenda or notes (optional)" rows={3} className="text-sm" />
        <div className="relative">
          <MapPin className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where — e.g. Conference room" className="h-9 pl-8 text-sm" />
        </div>
        <div className="relative">
          <Link2 className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Meeting link (optional)" className="h-9 pl-8 text-sm" />
        </div>
      </Sec>

      {kind !== 'personal' && (
        <Sec title={`Invite people${invitees.length ? ` · ${invitees.length}` : ''}`}>
          <PeoplePicker occurrences={sorted} selected={invitees} onChange={setInvitees} exclude={[viewerId]} windowsFor={windowsFor} />
          <p className="text-[11px] text-muted-foreground">
            Everyone invited gets a notification here and an email from HR to accept or decline.
            {repeat !== 'none' && ' Anyone busy on a later date just isn’t invited to that one.'}
          </p>
        </Sec>
      )}

      {kind !== 'personal' && (
        <Sec
          title={`Time slices${splitting && fitting.length ? ` · ${fitting.length}` : ''}`}
          action={
            splitting ? (
              <button type="button" onClick={() => (setSplitting(false), setSlices([]))} className="text-xs font-semibold text-muted-foreground hover:text-rose-600">
                Don't split
              </button>
            ) : null
          }
        >
          {!splitting ? (
            <>
              <p className="text-[11px] text-muted-foreground">
                Give each person their own part of the meeting — like 15 minutes each. Someone with a slice is only blocked for their slice.
              </p>
              <Button size="sm" variant="outline" className="w-fit" onClick={startSplit} disabled={!sorted.length}>
                <Scissors className="size-3.5" /> Split into slices
              </Button>
            </>
          ) : !meetingLength ? (
            <p className="text-[11px] text-amber-700 dark:text-amber-300">Give every picked time the same length to split it.</p>
          ) : (
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground">Each</span>
                {SLICE_LENGTHS.filter((l) => l < meetingLength || l === meetingLength).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => fillEven(l)}
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-[11px] font-bold transition-colors',
                      sliceLen === l ? 'border-transparent bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {l} min
                  </button>
                ))}
                <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  or
                  <input
                    type="number"
                    min={5}
                    max={meetingLength}
                    step={5}
                    value={sliceLen}
                    onChange={(e) => setSliceLen(Math.max(5, Math.min(meetingLength, Number(e.target.value) || 5)))}
                    onBlur={() => fillEven(sliceLen)}
                    className="h-6 w-14 rounded-md border border-border bg-background px-1.5 text-[11px] font-semibold text-foreground"
                    aria-label="Minutes per slice"
                  />
                  min
                </label>
                <button
                  type="button"
                  onClick={() => fillEven(sliceLen, guests.map((g) => [g]))}
                  disabled={!guests.length}
                  className="ml-auto flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary disabled:opacity-40"
                  title={guests.length ? 'Hand the slices to the invited people, in order' : 'Invite people first'}
                >
                  <Wand2 className="size-3" /> Fill from guests
                </button>
              </div>

              <SliceBar slices={fitting} length={meetingLength} nameOf={nameOf} />

              <div className="grid gap-1">
                {slices.map((s, i) => {
                  const out = s.end > meetingLength
                  const clash = i > 0 && s.start < slices[i - 1].end
                  const gap = i > 0 && s.start > slices[i - 1].end ? s.start - slices[i - 1].end : 0
                  return (
                    <div key={i} className="grid gap-1">
                      {gap > 0 && <p className="pl-2 text-[10.5px] text-muted-foreground italic">{gap} min free</p>}
                      <SliceRow
                        startMin={base?.startMin ?? 0}
                        length={meetingLength}
                        slice={s}
                        dim={out}
                        clash={clash}
                        viewerId={viewerId}
                        members={invitees}
                        others={everyoneElse}
                        nameOf={nameOf}
                        onChange={(patch) => setSlice(i, patch)}
                        onRemove={() => setSlices(slices.filter((_, j) => j !== i))}
                      />
                    </div>
                  )
                })}
              </div>
              {sliceClash && <p className="text-[11px] font-semibold text-rose-600">Two slices overlap — change one of their times.</p>}
              <button type="button" onClick={addSlice} className="flex w-fit items-center gap-1 text-xs font-semibold text-primary hover:underline">
                <Plus className="size-3.5" /> Add slice
              </button>
              <p className="text-[11px] text-muted-foreground">
                Slices can be different lengths and leave free minutes in between; a slice can be for several people. The same split is used on every date
                {repeat !== 'none' ? ' it repeats' : ''}, and you can change it later from the event.
              </p>
            </div>
          )}
        </Sec>
      )}
    </SidePanel>
  )
}

// One picked time: its date and hours, editable here as well as on the grid.
function SlotRow({
  slot,
  times,
  end,
  past,
  removable,
  onChange,
  onRemove,
}: {
  slot: Occurrence
  times: number[]
  end: number
  past: boolean
  removable: boolean
  onChange: (next: Occurrence) => void
  onRemove: () => void
}) {
  const ends = [...times.slice(1), end].filter((m) => m > slot.startMin)
  return (
    <div className={cn('grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-1 rounded-xl border bg-secondary/40 p-1', past ? 'border-rose-500/50' : 'border-border')}>
      <input
        type="date"
        value={slot.day}
        min={nowIst().day}
        onChange={(e) => e.target.value && onChange({ ...slot, day: e.target.value })}
        className="h-8 min-w-0 rounded-lg border border-border bg-background px-1.5 text-xs font-semibold"
        aria-label="Date"
      />
      <select
        value={slot.startMin}
        onChange={(e) => {
          const start = Number(e.target.value)
          const length = slot.endMin - slot.startMin
          onChange({ ...slot, startMin: start, endMin: Math.min(start + length, end) })
        }}
        className="h-8 min-w-0 rounded-lg border border-border bg-background px-1 text-xs"
        aria-label="Starts"
      >
        {times.map((m) => (
          <option key={m} value={m}>
            {fmtMin(m)}
          </option>
        ))}
      </select>
      <select
        value={slot.endMin}
        onChange={(e) => onChange({ ...slot, endMin: Number(e.target.value) })}
        className="h-8 min-w-0 rounded-lg border border-border bg-background px-1 text-xs"
        aria-label="Ends"
      >
        {ends.map((m) => (
          <option key={m} value={m}>
            {fmtMin(m)}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onRemove}
        disabled={!removable}
        className="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-30"
        aria-label="Remove this time"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

// The meeting as a bar, cut into its slices — who gets which part at a
// glance. Free minutes between slices show as gaps.
export function SliceBar({ slices, length, nameOf }: { slices: SliceInput[]; length: number; nameOf: (id: string) => string }) {
  if (!slices.length || !length) return null
  return (
    <div className="relative flex h-7 overflow-hidden rounded-lg border border-dashed border-border bg-secondary/30">
      {slices.map((s, i) => {
        const names = s.users.map(nameOf)
        return (
          <span
            key={i}
            className="absolute inset-y-0 flex items-center justify-center overflow-hidden border-x border-background text-[9.5px] font-bold text-white"
            style={{
              left: `${(s.start / length) * 100}%`,
              width: `${((s.end - s.start) / length) * 100}%`,
              background: s.users[0] ? avatarGradient(s.users[0]) : 'color-mix(in oklch, var(--muted-foreground) 45%, transparent)',
            }}
            title={`${s.end - s.start} min${names.length ? ` · ${names.join(', ')}` : ''}${s.label ? ` · ${s.label}` : ''}`}
          >
            <span className="truncate px-0.5">{names.length ? namesShort(names) : s.label || '—'}</span>
          </span>
        )
      })}
    </div>
  )
}

// One slice while creating: its own start and end (any length, in 5-minute
// steps), who it's for — any number of people — and a topic.
function SliceRow({
  startMin,
  length,
  slice,
  dim,
  clash,
  viewerId,
  members,
  others,
  nameOf,
  onChange,
  onRemove,
}: {
  startMin: number
  length: number
  slice: SliceInput
  dim: boolean
  clash: boolean
  viewerId: string
  members: string[]
  others: { _id: string; name: string }[]
  nameOf: (id: string) => string
  onChange: (patch: Partial<SliceInput>) => void
  onRemove: () => void
}) {
  const offsets = Array.from({ length: length / 5 + 1 }, (_, i) => i * 5)
  return (
    <div className={cn('grid gap-1.5 rounded-xl border p-1.5', clash ? 'border-rose-500/60 bg-rose-500/5' : 'border-border', dim && 'opacity-45')}>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] items-center gap-1">
        <select
          value={slice.start}
          onChange={(e) => {
            const start = Number(e.target.value)
            onChange({ start, end: Math.max(slice.end, start + 5) })
          }}
          className="h-8 min-w-0 rounded-lg border border-border bg-background px-1 text-xs font-semibold"
          aria-label="Slice starts"
        >
          {offsets.slice(0, -1).map((o) => (
            <option key={o} value={o}>
              {fmtMin(startMin + o)}
            </option>
          ))}
        </select>
        <select
          value={slice.end}
          onChange={(e) => onChange({ end: Number(e.target.value) })}
          className="h-8 min-w-0 rounded-lg border border-border bg-background px-1 text-xs font-semibold"
          aria-label="Slice ends"
        >
          {offsets
            .filter((o) => o > slice.start)
            .map((o) => (
              <option key={o} value={o}>
                {fmtMin(startMin + o)}
              </option>
            ))}
        </select>
        <span className="w-12 text-center text-[10.5px] font-bold text-primary tabular-nums">{slice.end - slice.start} min</span>
        <button type="button" onClick={onRemove} className="rounded-lg p-1.5 text-muted-foreground hover:text-rose-600" aria-label="Remove slice">
          <Trash2 className="size-3.5" />
        </button>
      </div>
      <SlicePeople value={slice.users} onChange={(users) => onChange({ users })} viewerId={viewerId} members={members} others={others} nameOf={nameOf} />
      <input
        value={slice.label ?? ''}
        onChange={(e) => onChange({ label: e.target.value })}
        placeholder="Topic (optional)"
        className="h-7 rounded-lg border border-border bg-background px-2 text-xs"
      />
    </div>
  )
}

// Who a slice is for: chips, plus a picker to add more — people in the
// meeting first, then anyone else (picking them invites them too).
export function SlicePeople({
  value,
  onChange,
  viewerId,
  members,
  others = [],
  nameOf,
}: {
  value: string[]
  onChange: (users: string[]) => void
  viewerId: string
  members: string[]
  others?: { _id: string; name: string }[]
  nameOf: (id: string) => string
}) {
  const inMeeting = [viewerId, ...members.filter((m) => m !== viewerId)].filter((id) => !value.includes(id))
  const rest = others.filter((p) => !value.includes(p._id) && !members.includes(p._id) && p._id !== viewerId)
  return (
    <div className="flex flex-wrap items-center gap-1">
      {value.map((id) => (
        <span key={id} className="flex items-center gap-1 rounded-full border border-border bg-secondary/60 py-0.5 pr-1 pl-0.5 text-[11px] font-semibold">
          <span className="size-4 rounded-full" style={{ background: avatarGradient(id) }} />
          {id === viewerId ? 'You' : nameOf(id).split(' ')[0]}
          <button type="button" onClick={() => onChange(value.filter((v) => v !== id))} className="rounded-full p-0.5 text-muted-foreground hover:text-foreground" aria-label={`Take ${nameOf(id)} off this slice`}>
            <X className="size-2.5" />
          </button>
        </span>
      ))}
      <select
        value=""
        onChange={(e) => e.target.value && onChange([...value, e.target.value])}
        className="h-7 min-w-0 flex-1 rounded-lg border border-dashed border-border bg-background px-1.5 text-[11px] text-muted-foreground"
        aria-label="Add a person to this slice"
      >
        <option value="">{value.length ? '+ Add another person' : '+ Who is this slice for? (optional)'}</option>
        {inMeeting.map((id) => (
          <option key={id} value={id}>
            {id === viewerId ? 'You' : nameOf(id)}
          </option>
        ))}
        {rest.length > 0 && (
          <optgroup label="Invite someone else">
            {rest.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  )
}
