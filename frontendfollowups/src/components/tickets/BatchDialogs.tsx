import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Unlock } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DateTimePicker } from '@/components/shared/DateTimePicker'
import { advanceTickets, errorMessage, getEstimates, startTickets, type StepEstimate, type Ticket } from '@/api/tickets.api'
import { hm } from '@/api/work.api'
import { useTicketMutation } from '@/hooks/useTickets'
import { HoursCheck } from './HandOverDialog'

// Can this ticket be handed on together with others? (Not when its step
// asks for a date, a link, or happens through a shoot.)
export const batchable = (t: Ticket) => Boolean(t.isWork && t.can.act && t.next && !t.next.needsDate && !t.next.needsLink && !t.next.viaShoot)

// Several tickets made together (a week of stories) handed on at once: one
// figure for the hours, shared by their estimates.
export function BatchHandOverDialog({ tickets, open, onOpenChange, onDone }: { tickets: Ticket[]; open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const [est, setEst] = useState<{ tickets: StepEstimate[]; totalMinutes: number } | null>(null)
  const [minutes, setMinutes] = useState(0)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const ids = tickets.map((t) => t._id)
  const key = ids.join(',')
  const move = useTicketMutation(() => {
    const ask = est?.tickets.some((x) => x.ask)
    const changed = ask && Math.abs(minutes - (est?.totalMinutes || 0)) >= 1
    return advanceTickets({ ids, note: note.trim() || undefined, ...(ask ? { minutes, reason: changed ? reason.trim() : undefined } : {}) })
  })

  useEffect(() => {
    if (!open || !key) return
    setEst(null)
    setReason('')
    getEstimates(key.split(','))
      .then((e) => {
        setEst(e)
        setMinutes(e.totalMinutes)
      })
      .catch((err) => toast.error(errorMessage(err, 'Could not work out the hours')))
  }, [open, key])

  const ask = Boolean(est?.tickets.some((x) => x.ask))
  const changed = ask && Math.abs(minutes - (est?.totalMinutes || 0)) >= 1
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Hand on {tickets.length} tickets together</DialogTitle>
          <DialogDescription>Each moves to its next step. The hours you give are shared across them by their estimates.</DialogDescription>
        </DialogHeader>
        {!est ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="grid gap-4">
            <ul className="grid max-h-40 gap-1 overflow-y-auto rounded-xl bg-secondary/30 p-3 text-xs ring-1 ring-border">
              {tickets.map((t) => {
                const e = est.tickets.find((x) => x.ticket === t._id)
                return (
                  <li key={t._id} className="flex items-center gap-2">
                    <span className="font-mono font-bold">{t.code}</span>
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    <span className="text-muted-foreground">→ {t.nextStepLabel}</span>
                    {e?.ask && <span className="font-mono">{hm(e.minutes)}</span>}
                  </li>
                )
              })}
            </ul>
            {ask && <HoursCheck label="Your hours on all of them" estimate={est.totalMinutes} minutes={minutes} setMinutes={setMinutes} reason={reason} setReason={setReason} />}
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note — kept in each ticket's record" rows={2} />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!est || move.isPending || (changed && !reason.trim())}
            onClick={() =>
              move
                .mutateAsync(undefined)
                .then((r) => {
                  toast.success(`${r.advanced} moved on`)
                  onDone()
                  onOpenChange(false)
                })
                .catch((err) => toast.error(errorMessage(err, 'That did not work')))
            }
          >
            {move.isPending && <Loader2 className="size-4 animate-spin" />}
            Move them on
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const pad = (n: number) => String(n).padStart(2, '0')
function inDays(n: number) {
  const d = new Date(Date.now() + n * 86_400_000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T18:30`
}

// Starting several locked tickets with one due date (or each keeps the one
// it has — the month's end, for tickets made from a plan).
export function StartManyDialog({ tickets, open, onOpenChange, onDone }: { tickets: Ticket[]; open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const [mode, setMode] = useState<'planned' | 'one'>('one')
  const [due, setDue] = useState(inDays(7))
  const start = useTicketMutation(() =>
    mode === 'one' ? startTickets({ ids: tickets.map((t) => t._id), dueAt: new Date(due).toISOString() }) : startTickets({ items: tickets.map((t) => ({ id: t._id, dueAt: t.dueAt })) })
  )
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Start work on {tickets.length} tickets</DialogTitle>
          <DialogDescription>They unlock and go to their first person. Time starts counting from now.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Label>Due dates</Label>
          <div className="grid gap-2">
            {(
              [
                ['one', 'One due date for all of them'],
                ['planned', "Keep each one's current due date (the month's end, for tickets from a plan)"],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" name="due-mode" checked={mode === k} onChange={() => setMode(k)} />
                {label}
              </label>
            ))}
          </div>
          {mode === 'one' && <DateTimePicker value={due} onChange={setDue} />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={start.isPending}
            onClick={() =>
              start
                .mutateAsync(undefined)
                .then((r) => {
                  toast.success(`${r.length} started`)
                  onDone()
                  onOpenChange(false)
                })
                .catch((err) => toast.error(errorMessage(err, 'Could not start them')))
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
