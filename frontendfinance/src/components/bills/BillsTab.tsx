import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { MarkPaidDialog } from '@/components/shared/MarkPaidDialog'
import { AddBillDialog } from '@/components/bills/AddBillDialog'
import { useAuth } from '@/hooks/useAuth'
import { canCreateBills } from '@/lib/roles'
import { useMarkBillInstancePaid, useMonthlyBills, useSetBillActive } from '@/hooks/useMonthlyBills'
import type { BillInstance } from '@/api/monthlyBills.api'

const MONTH_LABEL = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function StatusBadge({ instance }: { instance: BillInstance }) {
  if (instance.status === 'paid') return <Badge variant="success">Paid</Badge>
  if (instance.status === 'paid_late') return <Badge variant="warning">Paid late</Badge>
  const overdue = new Date(instance.dueDate) < new Date()
  return <Badge variant={overdue ? 'destructive' : 'warning'}>{overdue ? 'Overdue' : 'Due'}</Badge>
}

export function BillsTab() {
  const { user } = useAuth()
  const { data, isLoading } = useMonthlyBills()
  const markPaid = useMarkBillInstancePaid()
  const setActive = useSetBillActive()
  const bills = data?.bills ?? []
  const canCreate = canCreateBills(user)

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <AddBillDialog />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : bills.length === 0 ? (
        <p className="text-sm text-muted-foreground">No monthly bills set up yet.</p>
      ) : (
        <div className="space-y-3">
          {bills.map((bill) => {
            const sortedInstances = [...bill.instances].sort((a, b) =>
              a.year !== b.year ? b.year - a.year : b.month - a.month
            )
            const current = sortedInstances[0]
            return (
              <Card key={bill._id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{bill.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ₹{bill.amount.toLocaleString('en-IN')} · due day {bill.dueDay}
                      {!bill.isActive && ' · paused'}
                    </p>
                  </div>
                  {canCreate && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={setActive.isPending}
                      onClick={() =>
                        setActive.mutate(
                          { id: bill._id, isActive: !bill.isActive },
                          { onError: () => toast.error('Could not update bill') }
                        )
                      }
                    >
                      {bill.isActive ? 'Pause' : 'Resume'}
                    </Button>
                  )}
                </div>

                {current ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/40 p-3">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {MONTH_LABEL[current.month - 1]} {current.year} · due{' '}
                      {new Date(current.dueDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                    </p>
                    <div className="flex items-center gap-2">
                      <StatusBadge instance={current} />
                      {current.status === 'due' && (
                        <MarkPaidDialog
                          trigger={<Button size="sm">Mark paid</Button>}
                          title={`Mark ${bill.name} as paid`}
                          isPending={markPaid.isPending}
                          onSubmit={(input) =>
                            markPaid.mutateAsync(
                              { billId: bill._id, instanceId: current._id, input },
                              {
                                onSuccess: () => toast.success('Bill marked paid'),
                                onError: () => toast.error('Could not mark bill paid'),
                              }
                            )
                          }
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No instance for this bill yet — spawns on the 1st of next month.</p>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
