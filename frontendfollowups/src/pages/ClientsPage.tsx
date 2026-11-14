import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, ChevronLeft, ChevronRight, History, Loader2, Lock, PauseCircle, PlayCircle, Plus, Save } from 'lucide-react'
import { TicketNav } from '@/components/layout/TicketNav'
import { PersonPicker, pickablePeople } from '@/components/tickets/WorkPanels'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { errorMessage } from '@/api/tickets.api'
import { addClient, addMonth, hm, monthKeyOf, monthName, rupees, saveClientMonth, setClientPaused, type ContentType, type Counts, type MonthTicket } from '@/api/work.api'
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
              <Link key={c.client._id} to={`/clients/${c.client._id}?month=${month}`} className={cn('grid gap-3 rounded-2xl bg-card p-4 ring-1 ring-border transition hover:-translate-y-0.5 hover:shadow-md', c.client.workPaused && 'opacity-60')}>
                <div className="flex items-start gap-3">
                  {c.client.logoUrl ? <img src={c.client.logoUrl} alt="" className="size-10 rounded-xl object-cover ring-1 ring-border" /> : <span className="grid size-10 place-items-center rounded-xl bg-secondary text-sm font-black">{c.client.name.slice(0, 2).toUpperCase()}</span>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold">{c.client.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{[c.team?.title, c.smm?.name ? `SMM ${c.smm.name}` : null].filter(Boolean).join(' · ') || (c.planned ? '' : 'No plan for this month')}</p>
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
                              {p.done}/{p.committed} done{p.toStart ? ` · ${p.toStart} to start` : ''}
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
                  <span>{c.hoursLogged} h logged</span>
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

function TicketRow({ t }: { t: MonthTicket }) {
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
      {t.parkedIn && <PauseCircle className="size-3.5 text-muted-foreground" />}
      {t.carriedOver && <History className="size-3.5 text-amber-600" />}
      <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">{fmtDate(t.dueAt)}</span>
      <span className="w-14 shrink-0 text-right font-mono text-xs">{t.minutes ? hm(t.minutes) : ''}</span>
    </li>
  )
}

type PeopleKey = 'smm' | 'designer' | 'shooter' | 'editor' | 'contentManager'
const PEOPLE: { key: PeopleKey; label: string }[] = [
  { key: 'contentManager', label: 'Content Manager' },
  { key: 'smm', label: 'Social Media Manager' },
  { key: 'designer', label: 'Graphic designer' },
  { key: 'shooter', label: 'Videographer' },
  { key: 'editor', label: 'Video editor' },
]

export function ClientMonthPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const month = params.get('month') || monthKeyOf()
  const { data: meta } = useTicketMeta()
  const { data, isLoading } = useClientMonth(id, month)
  const [counts, setCounts] = useState<Counts>({ reels: 0, posts: 0, stories: 0, festiveStories: 0 })
  const [team, setTeam] = useState('')
  const [people, setPeople] = useState<Partial<Record<PeopleKey, string>>>({})
  const [fee, setFee] = useState('')
  useEffect(() => {
    if (!data) return
    setCounts(data.plan?.counts || { reels: 0, posts: 0, stories: 0, festiveStories: 0 })
    setTeam(data.plan?.team || '')
    setPeople(Object.fromEntries(PEOPLE.map((p) => [p.key, data.plan?.[p.key]?._id || ''])))
    setFee(data.plan?.fee != null ? String(data.plan.fee) : '')
  }, [data])
  const choices = useMemo(() => pickablePeople(meta, team), [meta, team])
  const save = useWorkMutation(() =>
    saveClientMonth(id!, month, {
      counts,
      team: team || null,
      ...Object.fromEntries(PEOPLE.map((p) => [p.key, people[p.key] || null])),
      ...(data?.canSeeMoney ? { fee: fee.trim() === '' ? null : Number(fee) } : {}),
    })
  )
  const pause = useWorkMutation((v: boolean) => setClientPaused(id!, v))
  const go = (m: string) => navigate(`/clients/${id}?month=${m}`, { replace: true })
  const editable = Boolean(data?.canPlan)

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
                  {data.plan?.isSuggestion ? `No plan for ${data.monthLabel} yet — showing ${monthName(data.plan.fromMonth)}'s to start from.` : data.plan ? `The plan for ${data.monthLabel}.` : `No plan for ${data.monthLabel} yet.`}
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
                  <Select value={team || undefined} onValueChange={(v) => setTeam(v)} disabled={!editable}>
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
                  <p className="text-[11px] text-muted-foreground">People left empty are filled from the team's boxes when you save.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {PEOPLE.map((p) => (
                    <div key={p.key} className="grid gap-1.5">
                      <Label>{p.label}</Label>
                      {editable ? <PersonPicker people={choices} value={people[p.key] || ''} onChange={(v) => setPeople((x) => ({ ...x, [p.key]: v }))} placeholder="From the team" /> : <p className="text-sm">{data.plan?.[p.key]?.name || '—'}</p>}
                    </div>
                  ))}
                </div>
                {data.canSeeMoney && (
                  <div className="grid gap-1.5">
                    <Label>Monthly fee (₹)</Label>
                    <Input type="number" min={0} value={fee} disabled={!editable} onChange={(e) => setFee(e.target.value)} placeholder="Used when there's no invoice for the month" />
                    {data.invoice && (
                      <p className="text-[11px] text-muted-foreground">
                        Invoice {data.invoice.number}: {rupees(data.invoice.amount)} ({data.invoice.status}) — used instead of the fee.
                      </p>
                    )}
                  </div>
                )}
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
                  Tickets are made locked, due at the month's end until someone starts the work and sets the real due date. Lowering a number takes off tickets nobody has worked on yet (locked ones first).
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
                    return (
                      <div key={t.key}>
                        <p className="mb-1 text-xs font-bold">
                          {t.plural} · {of.filter((x) => x.status === 'completed').length}/{of.filter((x) => !x.removed).length} done
                        </p>
                        <ul className="grid">{of.map((x) => <TicketRow key={x._id} t={x} />)}</ul>
                      </div>
                    )
                  })
                )}
                {data.carriedOver.length > 0 && (
                  <div>
                    <p className="mb-1 flex items-center gap-1 text-xs font-bold text-amber-700">
                      <History className="size-3.5" />
                      Carried over from earlier months
                    </p>
                    <ul className="grid">{data.carriedOver.map((x) => <TicketRow key={x._id} t={x} />)}</ul>
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
