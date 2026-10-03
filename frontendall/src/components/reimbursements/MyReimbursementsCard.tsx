import { Receipt } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardCard, DashboardCardEmpty } from '@/components/dashboard/DashboardCard'
import { useMyReimbursements } from '@/hooks/useReimbursements'
import { CATEGORY_LABEL, type ReimbursementStatus } from '@/api/reimbursements.api'

function StatusBadge({ status }: { status: ReimbursementStatus }) {
  if (status === 'paid') return <Badge variant="success">Paid</Badge>
  if (status === 'approved') return <Badge variant="secondary">Approved</Badge>
  if (status === 'rejected') return <Badge variant="destructive">Rejected</Badge>
  return <Badge variant="warning">Pending</Badge>
}

export function MyReimbursementsCard() {
  const { data, isLoading } = useMyReimbursements()
  const reimbursements = data?.reimbursements ?? []

  return (
    <DashboardCard icon={<Receipt className="size-4" />} title="My reimbursements">
      {isLoading ? (
        <Skeleton className="h-12 w-full rounded-xl" />
      ) : reimbursements.length === 0 ? (
        <DashboardCardEmpty icon={<Receipt className="size-4" />} message="No reimbursement claims yet." />
      ) : (
        <div className="grid gap-2">
          {reimbursements.slice(0, 6).map((r) => (
            <div key={r._id} className="flex items-center justify-between gap-3 rounded-xl bg-secondary/30 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {CATEGORY_LABEL[r.category]} · ₹{r.amount.toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.expenseDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                </p>
              </div>
              <StatusBadge status={r.status} />
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  )
}
