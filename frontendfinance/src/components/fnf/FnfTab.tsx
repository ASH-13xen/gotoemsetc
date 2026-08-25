import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { MarkPaidDialog } from '@/components/shared/MarkPaidDialog'
import { useFnfSettlements, useMarkFnfPaid } from '@/hooks/useFnfSettlements'

export function FnfTab() {
  const { data, isLoading } = useFnfSettlements()
  const markPaid = useMarkFnfPaid()
  const settlements = data?.settlements ?? []

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    )
  }

  if (settlements.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No Full &amp; Final settlements yet — these appear automatically when an FnF Settlement Agreement is
        generated for an employee (Employee detail → Generate Documents).
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {settlements.map((settlement) => {
        const employeeName = `${settlement.employee.firstName} ${settlement.employee.lastName || ''}`.trim()
        return (
          <Card key={settlement._id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-semibold text-foreground">{employeeName}</p>
              <p className="text-xs text-muted-foreground">
                {settlement.employee.employeeCode ? `${settlement.employee.employeeCode} · ` : ''}
                {settlement.amount != null ? `₹${settlement.amount.toLocaleString('en-IN')}` : 'Amount not on file'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {settlement.status === 'paid' ? <Badge variant="success">Paid</Badge> : <Badge variant="warning">Due</Badge>}
              {settlement.status === 'due' && (
                <MarkPaidDialog
                  trigger={<Button size="sm">Mark paid</Button>}
                  title={`Mark ${employeeName}'s FnF settlement as paid`}
                  description="Sends the signed settlement PDF and payment details to the employee's personal email."
                  isPending={markPaid.isPending}
                  onSubmit={(input) =>
                    markPaid.mutateAsync(
                      { id: settlement._id, input },
                      {
                        onSuccess: () => toast.success('FnF settlement marked paid'),
                        onError: () => toast.error('Could not mark settlement paid'),
                      }
                    )
                  }
                />
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
