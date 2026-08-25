import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Inbox, Loader2, Star } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useComplaints, useMarkComplaintCompleted } from '@/hooks/useComplaints'
import { CATEGORY_LABEL, type Complaint, type ComplaintStatus } from '@/api/complaints.api'

const STATUS_BADGE_VARIANT: Record<ComplaintStatus, 'warning' | 'success' | 'outline'> = {
  pending: 'warning',
  completed: 'success',
  reviewed: 'outline',
}

const STATUS_LABEL: Record<ComplaintStatus, string> = {
  pending: 'Pending',
  completed: 'Completed — awaiting review',
  reviewed: 'Reviewed',
}

const FILTERS: { key: ComplaintStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'reviewed', label: 'Reviewed' },
]

function formatDateTime(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StarRow({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn('size-3.5', i < value ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/30')} />
      ))}
    </div>
  )
}

function ComplaintRow({ complaint }: { complaint: Complaint }) {
  const markCompleted = useMarkComplaintCompleted()
  const employeeName = `${complaint.employee.firstName} ${complaint.employee.lastName ?? ''}`.trim()

  const onMarkCompleted = () => {
    markCompleted.mutate(complaint._id, {
      onSuccess: () => toast.success('Marked completed — the employee will be asked to review it'),
      onError: () => toast.error('Could not mark this complaint completed'),
    })
  }

  return (
    <div className="grid gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-foreground">{employeeName}</p>
          <p className="text-xs text-muted-foreground">Filed {formatDateTime(complaint.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{CATEGORY_LABEL[complaint.category]}</Badge>
          <Badge variant={STATUS_BADGE_VARIANT[complaint.status]}>{STATUS_LABEL[complaint.status]}</Badge>
        </div>
      </div>

      <p className="text-sm text-foreground/80">{complaint.description}</p>

      {complaint.status !== 'pending' && (
        <p className="text-xs text-muted-foreground">
          Completed {formatDateTime(complaint.completedAt)}
          {complaint.completedBy && ` · by ${complaint.completedBy.username}`}
        </p>
      )}

      {complaint.status === 'reviewed' && complaint.feedback && (
        <div className="grid gap-2 rounded-lg bg-secondary/40 p-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Speed</span>
            <StarRow value={complaint.feedback.speedRating} />
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Quality</span>
            <StarRow value={complaint.feedback.qualityRating} />
          </div>
          {complaint.feedback.comments && (
            <p className="text-xs text-muted-foreground sm:col-span-2">"{complaint.feedback.comments}"</p>
          )}
          <p className="text-[10px] text-muted-foreground/70 sm:col-span-2">
            Reviewed {formatDateTime(complaint.reviewedAt)}
          </p>
        </div>
      )}

      {complaint.status === 'pending' && (
        <div>
          <Button size="sm" onClick={onMarkCompleted} disabled={markCompleted.isPending}>
            {markCompleted.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Mark completed
          </Button>
        </div>
      )}
    </div>
  )
}

export default function ComplaintsPage() {
  const [filter, setFilter] = useState<ComplaintStatus | 'all'>('all')
  const { data, isLoading } = useComplaints(filter === 'all' ? undefined : filter)
  const complaints = data?.complaints ?? []

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 py-8">
      <PageHeader
        eyebrow="Operations"
        title="Complaint Register"
        description="Every complaint filed by an employee — mark it completed once resolved, and see their feedback once they've reviewed it."
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            type="button"
            size="sm"
            variant={filter === f.key ? 'default' : 'outline'}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <Card className="p-6">
        <CardContent className="grid gap-3 p-0">
          {isLoading ? (
            <Skeleton className="h-16 w-full rounded-xl bg-secondary/40" />
          ) : complaints.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Inbox className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No complaints here.</p>
            </div>
          ) : (
            complaints.map((complaint) => <ComplaintRow key={complaint._id} complaint={complaint} />)
          )}
        </CardContent>
      </Card>
    </div>
  )
}
