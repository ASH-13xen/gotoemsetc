import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, ExternalLink, Link2, Loader2, Pencil, Send, ShieldCheck, UserRoundCog } from 'lucide-react'
import { TicketNav } from '@/components/layout/TicketNav'
import { TicketStub } from '@/components/tickets/TicketStub'
import { StepTrail } from '@/components/tickets/StepTrail'
import { StepDurations } from '@/components/tickets/StepDurations'
import { TicketRecord } from '@/components/tickets/TicketRecord'
import { MoveButtons, NoteDialog } from '@/components/tickets/TicketActions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateTimePicker } from '@/components/shared/DateTimePicker'
import {
  addTicketLink,
  advanceTicket,
  commentTicket,
  editTicket,
  errorMessage,
  reassignTicket,
  rejectTicket,
  reviewTicket,
  sendBackTicket,
  type Priority,
  type Ticket,
} from '@/api/tickets.api'
import { useTicket, useTicketMeta, useTicketMutation } from '@/hooks/useTickets'
import { PRIORITY_LABEL, fmtDateTime, fmtDuration } from '@/lib/ticketFormat'
import { ticketStub } from '@/lib/stubData'
import { cn } from '@/lib/utils'

function Panel({ title, children, action, className }: { title: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl bg-card p-5 ring-1 ring-border', className)}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

const toLocal = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function EditDialog({ t, open, onOpenChange }: { t: Ticket; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [title, setTitle] = useState(t.title)
  const [description, setDescription] = useState(t.description)
  const [priority, setPriority] = useState<Priority>(t.priority)
  const [clientName, setClientName] = useState(t.clientName)
  const [due, setDue] = useState(toLocal(t.dueAt))
  const [note, setNote] = useState('')
  const save = useTicketMutation((input: Parameters<typeof editTicket>[1]) => editTicket(t._id, input))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit {t.code}</DialogTitle>
          <DialogDescription>Every change is kept in the record with its old and new value.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Details</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Due</Label>
              <DateTimePicker value={due} onChange={setDue} />
            </div>
            <div className="grid gap-1.5">
              <Label>Client name</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['low', 'normal', 'high', 'urgent'] as Priority[]).map((p) => (
              <button key={p} type="button" onClick={() => setPriority(p)} className={cn('rounded-full px-3 py-1.5 text-xs font-bold ring-1', priority === p ? 'bg-foreground text-background ring-foreground' : 'ring-border')}>
                {PRIORITY_LABEL[p]}
              </button>
            ))}
          </div>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why the change? (optional, kept in the record)" rows={2} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={save.isPending || !title.trim()}
            onClick={async () => {
              try {
                await save.mutateAsync({ title, description, priority, clientName, dueAt: new Date(due).toISOString(), note: note || undefined })
                toast.success('Saved')
                onOpenChange(false)
              } catch (err) {
                toast.error(errorMessage(err, 'Could not save'))
              }
            }}
          >
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReassignDialog({ t, open, onOpenChange }: { t: Ticket; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: meta } = useTicketMeta()
  const reached = t.trail.findIndex((s) => s.current)
  // The roles/steps still ahead that someone was picked for.
  const options: { value: string; label: string }[] =
    t.pipeline === 'simple'
      ? reached < 1
        ? [{ value: 'raisedFor', label: 'Assignee' }]
        : []
      : t.pipeline === 'custom'
        ? t.customSteps.filter((s) => t.trail.findIndex((x) => x.key === s.key) > reached).map((s) => ({ value: `step:${s.key}`, label: s.label }))
        : t.pipeline === 'post'
          ? [{ value: 'designer', label: 'Social Media Manager' }]
          : t.pipeline === 'reel'
            ? [
                { value: 'shooter', label: 'Videographer' },
                { value: 'editor', label: 'Video Editor' },
                { value: 'contentManager', label: 'Content Manager' },
              ]
            : []
  const [which, setWhich] = useState(options[0]?.value || '')
  const [person, setPerson] = useState('')
  const [note, setNote] = useState('')
  const save = useTicketMutation((input: Parameters<typeof reassignTicket>[1]) => reassignTicket(t._id, input))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hand a step to someone else</DialogTitle>
          <DialogDescription>Only steps not reached yet, and only people in your box or below.</DialogDescription>
        </DialogHeader>
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">There's nothing left to reassign on this ticket.</p>
        ) : (
          <div className="grid gap-3">
            <Select value={which} onValueChange={setWhich}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={person || undefined} onValueChange={setPerson}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose the person" />
              </SelectTrigger>
              <SelectContent>
                {meta?.raisable.map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why? (optional, kept in the record)" rows={2} />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {options.length > 0 && (
            <Button
              disabled={!person || save.isPending}
              onClick={async () => {
                try {
                  await save.mutateAsync({
                    employeeId: person,
                    note: note || undefined,
                    ...(which.startsWith('step:') ? { stepKey: which.slice(5) } : which === 'raisedFor' ? {} : { field: which }),
                  })
                  toast.success('Reassigned')
                  onOpenChange(false)
                } catch (err) {
                  toast.error(errorMessage(err, 'Could not reassign'))
                }
              }}
            >
              Reassign
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function TicketPage() {
  const { id } = useParams()
  const { data: t, isLoading, error } = useTicket(id)
  const [dialog, setDialog] = useState<null | 'edit' | 'reassign' | 'review'>(null)
  const [comment, setComment] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const advance = useTicketMutation((note: string) => advanceTicket(id!, note || undefined))
  const back = useTicketMutation((note: string) => sendBackTicket(id!, note))
  const reject = useTicketMutation((reason: string) => rejectTicket(id!, reason))
  const review = useTicketMutation((note: string) => reviewTicket(id!, note || undefined))
  const addComment = useTicketMutation((text: string) => commentTicket(id!, text))
  const addLink = useTicketMutation(({ url, label }: { url: string; label: string }) => addTicketLink(id!, url, label || undefined))

  if (isLoading)
    return (
      <>
        <TicketNav />
        <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6">
          <Skeleton className="h-64 rounded-2xl bg-secondary/50" />
        </main>
      </>
    )
  if (!t)
    return (
      <>
        <TicketNav />
        <main className="mx-auto max-w-7xl px-4 py-10 text-center text-sm text-muted-foreground">{errorMessage(error, 'Ticket not found')}</main>
      </>
    )

  const nextIdx = t.trail.findIndex((s) => s.current) + 1
  const nextColor = t.trail[nextIdx]?.color

  return (
    <>
      <TicketNav />
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6">
        <Link to="/tickets" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" />
          All tickets
        </Link>

        <TicketStub d={ticketStub(t)} hero />

        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-[280px] flex-1">
            <MoveButtons
              can={t.can}
              nextStepLabel={t.nextStepLabel}
              nextColor={nextColor}
              actingAs={t.actingAs}
              onAdvance={async (n) => {
                await advance.mutateAsync(n)
                toast.success('Moved on')
              }}
              onSendBack={async (n) => {
                await back.mutateAsync(n)
                toast.success('Sent back')
              }}
              onReject={async (r) => {
                await reject.mutateAsync(r)
                toast.success('Rejected')
              }}
            />
            {!t.can.act && t.status === 'open' && (
              <div className="rounded-2xl bg-secondary/40 p-4 text-sm ring-1 ring-border">
                Waiting on <span className="font-bold">{t.waitingOn.length ? t.waitingOn.join(', ') : t.waitingOnLabel}</span> for “{t.nextStepLabel}”.
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {t.can.edit && (
              <Button variant="outline" onClick={() => setDialog('edit')}>
                <Pencil className="size-4" />
                Edit
              </Button>
            )}
            {t.can.edit && (
              <Button variant="outline" onClick={() => setDialog('reassign')}>
                <UserRoundCog className="size-4" />
                Reassign
              </Button>
            )}
            {t.can.review && (
              <Button onClick={() => setDialog('review')}>
                <ShieldCheck className="size-4" />
                Mark reviewed
              </Button>
            )}
          </div>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          <div className="grid gap-6">
            <Panel title="Details">
              {t.description ? <p className="whitespace-pre-wrap text-sm leading-relaxed">{t.description}</p> : <p className="text-sm text-muted-foreground">No details given.</p>}
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                {[
                  ['Raised by', t.raisedBy.name],
                  ['For', `${t.raisedFor.name || '—'}${t.raisedFor.designation ? ` · ${t.raisedFor.designation}` : ''}`],
                  ['Raised', fmtDateTime(t.createdAt)],
                  ['Due', fmtDateTime(t.dueAt)],
                  ['Pipeline', t.pipelineName],
                  ['Priority', PRIORITY_LABEL[t.priority]],
                  ['Team', t.team?.title || '—'],
                  ['Client', t.clientName || '—'],
                  ...(t.completedAt ? [['Completed', fmtDateTime(t.completedAt)]] : []),
                  ...(t.rejectedAt ? [['Rejected', fmtDateTime(t.rejectedAt)]] : []),
                  ['Times sent back', String(t.metrics.reverts)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="font-semibold uppercase tracking-wider text-muted-foreground">{k}</dt>
                    <dd className="mt-0.5 font-medium text-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
            </Panel>

            <Panel title="Pipeline">
              <StepTrail trail={t.trail} labels />
            </Panel>

            <Panel title="Time at each step">
              <StepDurations trail={t.trail} stepMs={t.metrics.stepMs} />
              {t.completedAt && <p className="mt-3 text-xs text-muted-foreground">Raised to completed in {fmtDuration(new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime())}.</p>}
            </Panel>

            <Panel title="Links">
              {t.links.length === 0 ? (
                <p className="text-xs text-muted-foreground">No links yet — add where the work lives.</p>
              ) : (
                <ul className="grid gap-2">
                  {t.links.map((l) => (
                    <li key={l._id} className="flex items-center gap-2 text-sm">
                      <Link2 className="size-4 shrink-0 text-muted-foreground" />
                      <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 truncate font-medium text-primary hover:underline">
                        {l.label || l.url}
                      </a>
                      <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{l.by}</span>
                    </li>
                  ))}
                </ul>
              )}
              <form
                className="mt-3 flex flex-wrap gap-2"
                onSubmit={async (e) => {
                  e.preventDefault()
                  try {
                    await addLink.mutateAsync({ url: linkUrl, label: linkLabel })
                    setLinkUrl('')
                    setLinkLabel('')
                  } catch (err) {
                    toast.error(errorMessage(err, 'Could not add the link'))
                  }
                }}
              >
                <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" className="min-w-0 flex-[2]" />
                <Input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Label" className="min-w-0 flex-1" />
                <Button type="submit" variant="outline" disabled={!linkUrl || addLink.isPending}>
                  Add
                </Button>
              </form>
            </Panel>

            {t.ceoReviewedAt && (
              <Panel title="CEO review">
                <p className="text-sm">
                  Reviewed by <span className="font-bold">{t.ceoReviewedBy}</span> on {fmtDateTime(t.ceoReviewedAt)}.
                </p>
                {t.ceoReviewNote && <p className="mt-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm italic">{t.ceoReviewNote}</p>}
              </Panel>
            )}
          </div>

          <Panel title="The record" action={<span className="text-[11px] text-muted-foreground">{t.record?.length || 0} entries · nothing here can be changed</span>}>
            <form
              className="mb-6 grid gap-2"
              onSubmit={async (e) => {
                e.preventDefault()
                if (!comment.trim()) return
                try {
                  await addComment.mutateAsync(comment.trim())
                  setComment('')
                } catch (err) {
                  toast.error(errorMessage(err, 'Could not add the comment'))
                }
              }}
            >
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment to the record…" rows={2} />
              <Button type="submit" size="sm" className="justify-self-end" disabled={!comment.trim() || addComment.isPending}>
                <Send className="size-3.5" />
                Add comment
              </Button>
            </form>
            <TicketRecord record={t.record || []} />
          </Panel>
        </div>
      </main>

      {dialog === 'edit' && <EditDialog t={t} open onOpenChange={(v) => !v && setDialog(null)} />}
      {dialog === 'reassign' && <ReassignDialog t={t} open onOpenChange={(v) => !v && setDialog(null)} />}
      <NoteDialog
        open={dialog === 'review'}
        onOpenChange={(v) => setDialog(v ? 'review' : null)}
        title={`Review ${t.code}`}
        description="Marks this submitted ticket as reviewed. Your note is kept in the record."
        confirmLabel="Mark reviewed"
        onConfirm={async (n) => {
          await review.mutateAsync(n)
          toast.success('Reviewed')
        }}
      />
    </>
  )
}
