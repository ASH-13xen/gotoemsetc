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

function PersonSelect({
  meta,
  value,
  onChange,
  placeholder = 'Choose a person',
  id,
}: {
  meta: TicketMeta
  value: string
  onChange: (v: string) => void
  placeholder?: string
  id?: string
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {meta.raisable.map((p) => (
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

export function RaiseTicketDialog({ trigger }: { trigger?: React.ReactNode }) {
  const navigate = useNavigate()
  const { data: meta } = useTicketMeta()
  const [open, setOpen] = useState(false)
  const [printed, setPrinted] = useState<Ticket | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [pipeline, setPipeline] = useState<Pipeline>('simple')
  const [priority, setPriority] = useState<Priority>('normal')
  const [due, setDue] = useState(defaultDue())
  const [clientName, setClientName] = useState('')
  const [repeat, setRepeat] = useState<TicketRepeatKind | 'none'>('none')
  const [raisedFor, setRaisedFor] = useState('')
  const [team, setTeam] = useState('')
  const [smm, setSmm] = useState('')
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [steps, setSteps] = useState<CustomStepDraft[]>([])

  const raise = useTicketMutation(raiseTicket)
  const nameOf = (id: string) => meta?.raisable.find((p) => p._id === id)?.name || null
  const info = meta?.pipelines.find((p) => p.key === pipeline)
  const needsTeam = pipeline === 'story' || pipeline === 'post' || pipeline === 'reel'
  const teamInfo = meta?.teams.find((t) => t._id === team)
  const teamSmms = teamInfo?.smms ?? []
  const smmInfo = teamSmms.find((s) => s._id === smm)
  // A team with no SMM yet: anyone they may raise for can stand in.
  const smmOptions = teamSmms.length ? teamSmms : (meta?.raisable ?? []).map((p) => ({ _id: p._id, name: p.name, videographers: [], editors: [] }))

  // Picking the SMM fills in a reel's Videographer and Editor from that
  // SMM's own boxes (they can still be changed).
  function chooseSmm(id: string) {
    setSmm(id)
    const s = teamSmms.find((x) => x._id === id)
    if (s) setAssignments((a) => ({ ...a, shooter: s.videographers[0]?._id || a.shooter || '', editor: s.editors[0]?._id || a.editor || '' }))
  }
  function chooseTeam(id: string) {
    setTeam(id)
    setSmm('')
    setAssignments({})
  }
  const palette = meta?.customPalette || []

  function reset() {
    setTitle('')
    setDescription('')
    setPipeline('simple')
    setPriority('normal')
    setDue(defaultDue())
    setClientName('')
    setRaisedFor('')
    setTeam('')
    setSmm('')
    setAssignments({})
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
    if ((p === 'story' || p === 'post' || p === 'reel') && !team && meta) {
      setTeam(meta.me.teams[0] || meta.teams[0]?._id || '')
    }
  }

  // The ticket as it will print — updated as you type.
  const preview: StubData | null = useMemo(() => {
    if (!meta) return null
    const trail =
      pipeline === 'custom'
        ? [{ key: 'created', label: 'Raised', color: meta.pipelines.find((p) => p.key === 'simple')!.steps[0].color }, ...steps.map((s, i) => ({ key: `s${i}`, label: s.label || `Step ${i + 1}`, color: s.color }))]
        : (info?.steps || [])
    const firstPerson =
      pipeline === 'post' || pipeline === 'story' ? smm : pipeline === 'reel' ? assignments.shooter : pipeline === 'custom' ? steps[0]?.assignee : raisedFor
    return {
      id: 'preview',
      code: 'TKT-••••',
      title: title || 'Your ticket title',
      pipelineName: info?.name || '',
      priority,
      color: trail[0]?.color || '#f97316',
      stageLabel: trail[0]?.label,
      trail: trail.map((s, i) => ({ ...s, actorLabel: null, terminal: i === trail.length - 1, reached: i === 0, current: i === 0 })),
      clientName,
      teamTitle: needsTeam ? meta.teams.find((t) => t._id === team)?.title : null,
      raisedByName: 'You',
      raisedForName: firstPerson ? nameOf(firstPerson) || smmOptions.find((s) => s._id === firstPerson)?.name || '—' : '—',
      dueAt: due ? new Date(due).toISOString() : new Date().toISOString(),
      status: 'open',
      nextStepLabel: trail[1]?.label,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, pipeline, steps, info, title, priority, clientName, team, due, raisedFor, assignments, needsTeam, smm])

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
    if (pipeline === 'simple') {
      if (!raisedFor) return toast.error('Choose who this ticket is for')
      body.raisedFor = raisedFor
    }
    if (needsTeam) {
      if (!team) return toast.error('Choose the team')
      if (!smm) return toast.error('Choose the Social Media Manager')
      body.team = team
      body.smm = smm
    }
    if (pipeline === 'reel') {
      if (!assignments.shooter || !assignments.editor) return toast.error('Choose the videographer and the editor')
      // The team's Content Manager is filled in on the server.
      body.assignments = { shooter: assignments.shooter, editor: assignments.editor }
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
                  <motion.div
                    initial={{ y: '-105%' }}
                    animate={{ y: 0 }}
                    transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
                  >
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
                    For anyone in your own box or below you in the Organisation chart.
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
                      <Label>Pipeline</Label>
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {meta.pipelines.map((p) => (
                          <button
                            type="button"
                            key={p.key}
                            onClick={() => choosePipeline(p.key)}
                            className={cn(
                              'grid gap-2 rounded-xl p-3 text-left ring-1 transition-all',
                              pipeline === p.key ? 'bg-primary/5 ring-2 ring-primary' : 'bg-secondary/40 ring-border hover:bg-secondary'
                            )}
                          >
                            <span className="text-sm font-bold">{p.name}</span>
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
                        {teamInfo && (
                          <p className="text-[11px] text-muted-foreground">
                            Content Manager: {teamInfo.heads.length ? teamInfo.heads.map((h) => h.name).join(', ') : 'vacant — the CEO stands in'}
                          </p>
                        )}
                      </div>
                    )}

                    {needsTeam && team && (
                      <div className="grid gap-1.5">
                        <Label>Social Media Manager{pipeline === 'post' ? ' (designs it)' : pipeline === 'story' ? ' (makes it)' : ''}</Label>
                        <Select value={smm || undefined} onValueChange={chooseSmm}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Choose the SMM" />
                          </SelectTrigger>
                          <SelectContent>
                            {smmOptions.map((s) => (
                              <SelectItem key={s._id} value={s._id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground">
                          {teamSmms.length ? 'The SMM steps go to this person only.' : 'This team has no Social Media Manager box filled yet.'}
                        </p>
                      </div>
                    )}

                    {pipeline === 'simple' && (
                      <div className="grid gap-1.5">
                        <Label>For</Label>
                        <PersonSelect meta={meta} value={raisedFor} onChange={setRaisedFor} />
                      </div>
                    )}
                    {pipeline === 'reel' && smm && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {(
                          [
                            ['shooter', 'Videographer', smmInfo?.videographers],
                            ['editor', 'Video Editor', smmInfo?.editors],
                          ] as const
                        ).map(([field, label, own]) => (
                          <div key={field} className="grid gap-1.5">
                            <Label>{label}</Label>
                            <PersonSelect meta={meta} value={assignments[field] || ''} onChange={(v) => setAssignments((a) => ({ ...a, [field]: v }))} />
                            <p className="text-[11px] text-muted-foreground">
                              {own?.length ? `${smmInfo?.name}'s ${label.toLowerCase()}: ${own.map((p) => p.name).join(', ')}` : `${smmInfo?.name || 'This SMM'} has no ${label.toLowerCase()} yet — pick someone.`}
                            </p>
                          </div>
                        ))}
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
                            <PersonSelect meta={meta} value={s.assignee} onChange={(v) => setSteps((all) => all.map((x, j) => (j === i ? { ...x, assignee: v } : x)))} />
                          </div>
                        ))}
                        {steps.length < 5 && (
                          <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => setSteps((all) => [...all, { label: '', color: palette[all.length % palette.length], assignee: '' }])}>
                            <Plus className="size-4" />
                            Add a step
                          </Button>
                        )}
                        <p className="text-[11px] text-muted-foreground">Only colours the pipelines already use — pink, red and grey stay reserved for sent back, rejected and overdue.</p>
                      </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-1.5">
                        <Label>Due</Label>
                        <DateTimePicker value={due} onChange={setDue} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="t-client">Client name {needsTeam ? '' : '(optional)'}</Label>
                        <Input id="t-client" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Typed, since Client Management is off" maxLength={120} />
                      </div>
                    </div>

                    <div className="grid gap-1.5">
                      <Label htmlFor="t-repeat">Repeat</Label>
                      <select
                        id="t-repeat"
                        value={repeat}
                        onChange={(e) => setRepeat(e.target.value as TicketRepeatKind | 'none')}
                        className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                      >
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
                      <div key={s.key} className="flex items-center gap-2 text-xs">
                        <span className="size-3 shrink-0 rounded-full" style={{ background: s.color }} />
                        <span className="font-semibold">{s.label}</span>
                        {i > 0 && s.actorLabel && <span className="text-muted-foreground">· {s.actorLabel}</span>}
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
