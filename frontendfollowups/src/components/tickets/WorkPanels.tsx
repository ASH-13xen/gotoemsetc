import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Camera, Clapperboard, Loader2, Lock, PauseCircle, Play, PlayCircle, Square, Unlock, UserRoundCog } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateTimePicker } from '@/components/shared/DateTimePicker'
import { errorMessage, holdTicket, pickUpTicket, reassignTicket, resumeTicket, startTicket, type PickPerson, type Ticket, type TicketMeta } from '@/api/tickets.api'
import { hm, startTimer, stopTimer } from '@/api/work.api'
import { useTicketMeta, useTicketMutation } from '@/hooks/useTickets'
import { useTicketTime, useTimer, useWorkMutation } from '@/hooks/useWork'
import { fade, fmtDateTime, inkOn } from '@/lib/ticketFormat'
import { NoteDialog } from './TicketActions'

const pad = (n: number) => String(n).padStart(2, '0')
const toLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

export const ROLE_LABEL: Record<string, string> = {
  raisedFor: 'Assignee',
  approver: 'Approver',
  contentManager: 'Content Manager',
  shooter: 'Videographer',
  editor: 'Video editor',
  designer: 'Designer',
  smm: 'Social Media Manager',
}
// Who can be changed on each work pipeline (as the server allows).
export const WORK_FIELDS: Record<string, string[]> = {
  general: ['raisedFor', 'approver'],
  reel_v2: ['contentManager', 'shooter', 'editor', 'smm'],
  post_v2: ['designer', 'smm', 'contentManager'],
  story_v2: ['smm', 'contentManager'],
}

// The people someone may pick for a work ticket: anyone (Team Lead, CEO,
// admin), the ticket's team (its Content Manager), or their own box and below.
export function pickablePeople(meta: TicketMeta | undefined, teamId: string | null | undefined, general = false): PickPerson[] {
  if (!meta) return []
  if (meta.me.picksFromAnyTeam && meta.everyone) return meta.everyone
  if (!general && teamId && meta.me.cmOf?.includes(teamId)) {
    const team = meta.teams.find((x) => x._id === teamId)
    const seen = new Map<string, PickPerson>()
    team?.roles.forEach((r) => r.holders.forEach((h) => seen.set(h._id, { _id: h._id, name: h.name, designation: r.box, teams: [teamId] })))
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  }
  return meta.raisable
}

export function PersonPicker({ people, value, onChange, placeholder = 'Choose a person' }: { people: PickPerson[]; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="w-full min-w-0 [&>span]:truncate">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {people.map((p) => (
          <SelectItem key={p._id} value={p._id}>
            {p.name}
            {p.isSelf ? ' (you)' : ''}
            {p.designation ? <span className="text-muted-foreground"> · {p.designation}</span> : null}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ---- Start work (a locked ticket from a client's plan) ----------------------------------

export function StartWorkDialog({ t, open, onOpenChange }: { t: Ticket; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [due, setDue] = useState(() => toLocal(new Date(t.dueAt)))
  const [note, setNote] = useState('')
  const start = useTicketMutation(() => startTicket(t._id, new Date(due).toISOString(), note.trim() || undefined))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Start work on {t.code}</DialogTitle>
          <DialogDescription>It unlocks, takes its colour, and goes to {t.waitingOn.length ? t.waitingOn.join(', ') : 'its first person'}. Time starts counting from now.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Due</Label>
            <DateTimePicker value={due} onChange={setDue} />
          </div>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note — kept in the record" rows={2} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={start.isPending || !due}
            onClick={() =>
              start
                .mutateAsync(undefined)
                .then(() => {
                  toast.success('Work started')
                  onOpenChange(false)
                })
                .catch((err) => toast.error(errorMessage(err, 'Could not start it')))
            }
          >
            {start.isPending ? <Loader2 className="size-4 animate-spin" /> : <Unlock className="size-4" />}
            Start work
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---- where a work ticket is when it isn't waiting on anyone ----------------------------

export function WorkStatus({ t }: { t: Ticket }) {
  const { data: meta } = useTicketMeta()
  const [dlg, setDlg] = useState<null | 'start' | 'resume'>(null)
  const pickUp = useTicketMutation(() => pickUpTicket(t._id))
  const resume = useTicketMutation((note: string) => resumeTicket(t._id, note || undefined))
  if (t.status !== 'open') return null

  if (t.locked) {
    const color = fade(t.typeColor || t.color, 0.55)
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl p-4 ring-1 ring-border" style={{ background: color, color: inkOn(color) }}>
        <Lock className="size-5" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-bold">Locked — made from the client's plan</p>
          <p className="opacity-80">Work starts when the team's Content Manager, the Team Lead, the CEO or admin presses Start work and sets the due date. No time counts until then.</p>
        </div>
        {t.can.start && (
          <Button onClick={() => setDlg('start')} className="bg-foreground text-background hover:bg-foreground/90">
            <Unlock className="size-4" />
            Start work
          </Button>
        )}
        {dlg === 'start' && <StartWorkDialog t={t} open onOpenChange={(v) => !v && setDlg(null)} />}
      </div>
    )
  }
  if (!t.parkedIn) return null
  const lineup = meta?.lineups?.[t.parkedIn]
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-secondary/50 p-4 ring-1 ring-border">
      <PauseCircle className="size-5 text-muted-foreground" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-bold">
          {t.parkedIn === 'posting' && t.scheduledFor ? `Scheduled for ${fmtDateTime(t.scheduledFor)}` : `In the ${(t.lineupLabel || 'lineup').toLowerCase()}`}
        </p>
        <p className="text-muted-foreground">
          Nobody is holding it and no time counts while it waits{lineup ? ` — it leaves ${lineup.leaves}` : ''}.
          {t.parkNote ? ` ${t.parkNote}` : ''}
        </p>
      </div>
      {t.parkedIn === 'shoot' && (
        <Button asChild variant="outline">
          <Link to="/shoots">
            <Camera className="size-4" />
            Plan a shoot
          </Link>
        </Button>
      )}
      {t.can.pickUp && (
        <Button
          disabled={pickUp.isPending}
          onClick={() =>
            pickUp
              .mutateAsync(undefined)
              .then(() => toast.success('It’s yours — editing has started'))
              .catch((err) => toast.error(errorMessage(err, 'Could not pick it up')))
          }
        >
          {pickUp.isPending ? <Loader2 className="size-4 animate-spin" /> : <Clapperboard className="size-4" />}
          Start editing
        </Button>
      )}
      {t.can.resume && (
        <Button variant="outline" onClick={() => setDlg('resume')}>
          <PlayCircle className="size-4" />
          Resume
        </Button>
      )}
      <NoteDialog
        open={dlg === 'resume'}
        onOpenChange={(v) => setDlg(v ? 'resume' : null)}
        title="Resume this ticket"
        description="It goes back to whoever it was waiting on, and time counts again."
        confirmLabel="Resume"
        onConfirm={async (n) => {
          await resume.mutateAsync(n)
          toast.success('Resumed')
        }}
      />
    </div>
  )
}

export function HoldButton({ t }: { t: Ticket }) {
  const [open, setOpen] = useState(false)
  const hold = useTicketMutation((reason: string) => holdTicket(t._id, reason))
  if (!t.can.hold) return null
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <PauseCircle className="size-4" />
        Put on hold
      </Button>
      <NoteDialog
        open={open}
        onOpenChange={setOpen}
        title="Put it on hold"
        description="It leaves everyone's board and no time counts until it is resumed."
        required
        placeholder="Why is it on hold?"
        confirmLabel="Put on hold"
        onConfirm={async (r) => {
          await hold.mutateAsync(r)
          toast.success('On hold')
        }}
      />
    </>
  )
}

// ---- people on a work ticket ---------------------------------------------------------------

export function WorkReassignDialog({ t, open, onOpenChange, initial }: { t: Ticket; open: boolean; onOpenChange: (v: boolean) => void; initial?: string }) {
  const { data: meta } = useTicketMeta()
  const fields = WORK_FIELDS[t.pipeline] || []
  const [field, setField] = useState(initial || fields[0] || '')
  const [person, setPerson] = useState('')
  const [note, setNote] = useState('')
  const people = useMemo(() => pickablePeople(meta, t.team?._id, t.pipeline === 'general'), [meta, t.team?._id, t.pipeline])
  const save = useTicketMutation(() => reassignTicket(t._id, { field, employeeId: person, note: note.trim() || undefined }))
  const scope = meta?.me.picksFromAnyTeam ? 'Anyone, from any team.' : t.team && meta?.me.cmOf?.includes(t.team._id) ? `People in ${t.team.title}.` : 'People in your box or below.'
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change a person on {t.code}</DialogTitle>
          <DialogDescription>{scope} The change and who made it stay in the record.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Select value={field} onValueChange={setField}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fields.map((f) => (
                <SelectItem key={f} value={f}>
                  {ROLE_LABEL[f]}
                  {currentName(t, f) ? <span className="text-muted-foreground"> · now {currentName(t, f)}</span> : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <PersonPicker people={people} value={person} onChange={setPerson} />
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why? (optional, kept in the record)" rows={2} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!person || !field || save.isPending}
            onClick={() =>
              save
                .mutateAsync(undefined)
                .then(() => {
                  toast.success('Changed')
                  onOpenChange(false)
                })
                .catch((err) => toast.error(errorMessage(err, 'Could not change it')))
            }
          >
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            Change
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function currentName(t: Ticket, field: string) {
  if (field === 'raisedFor') return t.raisedFor?.name || null
  if (field === 'approver') return t.approver?.name || t.raisedBy?.name || null
  return t.people?.[field as keyof NonNullable<Ticket['people']>]?.name || null
}

export function PeoplePanel({ t }: { t: Ticket }) {
  const [edit, setEdit] = useState<string | null>(null)
  const fields = WORK_FIELDS[t.pipeline] || []
  return (
    <>
      <ul className="grid gap-2">
        {fields.map((f) => (
          <li key={f} className="flex items-center gap-3 text-sm">
            <span className="w-40 shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{ROLE_LABEL[f]}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{currentName(t, f) || '—'}</span>
            {t.can.reassign && t.status === 'open' && (
              <Button size="sm" variant="ghost" onClick={() => setEdit(f)}>
                <UserRoundCog className="size-3.5" />
                Change
              </Button>
            )}
          </li>
        ))}
      </ul>
      {edit && <WorkReassignDialog t={t} initial={edit} open onOpenChange={(v) => !v && setEdit(null)} />}
    </>
  )
}

// ---- the timer, and the hours on this ticket -------------------------------------------------

export function TimerButton({ t }: { t: Ticket }) {
  const { data } = useTimer()
  const start = useWorkMutation(() => startTimer({ ticketId: t._id }))
  const stop = useWorkMutation(() => stopTimer())
  if (t.status !== 'open' || t.locked) return null
  const here = data?.running?.ticket?._id === t._id
  return here ? (
    <Button variant="outline" className="border-emerald-500/40 text-emerald-700" disabled={stop.isPending} onClick={() => stop.mutateAsync(undefined).catch((err) => toast.error(errorMessage(err, 'Could not stop it')))}>
      <Square className="size-4 fill-current" />
      Stop timer · {hm(data?.running?.minutes)}
    </Button>
  ) : (
    <Button
      variant="outline"
      disabled={start.isPending}
      onClick={() =>
        start
          .mutateAsync(undefined)
          .then(() => toast.success(data?.running ? 'Switched the timer to this ticket' : 'Timer started'))
          .catch((err) => toast.error(errorMessage(err, 'Could not start the timer')))
      }
    >
      <Play className="size-4" />
      Start timer
    </Button>
  )
}

export function TicketHours({ t }: { t: Ticket }) {
  const { data, isLoading } = useTicketTime(t._id, Boolean(t.isWork))
  if (isLoading) return <Loader2 className="size-4 animate-spin text-muted-foreground" />
  if (!data || data.people.length === 0) return <p className="text-xs text-muted-foreground">No hours yet — they're confirmed as each step is handed on.</p>
  return (
    <div className="grid gap-2">
      {data.people.map((p) => (
        <div key={p._id} className="flex items-center gap-3 text-sm">
          <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
          <span className="font-mono text-xs font-bold">{hm(p.minutes)}</span>
        </div>
      ))}
      <div className="mt-1 flex items-center gap-3 border-t border-border pt-2 text-sm">
        <span className="flex-1 font-bold">Total</span>
        <span className="font-mono text-xs font-black">{hm(data.totalMinutes)}</span>
      </div>
    </div>
  )
}
