import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, CalendarPlus, Link2, Loader2, Lock, MapPin, Megaphone, Repeat, Send, Users, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { Occurrence, WeekData, WeeklyCategory } from '@/api/weeklyCalendar.api'
import { useCreateCalEvent } from '@/hooks/useWeeklyCalendar'
import { CATEGORY, CATEGORY_KEYS, PERSONAL, apiError, dowShort, expandRepeats, fmtRange, fmtWhen, nowIst, overlaps } from './calendarUtils'
import { PeoplePicker } from './PeoplePicker'
import { SidePanel, Sec, Chip } from './SidePanel'

const REPEAT_OPTIONS = [0, 1, 2, 3, 4, 6, 8, 12]

export function CreateEventPanel({
  week,
  viewerId,
  selections,
  onSelectionsChange,
  initialInvitees = [],
  onClose,
  onCreated,
}: {
  week: WeekData
  viewerId: string
  selections: Occurrence[]
  onSelectionsChange: (next: Occurrence[]) => void
  initialInvitees?: string[]
  onClose: () => void
  onCreated: (firstEventId: string | null) => void
}) {
  const create = useCreateCalEvent()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<WeeklyCategory>('team')
  const [kind, setKind] = useState<'meeting' | 'personal' | 'open'>('meeting')
  const [location, setLocation] = useState('')
  const [link, setLink] = useState('')
  const [repeatWeeks, setRepeatWeeks] = useState(0)
  const [invitees, setInvitees] = useState<string[]>(initialInvitees)

  const occurrences = useMemo(() => expandRepeats(selections, repeatWeeks), [selections, repeatWeeks])
  const accent = kind === 'personal' ? PERSONAL : CATEGORY[category]
  const now = nowIst()

  // Same time on other days of this week, in one tap.
  const base = selections[0]
  const sameTime = selections.every((s) => base && s.startMin === base.startMin && s.endMin === base.endMin)
  const toggleDay = (day: string) => {
    if (!base) return
    const has = selections.some((s) => s.day === day)
    if (has && selections.length === 1) return
    onSelectionsChange(
      has ? selections.filter((s) => s.day !== day) : [...selections, { day, startMin: base.startMin, endMin: base.endMin }].sort((a, b) => a.day.localeCompare(b.day))
    )
  }

  const selfClashes = useMemo(
    () =>
      selections.flatMap((s) =>
        week.events.filter((e) => (e.myRole === 'host' || e.myRole === 'accepted') && overlaps(e, s)).map((e) => `${e.title} (${fmtWhen(e)})`)
      ),
    [selections, week.events]
  )

  const submit = async () => {
    if (!title.trim()) return toast.error('Give it a title')
    try {
      const result = await create.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        isPersonal: kind === 'personal',
        openForAll: kind === 'open',
        location: location.trim() || undefined,
        link: link.trim() || undefined,
        slots: selections,
        repeatWeeks: repeatWeeks || undefined,
        invitees: kind === 'personal' ? [] : invitees,
      })
      const invited = kind === 'personal' ? 0 : invitees.length
      toast.success(
        `${kind === 'personal' ? 'Time blocked' : 'Created'}${result.count > 1 ? ` on ${result.count} dates` : ''}${invited ? ` · ${invited} invite${invited === 1 ? '' : 's'} sent` : ''}`
      )
      onCreated(result.events[0]?._id ?? null)
    } catch (err) {
      toast.error(apiError(err, 'Could not create it'))
    }
  }

  return (
    <SidePanel
      panelKey="create"
      accent={accent}
      eyebrow={
        <>
          <Chip style={{ background: `linear-gradient(90deg, ${accent.from}, ${accent.to})` }}>{kind === 'personal' ? 'Personal block' : 'New event'}</Chip>
          <span className="text-[11px] font-semibold text-muted-foreground">
            {occurrences.length} {occurrences.length === 1 ? 'date' : 'dates'}
          </span>
        </>
      }
      title={
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && submit()}
          placeholder={kind === 'personal' ? 'e.g. Doctor appointment' : 'e.g. ALPHA TEAM MEETING'}
          className="w-full rounded-lg bg-transparent text-2xl font-black tracking-tight text-foreground outline-none placeholder:text-muted-foreground/40"
          aria-label="Title"
        />
      }
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button className="ml-auto" onClick={submit} disabled={create.isPending || !selections.length}>
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
      <Sec title="When">
        <div className="flex flex-wrap gap-1.5">
          {selections.map((s) => (
            <span key={s.day} className="flex items-center gap-1 rounded-xl border border-border bg-secondary/50 py-1 pr-1 pl-2.5 text-xs font-semibold">
              {fmtWhen(s)}
              {selections.length > 1 && (
                <button type="button" onClick={() => toggleDay(s.day)} className="rounded-md p-0.5 text-muted-foreground hover:bg-background hover:text-foreground" aria-label="Remove date">
                  <X className="size-3" />
                </button>
              )}
            </span>
          ))}
        </div>
        {sameTime && base && (
          <div>
            <p className="mb-1.5 text-[11px] text-muted-foreground">Same time ({fmtRange(base.startMin, base.endMin)}) on</p>
            <div className="flex gap-1">
              {week.days.map((day) => {
                const on = selections.some((s) => s.day === day)
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
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Repeat className="size-3.5" />
          Repeat weekly
          <select
            value={repeatWeeks}
            onChange={(e) => setRepeatWeeks(Number(e.target.value))}
            className="ml-auto h-8 rounded-lg border border-border bg-background px-2 text-xs font-semibold text-foreground"
          >
            {REPEAT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n === 0 ? "Doesn't repeat" : `For ${n + 1} weeks`}
              </option>
            ))}
          </select>
        </label>
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
          <PeoplePicker occurrences={occurrences} selected={invitees} onChange={setInvitees} exclude={[viewerId]} />
          <p className="text-[11px] text-muted-foreground">Everyone invited gets a notification here and an email from HR to accept or decline.</p>
        </Sec>
      )}
    </SidePanel>
  )
}
