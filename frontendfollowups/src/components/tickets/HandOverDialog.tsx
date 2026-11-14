import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Clock3, Loader2, Pencil } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DateTimePicker } from '@/components/shared/DateTimePicker'
import { advanceTicket, errorMessage, getEstimate, type StepEstimate, type Ticket } from '@/api/tickets.api'
import { hm } from '@/api/work.api'
import { useTicketMutation } from '@/hooks/useTickets'
import { fmtDateTime, inkOn } from '@/lib/ticketFormat'
import { cn } from '@/lib/utils'

// Hours and minutes, as two small boxes. `value` is in minutes.
export function HoursInput({ value, onChange, className }: { value: number; onChange: (m: number) => void; className?: string }) {
  const h = Math.floor(value / 60)
  const m = value % 60
  const set = (hh: number, mm: number) => onChange(Math.max(0, (Number.isFinite(hh) ? hh : 0) * 60 + (Number.isFinite(mm) ? mm : 0)))
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex items-center gap-1">
        <Input type="number" min={0} max={336} value={h} onChange={(e) => set(parseInt(e.target.value || '0', 10), m)} className="w-20 text-right" aria-label="Hours" />
        <span className="text-xs font-semibold text-muted-foreground">h</span>
      </div>
      <div className="flex items-center gap-1">
        <Input type="number" min={0} max={59} step={5} value={m} onChange={(e) => set(h, Math.min(59, parseInt(e.target.value || '0', 10)))} className="w-20 text-right" aria-label="Minutes" />
        <span className="text-xs font-semibold text-muted-foreground">m</span>
      </div>
    </div>
  )
}

// The hours part of handing on: "you had it since …, estimated X — right?",
// changeable with a reason. Shared by one ticket, several, and confirming later.
export function HoursCheck({
  estimate,
  minutes,
  setMinutes,
  reason,
  setReason,
  since,
  approval,
  label = 'Your hours on this step',
}: {
  estimate: number
  minutes: number
  setMinutes: (m: number) => void
  reason: string
  setReason: (r: string) => void
  since?: string | null
  approval?: boolean
  label?: string
}) {
  const changed = Math.abs(minutes - estimate) >= 1
  return (
    <div className="grid gap-3 rounded-xl bg-secondary/40 p-4 ring-1 ring-border">
      <div className="flex items-start gap-3">
        <Clock3 className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="text-sm">
          <p className="font-bold">{label}</p>
          <p className="text-muted-foreground">
            {approval
              ? `A review counts as ${hm(estimate)}.`
              : since
                ? `You've had it since ${fmtDateTime(since)} — estimated ${hm(estimate)} of working time. Is that right?`
                : `Estimated ${hm(estimate)}. Is that right?`}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <HoursInput value={minutes} onChange={setMinutes} />
        {changed ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-700">
            <Pencil className="size-3" />
            Changed from {hm(estimate)}
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-emerald-700">As estimated</span>
        )}
        {changed && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setMinutes(estimate)}>
            Use the estimate
          </Button>
        )}
      </div>
      {changed && (
        <div className="grid gap-1.5">
          <Label>Why is it different?</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. worked on it over the weekend, waited on the client for a day" rows={2} />
          <p className="text-[11px] text-muted-foreground">Shown beside the hours as changed, with your reason.</p>
        </div>
      )}
    </div>
  )
}

const pad = (n: number) => String(n).padStart(2, '0')
const localNow = (plusDays = 1) => {
  const d = new Date(Date.now() + plusDays * 86_400_000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00`
}

// Completing a work ticket's step: the hours, and the date or link the step asks for.
export function HandOverDialog({ t, open, onOpenChange }: { t: Ticket; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [est, setEst] = useState<StepEstimate | null>(null)
  const [loading, setLoading] = useState(false)
  const [minutes, setMinutes] = useState(0)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(localNow())
  const [link, setLink] = useState('')
  const move = useTicketMutation((input: Parameters<typeof advanceTicket>[1]) => advanceTicket(t._id, input))
  const next = t.next
  const nextIdx = t.trail.findIndex((s) => s.current) + 1
  const nextColor = t.trail[nextIdx]?.color

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setReason('')
    setNote('')
    setLink('')
    getEstimate(t._id)
      .then((e) => {
        setEst(e)
        setMinutes(e.minutes || 0)
      })
      .catch((err) => toast.error(errorMessage(err, 'Could not work out the hours')))
      .finally(() => setLoading(false))
  }, [open, t._id])

  const changed = Boolean(est?.ask) && Math.abs(minutes - (est?.minutes || 0)) >= 1
  const blocked = loading || move.isPending || (changed && !reason.trim()) || (next?.needsLink && !/^https?:\/\//i.test(link.trim())) || (next?.needsDate && !date)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Mark “{t.nextStepLabel}”</DialogTitle>
          <DialogDescription>
            {t.code} · {t.title}
          </DialogDescription>
        </DialogHeader>
        {loading || !est ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="grid gap-4">
            {est.ask ? (
              <HoursCheck estimate={est.minutes || 0} minutes={minutes} setMinutes={setMinutes} reason={reason} setReason={setReason} since={est.since} approval={est.approval} />
            ) : (
              <p className="rounded-xl bg-secondary/40 p-3 text-sm text-muted-foreground ring-1 ring-border">
                You're doing this for {t.waitingOn.length ? t.waitingOn.join(', ') : t.waitingOnLabel}. Their hours are estimated and they confirm them (or they stand as estimated after three days).
              </p>
            )}
            {next?.needsDate && (
              <div className="grid gap-1.5">
                <Label>Posting date and time</Label>
                <DateTimePicker value={date} onChange={setDate} />
                <p className="text-[11px] text-muted-foreground">It waits until then, and the Social Media Manager uploads it on the day.</p>
              </div>
            )}
            {next?.needsLink && (
              <div className="grid gap-1.5">
                <Label>Link</Label>
                <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
                <p className="text-[11px] text-muted-foreground">{next.key === 'uploaded' ? 'Where it was posted.' : 'Where the footage now is (Drive folder).'}</p>
              </div>
            )}
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note — kept in the record" rows={2} />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={Boolean(blocked)}
            style={{ background: nextColor || undefined, color: inkOn(nextColor) }}
            className="bg-none shadow-none"
            onClick={async () => {
              try {
                await move.mutateAsync({
                  note: note.trim() || undefined,
                  ...(est?.ask ? { minutes, reason: changed ? reason.trim() : undefined } : {}),
                  ...(next?.needsDate ? { date: new Date(date).toISOString() } : {}),
                  ...(next?.needsLink ? { link: link.trim() } : {}),
                })
                toast.success('Moved on')
                onOpenChange(false)
              } catch (err) {
                toast.error(errorMessage(err, 'That did not work'))
              }
            }}
          >
            {move.isPending && <Loader2 className="size-4 animate-spin" />}
            Move it on
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
