import { useState } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MarkPaidDialog } from '@/components/shared/MarkPaidDialog'
import { RejectReimbursementDialog } from '@/components/reimbursements/RejectReimbursementDialog'
import { useAuth } from '@/hooks/useAuth'
import { canApproveReimbursements } from '@/lib/roles'
import { useApproveReimbursement, useMarkReimbursementPaid, useReimbursements } from '@/hooks/useReimbursements'
import { downloadReceiptBlob, CATEGORY_LABEL, type Reimbursement, type ReimbursementStatus } from '@/api/reimbursements.api'

const STATUS_FILTERS: Array<{ value: ReimbursementStatus | 'all'; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
]

function StatusBadge({ status }: { status: ReimbursementStatus }) {
  if (status === 'paid') return <Badge variant="success">Paid</Badge>
  if (status === 'approved') return <Badge variant="secondary">Approved</Badge>
  if (status === 'rejected') return <Badge variant="destructive">Rejected</Badge>
  return <Badge variant="warning">Pending</Badge>
}

async function viewReceipt(id: string) {
  const blob = await downloadReceiptBlob(id)
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function ReimbursementRow({ reimbursement }: { reimbursement: Reimbursement }) {
  const { user } = useAuth()
  const approve = useApproveReimbursement()
  const markPaid = useMarkReimbursementPaid()
  const employeeName = `${reimbursement.employee.firstName} ${reimbursement.employee.lastName || ''}`.trim()
  const subtitle = reimbursement.category === 'client_work'
    ? reimbursement.client?.name || reimbursement.clientBrandName
    : reimbursement.travelMode
      ? reimbursement.travelMode === 'cab' ? 'Ola/Rapido/Uber' : 'Bike/Petrol'
      : undefined

  return (
    <Card className="space-y-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {employeeName} · ₹{reimbursement.amount.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-muted-foreground">
            {CATEGORY_LABEL[reimbursement.category]}
            {subtitle ? ` · ${subtitle}` : ''} ·{' '}
            {new Date(reimbursement.expenseDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
          </p>
        </div>
        <StatusBadge status={reimbursement.status} />
      </div>
      <p className="text-sm text-foreground">{reimbursement.description}</p>
      {reimbursement.peopleInvolved.length > 0 && (
        <p className="text-xs text-muted-foreground">
          With: {reimbursement.peopleInvolved.map((p) => `${p.firstName} ${p.lastName || ''}`.trim()).join(', ')}
        </p>
      )}
      {reimbursement.status === 'rejected' && reimbursement.rejectionReason && (
        <p className="text-xs text-destructive">Reason: {reimbursement.rejectionReason}</p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {reimbursement.receiptFile?.filename && (
          <Button size="sm" variant="outline" onClick={() => viewReceipt(reimbursement._id)}>
            View receipt
          </Button>
        )}
        {reimbursement.status === 'pending' && canApproveReimbursements(user) && (
          <>
            <Button
              size="sm"
              disabled={approve.isPending}
              onClick={() =>
                approve.mutate(reimbursement._id, {
                  onSuccess: () => toast.success('Claim approved'),
                  onError: () => toast.error('Could not approve claim'),
                })
              }
            >
              Approve
            </Button>
            <RejectReimbursementDialog id={reimbursement._id} />
          </>
        )}
        {reimbursement.status === 'approved' && (
          <MarkPaidDialog
            trigger={<Button size="sm">Mark paid</Button>}
            title={`Mark ${employeeName}'s reimbursement as paid`}
            isPending={markPaid.isPending}
            onSubmit={(input) =>
              markPaid.mutateAsync(
                { id: reimbursement._id, input },
                {
                  onSuccess: () => toast.success('Reimbursement marked paid'),
                  onError: () => toast.error('Could not mark reimbursement paid'),
                }
              )
            }
          />
        )}
      </div>
    </Card>
  )
}

export function ReimbursementsTab() {
  const [status, setStatus] = useState<ReimbursementStatus | 'all'>('pending')
  const { data, isLoading } = useReimbursements(status === 'all' ? undefined : status)
  const reimbursements = data?.reimbursements ?? []

  return (
    <div className="space-y-4">
      <Select value={status} onValueChange={(v) => setStatus(v as ReimbursementStatus | 'all')}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_FILTERS.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : reimbursements.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing here.</p>
      ) : (
        <div className="space-y-2">
          {reimbursements.map((r) => (
            <ReimbursementRow key={r._id} reimbursement={r} />
          ))}
        </div>
      )}
    </div>
  )
}
