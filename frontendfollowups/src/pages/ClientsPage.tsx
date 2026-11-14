import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, ChevronLeft, ChevronRight, History, Loader2, Lock, PauseCircle, PlayCircle, Plus, Save, X } from 'lucide-react'
import { TicketNav } from '@/components/layout/TicketNav'
import { PersonPicker, pickablePeople } from '@/components/tickets/WorkPanels'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { errorMessage, type Person, type PickPerson, type TicketMeta } from '@/api/tickets.api'
import {
  addClient,
  addExtraTicket,
  addMonth,
  hm,
  monthKeyOf,
  monthName,
  rupees,
  saveClientMonth,
  setClientPaused,
  type ClientCard,
  type ContentType,
  type Counts,
  type MonthPlan,
  type MonthTicket,
  type PlanRole,
} from '@/api/work.api'
import { useTicketMeta } from '@/hooks/useTickets'
import { useClientCards, useClientMonth, useWorkMutation } from '@/hooks/useWork'
import { fade, fmtDate, inkOn } from '@/lib/ticketFormat'
import { cn } from '@/lib/utils'

const TYPES: ContentType[] = ['reels', 'posts', 'stories', 'festiveStories']
const TYPE_COLOR: Record<ContentType, string> = { reels: '#e1ad01', posts: '#f97316', stories: '#795548', festiveStories: '#795548' }

function MonthSwitch({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Button size="icon" variant="outline" onClick={() => onChange(addMonth(month, -1))} aria-label="Month before">
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-36 text-center text-sm font-bold">{monthName(month)}</span>
      <Button size="icon" variant="outline" onClick={() => onChange(addMonth(month, 1))} aria-label="Month after">
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}

function Bar({ done, made, committed, color }: { done: number; made: number; committed: number; color: string }) {
  const total = Math.max(committed, made, 1)
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-secondary">
      <span style={{ width: `${(done / total) * 100}%`, background: color }} />
      <span style={{ width: `${(Math.max(0, made - done) / total) * 100}%`, background: fade(color, 0.6) }} />
    </div>
  )
}

// The CEO and admin add a client: its name (and brand), then on to its month
// to set the plan that makes its tickets.
function AddClientDialog({ month, onClose }: { month: string; onClose: () => void }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [brandName, setBrandName] = useState('')
  const add = useWorkMutation(() => addClient({ name: name.trim(), brandName: brandName.trim() || undefined }))
  const submit = () =>
    add
      .mutateAsync(undefined)
      .then(({ client, restored }) => {
        toast.success(restored ? `${client.name} is back — removed before, its history is kept` : `${client.name} added — now set this month's plan`)
        onClose()
        navigate(`/clients/${client._id}?month=${month}`)
      })
      .catch((err) => toast.error(errorMessage(err, 'Could not add the client')))
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a client</DialogTitle>
          <DialogDescription>Next, set the month's plan (reels, posts, stories and the team) to make its tickets.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim() && !add.isPending) submit()
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="client-name">Client name</Label>
            <Input id="client-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Pvt Ltd" maxLength={120} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="client-brand">Brand name (optional)</Label>
            <Input id="client-brand" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Acme" maxLength={120} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!name.trim() || add.isPending}>
              {add.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Add client
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const smmNames = (c: ClientCard) => (c.smms?.length ? c.smms : c.smm ? [c.smm] : []).map((p) => p.name).filter(Boolean)

export function ClientsPage() {
  const [params, setParams] = useSearchParams()
  const month = params.get('month') || monthKeyOf()
  const { data, isLoading } = useClientCards(month)
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const cards = (data?.cards || []).filter((c) => !q.trim() || c.client.name.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <>
      <TicketNav />
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">Client work</p>
            <h1 className="text-2xl font-black tracking-tight">Clients</h1>
            <p className="text-sm text-muted-foreground">Each client's plan for the month — how many reels, posts and stories — makes its tickets, locked until work is started.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients" className="w-48" />
            <MonthSwitch month={month} onChange={(m) => setParams({ month: m }, { replace: true })} />
            {data?.canAddClient && (
              <Button onClick={() => setAdding(true)}>
                <Plus className="size-4" />
                Add client
              </Button>
            )}
          </div>
        </div>
        {!isLoading && data && data.cards.length === 0 && (
          <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-border">
            No clients yet.{data.canAddClient ? ' Add one to plan its month and make its tickets.' : ''}
          </p>
        )}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-48 rounded-2xl bg-secondary/50" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((c) => (
              <Link key={c.client._id} to={`/clients/${c.client._id}?month=${month}`} className={cn('grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 rounded-2xl bg-card p-4 ring-1 ring-border transition hover:-translate-y-0.5 hover:shadow-md', c.client.workPaused && 'opacity-60')}>
                <div className="flex items-start gap-3">
                  {c.client.logoUrl ? <img src={c.client.logoUrl} alt="" className="size-10 rounded-xl object-cover ring-1 ring-border" /> : <span className="grid size-10 place-items-center rounded-xl bg-secondary text-sm font-black">{c.client.name.slice(0, 2).toUpperCase()}</span>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold">{c.client.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[c.team?.title, smmNames(c).length ? `SMM ${smmNames(c).join(', ')}` : null].filter(Boolean).join(' · ') || (c.planned ? '' : 'No plan for this month')}
                    </p>
                    {c.carriedFrom && <p className="text-[11px] text-muted-foreground">Same plan as {monthName(c.carriedFrom)}</p>}
                  </div>
                  {c.client.workPaused && <span className="rounded-full bg-slate-500/12 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">Paused</span>}
                </div>
                {c.planned ? (
                  <div className="grid gap-2">
                    {TYPES.filter((k) => c.progress[k].committed || c.progress[k].made).map((k) => {
                      const p = c.progress[k]
                      return (
                        <div key={k} className="grid gap-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold">{data?.types.find((t) => t.key === k)?.plural}</span>
                            <span className="text-muted-foreground">
                              {p.done}/{p.committed} done{p.extra ? ` · ${p.extra} extra` : ''}
                              {p.toStart ? ` · ${p.toStart} to start` : ''}
                            </span>
                          </div>
                          <Bar done={p.done} made={p.made} committed={p.committed} color={TYPE_COLOR[k]} />
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{data?.canPlan ? 'Set the plan →' : 'Not planned yet.'}</p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  {c.hoursLogged != null && <span>{c.hoursLogged} h logged</span>}
                  {c.carriedOver > 0 && (
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                      <History className="size-3" />
                      {c.carriedOver} carried over
                    </span>
                  )}
                  {c.revenue && (
                    <span>
                      {rupees(c.revenue.amount)} · {c.revenue.source === 'invoice' ? 'invoice' : 'fee'}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      {adding && <AddClientDialog month={month} onClose={() => setAdding(false)} />}
    </>
  )
}

function TicketRow({ t, showTime }: { t: MonthTicket; showTime: boolean }) {
  const color = t.locked ? fade(t.color, 0.55) : t.color
  return (
    <li className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm', t.removed && 'opacity-50')}>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: color, color: inkOn(color) }}>
        {t.locked && <Lock className="size-2.5" />}
        {t.removed ? 'Removed' : t.locked ? 'Locked' : t.stageLabel}
      </span>
      <Link to={`/tickets/${t._id}`} className="min-w-0 flex-1 truncate hover:underline">
        <span className="font-mono text-xs font-bold">{t.code}</span> {t.title}
      </Link>
      {t.extra && <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">Extra</span>}
      {t.parkedIn && <PauseCircle className="size-3.5 text-muted-foreground" />}
      {t.carriedOver && <History className="size-3.5 text-amber-600" />}
      <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">{fmtDate(t.dueAt)}</span>
      {showTime && <span className="w-14 shrink-0 text-right font-mono text-xs">{t.minutes ? hm(t.minutes) : ''}</span>}
    </li>
  )
}

// The roles on a client's tickets, and the boxes in a team that fill each.
const PEOPLE: { key: PlanRole; label: string; boxes: string[]; none: string }[] = [
  { key: 'contentManager', label: 'Content Manager', boxes: ['content_manager'], none: 'Nobody yet' },
  { key: 'smm', label: 'Social Media Manager', boxes: ['social_media_manager'], none: 'Nobody yet' },
  { key: 'designer', label: 'Graphic designer', boxes: ['graphic_designer'], none: 'None — the Social Media Manager makes the posts' },
  { key: 'shooter', label: 'Videographer', boxes: ['videographer', 'videographer_editor'], none: 'Nobody yet' },
  { key: 'editor', label: 'Video editor', boxes: ['editor', 'videographer_editor'], none: 'Nobody yet' },
]
type People = Record<PlanRole, Person[]>
const noPeople = (): People => ({ smm: [], designer: [], shooter: [], editor: [], contentManager: [] })

// Everyone holding each role in a team (the Organisation chart) — what choosing the team fills in.
function teamPeople(meta: TicketMeta | undefined, teamId: string): People {
  const out = noPeople()
  const team = meta?.teams.find((t) => t._id === teamId)
  if (!team) return out
  for (const p of PEOPLE) {
    const seen = new Map<string, Person>()
    team.roles.filter((r) => p.boxes.includes(r.role)).forEach((r) => r.holders.forEach((h) => seen.set(h._id, { _id: h._id, name: h.name })))
    out[p.key] = [...seen.values()]
  }
  // No Content Manager box: the team's head.
  if (!out.contentManager.length) out.contentManager = team.heads.map((h) => ({ _id: h._id, name: h.name }))
  return out
}

// A plan's people per role: its lists, or the single fields of an older plan.
function planPeople(plan: MonthPlan | null | undefined): People {
  const out = noPeople()
  if (!plan) return out
  for (const p of PEOPLE) {
    const one = plan[p.key]
    out[p.key] = plan.people?.[p.key]?.length ? plan.people[p.key] : one ? [one] : []
  }
  return out
}

// One role's people: each as a chip (removable), and "Add someone" for more.
function PeopleField({
  label,
  none,
  people,
  choices,
  editable,
  onChange,
}: {
  label: string
  none: string
  people: Person[]
  choices: PickPerson[]
  editable: boolean
  onChange: (next: Person[]) => void
}) {
  const left = choices.filter((c) => !people.some((p) => p._id === c._id))
  const add = (id: string) => {
    const c = choices.find((x) => x._id === id)
    if (c && !people.some((p) => p._id === id)) onChange([...people, { _id: c._id, name: c.name }])
  }
  return (
    <div className="grid content-start gap-1.5">
      <div>
        <Label>{label}</Label>
        {people.length > 1 && <p className="text-[11px] text-muted-foreground">{people.length} people — tickets shared in turn</p>}
      </div>
      <div className="flex min-h-7 flex-wrap items-center gap-1.5">
        {people.length === 0 && <span className="text-xs text-muted-foreground">{none}</span>}
        {people.map((p) => (
          <span key={p._id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">
            <span className="truncate">{p.name || 'Unknown'}</span>
            {editable && (
              <button type="button" aria-label={`Remove ${p.name || 'this person'}`} className="shrink-0 rounded-full text-muted-foreground hover:text-foreground" onClick={() => onChange(people.filter((x) => x._id !== p._id))}>
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {editable && left.length > 0 && <PersonPicker key={people.map((p) => p._id).join()} people={left} value="" onChange={add} placeholder="Add someone" />}
    </div>
  )
}

export function ClientMonthPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const month = params.get('month') || monthKeyOf()
  const { data: meta } = useTicketMeta()
  const { data, isLoading } = useClientMonth(id, month)
  const [counts, setCounts] = useState<Counts>({ reels: 0, posts: 0, stories: 0, festiveStories: 0 })
  const [team, setTeam] = useState('')
  const [people, setPeople] = useState<People>(noPeople)
  useEffect(() => {
    if (!data) return
    setCounts(data.plan?.counts || { reels: 0, posts: 0, stories: 0, festiveStories: 0 })
    setTeam(data.plan?.team || '')
    setPeople(planPeople(data.plan))
  }, [data])
  const choices = useMemo(() => pickablePeople(meta, team), [meta, team])
  // Choosing a team fills every role with the team's people.
  const chooseTeam = (teamId: string) => {
    setTeam(teamId)
    setPeople(teamPeople(meta, teamId))
  }
  // The fee is no longer set here: leaving it out keeps what is stored.
  const save = useWorkMutation(() =>
    saveClientMonth(id!, month, {
      counts,
      team: team || null,
      people: Object.fromEntries(PEOPLE.map((p) => [p.key, people[p.key].map((x) => x._id)])),
    })
  )
  const extra = useWorkMutation((type: ContentType) => addExtraTicket(id!, month, type))
  const pause = useWorkMutation((v: boolean) => setClientPaused(id!, v))
  const go = (m: string) => navigate(`/clients/${id}?month=${m}`, { replace: true })
  const editable = Boolean(data?.canPlan)
  const ownPlan = Boolean(data?.plan && !data.plan.isSuggestion && !data.plan.carried)

  return (
    <>
      <TicketNav />
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6">
        <Link to={`/clients?month=${month}`} className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" />
          All clients
        </Link>
        {isLoading || !data ? (
          <Skeleton className="h-64 rounded-2xl bg-secondary/50" />
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black tracking-tight">{data.client.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {data.plan?.carried
                    ? `Same plan as ${monthName(data.plan.fromMonth)} — it carries on every month until you change it.`
                    : data.plan?.isSuggestion
                      ? `No plan for ${data.monthLabel} — showing ${monthName(data.plan.fromMonth)}'s to start from.`
                      : data.plan
                        ? `The plan for ${data.monthLabel} — it carries on to the next months until you change it.`
                        : `No plan for ${data.monthLabel} yet.`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {editable && (
                  <Button variant="outline" size="sm" disabled={pause.isPending} onClick={() => pause.mutateAsync(!data.client.workPaused).then(() => toast.success(data.client.workPaused ? 'Resumed' : 'Paused'))}>
                    {data.client.workPaused ? <PlayCircle className="size-4" /> : <PauseCircle className="size-4" />}
                    {data.client.workPaused ? 'Resume next months' : 'Pause next months'}
                  </Button>
                )}
                <MonthSwitch month={month} onChange={go} />
              </div>
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
              <section className="grid gap-4 rounded-2xl bg-card p-5 ring-1 ring-border">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">The month's plan</h2>
                <div className="grid grid-cols-2 gap-3">
                  {data.types.map((t) => (
                    <div key={t.key} className="grid gap-1.5">
                      <Label className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ background: TYPE_COLOR[t.key] }} />
                        {t.plural}
                      </Label>
                      <Input type="number" min={0} max={200} value={counts[t.key]} disabled={!editable} onChange={(e) => setCounts((c) => ({ ...c, [t.key]: Math.max(0, parseInt(e.target.value || '0', 10)) }))} />
                    </div>
                  ))}
                </div>
                <div className="grid gap-1.5">
                  <Label>Team</Label>
                  <Select value={team || undefined} onValueChange={chooseTeam} disabled={!editable}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose the team" />
                    </SelectTrigger>
                    <SelectContent>
                      {meta?.teams.map((t) => (
                        <SelectItem key={t._id} value={t._id}>
                          {t.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">Choosing the team fills in its people below — add or remove anyone.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {PEOPLE.map((p) => (
                    <PeopleField
                      key={p.key}
                      label={p.label}
                      none={p.none}
                      people={people[p.key]}
                      choices={choices}
                      editable={editable && Boolean(team)}
                      onChange={(next) => setPeople((x) => ({ ...x, [p.key]: next }))}
                    />
                  ))}
                </div>
                {editable && (
                  <Button
                    className="justify-self-end"
                    disabled={save.isPending || !team}
                    onClick={() =>
                      save
                        .mutateAsync(undefined)
                        .then((r) => {
                          const made = r.result?.created || 0
                          const removed = r.result?.removed || 0
                          toast.success(made || removed ? `Saved — ${made} ticket${made === 1 ? '' : 's'} made${removed ? `, ${removed} taken off` : ''}` : 'Saved')
                        })
                        .catch((err) => toast.error(errorMessage(err, 'Could not save the plan')))
                    }
                  >
                    {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Save and make the tickets
                  </Button>
                )}
                <p className="text-[11px] text-muted-foreground">
                  The plan stays the same every month until you change it. With more than one person in a role, the tickets are shared between them in turn. Tickets are made locked, due at the month's end until someone starts the work and sets the real due date. Lowering a number takes off tickets nobody has worked on yet (locked ones first).
                </p>
              </section>

              <section className="grid gap-4 rounded-2xl bg-card p-5 ring-1 ring-border">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Its tickets</h2>
                {data.tickets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None yet — save the plan to make them.</p>
                ) : (
                  data.types.map((t) => {
                    const of = data.tickets.filter((x) => x.type === t.key)
                    if (!of.length) return null
                    const live = of.filter((x) => !x.removed)
                    const extras = live.filter((x) => x.extra).length
                    const committed = ownPlan ? data.plan!.counts[t.key] : live.length - extras
                    return (
                      <div key={t.key}>
                        <p className="mb-1 text-xs font-bold">
                          {t.plural} · {live.filter((x) => x.status === 'completed').length}/{committed} done{extras ? ` · ${extras} extra` : ''}
                        </p>
                        <ul className="grid">{of.map((x) => <TicketRow key={x._id} t={x} showTime={Boolean(data.canSeeTime)} />)}</ul>
                      </div>
                    )
                  })
                )}
                {data.canAddExtra && (
                  <div className="grid gap-2 border-t border-border pt-3">
                    <p className="text-xs font-bold">More than the plan</p>
                    <div className="flex flex-wrap gap-2">
                      {data.types.map((t) => (
                        <Button
                          key={t.key}
                          size="sm"
                          variant="outline"
                          disabled={extra.isPending}
                          onClick={() => {
                            if (!window.confirm(`Make one more ${t.label.toLowerCase()} ticket for ${data.client.name} in ${data.monthLabel}, beyond the plan's ${data.plan?.counts[t.key] ?? 0}?`)) return
                            extra
                              .mutateAsync(t.key)
                              .then(() => toast.success(`Extra ${t.label.toLowerCase()} made`))
                              .catch((err) => toast.error(errorMessage(err, 'Could not make the ticket')))
                          }}
                        >
                          <Plus className="size-3.5" />
                          {t.label}
                        </Button>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">An extra ticket doesn't change the plan — it shows as, say, 9/8. Raising the count later takes the extras into it.</p>
                  </div>
                )}
                {data.carriedOver.length > 0 && (
                  <div>
                    <p className="mb-1 flex items-center gap-1 text-xs font-bold text-amber-700">
                      <History className="size-3.5" />
                      Carried over from earlier months
                    </p>
                    <ul className="grid">{data.carriedOver.map((x) => <TicketRow key={x._id} t={x} showTime={Boolean(data.canSeeTime)} />)}</ul>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </main>
    </>
  )
}
