import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Camera, CheckCircle2, Loader2, MapPin, Users, XCircle } from 'lucide-react'
import { TicketNav } from '@/components/layout/TicketNav'
import { HoursInput } from '@/components/tickets/HandOverDialog'
import { pickablePeople } from '@/components/tickets/WorkPanels'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { errorMessage, type Ticket } from '@/api/tickets.api'
import { cancelShoot, clock, completeShoot, createShoot, hm, todayKey, type Shoot } from '@/api/work.api'
import { useTicketMeta, useWorkList } from '@/hooks/useTickets'
import { useShoots, useWorkMutation } from '@/hooks/useWork'
import { NoteDialog } from '@/components/tickets/TicketActions'
import { cn } from '@/lib/utils'

const dayLabel = (key: string) => new Date(`${key}T12:00:00+05:30`).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' })
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function PlanDialog({ reels, open, onOpenChange, onDone }: { reels: Ticket[]; open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const { data: meta } = useTicketMeta()
  const teamId = reels[0]?.team?._id
  const people = useMemo(() => pickablePeople(meta, teamId), [meta, teamId])
  const shooters = useMemo(() => [...new Set(reels.map((r) => r.people?.shooter?._id).filter(Boolean) as string[])], [reels])
  const [day, setDay] = useState(todayKey())
  const [from, setFrom] = useState('10:00')
  const [to, setTo] = useState('14:00')
  const [location, setLocation] = useState('')
  const [note, setNote] = useState('')
  const [crew, setCrew] = useState<Set<string>>(new Set())
  const [weights, setWeights] = useState<Record<string, number>>({})
  const save = useWorkMutation(() =>
    createShoot({
      day,
      startMin: toMin(from),
      endMin: toMin(to),
      location: location.trim() || undefined,
      note: note.trim() || undefined,
      people: [...crew],
      ticketIds: reels.map((r) => r._id),
      weights: Object.keys(weights).length ? weights : undefined,
    })
  )
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Plan a shoot for {reels.length} reel{reels.length === 1 ? '' : 's'}</DialogTitle>
          <DialogDescription>The time is blocked on everyone's Weekly Calendar. The reels wait as “Shoot planned” until the day.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label>Day</Label>
              <Input type="date" value={day} min={todayKey()} onChange={(e) => setDay(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>From</Label>
              <Input type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>To</Label>
              <Input type="time" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where (optional)" maxLength={200} />
          <div className="grid gap-1.5">
            <Label>Who else is on it</Label>
            <p className="text-[11px] text-muted-foreground">Each reel's videographer is on it already{shooters.length ? '' : ' (none set)'}.</p>
            <div className="grid max-h-44 gap-1 overflow-y-auto rounded-lg p-2 ring-1 ring-border">
              {people
                .filter((p) => !shooters.includes(p._id))
                .map((p) => (
                  <label key={p._id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={crew.has(p._id)}
                      onCheckedChange={(v) =>
                        setCrew((s) => {
                          const n = new Set(s)
                          if (v) n.add(p._id)
                          else n.delete(p._id)
                          return n
                        })
                      }
                    />
                    {p.name}
                    {p.designation && <span className="text-xs text-muted-foreground">· {p.designation}</span>}
                  </label>
                ))}
            </div>
          </div>
          {reels.length > 1 && (
            <div className="grid gap-1.5">
              <Label>How the hours split across the reels</Label>
              <p className="text-[11px] text-muted-foreground">Equal by default. Give a reel a bigger share if it takes longer (e.g. 2 = twice the others). You can change it when the shoot is done, too.</p>
              {reels.map((r) => (
                <div key={r._id} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {r.code} · {r.title}
                    {r.clientName ? <span className="text-muted-foreground"> · {r.clientName}</span> : null}
                  </span>
                  <Input type="number" min={0} step={0.5} value={weights[r._id] ?? 1} onChange={(e) => setWeights((w) => ({ ...w, [r._id]: Number(e.target.value) }))} className="w-20 text-right" />
                </div>
              ))}
            </div>
          )}
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" rows={2} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={save.isPending || toMin(to) <= toMin(from)}
            onClick={() =>
              save
                .mutateAsync(undefined)
                .then(() => {
                  toast.success('Shoot planned and blocked on the calendar')
                  onDone()
                  onOpenChange(false)
                })
                .catch((err) => toast.error(errorMessage(err, 'Could not plan it')))
            }
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            Plan shoot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CompleteDialog({ s, open, onOpenChange }: { s: Shoot; open: boolean; onOpenChange: (v: boolean) => void }) {
  const length = s.endMin - s.startMin
  const [shot, setShot] = useState<Record<string, boolean>>(() => Object.fromEntries(s.reels.map((r) => [r.ticket, true])))
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [weights, setWeights] = useState<Record<string, number>>(() => Object.fromEntries(s.reels.map((r) => [r.ticket, r.weight])))
  const [hours, setHours] = useState<Record<string, number>>(() => Object.fromEntries(s.people.map((p) => [p._id, length])))
  const save = useWorkMutation(() =>
    completeShoot(s._id, {
      shot: s.reels.filter((r) => shot[r.ticket]).map((r) => r.ticket),
      notShot: s.reels.filter((r) => !shot[r.ticket]).map((r) => ({ ticket: r.ticket, reason: (reasons[r.ticket] || '').trim() })),
      hours: s.people.map((p) => ({ employee: p._id, minutes: hours[p._id] ?? length })),
      weights,
    })
  )
  const missing = s.reels.some((r) => !shot[r.ticket] && !(reasons[r.ticket] || '').trim())
  const shotCount = s.reels.filter((r) => shot[r.ticket]).length
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Shoot done — {dayLabel(s.day)}</DialogTitle>
          <DialogDescription>Shot reels move on to data transfer. Reels not shot go back to the shoot lineup with your reason. Everyone's hours are shared across the shot reels.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>The reels</Label>
            {s.reels
              .filter((r) => r.status === 'planned')
              .map((r) => (
                <div key={r.ticket} className="grid gap-2 rounded-xl p-3 ring-1 ring-border">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {r.code} · {r.title}
                      {r.clientName ? <span className="text-muted-foreground"> · {r.clientName}</span> : null}
                    </span>
                    <div className="flex gap-1 rounded-lg bg-secondary/60 p-0.5">
                      {[true, false].map((v) => (
                        <button key={String(v)} type="button" onClick={() => setShot((x) => ({ ...x, [r.ticket]: v }))} className={cn('rounded-md px-2.5 py-1 text-xs font-bold', shot[r.ticket] === v ? 'bg-card shadow-sm' : 'text-muted-foreground')}>
                          {v ? 'Shot' : 'Not shot'}
                        </button>
                      ))}
                    </div>
                    {shot[r.ticket] && shotCount > 1 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        share
                        <Input type="number" min={0} step={0.5} value={weights[r.ticket] ?? 1} onChange={(e) => setWeights((w) => ({ ...w, [r.ticket]: Number(e.target.value) }))} className="h-8 w-16 text-right" />
                      </span>
                    )}
                  </div>
                  {!shot[r.ticket] && <Input value={reasons[r.ticket] || ''} onChange={(e) => setReasons((x) => ({ ...x, [r.ticket]: e.target.value }))} placeholder="Why wasn't it shot? (required)" />}
                </div>
              ))}
          </div>
          <div className="grid gap-2">
            <Label>Hours on the shoot</Label>
            <p className="text-[11px] text-muted-foreground">Each person's time, travel included — the planned {hm(length)} unless you change it.</p>
            {s.people.map((p) => (
              <div key={p._id} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                <HoursInput value={hours[p._id] ?? length} onChange={(m) => setHours((h) => ({ ...h, [p._id]: m }))} />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={save.isPending || missing}
            onClick={() =>
              save
                .mutateAsync(undefined)
                .then(() => {
                  toast.success('Shoot closed')
                  onOpenChange(false)
                })
                .catch((err) => toast.error(errorMessage(err, 'Could not close it')))
            }
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Close the shoot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ShootCard({ s }: { s: Shoot }) {
  const [dlg, setDlg] = useState<null | 'done' | 'cancel'>(null)
  const cancel = useWorkMutation((reason: string) => cancelShoot(s._id, reason))
  const today = todayKey()
  return (
    <div className={cn('grid gap-3 rounded-2xl bg-card p-4 ring-1', s.status === 'planned' ? 'ring-blue-500/40' : 'ring-border', s.status === 'cancelled' && 'opacity-60')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg px-2 py-1 text-xs font-black text-white" style={{ background: '#2563eb' }}>
          {dayLabel(s.day)}
        </span>
        <span className="text-sm font-bold">
          {clock(s.startMin)} – {clock(s.endMin)}
        </span>
        {s.location && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3" />
            {s.location}
          </span>
        )}
        <span
          className={cn(
            'ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
            s.status === 'planned' ? 'bg-blue-500/12 text-blue-700' : s.status === 'done' ? 'bg-emerald-500/12 text-emerald-700' : 'bg-slate-500/12 text-slate-600'
          )}
        >
          {s.status === 'planned' ? (s.day < today ? 'To close' : 'Planned') : s.status === 'done' ? 'Done' : 'Cancelled'}
        </span>
      </div>
      <ul className="grid gap-1 text-sm">
        {s.reels.map((r) => (
          <li key={r.ticket} className="flex items-center gap-2">
            <Link to={`/tickets/${r.ticket}`} className="min-w-0 flex-1 truncate hover:underline">
              <span className="font-mono text-xs font-bold">{r.code}</span> {r.title}
              {r.clientName ? <span className="text-muted-foreground"> · {r.clientName}</span> : null}
            </Link>
            {r.status === 'shot' && <span className="text-[11px] font-bold text-emerald-700">shot</span>}
            {r.status === 'not_shot' && <span className="text-[11px] font-bold text-pink-600" title={r.reason}>not shot</span>}
            {r.status === 'removed' && <span className="text-[11px] text-muted-foreground">removed</span>}
          </li>
        ))}
      </ul>
      <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="size-3.5" />
        {s.people.map((p) => p.name).join(', ') || '—'}
      </p>
      {s.status === 'done' && s.hours.length > 0 && <p className="text-xs text-muted-foreground">Hours: {s.hours.map((h) => `${h.name} ${hm(h.minutes)}`).join(' · ')}</p>}
      {s.status === 'cancelled' && s.cancelReason && <p className="text-xs italic text-muted-foreground">{s.cancelReason}</p>}
      {s.status === 'planned' && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setDlg('done')}>
            <CheckCircle2 className="size-4" />
            Shoot done
          </Button>
          <Button size="sm" variant="outline" className="text-red-600" onClick={() => setDlg('cancel')}>
            <XCircle className="size-4" />
            Cancel
          </Button>
        </div>
      )}
      {dlg === 'done' && <CompleteDialog s={s} open onOpenChange={(v) => !v && setDlg(null)} />}
      <NoteDialog
        open={dlg === 'cancel'}
        onOpenChange={(v) => setDlg(v ? 'cancel' : null)}
        title="Cancel this shoot?"
        description="Its reels go back to the shoot lineup and the calendar block is freed."
        required
        placeholder="Why is it cancelled?"
        confirmLabel="Cancel shoot"
        destructive
        onConfirm={async (r) => {
          await cancel.mutateAsync(r)
          toast.success('Cancelled')
        }}
      />
    </div>
  )
}

export default function ShootsPage() {
  const lineup = useWorkList('lineup', 'shoot')
  const { data: shoots, isLoading } = useShoots()
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [planning, setPlanning] = useState(false)
  const reels = (lineup.data || []).filter((t) => t.pipeline === 'reel_v2')
  const pickedReels = reels.filter((r) => picked.has(r._id))
  const planned = (shoots || []).filter((s) => s.status === 'planned')
  const past = (shoots || []).filter((s) => s.status !== 'planned').reverse()
  return (
    <>
      <TicketNav />
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">Client work</p>
          <h1 className="text-2xl font-black tracking-tight">Shoots</h1>
          <p className="text-sm text-muted-foreground">One shoot can cover several reels, from several clients. Its hours are shared across the reels shot.</p>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <section className="grid gap-3 rounded-2xl bg-card p-5 ring-1 ring-border">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Reels in the shoot lineup</h2>
              <Button size="sm" disabled={pickedReels.length === 0} onClick={() => setPlanning(true)}>
                <Camera className="size-4" />
                Plan a shoot{pickedReels.length ? ` (${pickedReels.length})` : ''}
              </Button>
            </div>
            {lineup.isLoading ? (
              <Skeleton className="h-24 rounded-xl bg-secondary/50" />
            ) : reels.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reels waiting. A reel joins the lineup once its script is approved.</p>
            ) : (
              <ul className="grid gap-2">
                {reels.map((r) => (
                  <li key={r._id} className={cn('flex items-center gap-3 rounded-xl p-3 text-sm ring-1', picked.has(r._id) ? 'bg-primary/5 ring-primary' : 'ring-border')}>
                    <Checkbox
                      className="border-2 border-muted-foreground/40 bg-card data-[state=checked]:border-primary"
                      checked={picked.has(r._id)}
                      onCheckedChange={(v) =>
                        setPicked((s) => {
                          const n = new Set(s)
                          if (v) n.add(r._id)
                          else n.delete(r._id)
                          return n
                        })
                      }
                    />
                    <Link to={`/tickets/${r._id}`} className="min-w-0 flex-1 hover:underline">
                      <span className="font-mono text-xs font-bold">{r.code}</span> <span className="font-medium">{r.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {[r.clientName, r.team?.title, r.people?.shooter?.name ? `videographer ${r.people.shooter.name}` : null].filter(Boolean).join(' · ')}
                        {r.parkNote ? ` · ${r.parkNote}` : ''}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="grid gap-3">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Planned</h2>
            {isLoading ? <Skeleton className="h-32 rounded-2xl bg-secondary/50" /> : planned.length === 0 ? <p className="text-sm text-muted-foreground">No shoots planned.</p> : planned.map((s) => <ShootCard key={s._id} s={s} />)}
            {past.length > 0 && (
              <>
                <h2 className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Earlier</h2>
                {past.slice(0, 20).map((s) => (
                  <ShootCard key={s._id} s={s} />
                ))}
              </>
            )}
          </section>
        </div>
      </main>
      {planning && <PlanDialog reels={pickedReels} open onOpenChange={setPlanning} onDone={() => setPicked(new Set())} />}
    </>
  )
}
