import { useState } from 'react'
import { toast } from 'sonner'
import { Check, ImageIcon, Loader2, Receipt } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DashboardCard, DashboardCardEmpty } from '@/components/dashboard/DashboardCard'
import { useAcknowledgeReimbursement, useMyReimbursements } from '@/hooks/useReimbursements'
import { CATEGORY_LABEL, fetchPaymentProof, type Reimbursement, type ReimbursementStatus } from '@/api/reimbursements.api'

// pending -> Finance hasn't decided. approved -> waiting to be paid.
// paid / rejected -> Finance is done; the claimant can open the payment
// screenshot (paid) or read the reason (rejected) and Acknowledge it, which
// takes it off this card — it stays under "Show all reimbursements".
function StatusBadge({ status }: { status: ReimbursementStatus }) {
  if (status === 'paid') return <Badge variant="success">Paid</Badge>
  if (status === 'approved') return <Badge variant="secondary">Approved — to be paid</Badge>
  if (status === 'rejected') return <Badge variant="destructive">Rejected</Badge>
  return <Badge variant="warning">Pending</Badge>
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' })

function Row({ claim, onDashboard }: { claim: Reimbursement; onDashboard: boolean }) {
  const acknowledge = useAcknowledgeReimbursement()
  const [openingProof, setOpeningProof] = useState(false)
  const finished = claim.status === 'paid' || claim.status === 'rejected'

  // The screenshot sits behind the login, so it's fetched with the session
  // and opened from memory rather than linked to directly.
  const openProof = async () => {
    setOpeningProof(true)
    try {
      const url = URL.createObjectURL(await fetchPaymentProof(claim._id))
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      toast.error('Could not open the payment screenshot')
    } finally {
      setOpeningProof(false)
    }
  }

  return (
    <div className="min-w-0 rounded-xl bg-secondary/30 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {CATEGORY_LABEL[claim.category]} · ₹{claim.amount.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-muted-foreground">{fmt(claim.expenseDate)}</p>
          {!onDashboard && <p className="mt-0.5 text-xs text-muted-foreground">{claim.description}</p>}
        </div>
        <StatusBadge status={claim.status} />
      </div>
      {claim.status === 'rejected' && claim.rejectionReason && (
        <p className="mt-2 rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">Reason: {claim.rejectionReason}</p>
      )}
      {claim.status === 'paid' && (
        <p className="mt-2 text-xs text-muted-foreground">
          Paid{claim.paidAt ? ` on ${fmt(claim.paidAt)}` : ''}
          {claim.transactionDetails?.mode ? ` · ${claim.transactionDetails.mode}` : ''}
          {claim.transactionDetails?.referenceNumber ? ` · Ref ${claim.transactionDetails.referenceNumber}` : ''}
        </p>
      )}
      {!onDashboard && claim.acknowledgedAt && <p className="mt-1 text-[11px] text-muted-foreground/80">Acknowledged {fmt(claim.acknowledgedAt)}</p>}
      {(claim.paymentProofFile || (finished && !claim.acknowledgedAt)) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {claim.paymentProofFile && (
            <Button size="sm" variant="outline" className="min-w-0 flex-1 whitespace-nowrap" onClick={openProof} disabled={openingProof}>
              {openingProof ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />} View payment proof
            </Button>
          )}
          {finished && !claim.acknowledgedAt && (
            <Button
              size="sm"
              variant="outline"
              className="min-w-0 flex-1 whitespace-nowrap"
              disabled={acknowledge.isPending}
              onClick={() =>
                acknowledge.mutate(claim._id, {
                  onSuccess: () => toast.success('Acknowledged — moved to your full list'),
                  onError: () => toast.error('Could not acknowledge this claim'),
                })
              }
            >
              <Check className="size-3.5" /> Acknowledge
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export function MyReimbursementsCard() {
  const { data, isLoading } = useMyReimbursements()
  const [allOpen, setAllOpen] = useState(false)
  const reimbursements = data?.reimbursements ?? []
  const open = reimbursements.filter((r) => !r.acknowledgedAt)

  return (
    <DashboardCard icon={<Receipt className="size-4" />} title="My reimbursements">
      {isLoading ? (
        <Skeleton className="h-12 w-full rounded-xl" />
      ) : open.length === 0 ? (
        <DashboardCardEmpty
          icon={<Receipt className="size-4" />}
          message={reimbursements.length === 0 ? 'No reimbursement claims yet.' : 'Nothing open — every claim is acknowledged.'}
        />
      ) : (
        <div className="grid max-h-72 min-w-0 grid-cols-1 gap-2 overflow-x-hidden overflow-y-auto pr-0.5">
          {open.map((r) => (
            <Row key={r._id} claim={r} onDashboard />
          ))}
        </div>
      )}
      {reimbursements.length > 0 && (
        <Button size="sm" variant="ghost" className="mt-3 w-full text-primary" onClick={() => setAllOpen(true)}>
          Show all reimbursements
        </Button>
      )}

      <Dialog open={allOpen} onOpenChange={setAllOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>All my reimbursements</DialogTitle>
            <DialogDescription>Every claim you have made, newest first.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {reimbursements.map((r) => (
              <Row key={r._id} claim={r} onDashboard={false} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardCard>
  )
}
