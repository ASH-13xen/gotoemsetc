import { MessageSquareWarning } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardCard, DashboardCardEmpty } from '@/components/dashboard/DashboardCard'
import { useMyComplaints } from '@/hooks/useComplaints'
import { CATEGORY_LABEL, type ComplaintStatus } from '@/api/complaints.api'

// pending -> Operations hasn't acted yet. completed -> Operations resolved
// it but the filer hasn't rated it yet (see ComplaintReviewModal, which is
// what actually collects that rating). reviewed -> rated, terminal. See
// backend/src/services/complaint.service.js for the linear pending ->
// completed -> reviewed flow this mirrors — there's no rejection path.
function StatusBadge({ status }: { status: ComplaintStatus }) {
  if (status === 'reviewed') return <Badge variant="success">Reviewed</Badge>
  if (status === 'completed') return <Badge variant="secondary">Awaiting your review</Badge>
  return <Badge variant="warning">Pending</Badge>
}

export function MyComplaintsCard() {
  const { data, isLoading } = useMyComplaints()
  const complaints = data?.complaints ?? []

  return (
    <DashboardCard icon={<MessageSquareWarning className="size-4" />} title="My registered complaints">
      {isLoading ? (
        <Skeleton className="h-12 w-full rounded-xl" />
      ) : complaints.length === 0 ? (
        <DashboardCardEmpty icon={<MessageSquareWarning className="size-4" />} message="No complaints filed yet." />
      ) : (
        <div className="grid gap-2 max-h-72 overflow-y-auto pr-0.5">
          {complaints.slice(0, 8).map((c) => (
            <div key={c._id} className="flex items-center justify-between gap-3 rounded-xl bg-secondary/30 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{CATEGORY_LABEL[c.category]}</p>
                <p className="truncate text-xs text-muted-foreground">{c.description}</p>
              </div>
              <StatusBadge status={c.status} />
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  )
}
