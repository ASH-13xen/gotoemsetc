import { useState } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { MarkPaidDialog } from '@/components/shared/MarkPaidDialog'
import { useFinanceSlips, useMarkSalaryPaid } from '@/hooks/useSalarySlips'

const MONTH_LABEL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function currentYearMonth() {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

export function SalaryTab() {
  const [{ year, month }, setPeriod] = useState(currentYearMonth())
  const { data, isLoading } = useFinanceSlips(year, month)
  const markPaid = useMarkSalaryPaid()
  const slips = data?.slips ?? []

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(month)} onValueChange={(v) => setPeriod((p) => ({ ...p, month: Number(v) }))}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_LABEL.map((label, i) => (
              <SelectItem key={label} value={String(i + 1)}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setPeriod((p) => ({ ...p, year: Number(v) }))}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : slips.length === 0 ? (
        <p className="text-sm text-muted-foreground">No salary slips generated for this month yet.</p>
      ) : (
        <div className="space-y-2">
          {slips.map((slip) => {
            const employeeName = `${slip.employee.firstName} ${slip.employee.lastName || ''}`.trim()
            return (
              <Card key={slip._id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">{employeeName}</p>
                  <p className="text-xs text-muted-foreground">
                    {slip.employee.employeeCode ? `${slip.employee.employeeCode} · ` : ''}
                    ₹{Number(slip.netPayable).toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {slip.paymentStatus === 'paid' ? (
                    <Badge variant="success">Paid</Badge>
                  ) : (
                    <Badge variant="warning">Due</Badge>
                  )}
                  {slip.paymentStatus === 'due' && (
                    <MarkPaidDialog
                      trigger={<Button size="sm">Mark paid</Button>}
                      title={`Mark ${employeeName}'s salary as paid`}
                      isPending={markPaid.isPending}
                      onSubmit={(input) =>
                        markPaid.mutateAsync(
                          { id: slip._id, input },
                          {
                            onSuccess: () => toast.success('Salary marked paid'),
                            onError: () => toast.error('Could not mark salary paid'),
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
      )}
    </div>
  )
}
