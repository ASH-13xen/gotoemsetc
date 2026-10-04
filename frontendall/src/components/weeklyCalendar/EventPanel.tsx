import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Ban,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock3,
  History,
  Link2,
  ListTodo,
  Loader2,
  Lock,
  MapPin,
  Megaphone,
  Pencil,
  Plus,
  Repeat,
  Send,
  StickyNote,
  Trash2,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { featureOn } from '@/lib/access'
import type { CalEvent, CalNote, CalPerson, Scope, WeeklyCategory } from '@/api/weeklyCalendar.api'
import {
  useAddNote,
  useCalEvent,
  useCancelCalEvent,
  useDeleteNote,
  useInviteMore,
  useJoin,
  useNoteToTask,
  useRemoveAttendee,
  useRespond,
  useSetSegments,
  useUpdateCalEvent,
  useUpdateNote,
} from '@/hooks/useWeeklyCalendar'
import { CATEGORY, CATEGORY_KEYS, PERSONAL, addDays, apiError, fmtDay, fmtDayLong, fmtMin, fmtRange, fmtWhen, nowIst } from './calendarUtils'
import { Avatar, PeoplePicker } from './PeoplePicker'
import { Chip, Sec, SidePanel } from './SidePanel'

function timeAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function ScopeToggle({ value, onChange, size }: { value: Scope; onChange: (s: Scope) => void; size: number }) {
  if (size <= 1) return null
  return (
    <div className="flex gap-1 rounded-xl bg-secondary/60 p-1 text-[11px] font-semibold">
      {(
        [
          ['one', 'Just this date'],
          ['series', `This & upcoming (${size})`],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn('flex-1 rounded-lg py-1 transition-all', value === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

const slotOptions = (from: number, to: number, step: number) => {
  const out: number[] = []
  for (let m = from; m <= to; m += step) out.push(m)
  return out
}

export function EventPanel({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const { data: event, isLoading, isError } = useCalEvent(eventId)

  if (isLoading || !event) {
    return (
      <SidePanel panelKey={`loading-${eventId}`} accent={CATEGORY.other} eyebrow={null} title={<div className="h-8" />} onClose={onClose}>
        <div className="flex items-center justify-center p-10 text-muted-foreground">
          {isError ? <p className="text-sm">This event isn't available any more.</p> : <Loader2 className="size-5 animate-spin" />}
        </div>
      </SidePanel>
    )
  }
  return <EventPanelBody key={event._id} event={event} onClose={onClose} />
}

function EventPanelBody({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const accent = event.isPersonal ? PERSONAL : CATEGORY[event.category ?? 'other']
  const seriesSize = event.seriesSize ?? 1
  const upcomingInSeries = (event.occurrences ?? []).filter((o) => o.day >= event.day).length || 1
  const now = nowIst()
  const isPast = event.day < now.day || (event.day === now.day && event.endMin <= now.min)

  const respond = useRespond()
  const join = useJoin()
  const [rsvpScope, setRsvpScope] = useState<Scope>(seriesSize > 1 ? 'series' : 'one')
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')

  const doRespond = async (response: 'accept' | 'decline') => {
    try {
      const result = await respond.mutateAsync({ id: event._id, response, reason: reason.trim() || undefined, scope: rsvpScope })
      toast.success(response === 'accept' ? `You're in${result.updated > 1 ? ` for ${result.updated} dates` : ''} — it's on your calendar` : 'Declined — the host has been told')
      result.skipped.forEach((s) => toast.warning(`Skipped ${s}`))
      setDeclining(false)
    } catch (err) {
      toast.error(apiError(err, 'Could not respond'))
    }
  }

  const going = (event.attendees ?? []).filter((a) => a.status === 'accepted')
  const pending = (event.attendees ?? []).filter((a) => a.status === 'invited')
  const declined = (event.attendees ?? []).filter((a) => a.status === 'declined')
  const members: CalPerson[] = [event.host!, ...(event.attendees ?? []).filter((a) => a.status !== 'declined').map((a) => a.user)].filter(Boolean)

  return (
    <SidePanel
      panelKey={event._id}
      accent={accent}
      eyebrow={
        <>
          <Chip style={{ background: `linear-gradient(90deg, ${accent.from}, ${accent.to})` }}>{event.isPersonal ? 'Personal' : CATEGORY[event.category ?? 'other'].label}</Chip>
          {event.openForAll && (
            <Chip className="flex items-center gap-1 bg-amber-500">
              <Megaphone className="size-3" /> Open for all
            </Chip>
          )}
          {seriesSize > 1 && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
              <Repeat className="size-3" /> {seriesSize} dates
            </span>
          )}
        </>
      }
      title={<h2 className="text-2xl leading-tight font-black tracking-tight text-foreground">{event.title}</h2>}
      subtitle={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1 font-semibold text-foreground">
            <Clock3 className="size-3.5" />
            {fmtDayLong(event.day)} · {fmtRange(event.startMin, event.endMin)}
          </span>
          {event.host && (
            <span className="flex items-center gap-1.5">
              <Avatar person={event.host} size="size-4" className="text-[7px]" /> Hosted by {event.host.name}
            </span>
          )}
        </span>
      }
      onClose={onClose}
    >
      {/* RSVP */}
      {event.myRole === 'invited' && !isPast && (
        <Sec title="You're invited" className="bg-primary/[0.04]">
          <ScopeToggle value={rsvpScope} onChange={setRsvpScope} size={upcomingInSeries} />
          {!declining ? (
            <div className="flex gap-2">
              <Button className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700" disabled={respond.isPending} onClick={() => doRespond('accept')}>
                <Check className="size-4" /> Accept
              </Button>
              <Button variant="outline" className="flex-1 border-rose-500/40 text-rose-600 hover:bg-rose-500/10" disabled={respond.isPending} onClick={() => setDeclining(true)}>
                <X className="size-4" /> Decline
              </Button>
            </div>
          ) : (
            <div className="grid gap-2">
              <Input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional) — the host will see it" className="h-9 text-sm" />
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setDeclining(false)}>
                  Back
                </Button>
                <Button variant="destructive" className="flex-1" disabled={respond.isPending} onClick={() => doRespond('decline')}>
                  Decline
                </Button>
              </div>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">Until you accept, this shows as tentative and doesn't block your time.</p>
        </Sec>
      )}
      {event.myRole === 'accepted' && (
        <Sec title="Your reply">
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-4" /> You're going — it's blocked on your calendar
          </div>
          {!isPast && (
            <button type="button" className="w-fit text-xs font-semibold text-muted-foreground hover:text-rose-600" onClick={() => doRespond('decline')}>
              Can't make it any more
            </button>
          )}
        </Sec>
      )}
      {event.myRole === 'open' && !isPast && (
        <Sec title="Open for all">
          <Button
            disabled={join.isPending}
            onClick={() =>
              join
                .mutateAsync(event._id)
                .then(() => toast.success("Joined — it's on your calendar"))
                .catch((err) => toast.error(apiError(err, 'Could not join')))
            }
          >
            <Plus className="size-4" /> Join this
          </Button>
        </Sec>
      )}

      {(event.description || event.location || event.link) && (
        <Sec title="Details">
          {event.description && <p className="text-sm whitespace-pre-line text-foreground">{event.description}</p>}
          {event.location && (
            <p className="flex items-center gap-1.5 text-sm text-foreground">
              <MapPin className="size-3.5 text-muted-foreground" /> {event.location}
            </p>
          )}
          {event.link && (
            <a href={event.link} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 truncate text-sm font-semibold text-primary hover:underline">
              <Link2 className="size-3.5" /> {event.link}
            </a>
          )}
        </Sec>
      )}

      {!event.isPersonal && (
        <PeopleSection event={event} going={going} pending={pending} declined={declined} isPast={isPast} upcomingInSeries={upcomingInSeries} />
      )}

      {!event.isPersonal && (event.segments?.length || event.canManage) ? <AgendaSection event={event} members={members} /> : null}

      {event.canNote && <NotesSection event={event} members={members} viewerId={user?.id ?? ''} isAdmin={isAdmin} />}

      {event.canManage && <HostTools event={event} isPast={isPast} upcomingInSeries={upcomingInSeries} onClosed={onClose} />}
    </SidePanel>
  )
}

// ---------------------------------------------------------------------------

function PeopleSection({
  event,
  going,
  pending,
  declined,
  isPast,
  upcomingInSeries,
}: {
  event: CalEvent
  going: NonNullable<CalEvent['attendees']>
  pending: NonNullable<CalEvent['attendees']>
  declined: NonNullable<CalEvent['attendees']>
  isPast: boolean
  upcomingInSeries: number
}) {
  const invite = useInviteMore()
  const remove = useRemoveAttendee()
  const [adding, setAdding] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [scope, setScope] = useState<Scope>('one')
  const occurrences = useMemo(
    () => (scope === 'series' ? (event.occurrences ?? []).filter((o) => o.day >= event.day) : [{ day: event.day, startMin: event.startMin, endMin: event.endMin }]),
    [scope, event]
  )
  const already = [event.host?._id, ...(event.attendees ?? []).filter((a) => a.status !== 'declined').map((a) => a.user._id)].filter(Boolean) as string[]

  const send = async () => {
    try {
      await invite.mutateAsync({ id: event._id, userIds: picked, scope })
      toast.success(`Invited ${picked.length} more`)
      setPicked([])
      setAdding(false)
    } catch (err) {
      toast.error(apiError(err, 'Could not invite'))
    }
  }

  const row = (person: CalPerson, badge: React.ReactNode, extra?: React.ReactNode, removable = false) => (
    <div key={person._id} className="flex items-center gap-2.5 rounded-xl px-1 py-1">
      <Avatar person={person} size="size-8" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{person.name}</p>
        <p className="truncate text-[11px] text-muted-foreground">{extra ?? person.subtitle}</p>
      </div>
      {badge}
      {removable && event.canManage && !isPast && (
        <button
          type="button"
          title={`Remove ${person.name}`}
          onClick={() =>
            remove
              .mutateAsync({ id: event._id, userId: person._id })
              .then(() => toast.success(`Removed ${person.name.split(' ')[0]}`))
              .catch((err) => toast.error(apiError(err, 'Could not remove')))
          }
          className="rounded-full p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )

  const pill = (text: string, cls: string) => <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', cls)}>{text}</span>

  return (
    <Sec
      title={`People · ${going.length + 1} going${pending.length ? ` · ${pending.length} pending` : ''}`}
      action={
        event.canManage && !isPast ? (
          <button type="button" onClick={() => setAdding((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            <UserPlus className="size-3.5" /> {adding ? 'Close' : 'Invite more'}
          </button>
        ) : null
      }
    >
      {adding && (
        <div className="grid gap-2 rounded-2xl border border-primary/30 bg-primary/[0.03] p-3">
          <ScopeToggle value={scope} onChange={setScope} size={upcomingInSeries} />
          <PeoplePicker occurrences={occurrences} selected={picked} onChange={setPicked} exclude={already} ignoreEventId={event._id} />
          <Button size="sm" disabled={!picked.length || invite.isPending} onClick={send}>
            {invite.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            Send {picked.length || ''} invite{picked.length === 1 ? '' : 's'}
          </Button>
        </div>
      )}
      <div className="grid gap-0.5">
        {event.host && row(event.host, pill('Host', 'bg-primary/12 text-primary'))}
        {going.map((a) => row(a.user, pill('Going', 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'), undefined, true))}
        {pending.map((a) => row(a.user, pill('Pending', 'bg-amber-500/14 text-amber-700 dark:text-amber-300'), `Invited ${a.invitedAt ? timeAgo(a.invitedAt) : ''}`, true))}
        {declined.map((a) =>
          row(a.user, pill('Declined', 'bg-rose-500/12 text-rose-700 dark:text-rose-300'), a.reason ? `“${a.reason}”` : 'Declined', true)
        )}
      </div>
    </Sec>
  )
}

// ---------------------------------------------------------------------------

function AgendaSection({ event, members }: { event: CalEvent; members: CalPerson[] }) {
  const save = useSetSegments()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<{ startMin: number; endMin: number; label: string; user: string }[]>([])
  const options = slotOptions(event.startMin, event.endMin, 5)

  const begin = () => {
    setDraft(
      (event.segments ?? []).map((s) => ({ startMin: s.startMin, endMin: s.endMin, label: s.label, user: s.user?._id ?? '' }))
    )
    setEditing(true)
  }
  const addRow = () => {
    const last = draft[draft.length - 1]
    const start = last ? last.endMin : event.startMin
    if (start >= event.endMin) return toast.info('The agenda already fills the meeting')
    setDraft([...draft, { startMin: start, endMin: Math.min(start + 15, event.endMin), label: '', user: '' }])
  }
  const commit = async () => {
    try {
      await save.mutateAsync({ id: event._id, segments: draft.map((d) => ({ startMin: d.startMin, endMin: d.endMin, label: d.label || undefined, user: d.user || null })) })
      toast.success('Agenda saved')
      setEditing(false)
    } catch (err) {
      toast.error(apiError(err, 'Could not save the agenda'))
    }
  }

  return (
    <Sec
      title="Agenda · time slices"
      action={
        event.canManage && !editing ? (
          <button type="button" onClick={begin} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            <Pencil className="size-3" /> {event.segments?.length ? 'Edit' : 'Split into slices'}
          </button>
        ) : null
      }
    >
      {!editing ? (
        event.segments?.length ? (
          <div className="grid gap-1">
            {event.segments.map((s) => (
              <div key={s._id} className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-secondary/30 px-2.5 py-1.5">
                <span className="w-[92px] shrink-0 text-[11px] font-bold text-primary tabular-nums">{fmtRange(s.startMin, s.endMin)}</span>
                {s.user && <Avatar person={s.user} size="size-5" className="text-[8px]" />}
                <span className="truncate text-sm font-semibold text-foreground">
                  {s.user?.name ?? s.label}
                  {s.user && s.label && <span className="font-normal text-muted-foreground"> · {s.label}</span>}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Give each person their own slice — like 15 minutes each in a co-ordinators meeting.</p>
        )
      ) : (
        <div className="grid gap-2">
          {draft.map((d, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-1.5 rounded-xl border border-border p-2">
              <select
                value={d.startMin}
                onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, startMin: Number(e.target.value) } : x)))}
                className="h-8 rounded-lg border border-border bg-background px-1.5 text-xs"
              >
                {options.slice(0, -1).map((m) => (
                  <option key={m} value={m}>
                    {fmtMin(m)}
                  </option>
                ))}
              </select>
              <select
                value={d.endMin}
                onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, endMin: Number(e.target.value) } : x)))}
                className="h-8 rounded-lg border border-border bg-background px-1.5 text-xs"
              >
                {options.slice(1).map((m) => (
                  <option key={m} value={m}>
                    {fmtMin(m)}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => setDraft(draft.filter((_, j) => j !== i))} className="rounded-lg px-1.5 text-muted-foreground hover:text-rose-600" aria-label="Remove slice">
                <Trash2 className="size-3.5" />
              </button>
              <select
                value={d.user}
                onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, user: e.target.value } : x)))}
                className="h-8 rounded-lg border border-border bg-background px-1.5 text-xs"
              >
                <option value="">No one in particular</option>
                {members.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <input
                value={d.label}
                onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                placeholder="Topic"
                className="col-span-2 h-8 rounded-lg border border-border bg-background px-2 text-xs"
              />
            </div>
          ))}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={addRow}>
              <Plus className="size-3.5" /> Add slice
            </Button>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={commit} disabled={save.isPending}>
              Save
            </Button>
          </div>
        </div>
      )}
    </Sec>
  )
}

// ---------------------------------------------------------------------------

function NotesSection({ event, members, viewerId, isAdmin }: { event: CalEvent; members: CalPerson[]; viewerId: string; isAdmin: boolean }) {
  const add = useAddNote()
  const [kind, setKind] = useState<'note' | 'action'>('note')
  const [text, setText] = useState('')
  const [assignee, setAssignee] = useState('')
  const [dueDay, setDueDay] = useState('')
  const notes = event.notes ?? []
  const actions = notes.filter((n) => n.kind === 'action')

  const submit = async () => {
    if (!text.trim()) return
    if (kind === 'action' && !assignee) return toast.error('Pick who the action item is for')
    try {
      await add.mutateAsync({ id: event._id, kind, text: text.trim(), assignee: kind === 'action' ? assignee : undefined, dueDay: kind === 'action' && dueDay ? dueDay : undefined })
      setText('')
      setDueDay('')
      toast.success(kind === 'action' ? 'Action item added' : 'Note added')
    } catch (err) {
      toast.error(apiError(err, 'Could not add it'))
    }
  }

  return (
    <Sec title={`Meeting notes · ${notes.length}${actions.length ? ` · ${actions.filter((a) => a.done).length}/${actions.length} actions done` : ''}`}>
      <p className="-mt-1 text-[11px] text-muted-foreground">Everyone in the meeting can add and edit these. Every change shows who made it.</p>
      <div className="grid gap-2">
        {notes.map((note) => (
          <NoteCard key={note._id} event={event} note={note} canDelete={note.createdBy._id === viewerId || event.myRole === 'host' || isAdmin} members={members} />
        ))}
      </div>

      <div className="grid gap-2 rounded-2xl border border-border bg-background p-2.5">
        <div className="flex gap-1 rounded-lg bg-secondary/60 p-0.5 text-[11px] font-semibold">
          {(
            [
              ['note', 'Note', StickyNote],
              ['action', 'Action item', ListTodo],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setKind(key)}
              className={cn('flex flex-1 items-center justify-center gap-1 rounded-md py-1 transition-all', kind === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}
            >
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && submit()}
          placeholder={kind === 'note' ? 'What was discussed or decided…' : 'What needs doing…'}
          rows={2}
          className="text-sm"
        />
        {kind === 'action' && (
          <div className="grid grid-cols-2 gap-1.5">
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="h-8 rounded-lg border border-border bg-background px-2 text-xs">
              <option value="">For who?</option>
              {members.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                </option>
              ))}
            </select>
            <input type="date" value={dueDay} min={nowIst().day} onChange={(e) => setDueDay(e.target.value)} className="h-8 rounded-lg border border-border bg-background px-2 text-xs" />
          </div>
        )}
        <Button size="sm" className="justify-self-end" onClick={submit} disabled={add.isPending || !text.trim()}>
          {add.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Add {kind === 'action' ? 'action item' : 'note'}
        </Button>
      </div>
    </Sec>
  )
}

function NoteCard({ event, note, canDelete, members }: { event: CalEvent; note: CalNote; canDelete: boolean; members: CalPerson[] }) {
  const { user } = useAuth()
  const tasksOn = featureOn(user, 'TASK_MANAGEMENT')
  const update = useUpdateNote()
  const remove = useDeleteNote()
  const toTask = useNoteToTask()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(note.text)
  const [showHistory, setShowHistory] = useState(false)
  useEffect(() => setText(note.text), [note.text])

  const patch = (input: Parameters<typeof update.mutateAsync>[0], ok?: string) =>
    update
      .mutateAsync(input)
      .then(() => ok && toast.success(ok))
      .catch((err) => toast.error(apiError(err, 'Could not update the note')))

  const isAction = note.kind === 'action'
  return (
    <div className={cn('rounded-2xl border px-3 py-2.5', isAction ? 'border-primary/25 bg-primary/[0.03]' : 'border-border/70 bg-secondary/25')}>
      <div className="flex items-center gap-2">
        <Avatar person={note.createdBy} size="size-6" className="text-[9px]" />
        <p className="min-w-0 flex-1 truncate text-xs">
          <span className="font-bold text-foreground">{note.createdBy.name}</span>
          <span className="text-muted-foreground"> · {timeAgo(note.createdAt)}</span>
        </p>
        {isAction && (
          <span className="flex items-center gap-1 rounded-full bg-primary/12 px-1.5 py-0.5 text-[9.5px] font-black tracking-wide text-primary uppercase">
            <ListTodo className="size-3" /> Action
          </span>
        )}
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Edit note">
            <Pencil className="size-3" />
          </button>
        )}
        {canDelete && !editing && (
          <button
            type="button"
            onClick={() => remove.mutateAsync({ id: event._id, noteId: note._id }).catch((err) => toast.error(apiError(err, 'Could not delete')))}
            className="rounded p-1 text-muted-foreground hover:text-rose-600"
            aria-label="Delete note"
          >
            <Trash2 className="size-3" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-2 grid gap-1.5">
          <Textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={3} className="text-sm" />
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => (setEditing(false), setText(note.text))}>
              Cancel
            </Button>
            <Button size="sm" disabled={update.isPending || !text.trim()} onClick={() => patch({ id: event._id, noteId: note._id, text: text.trim() }, 'Note updated').then(() => setEditing(false))}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-1.5 flex items-start gap-2">
          {isAction && (
            <button
              type="button"
              onClick={() => patch({ id: event._id, noteId: note._id, done: !note.done })}
              className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors', note.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-border')}
              aria-label={note.done ? 'Mark not done' : 'Mark done'}
            >
              {note.done && <Check className="size-3" />}
            </button>
          )}
          <p className={cn('text-sm whitespace-pre-line text-foreground', note.done && 'text-muted-foreground line-through')}>{note.text}</p>
        </div>
      )}

      {isAction && !editing && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          <select
            value={note.assignee?._id ?? ''}
            disabled={Boolean(note.task)}
            onChange={(e) => patch({ id: event._id, noteId: note._id, assignee: e.target.value || null })}
            className="h-7 rounded-lg border border-border bg-background px-1.5 text-[11px] font-semibold"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m._id} value={m._id}>
                {m.name}
              </option>
            ))}
          </select>
          {note.dueDay && <span className="rounded-lg bg-secondary px-2 py-1 font-semibold text-muted-foreground">Due {fmtDay(note.dueDay)}</span>}
          {note.task ? (
            <span className="ml-auto flex items-center gap-1 rounded-lg bg-emerald-500/12 px-2 py-1 font-bold text-emerald-700 dark:text-emerald-300">
              <ClipboardList className="size-3" /> In Task Management
            </span>
          ) : !tasksOn ? null : (
            <button
              type="button"
              disabled={toTask.isPending || !note.assignee}
              onClick={() =>
                toTask
                  .mutateAsync({ id: event._id, noteId: note._id })
                  .then(() => toast.success(`Task created for ${note.assignee?.name.split(' ')[0]}`))
                  .catch((err) => toast.error(apiError(err, 'Could not create the task')))
              }
              className="ml-auto flex items-center gap-1 rounded-lg bg-primary px-2 py-1 font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              title={note.assignee ? 'Create a task in Task Management' : 'Pick who it is for first'}
            >
              <ClipboardList className="size-3" /> Make it a task
            </button>
          )}
        </div>
      )}

      {note.updatedBy && note.history.length > 0 && (
        <div className="mt-1.5">
          <button type="button" onClick={() => setShowHistory((v) => !v)} className="flex items-center gap-1 text-[10.5px] text-muted-foreground hover:text-foreground">
            <History className="size-3" />
            Edited by {note.updatedBy.name} · {timeAgo(note.updatedAt)} · {note.history.length} earlier version{note.history.length === 1 ? '' : 's'}
          </button>
          {showHistory && (
            <div className="mt-1.5 grid gap-1 border-l-2 border-border pl-2.5">
              {[...note.history].reverse().map((h, i) => (
                <div key={i} className="text-[11px]">
                  <span className="font-semibold text-foreground">{h.by.name}</span>
                  <span className="text-muted-foreground"> · {timeAgo(h.at)}</span>
                  <p className="whitespace-pre-line text-muted-foreground">{h.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {note.updatedBy && note.history.length === 0 && note.updatedBy._id !== note.createdBy._id && (
        <p className="mt-1 text-[10.5px] text-muted-foreground">Updated by {note.updatedBy.name} · {timeAgo(note.updatedAt)}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function HostTools({ event, isPast, upcomingInSeries, onClosed }: { event: CalEvent; isPast: boolean; upcomingInSeries: number; onClosed: () => void }) {
  const update = useUpdateCalEvent()
  const cancel = useCancelCalEvent()
  const [mode, setMode] = useState<'none' | 'edit' | 'move' | 'cancel'>('none')
  const [scope, setScope] = useState<Scope>('one')
  const [form, setForm] = useState({
    title: event.title ?? '',
    description: event.description ?? '',
    category: (event.category ?? 'other') as WeeklyCategory,
    location: event.location ?? '',
    link: event.link ?? '',
    openForAll: Boolean(event.openForAll),
  })
  const [move, setMove] = useState({ day: event.day, startMin: event.startMin, endMin: event.endMin })
  const [reason, setReason] = useState('')
  const times = slotOptions(390, 1230, 30).filter((m) => m < 810 || m >= 870)

  if (isPast) return null

  const saveDetails = () =>
    update
      .mutateAsync({ id: event._id, ...form, scope })
      .then(() => (toast.success('Saved'), setMode('none')))
      .catch((err) => toast.error(apiError(err, 'Could not save')))

  const reschedule = () =>
    update
      .mutateAsync({ id: event._id, ...move })
      .then(() => (toast.success('Moved — guests have been asked to confirm the new time'), setMode('none')))
      .catch((err) => toast.error(apiError(err, 'Could not move it')))

  const doCancel = () =>
    cancel
      .mutateAsync({ id: event._id, scope, reason: reason.trim() || undefined })
      .then((r) => {
        toast.success(r.cancelled > 1 ? `Cancelled ${r.cancelled} dates — everyone was told` : 'Cancelled — everyone was told')
        onClosed()
      })
      .catch((err) => toast.error(apiError(err, 'Could not cancel')))

  return (
    <Sec title="Host tools">
      {mode === 'none' && (
        <div className="grid grid-cols-3 gap-1.5">
          <Button size="sm" variant="outline" onClick={() => setMode('edit')}>
            <Pencil className="size-3.5" /> Edit
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMode('move')}>
            <Clock3 className="size-3.5" /> Move
          </Button>
          <Button size="sm" variant="outline" className="border-rose-500/40 text-rose-600 hover:bg-rose-500/10" onClick={() => setMode('cancel')}>
            <Ban className="size-3.5" /> Cancel
          </Button>
        </div>
      )}

      {mode === 'edit' && (
        <div className="grid gap-2">
          <ScopeToggle value={scope} onChange={setScope} size={upcomingInSeries} />
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-9 text-sm font-semibold" />
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Agenda or notes" className="text-sm" />
          <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Where" className="h-9 text-sm" />
          <Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="Meeting link" className="h-9 text-sm" />
          {!event.isPersonal && (
            <>
              <div className="flex flex-wrap gap-1">
                {CATEGORY_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm({ ...form, category: key })}
                    className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', form.category === key ? 'border-transparent text-white' : 'border-border text-muted-foreground')}
                    style={form.category === key ? { background: CATEGORY[key].from } : undefined}
                  >
                    {CATEGORY[key].label}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold">
                <input type="checkbox" checked={form.openForAll} onChange={(e) => setForm({ ...form, openForAll: e.target.checked })} className="size-4 accent-primary" />
                <Megaphone className="size-3.5" /> Open for all
              </label>
            </>
          )}
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setMode('none')}>
              Back
            </Button>
            <Button size="sm" onClick={saveDetails} disabled={update.isPending || !form.title.trim()}>
              Save
            </Button>
          </div>
        </div>
      )}

      {mode === 'move' && (
        <div className="grid gap-2">
          <input
            type="date"
            value={move.day}
            min={nowIst().day}
            max={addDays(nowIst().day, 365)}
            onChange={(e) => setMove({ ...move, day: e.target.value })}
            className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-1.5">
            <select value={move.startMin} onChange={(e) => setMove({ ...move, startMin: Number(e.target.value) })} className="h-9 rounded-lg border border-border bg-background px-2 text-sm">
              {times.map((m) => (
                <option key={m} value={m}>
                  {fmtMin(m)}
                </option>
              ))}
            </select>
            <select value={move.endMin} onChange={(e) => setMove({ ...move, endMin: Number(e.target.value) })} className="h-9 rounded-lg border border-border bg-background px-2 text-sm">
              {[...times.slice(1), 1230].filter((m) => m > move.startMin).map((m) => (
                <option key={m} value={m}>
                  {fmtMin(m)}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-muted-foreground">Everyone who accepted will be asked to confirm the new time.</p>
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setMode('none')}>
              Back
            </Button>
            <Button size="sm" onClick={reschedule} disabled={update.isPending}>
              Move to {fmtWhen(move)}
            </Button>
          </div>
        </div>
      )}

      {mode === 'cancel' && (
        <div className="grid gap-2 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3">
          <ScopeToggle value={scope} onChange={setScope} size={upcomingInSeries} />
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional) — sent to everyone" className="h-9 text-sm" />
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setMode('none')}>
              Keep it
            </Button>
            <Button size="sm" variant="destructive" onClick={doCancel} disabled={cancel.isPending}>
              <XCircle className="size-3.5" /> Cancel {scope === 'series' ? `${upcomingInSeries} dates` : 'event'}
            </Button>
          </div>
        </div>
      )}
      {event.isPersonal && mode === 'none' && (
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Lock className="size-3" /> Personal — colleagues only see "Busy".
        </p>
      )}
    </Sec>
  )
}
