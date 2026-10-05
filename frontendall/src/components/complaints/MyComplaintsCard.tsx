import { useState } from 'react'
import { toast } from 'sonner'
import { Check, MessageSquareWarning, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DashboardCard, DashboardCardEmpty } from '@/components/dashboard/DashboardCard'
import { useAcknowledgeComplaint, useMyComplaints } from '@/hooks/useComplaints'
import { CATEGORY_LABEL, type Complaint, type ComplaintStatus } from '@/api/complaints.api'

// pending -> Operations hasn't acted yet. completed -> Operations resolved
// it but the filer hasn't rated it yet (ComplaintReviewModal collects that
// rating, and can't be skipped). reviewed -> rated; from here the filer can
// Acknowledge it, which takes it off this card — it stays under "See all my
// complaints". See backend/src/services/complaint.service.js.
function StatusBadge({ status }: { status: ComplaintStatus }) {
  if (status === 'reviewed') return <Badge variant="success">Reviewed</Badge>
  if (status === 'completed') return <Badge variant="secondary">Awaiting your review</Badge>
  return <Badge variant="warning">Pending</Badge>
}

const ORDER: Record<ComplaintStatus, number> = { pending: 0, completed: 1, reviewed: 2 }
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

function Row({ complaint, onDashboard }: { complaint: Complaint; onDashboard: boolean }) {
  const acknowledge = useAcknowledgeComplaint()
  return (
    <div className="min-w-0 rounded-xl bg-secondary/30 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{CATEGORY_LABEL[complaint.category]}</p>
          <p className={onDashboard ? 'truncate text-xs text-muted-foreground' : 'text-xs text-muted-foreground'}>{complaint.description}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground/80">Filed {fmt(complaint.createdAt)}</p>
        </div>
        <StatusBadge status={complaint.status} />
      </div>
      {!onDashboard && complaint.feedback && (
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Star className="size-3 fill-amber-500 text-amber-500" /> Speed {complaint.feedback.speedRating}/5
          </span>
          <span className="inline-flex items-center gap-1">
            <Star className="size-3 fill-amber-500 text-amber-500" /> Quality {complaint.feedback.qualityRating}/5
          </span>
          {complaint.acknowledgedAt && <span>Acknowledged {fmt(complaint.acknowledgedAt)}</span>}
        </p>
      )}
      {complaint.status === 'reviewed' && !complaint.acknowledgedAt && (
        <Button
          size="sm"
          variant="outline"
          className="mt-2 w-full"
          disabled={acknowledge.isPending}
          onClick={() =>
            acknowledge.mutate(complaint._id, {
              onSuccess: () => toast.success('Acknowledged — moved to your full list'),
              onError: () => toast.error('Could not acknowledge this complaint'),
            })
          }
        >
          <Check className="size-3.5" /> Acknowledge
        </Button>
      )}
    </div>
  )
}

export function MyComplaintsCard() {
  const { data, isLoading } = useMyComplaints()
  const [allOpen, setAllOpen] = useState(false)
  const complaints = data?.complaints ?? []
  // Everything not yet acknowledged, the ones still pending first.
  const open = complaints.filter((c) => !c.acknowledgedAt).sort((a, b) => ORDER[a.status] - ORDER[b.status])

  return (
    <DashboardCard icon={<MessageSquareWarning className="size-4" />} title="My registered complaints">
      {isLoading ? (
        <Skeleton className="h-12 w-full rounded-xl" />
      ) : open.length === 0 ? (
        <DashboardCardEmpty
          icon={<MessageSquareWarning className="size-4" />}
          message={complaints.length === 0 ? 'No complaints filed yet.' : 'Nothing open — every complaint is acknowledged.'}
        />
      ) : (
        <div className="grid max-h-72 min-w-0 grid-cols-1 gap-2 overflow-x-hidden overflow-y-auto pr-0.5">
          {open.map((c) => (
            <Row key={c._id} complaint={c} onDashboard />
          ))}
        </div>
      )}
      {complaints.length > 0 && (
        <Button size="sm" variant="ghost" className="mt-3 w-full text-primary" onClick={() => setAllOpen(true)}>
          See all my complaints
        </Button>
      )}

      <Dialog open={allOpen} onOpenChange={setAllOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>All my complaints</DialogTitle>
            <DialogDescription>Everything you have filed, newest first.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {complaints.map((c) => (
              <Row key={c._id} complaint={c} onDashboard={false} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardCard>
  )
}
