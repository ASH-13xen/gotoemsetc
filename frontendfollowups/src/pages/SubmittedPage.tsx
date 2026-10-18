import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Inbox, ShieldCheck } from 'lucide-react'
import { TicketNav } from '@/components/layout/TicketNav'
import { TicketStub } from '@/components/tickets/TicketStub'
import { NoteDialog } from '@/components/tickets/TicketActions'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { reviewTicket, type Ticket } from '@/api/tickets.api'
import { useTicketMeta, useTicketMutation, useTickets } from '@/hooks/useTickets'
import { ticketStub } from '@/lib/stubData'
import { fmtDateTime } from '@/lib/ticketFormat'
import { cn } from '@/lib/utils'

const FILTERS = [
  { key: 'unreviewed', label: 'To review' },
  { key: 'completed', label: 'Completed' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'reviewed', label: 'Reviewed' },
  { key: 'all', label: 'All' },
]

// The CEO's section: every ticket that reached its last colour (or was
// rejected) lands here, with its whole record, to be marked reviewed.
export default function SubmittedPage() {
  const { data: meta } = useTicketMeta()
  const [filter, setFilter] = useState('unreviewed')
  const { data, isLoading } = useTickets('submitted', filter, undefined, Boolean(meta?.me.seesEveryone))
  const [reviewing, setReviewing] = useState<Ticket | null>(null)
  const review = useTicketMutation(({ id, note }: { id: string; note: string }) => reviewTicket(id, note || undefined))
  if (meta && !meta.me.seesEveryone) return <Navigate to="/tickets" replace />
  const list = data || []
  return (
    <>
      <TicketNav />
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6">
        <section className="flex flex-wrap items-end justify-between gap-4 rounded-3xl bg-gradient-to-br from-zinc-900 to-zinc-700 p-6 text-white sm:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/60">CEO</p>
            <h1 className="mt-1 inline-flex items-center gap-3 text-3xl font-black tracking-tight">
              <Inbox className="size-7" />
              Submitted tickets
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/75">Every ticket arrives here once it reaches its last colour — or is rejected — with its full timestamped record.</p>
          </div>
        </section>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)} className={cn('rounded-full px-3.5 py-1.5 text-xs font-bold ring-1 transition', filter === f.key ? 'bg-foreground text-background ring-foreground' : 'ring-border hover:bg-secondary')}>
              {f.label}
            </button>
          ))}
        </div>
        {isLoading ? (
          <Skeleton className="h-44 rounded-2xl bg-secondary/50" />
        ) : list.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border py-14 text-center text-sm text-muted-foreground">Nothing here.</div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {list.map((t) => (
              <div key={t._id} className="grid gap-2">
                <TicketStub d={ticketStub(t)} to={`/tickets/${t._id}`} />
                <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
                  <span>Submitted {fmtDateTime(t.submittedToCeoAt)}</span>
                  {t.ceoReviewedAt ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                      <ShieldCheck className="size-3.5" />
                      Reviewed by {t.ceoReviewedBy}
                    </span>
                  ) : (
                    <Button size="sm" onClick={() => setReviewing(t)}>
                      <ShieldCheck className="size-3.5" />
                      Mark reviewed
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <NoteDialog
        open={Boolean(reviewing)}
        onOpenChange={(v) => !v && setReviewing(null)}
        title={`Review ${reviewing?.code ?? ''}`}
        description={reviewing?.title}
        confirmLabel="Mark reviewed"
        onConfirm={async (note) => {
          await review.mutateAsync({ id: reviewing!._id, note })
          toast.success('Reviewed')
        }}
      />
    </>
  )
}
