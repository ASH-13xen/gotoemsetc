import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Clock3, Layers, Search, Ticket as TicketIcon, Unlock } from 'lucide-react'
import { TicketNav } from '@/components/layout/TicketNav'
import { TicketStub } from '@/components/tickets/TicketStub'
import { ColorGuide } from '@/components/tickets/ColorGuide'
import { RaiseTicketDialog } from '@/components/tickets/RaiseTicketDialog'
import { BatchHandOverDialog, StartManyDialog, batchable } from '@/components/tickets/BatchDialogs'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useCalendarTickets, useTicketMeta, useTicketSummary, useTickets, useWorkList } from '@/hooks/useTickets'
import { usePendingHours } from '@/hooks/useWork'
import { calendarLink, calendarStub, ticketStub } from '@/lib/stubData'
import type { Lineup, Scope, Ticket } from '@/api/tickets.api'
import { cn } from '@/lib/utils'

type Tab = 'mine' | 'to_start' | 'lineups' | 'raised' | 'team' | 'all'
const STATUSES = [
  { key: 'open', label: 'Open' },
  { key: 'completed', label: 'Completed' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
]
const LINEUPS: Lineup[] = ['shoot', 'editing', 'calendar', 'posting', 'hold']

function Empty({ text }: { text: string }) {
  return (
    <div className="grid place-items-center gap-3 rounded-2xl border-2 border-dashed border-border px-6 py-14 text-center">
      <div className="relative">
        <TicketIcon className="size-10 -rotate-12 text-muted-foreground/25" />
      </div>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  )
}

// A ticket card with a tick box in its corner, for doing several at once.
function Pickable({ t, picked, onPick, canPick }: { t: Ticket; picked: boolean; onPick: (v: boolean) => void; canPick: boolean }) {
  if (!canPick) return <TicketStub d={ticketStub(t)} to={`/tickets/${t._id}`} />
  return (
    <div className="flex items-stretch gap-2">
      <div className={cn('grid w-9 shrink-0 place-items-center rounded-2xl ring-1 transition', picked ? 'bg-primary/10 ring-primary' : 'bg-card ring-border')}>
        <Checkbox checked={picked} onCheckedChange={(v) => onPick(Boolean(v))} aria-label={`Select ${t.code}`} className="border-2 border-muted-foreground/40 bg-card data-[state=checked]:border-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <TicketStub d={ticketStub(t)} to={`/tickets/${t._id}`} />
      </div>
    </div>
  )
}

export default function TicketsBoardPage() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'mine'
  const lineup = (params.get('lineup') as Lineup) || undefined
  const status = tab === 'mine' ? 'open' : params.get('status') || 'open'
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [dlg, setDlg] = useState<null | 'batch' | 'start'>(null)
  const { data: meta } = useTicketMeta()
  const { data: summary } = useTicketSummary()
  const { data: pending } = usePendingHours()
  const manages = Boolean(meta && (meta.me.seesEveryone || meta.me.isTeamLead || (meta.me.cmOf?.length ?? 0) > 0))
  const listScope: Scope = tab === 'to_start' || tab === 'lineups' ? 'mine' : tab
  const tickets = useTickets(listScope, status, q || undefined, tab !== 'to_start' && tab !== 'lineups')
  const toStart = useWorkList('to_start', undefined, tab === 'to_start')
  const lineupList = useWorkList('lineup', lineup, tab === 'lineups')
  const calScope = tab === 'raised' || tab === 'to_start' || tab === 'lineups' ? null : tab === 'mine' ? 'mine' : tab === 'team' ? 'team' : 'all'
  const calendar = useCalendarTickets(calScope || 'mine', status, Boolean(calScope) && !q)

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'mine', label: 'For me', count: summary ? summary.waitingCount + summary.calendarWaiting : undefined },
    ...(manages ? [{ key: 'to_start' as Tab, label: 'To start', count: summary?.toStart }] : []),
    { key: 'lineups', label: 'Lineups' },
    { key: 'raised', label: 'Raised by me', count: summary?.raisedOpen },
    ...(meta?.me.hasTeam || meta?.me.seesEveryone ? [{ key: 'team' as Tab, label: 'My team' }] : []),
    ...(meta?.me.seesEveryone ? [{ key: 'all' as Tab, label: 'All tickets' }] : []),
  ]
  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params)
    if (v === null) next.delete(k)
    else next.set(k, v)
    if (k === 'tab') {
      next.delete('status')
      next.delete('lineup')
      setPicked(new Set())
    }
    setParams(next, { replace: true })
  }

  const filter = (list: Ticket[]) => {
    const term = q.trim().toLowerCase()
    return term ? list.filter((t) => t.title.toLowerCase().includes(term) || t.code.toLowerCase().includes(term)) : list
  }
  const list = tab === 'to_start' ? filter(toStart.data || []) : tab === 'lineups' ? filter(lineupList.data || []) : tickets.data || []
  const loading = tab === 'to_start' ? toStart.isLoading : tab === 'lineups' ? lineupList.isLoading : tickets.isLoading
  const cal = calScope ? calendar.data || [] : []
  const canPick = (t: Ticket) => (tab === 'to_start' ? Boolean(t.can.start) : tab === 'mine' ? batchable(t) : false)
  const pickedTickets = useMemo(() => list.filter((t) => picked.has(t._id)), [list, picked])
  const togglePick = (id: string, v: boolean) =>
    setPicked((s) => {
      const n = new Set(s)
      if (v) n.add(id)
      else n.delete(id)
      return n
    })
  const emptyText: Record<Tab, string> = {
    mine: 'Nothing is waiting on you. When a ticket reaches your step, it lands here.',
    to_start: 'Nothing to start. Tickets made from a client’s plan wait here, locked, until you press Start work.',
    lineups: 'Nothing waiting in a lineup.',
    raised: "You haven't raised any tickets yet.",
    team: 'No tickets for the people below you right now.',
    all: 'No tickets here.',
  }

  return (
    <>
      <TicketNav />
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6">
        {/* header */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-primary to-violet-600 p-6 text-white shadow-lg sm:p-8">
          <div className="absolute -right-10 -top-10 size-48 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-16 right-24 size-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/70">Task Management</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Tickets</h1>
              <p className="mt-2 max-w-xl text-sm text-white/80">
                Every ticket moves through its pipeline, changes colour at every step, and keeps a timestamped record of everything that happens — including the hours worked at each step.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                { n: summary ? summary.waitingCount + summary.calendarWaiting : '–', l: 'waiting on you' },
                { n: summary?.overdueCount ?? '–', l: 'of them overdue' },
                ...(manages ? [{ n: summary?.toStart ?? '–', l: 'locked, to start' }] : [{ n: summary?.raisedOpen ?? '–', l: 'raised by you, open' }]),
              ].map((s) => (
                <div key={s.l} className="min-w-[110px] rounded-2xl bg-white/12 px-4 py-3 ring-1 ring-white/20 backdrop-blur">
                  <p className="text-2xl font-black">{s.n}</p>
                  <p className="text-[11px] font-medium text-white/75">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {pending && pending.length > 0 && (
          <Link to="/time" className="flex flex-wrap items-center gap-3 rounded-2xl bg-amber-500/10 p-4 text-sm ring-1 ring-amber-500/30 transition hover:bg-amber-500/15">
            <Clock3 className="size-5 text-amber-600" />
            <span className="min-w-0 flex-1">
              <b>
                {pending.length} step{pending.length === 1 ? '' : 's'} of yours {pending.length === 1 ? 'was' : 'were'} handed on by someone else
              </b>{' '}
              — confirm or change your hours. Left alone, they stand as estimated after three days.
            </span>
            <span className="font-bold text-amber-700">Confirm hours →</span>
          </Link>
        )}

        {/* tabs + filters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1 rounded-2xl bg-secondary/60 p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => set('tab', t.key)}
                className={cn('inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition', tab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                {t.label}
                {t.count !== undefined && t.count > 0 && <span className={cn('rounded-full px-1.5 text-[10px] font-extrabold', tab === t.key ? 'bg-primary text-white' : 'bg-muted-foreground/15')}>{t.count}</span>}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {tab === 'lineups' && (
              <>
                <button type="button" onClick={() => set('lineup', null)} className={cn('rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition', !lineup ? 'bg-foreground text-background ring-foreground' : 'ring-border hover:bg-secondary')}>
                  All
                </button>
                {LINEUPS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => set('lineup', l)}
                    className={cn('rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition', lineup === l ? 'bg-foreground text-background ring-foreground' : 'ring-border hover:bg-secondary')}
                  >
                    {meta?.lineups?.[l]?.label || l}
                  </button>
                ))}
              </>
            )}
            {tab !== 'mine' &&
              tab !== 'to_start' &&
              tab !== 'lineups' &&
              STATUSES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => set('status', s.key)}
                  className={cn('rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition', status === s.key ? 'bg-foreground text-background ring-foreground' : 'ring-border hover:bg-secondary')}
                >
                  {s.label}
                </button>
              ))}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or TKT-…" className="w-56 pl-9" />
            </div>
          </div>
        </div>

        {meta && <ColorGuide meta={meta} />}

        {/* doing several at once */}
        {(tab === 'mine' || tab === 'to_start') && list.some(canPick) && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-3 text-sm ring-1 ring-border">
            <Layers className="size-4 text-muted-foreground" />
            <span className="min-w-0 flex-1 text-muted-foreground">
              {picked.size
                ? `${picked.size} selected`
                : tab === 'mine'
                  ? 'Made several together (a week of stories)? Tick them and hand them on at once, with one figure for the hours.'
                  : 'Tick tickets to start them together.'}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setPicked(new Set(list.filter(canPick).map((t) => t._id)))}>
              Select all
            </Button>
            {picked.size > 0 && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setPicked(new Set())}>
                  Clear
                </Button>
                {tab === 'mine' ? (
                  <Button size="sm" disabled={picked.size < 1} onClick={() => setDlg('batch')}>
                    Hand on {picked.size}
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setDlg('start')}>
                    <Unlock className="size-4" />
                    Start {picked.size}
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        {/* tickets */}
        {loading ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-44 rounded-2xl bg-secondary/50" />
            ))}
          </div>
        ) : list.length === 0 && cal.length === 0 ? (
          <div className="grid gap-4">
            <Empty text={emptyText[tab]} />
            {tab === 'raised' && (
              <div className="justify-self-center">
                <RaiseTicketDialog />
              </div>
            )}
          </div>
        ) : (
          <>
            {list.length > 0 && (
              <section className="grid gap-4 xl:grid-cols-2">
                <AnimatePresence initial={false}>
                  {list.map((t, i) => (
                    <motion.div key={t._id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }}>
                      <Pickable t={t} canPick={canPick(t)} picked={picked.has(t._id)} onPick={(v) => togglePick(t._id, v)} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </section>
            )}
            {cal.length > 0 && (
              <section className="grid gap-3">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">From the content calendar</h2>
                  <p className="text-xs text-muted-foreground">Daily stories and monthly posts and reels — they come from the calendar, nobody raises them.</p>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  {cal.map((t) => (
                    <TicketStub key={`${t.kind}-${t._id}`} d={calendarStub(t)} to={calendarLink(t)} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {dlg === 'batch' && <BatchHandOverDialog tickets={pickedTickets} open onOpenChange={(v) => !v && setDlg(null)} onDone={() => setPicked(new Set())} />}
      {dlg === 'start' && <StartManyDialog tickets={pickedTickets} open onOpenChange={(v) => !v && setDlg(null)} onDone={() => setPicked(new Set())} />}
    </>
  )
}
