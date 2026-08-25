import { Receipt } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
    <Card className="rounded-xl border border-border p-6">
      <CardContent className="p-0">
        <h2 className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <Receipt className="size-4 text-primary" />
          My reimbursements
        </h2>
        {isLoading ? (
          <div className="mt-4 grid gap-2">
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : reimbursements.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No reimbursement claims yet.</p>
        ) : (
          <div className="mt-4 grid gap-2">
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
      </CardContent>
    </Card>
  )
}
