import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { Loader2, Plus, Printer, Ticket as TicketIcon, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateTimePicker } from '@/components/shared/DateTimePicker'
import { errorMessage, raiseTicket, type Pipeline, type Priority, type Ticket, type TicketMeta, type TicketRepeatKind } from '@/api/tickets.api'
import { useTicketMeta, useTicketMutation } from '@/hooks/useTickets'
import { PRIORITY_LABEL, inkOn } from '@/lib/ticketFormat'
import { ticketStub } from '@/lib/stubData'
import { cn } from '@/lib/utils'
import { TicketStub, type StubData } from './TicketStub'
import { PersonPicker, ROLE_LABEL, pickablePeople } from './WorkPanels'

function pad(n: number) {
  return String(n).padStart(2, '0')
}
// Tomorrow 6:30 pm, local wall-clock — the usual end of a working day.
function defaultDue() {
  const d = new Date(Date.now() + 86_400_000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T18:30`
}

interface CustomStepDraft {
  label: string
  color: string
  assignee: string
}

type Role = 'contentManager' | 'smm' | 'designer' | 'shooter' | 'editor'
// The people each kind of ticket needs, in the order they work on it.
const ROLES: Partial<Record<Pipeline, Role[]>> = {
  reel_v2: ['contentManager', 'shooter', 'editor', 'smm'],
  post_v2: ['designer', 'smm', 'contentManager'],
  story_v2: ['smm', 'contentManager'],
}
const ROLE_HINT: Record<Role, string> = {
  contentManager: 'writes the topic and script, approves, schedules',
  shooter: 'shoots it, transfers the data',
  editor: 'edits it',
  smm: 'uploads it',
  designer: 'designs it (the Social Media Manager when the team has no designer)',
}
const ORDER: Pipeline[] = ['general', 'reel_v2', 'post_v2', 'story_v2', 'custom']
const TEAM_PIPELINES: Pipeline[] = ['reel_v2', 'post_v2', 'story_v2']

// Who the team's boxes say does each role — the defaults, all changeable.
function teamDefaults(meta: TicketMeta, teamId: string): Record<Role, string> {
  const team = meta.teams.find((t) => t._id === teamId)
  const holder = (...roles: string[]) => {
    for (const r of roles) {
      const box = team?.roles.find((x) => x.role === r && x.holders.length)
      if (box) return box.holders[0]._id
    }
    return ''
  }
  const smm = team?.smms[0]?._id || holder('social_media_manager')
  return {
    contentManager: holder('content_manager') || team?.heads[0]?._id || '',
    smm,
    designer: holder('graphic_designer') || smm,
    shooter: team?.smms[0]?.videographers[0]?._id || holder('videographer', 'videographer_editor'),
    editor: team?.smms[0]?.editors[0]?._id || holder('editor', 'videographer_editor'),
  }
}

export function RaiseTicketDialog({ trigger }: { trigger?: React.ReactNode }) {
  const navigate = useNavigate()
  const { data: meta } = useTicketMeta()
  const [open, setOpen] = useState(false)
  const [printed, setPrinted] = useState<Ticket | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [pipeline, setPipeline] = useState<Pipeline>('general')
  const [priority, setPriority] = useState<Priority>('normal')
  const [due, setDue] = useState(defaultDue())
  const [clientName, setClientName] = useState('')
  const [repeat, setRepeat] = useState<TicketRepeatKind | 'none'>('none')
  const [raisedFor, setRaisedFor] = useState('')
  const [approver, setApprover] = useState('')
  const [team, setTeam] = useState('')
  const [people, setPeople] = useState<Partial<Record<Role, string>>>({})
  const [steps, setSteps] = useState<CustomStepDraft[]>([])

  const raise = useTicketMutation(raiseTicket)
  const pipelines = useMemo(() => (meta?.pipelines || []).slice().sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key)), [meta])
  const info = pipelines.find((p) => p.key === pipeline)
  const needsTeam = TEAM_PIPELINES.includes(pipeline)
  const roles = ROLES[pipeline] || []
  const teamInfo = meta?.teams.find((t) => t._id === team)
  const choices = useMemo(() => pickablePeople(meta, needsTeam ? team : null, !needsTeam), [meta, team, needsTeam])
  const nameOf = (id: string) => meta?.everyone?.find((p) => p._id === id)?.name || meta?.raisable.find((p) => p._id === id)?.name || choices.find((p) => p._id === id)?.name || null
  const palette = meta?.customPalette || []

  function chooseTeam(id: string) {
    setTeam(id)
    if (meta) setPeople(teamDefaults(meta, id))
  }

  function reset() {
    setTitle('')
    setDescription('')
    setPipeline('general')
    setPriority('normal')
    setDue(defaultDue())
    setClientName('')
    setRaisedFor('')
    setApprover('')
    setTeam('')
    setPeople({})
    setSteps([])
    setPrinted(null)
  }

  function choosePipeline(p: Pipeline) {
    setPipeline(p)
    if (p === 'custom' && steps.length === 0 && palette.length) {
      setSteps([
        { label: '', color: palette[0], assignee: '' },
        { label: '', color: palette[Math.min(4, palette.length - 1)], assignee: '' },
      ])
    }
    if (TEAM_PIPELINES.includes(p) && !team && meta) {
      const first = meta.me.cmOf?.[0] || meta.me.teams[0] || meta.teams[0]?._id || ''
      if (first) chooseTeam(first)
    }
  }

  // The ticket as it will print — updated as you type.
  const preview: StubData | null = useMemo(() => {
    if (!meta) return null
    const generalStart = pipelines.find((p) => p.key === 'general')?.steps[0]?.color || '#9ca3af'
    const trail =
      pipeline === 'custom'
        ? [{ key: 'created', label: 'Raised', color: generalStart }, ...steps.map((s, i) => ({ key: `s${i}`, label: s.label || `Step ${i + 1}`, color: s.color }))]
        : (info?.steps || [])
    const firstPerson = pipeline === 'general' ? raisedFor : pipeline === 'custom' ? steps[0]?.assignee : people[roles[0]] || ''
    return {
      id: 'preview',
      code: 'TKT-••••',
      title: title || 'Your ticket title',
      pipelineName: info?.name || '',
      priority,
      color: trail[0]?.color || '#9ca3af',
      stageLabel: trail[0]?.label,
      trail: trail.map((s, i) => ({ ...s, actorLabel: null, terminal: i === trail.length - 1, reached: i === 0, current: i === 0 })),
      clientName,
      teamTitle: needsTeam ? teamInfo?.title : null,
      raisedByName: 'You',
      raisedForName: firstPerson ? nameOf(firstPerson) || '—' : '—',
      dueAt: due ? new Date(due).toISOString() : new Date().toISOString(),
      status: 'open',
      nextStepLabel: trail[1]?.label,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, pipelines, pipeline, steps, info, title, priority, clientName, team, due, raisedFor, people, needsTeam])

  async function submit() {
    if (!meta) return
    if (!title.trim()) return toast.error('Give the ticket a title')
    if (!due) return toast.error('Choose a due date')
    const body: Parameters<typeof raiseTicket>[0] = {
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      dueAt: new Date(due).toISOString(),
      clientName: clientName.trim() || undefined,
      pipeline,
      repeat,
    }
    if (pipeline === 'general') {
      if (!raisedFor) return toast.error('Choose who this ticket is for')
      body.raisedFor = raisedFor
      if (approver.startsWith('login:')) body.approverUser = approver.slice(6)
      else if (approver) body.approver = approver
    }
    if (needsTeam) {
      if (!team) return toast.error('Choose the team')
      const missing = roles.find((r) => !people[r] && !(r === 'designer' && people.smm))
      if (missing) return toast.error(`Choose the ${ROLE_LABEL[missing].toLowerCase()}`)
      body.team = team
      body.smm = people.smm
      body.assignments = Object.fromEntries(roles.map((r) => [r, people[r]]).filter(([, v]) => v)) as Parameters<typeof raiseTicket>[0]['assignments']
    }
    if (pipeline === 'custom') {
      if (steps.some((s) => !s.label.trim() || !s.assignee)) return toast.error('Every step needs a name and a person')
      body.customSteps = steps.map((s) => ({ ...s, label: s.label.trim() }))
    }
    try {
      const ticket = await raise.mutateAsync(body)
      setPrinted(ticket)
    } catch (err) {
      toast.error(errorMessage(err, 'Could not raise the ticket'))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setTimeout(reset, 250)
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <TicketIcon className="size-4" />
            Raise ticket
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-6xl gap-0 overflow-y-auto p-0">
        <AnimatePresence mode="wait">
          {printed ? (
            <motion.div key="printed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 sm:p-10">
              <DialogHeader className="mb-6 text-center sm:text-center">
                <DialogTitle className="text-2xl">Ticket raised</DialogTitle>
                <DialogDescription>
                  {printed.code} is now with {printed.waitingOn.length ? printed.waitingOn.join(', ') : printed.raisedFor.name}.
                </DialogDescription>
              </DialogHeader>
              {/* the printer slot, and the ticket sliding out of it */}
              <div className="mx-auto max-w-2xl">
                <div className="relative z-10 mx-2 h-4 rounded-full bg-gradient-to-b from-zinc-800 to-zinc-600 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]" />
                <div className="-mt-2 overflow-hidden px-4 pb-6">
                  <motion.div initial={{ y: '-105%' }} animate={{ y: 0 }} transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}>
                    <TicketStub d={ticketStub(printed)} />
                  </motion.div>
                </div>
              </div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }} className="mt-2 flex flex-wrap justify-center gap-3">
                <Button
                  onClick={() => {
                    setOpen(false)
                    navigate(`/tickets/${printed._id}`)
                  }}
                >
                  Open ticket
                </Button>
                <Button variant="outline" onClick={reset}>
                  <Plus className="size-4" />
                  Raise another
                </Button>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div key="form" exit={{ opacity: 0 }} className="grid lg:grid-cols-[1fr_420px]">
              <div className="grid gap-5 p-6 sm:p-8">
                <DialogHeader>
                  <DialogTitle className="text-xl">Raise a ticket</DialogTitle>
                  <DialogDescription>
                    {meta?.me.picksFromAnyTeam ? 'For anyone, in any team.' : 'For anyone in your own box or below you in the Organisation chart.'}
                    {meta ? ` You're raising as ${meta.me.postLabel}.` : ''}
                  </DialogDescription>
                </DialogHeader>

                {!meta ? (
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <div className="grid gap-1.5">
                      <Label htmlFor="t-title">Title</Label>
                      <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" maxLength={160} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="t-desc">Details</Label>
                      <Textarea id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Anything they need to know" rows={3} />
                    </div>

                    <div className="grid gap-2">
                      <Label>Kind of ticket</Label>
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {pipelines.map((p) => (
                          <button
                            type="button"
                            key={p.key}
                            onClick={() => choosePipeline(p.key)}
                            className={cn('grid gap-2 rounded-xl p-3 text-left ring-1 transition-all', pipeline === p.key ? 'bg-primary/5 ring-2 ring-primary' : 'bg-secondary/40 ring-border hover:bg-secondary')}
                          >
                            <span className="flex items-center gap-2 text-sm font-bold">
                              {p.typeColor && <span className="size-3 rounded-full ring-1 ring-black/10" style={{ background: p.typeColor }} />}
                              {p.name}
                            </span>
                            <span className="text-[11px] leading-snug text-muted-foreground">{p.description}</span>
                            <span className="flex gap-1">
                              {(p.key === 'custom' ? palette.slice(0, 6) : p.steps.map((s) => s.color)).map((c, i) => (
                                <span key={i} className="h-2 flex-1 rounded-full" style={{ background: c }} />
                              ))}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {needsTeam && (
                      <div className="grid gap-1.5">
                        <Label>Team</Label>
                        <Select value={team || undefined} onValueChange={chooseTeam}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Choose the team" />
                          </SelectTrigger>
                          <SelectContent>
                            {meta.teams.map((t) => (
                              <SelectItem key={t._id} value={t._id}>
                                {t.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground">The people below come from the team's boxes in the Organisation chart — change any of them.</p>
                      </div>
                    )}

                    {needsTeam && team && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {roles.map((r) => (
                          <div key={r} className="grid min-w-0 gap-1.5">
                            <Label>{ROLE_LABEL[r]}</Label>
                            <PersonPicker people={choices} value={people[r] || ''} onChange={(v) => setPeople((p) => ({ ...p, [r]: v }))} placeholder={`Choose the ${ROLE_LABEL[r].toLowerCase()}`} />
                            <p className="text-[11px] text-muted-foreground">{ROLE_HINT[r]}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {pipeline === 'general' && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid min-w-0 gap-1.5">
                          <Label>For</Label>
                          <PersonPicker people={choices} value={raisedFor} onChange={setRaisedFor} />
                          <p className="text-[11px] text-muted-foreground">Does the work and marks it done.</p>
                        </div>
                        <div className="grid min-w-0 gap-1.5">
                          <Label>Approver</Label>
                          <PersonPicker
                            people={[
                              ...(meta.approverLogins || []).map((l) => ({ _id: `login:${l._id}`, name: l.name, designation: '', teams: [] })),
                              ...(meta.everyone || meta.raisable),
                            ]}
                            value={approver}
                            onChange={setApprover}
                            placeholder="You (unless you choose someone)"
                          />
                          <p className="text-[11px] text-muted-foreground">Checks the work and closes it.</p>
                        </div>
                      </div>
                    )}
                    {pipeline === 'custom' && (
                      <div className="grid gap-2">
                        <Label>Steps (2–5), in order</Label>
                        {steps.map((s, i) => (
                          <div key={i} className="grid gap-2 rounded-xl bg-secondary/40 p-3 ring-1 ring-border">
                            <div className="flex items-center gap-2">
                              <span className="grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-black" style={{ background: s.color, color: inkOn(s.color) }}>
                                {i + 1}
                              </span>
                              <Input value={s.label} onChange={(e) => setSteps((all) => all.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder={`Step ${i + 1} name`} maxLength={60} />
                              {steps.length > 2 && (
                                <Button type="button" size="icon" variant="ghost" onClick={() => setSteps((all) => all.filter((_, j) => j !== i))} aria-label="Remove step">
                                  <Trash2 className="size-4" />
                                </Button>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {palette.map((c) => (
                                <button
                                  type="button"
                                  key={c}
                                  aria-label={`Colour ${c}`}
                                  onClick={() => setSteps((all) => all.map((x, j) => (j === i ? { ...x, color: c } : x)))}
                                  className={cn('size-6 rounded-full ring-offset-2 ring-offset-card transition', s.color === c ? 'ring-2 ring-foreground' : 'hover:scale-110')}
                                  style={{ background: c }}
                                />
                              ))}
                            </div>
                            <PersonPicker people={meta.raisable} value={s.assignee} onChange={(v) => setSteps((all) => all.map((x, j) => (j === i ? { ...x, assignee: v } : x)))} />
                          </div>
                        ))}
                        {steps.length < 5 && (
                          <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => setSteps((all) => [...all, { label: '', color: palette[all.length % palette.length], assignee: '' }])}>
                            <Plus className="size-4" />
                            Add a step
                          </Button>
                        )}
                        <p className="text-[11px] text-muted-foreground">Only colours the pipelines already use — pink, red and yellow stay reserved for sent back, rejected and overdue.</p>
                      </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-1.5">
                        <Label>Due</Label>
                        <DateTimePicker value={due} onChange={setDue} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="t-client">Client name (optional)</Label>
                        <Input id="t-client" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Who it's for" maxLength={120} />
                      </div>
                    </div>

                    <div className="grid gap-1.5">
                      <Label htmlFor="t-repeat">Repeat</Label>
                      <select id="t-repeat" value={repeat} onChange={(e) => setRepeat(e.target.value as TicketRepeatKind | 'none')} className="h-9 rounded-md border border-border bg-background px-3 text-sm">
                        <option value="none">Doesn't repeat</option>
                        <option value="daily">Every day (not Sundays or holidays)</option>
                        <option value="weekly">Every week</option>
                        <option value="monthly">Every month</option>
                        <option value="yearly">Every year</option>
                      </select>
                      {repeat !== 'none' && (
                        <p className="text-[11px] text-muted-foreground">
                          A fresh copy is raised for the same people at 9:00 am on each{' '}
                          {repeat === 'daily' ? 'working day' : repeat === 'weekly' ? 'week, on this weekday' : repeat === 'monthly' ? 'month, on this date (months without it are skipped)' : 'year, on this date'}
                          , due as long after as this one is. It keeps going until you stop it from the ticket.
                        </p>
                      )}
                    </div>

                    <div className="grid gap-1.5">
                      <Label>Priority</Label>
                      <div className="flex flex-wrap gap-2">
                        {meta.priorities.map((p) => (
                          <button
                            type="button"
                            key={p}
                            onClick={() => setPriority(p)}
                            className={cn('rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition', priority === p ? 'bg-foreground text-background ring-foreground' : 'ring-border hover:bg-secondary')}
                          >
                            {PRIORITY_LABEL[p]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 border-t border-border pt-4">
                      <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={submit} disabled={raise.isPending}>
                        {raise.isPending ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
                        Print ticket
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {/* live preview */}
              <div className="hidden border-l border-border bg-secondary/30 p-6 lg:block">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Preview</p>
                {preview && <TicketStub d={preview} />}
                {info && pipeline !== 'custom' && (
                  <div className="mt-6 grid gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Its steps</p>
                    {info.steps.map((s, i) => (
                      <div key={s.key} className="grid gap-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="size-3 shrink-0 rounded-full" style={{ background: s.color }} />
                          <span className="font-semibold">{s.label}</span>
                          {i > 0 && s.actorLabel && <span className="text-muted-foreground">· {s.actorLabel}</span>}
                        </div>
                        {s.lineupAfter && meta?.lineups?.[s.lineupAfter] && (
                          <span className="ml-5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">then waits in the {meta.lineups[s.lineupAfter].label.toLowerCase()}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}
