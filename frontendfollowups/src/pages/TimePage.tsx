import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Clock3, Loader2, Pencil, Play, Plus, Square, Trash2, Users } from 'lucide-react'
import { TicketNav } from '@/components/layout/TicketNav'
import { HoursCheck } from '@/components/tickets/HandOverDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { confirmHours, errorMessage, listTickets, type PendingHours, type Ticket } from '@/api/tickets.api'
import { OTHER_WORK, addTimeEntry, editTimeEntry, hm, removeTimeEntry, startTimer, stopTimer, todayKey, type OtherWork, type TimeEntry } from '@/api/work.api'
import { useTicketMeta } from '@/hooks/useTickets'
import { usePendingHours, useTimeDay, useTimeTeam, useTimer, useWorkMutation } from '@/hooks/useWork'
import { fmtDateTime } from '@/lib/ticketFormat'
import { cn } from '@/lib/utils'

const TZ = 'Asia/Kolkata'
const timeOf = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }) : '…')
const hhmmOf = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
const dayLabel = (key: string) => new Date(`${key}T12:00:00+05:30`).toLocaleDateString('en-IN', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' })
const shiftDay = (key: string, n: number) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(new Date(`${key}T12:00:00+05:30`).getTime() + n * 86_400_000))
// A wall-clock time on a day in India, as an instant.
const atIst = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+05:30`).toISOString()

const SOURCE: Record<TimeEntry['source'], { label: string; cls: string }> = {
  timer: { label: 'Timer', cls: 'bg-sky-500/12 text-sky-700' },
  confirmed: { label: 'Handed on', cls: 'bg-emerald-500/12 text-emerald-700' },
  shoot: { label: 'Shoot', cls: 'bg-blue-600/12 text-blue-700' },
  meeting: { label: 'Meeting', cls: 'bg-zinc-900/10 text-zinc-800' },
  manual: { label: 'Added', cls: 'bg-violet-500/12 text-violet-700' },
}

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

// ---- the timer -----------------------------------------------------------------------

function TimerCard() {
  const { data } = useTimer()
  const [kind, setKind] = useState<OtherWork>('internal')
  const [note, setNote] = useState('')
  const start = useWorkMutation(() => startTimer({ otherKind: kind, note: note.trim() || undefined }))
  const stop = useWorkMutation(() => stopTimer())
  const r = data?.running
  return (
    <Panel title="Timer" action={<span className="text-xs text-muted-foreground">Today: {hm(data?.todayMinutes)}</span>}>
      {r ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-emerald-500/10 p-4 ring-1 ring-emerald-500/30">
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
          </span>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-bold">
              {r.ticket ? (
                <Link to={`/tickets/${r.ticket._id}`} className="hover:underline">
                  {r.ticket.code} · {r.ticket.title}
                </Link>
              ) : (
                r.otherLabel
              )}
            </p>
            <p className="text-muted-foreground">
              Since {timeOf(r.startedAt)} · {hm(r.minutes)}
              {r.note ? ` · ${r.note}` : ''}
            </p>
          </div>
          <Button variant="outline" disabled={stop.isPending} onClick={() => stop.mutateAsync(undefined).catch((err) => toast.error(errorMessage(err, 'Could not stop it')))}>
            <Square className="size-4 fill-current" />
            Stop
          </Button>
        </div>
      ) : (
        <p className="mb-3 text-sm text-muted-foreground">Not running. Start it from a ticket, or for other work below. It stops by itself at lunch and at the end of your shift.</p>
      )}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="grid gap-1.5">
          <Label>Other work</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as OtherWork)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(OTHER_WORK).map(([k, l]) => (
                <SelectItem key={k} value={k}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What is it? (optional)" className="min-w-0 flex-1" maxLength={300} />
        <Button disabled={start.isPending} onClick={() => start.mutateAsync(undefined).then(() => setNote('')).catch((err) => toast.error(errorMessage(err, 'Could not start it')))}>
          <Play className="size-4" />
          {r ? 'Switch to this' : 'Start'}
        </Button>
      </div>
    </Panel>
  )
}

// ---- hours someone else handed on for you ------------------------------------------------

function PendingRow({ p }: { p: PendingHours }) {
  const [minutes, setMinutes] = useState(p.estimateMinutes || 0)
  const [reason, setReason] = useState('')
  const save = useWorkMutation(() => confirmHours(p._id, { minutes, reason: Math.abs(minutes - (p.estimateMinutes || 0)) >= 1 ? reason.trim() : undefined }))
  const changed = Math.abs(minutes - (p.estimateMinutes || 0)) >= 1
  return (
    <div className="grid gap-3 rounded-xl p-4 ring-1 ring-border">
      <div className="flex flex-wrap items-baseline gap-2 text-sm">
        {p.ticket ? (
          <Link to={`/tickets/${p.ticket._id}`} className="font-bold hover:underline">
            {p.ticket.code} · {p.ticket.title}
          </Link>
        ) : (
          <span className="font-bold">A ticket</span>
        )}
        <span className="text-muted-foreground">— “{p.stepLabel}”, handed on {fmtDateTime(p.createdAt)}</span>
      </div>
      <HoursCheck estimate={p.estimateMinutes || 0} minutes={minutes} setMinutes={setMinutes} reason={reason} setReason={setReason} since={p.from} label="Your hours on this step" />
      <Button
        className="justify-self-end"
        disabled={save.isPending || (changed && !reason.trim())}
        onClick={() =>
          save
            .mutateAsync(undefined)
            .then(() => toast.success('Confirmed'))
            .catch((err) => toast.error(errorMessage(err, 'Could not confirm')))
        }
      >
        {save.isPending && <Loader2 className="size-4 animate-spin" />}
        Confirm {hm(minutes)}
      </Button>
    </div>
  )
}

// ---- one day's entries, with corrections for managers ---------------------------------------

function EntryDialog({ day, employee, entry, open, onOpenChange }: { day: string; employee: string; entry?: TimeEntry; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: meta } = useTicketMeta()
  const [kind, setKind] = useState<'ticket' | OtherWork>(entry ? (entry.kind === 'ticket' ? 'ticket' : entry.otherKind || 'other') : 'internal')
  const [from, setFrom] = useState(entry ? hhmmOf(entry.startedAt) : '10:00')
  const [to, setTo] = useState(entry?.endedAt ? hhmmOf(entry.endedAt) : '11:00')
  const [note, setNote] = useState(entry?.note || '')
  const [reason, setReason] = useState('')
  const [q, setQ] = useState('')
  const [found, setFound] = useState<Ticket[]>([])
  const [ticketId, setTicketId] = useState(entry?.ticket?._id || '')
  useEffect(() => {
    if (kind !== 'ticket' || q.trim().length < 2 || !meta) return
    const h = setTimeout(() => {
      listTickets({ scope: meta.me.seesEveryone ? 'all' : 'team', status: 'all', q: q.trim() })
        .then(setFound)
        .catch(() => setFound([]))
    }, 300)
    return () => clearTimeout(h)
  }, [q, kind, meta])
  const save = useWorkMutation(async () => {
    const body = {
      startedAt: atIst(day, from),
      endedAt: atIst(day, to),
      note: note.trim() || undefined,
      ...(kind === 'ticket' ? { ticketId } : { otherKind: kind }),
    }
    return entry ? editTimeEntry(entry._id, { ...body, reason: reason.trim() }) : addTimeEntry({ ...body, employee })
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entry ? 'Correct this time' : 'Add time'}</DialogTitle>
          <DialogDescription>{dayLabel(day)} · the correction, who made it and why are kept with the entry.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>On</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as 'ticket' | OtherWork)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ticket">A ticket</SelectItem>
                {Object.entries(OTHER_WORK).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {kind === 'ticket' && (
            <div className="grid gap-1.5">
              <Label>Ticket</Label>
              {entry?.ticket && ticketId === entry.ticket._id && <p className="text-sm font-medium">{entry.ticket.code} · {entry.ticket.title}</p>}
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title or TKT-…" />
              {found.length > 0 && (
                <ul className="grid max-h-40 gap-1 overflow-y-auto rounded-lg p-1 ring-1 ring-border">
                  {found.slice(0, 20).map((t) => (
                    <li key={t._id}>
                      <button type="button" onClick={() => setTicketId(t._id)} className={cn('w-full rounded-md px-2 py-1 text-left text-xs', ticketId === t._id ? 'bg-primary/10 font-bold' : 'hover:bg-secondary')}>
                        {t.code} · {t.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>From</Label>
              <Input type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>To</Label>
              <Input type="time" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          {entry ? (
            <>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" maxLength={300} />
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why the correction? (required)" rows={2} />
            </>
          ) : (
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why is it being added? (required)" rows={2} maxLength={300} />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={save.isPending || (kind === 'ticket' && !ticketId) || (entry ? !reason.trim() : !note.trim())}
            onClick={() =>
              save
                .mutateAsync(undefined)
                .then(() => {
                  toast.success('Saved')
                  onOpenChange(false)
                })
                .catch((err) => toast.error(errorMessage(err, 'Could not save')))
            }
          >
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DayEntries({ day, employee }: { day: string; employee?: string }) {
  const { data, isLoading } = useTimeDay(day, employee)
  const [edit, setEdit] = useState<TimeEntry | 'new' | null>(null)
  const [removing, setRemoving] = useState<TimeEntry | null>(null)
  const [why, setWhy] = useState('')
  const remove = useWorkMutation(() => removeTimeEntry(removing!._id, why.trim()))
  if (isLoading) return <Skeleton className="h-32 rounded-xl bg-secondary/50" />
  if (!data) return null
  return (
    <div className="grid gap-3">
      {employee && (
        <p className="text-sm">
          <b>{data.employee.name}</b>
          {data.employee.designation ? <span className="text-muted-foreground"> · {data.employee.designation}</span> : null}
        </p>
      )}
      {data.entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No time on this day.</p>
      ) : (
        <ul className="grid gap-2">
          {data.entries.map((e) => (
            <li key={e._id} className="grid gap-1 rounded-xl p-3 text-sm ring-1 ring-border">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-36 shrink-0 font-mono text-xs text-muted-foreground">
                  {timeOf(e.startedAt)} – {e.endedAt ? timeOf(e.endedAt) : 'now'}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {e.ticket ? (
                    <Link to={`/tickets/${e.ticket._id}`} className="hover:underline">
                      {e.ticket.code} · {e.ticket.title}
                    </Link>
                  ) : (
                    e.otherLabel
                  )}
                  {e.note ? <span className="text-muted-foreground"> · {e.note}</span> : null}
                </span>
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', SOURCE[e.source]?.cls)}>{SOURCE[e.source]?.label || e.source}</span>
                {e.pending && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">To confirm</span>}
                {e.autoConfirmed && <span className="rounded-full bg-slate-500/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">Never confirmed</span>}
                <span className="w-16 text-right font-mono text-xs font-bold">{hm(e.minutes)}</span>
                {data.canEdit && employee && (
                  <span className="flex">
                    <Button size="icon" variant="ghost" onClick={() => setEdit(e)} aria-label="Correct">
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setRemoving(e)} aria-label="Remove">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </span>
                )}
              </div>
              {e.changed && (
                <p className="text-xs text-amber-700">
                  Changed from the estimate of {hm(e.estimateMinutes)}: {e.reason}
                </p>
              )}
              {e.overtimeMinutes > 0 && <p className="text-xs text-violet-700">{hm(e.overtimeMinutes)} of it after hours (overtime)</p>}
              {(e.edits || []).map((x, i) => (
                <p key={i} className="text-[11px] text-muted-foreground">
                  Corrected by {x.byName}, {fmtDateTime(x.at)}
                  {x.note ? `: ${x.note}` : ''}
                </p>
              ))}
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
        {data.canEdit && employee ? (
          <Button size="sm" variant="outline" onClick={() => setEdit('new')}>
            <Plus className="size-4" />
            Add time
          </Button>
        ) : (
          <span />
        )}
        <span>
          Total <b className="font-mono">{hm(data.totalMinutes)}</b>
        </span>
      </div>
      {edit && <EntryDialog day={day} employee={data.employee._id} entry={edit === 'new' ? undefined : edit} open onOpenChange={(v) => !v && setEdit(null)} />}
      <Dialog open={Boolean(removing)} onOpenChange={(v) => !v && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this time?</DialogTitle>
            <DialogDescription>It stops counting; the entry and why it was removed are kept.</DialogDescription>
          </DialogHeader>
          <Textarea value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why? (required)" rows={2} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!why.trim() || remove.isPending}
              onClick={() =>
                remove
                  .mutateAsync(undefined)
                  .then(() => {
                    toast.success('Removed')
                    setRemoving(null)
                    setWhy('')
                  })
                  .catch((err) => toast.error(errorMessage(err, 'Could not remove it')))
              }
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TeamDay({ day }: { day: string }) {
  const { data } = useTimeTeam(day)
  const [who, setWho] = useState<string | null>(null)
  const people = useMemo(() => data?.people.filter((p) => p._id) || [], [data])
  if (!data || people.length === 0) return null
  return (
    <Panel title="Your team's time" action={<span className="text-xs text-muted-foreground">{people.length} people</span>}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <ul className="grid max-h-[480px] gap-1 overflow-y-auto">
          {people.map((p) => (
            <li key={p._id}>
              <button type="button" onClick={() => setWho(p._id)} className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm', who === p._id ? 'bg-primary/10' : 'hover:bg-secondary')}>
                {p.running && <span className="size-2 rounded-full bg-emerald-500" title="Timer running" />}
                <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                <span className={cn('font-mono text-xs', p.minutes === 0 ? 'text-muted-foreground' : 'font-bold')}>{hm(p.minutes)}</span>
              </button>
            </li>
          ))}
        </ul>
        <div>{who ? <DayEntries day={day} employee={who} /> : <p className="text-sm text-muted-foreground">Choose someone to see — and correct — their day.</p>}</div>
      </div>
    </Panel>
  )
}

export default function TimePage() {
  const [params, setParams] = useSearchParams()
  const day = params.get('day') || todayKey()
  const { data: pending } = usePendingHours()
  const { data: meta } = useTicketMeta()
  // A login with no employee record (the CEO, admin) has no time of its own — only its people's.
  const ownTime = Boolean(meta?.me.employeeId)
  const goDay = (d: string) => {
    const n = new URLSearchParams(params)
    n.set('day', d)
    setParams(n, { replace: true })
  }
  return (
    <>
      <TicketNav />
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">Client work</p>
            <h1 className="text-2xl font-black tracking-tight">Time</h1>
            <p className="text-sm text-muted-foreground">Hours are confirmed when you hand a step on. The timer is optional — when it ran, its time becomes the estimate.</p>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" onClick={() => goDay(shiftDay(day, -1))} aria-label="Day before">
              <ChevronLeft className="size-4" />
            </Button>
            <Input type="date" value={day} max={todayKey()} onChange={(e) => e.target.value && goDay(e.target.value)} className="w-40" />
            <Button size="icon" variant="outline" onClick={() => goDay(shiftDay(day, 1))} disabled={day >= todayKey()} aria-label="Day after">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        {ownTime ? (
          <TimerCard />
        ) : meta ? (
          <p className="rounded-2xl bg-secondary/40 p-4 text-sm text-muted-foreground ring-1 ring-border">This login isn't linked to an employee record, so it has no time of its own — below is the time of the people you manage.</p>
        ) : null}

        {pending && pending.length > 0 && (
          <Panel title="Hours to confirm" action={<span className="text-xs text-muted-foreground">left alone, they stand as estimated after three days</span>}>
            <div className="grid gap-3">
              {pending.map((p) => (
                <PendingRow key={p._id} p={p} />
              ))}
            </div>
          </Panel>
        )}

        {ownTime && (
          <Panel title={day === todayKey() ? 'Today' : dayLabel(day)} action={<Clock3 className="size-4 text-muted-foreground" />}>
            <DayEntries day={day} />
          </Panel>
        )}

        <TeamDay day={day} />
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="size-3.5" />
          Content Managers, the Team Lead, the CEO and admin see and correct their people's time.
        </p>
      </main>
    </>
  )
}
