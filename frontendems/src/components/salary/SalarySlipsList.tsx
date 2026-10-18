import { toast } from 'sonner'
import { Download, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useSalarySlips } from '@/hooks/useSalarySlips'
import { downloadEmployeeSalarySlip, type SalarySlip } from '@/api/salarySlips.api'

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    value
  )
}

// A month's slip can be generated more than once (after an attendance fix,
// say). Only the newest one for each month is shown — the one the master
// salary sheet and Finance go by. The month is the one the slip starts in.
function latestPerMonth(slips: SalarySlip[]) {
  const byMonth = new Map<string, SalarySlip>()
  for (const slip of slips) {
    // One replaced by a newer slip before it was ever approved isn't a slip of record.
    if (slip.approvalStatus === 'superseded') continue
    const month = slip.startDate.slice(0, 7)
    const kept = byMonth.get(month)
    if (!kept || new Date(slip.createdAt).getTime() > new Date(kept.createdAt).getTime()) byMonth.set(month, slip)
  }
  return [...byMonth.values()].sort((a, b) => b.startDate.localeCompare(a.startDate))
}

export function SalarySlipsList({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const { data, isLoading } = useSalarySlips(employeeId)
  const slips = latestPerMonth(data?.slips ?? [])

  const onDownload = async (slipId: string, startDate: string, endDate: string) => {
    try {
      await downloadEmployeeSalarySlip(employeeId, slipId, `${employeeName}-${startDate}_to_${endDate}.pdf`)
    } catch {
      toast.error('Could not download salary slip')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Salary slips</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {isLoading ? (
          <Skeleton className="h-12 w-full bg-secondary/40 rounded-xl" />
        ) : slips.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground p-2">
            <FileText className="size-4" />
            No salary slips generated yet.
          </p>
        ) : (
          slips.map((slip) => (
            <div key={slip._id} className="flex items-center justify-between gap-4 rounded-xl bg-secondary/30 p-4 border border-border/5">
              <span className="flex flex-col text-sm">
                <span className="font-semibold text-foreground">
                  {formatDate(slip.startDate)} – {formatDate(slip.endDate)}
                </span>
                <span className="text-xs text-muted-foreground mt-0.5">
                  Net Payable: {formatCurrency(slip.netPayable)}
                </span>
                {slip.approvalStatus === 'pending' && (
                  <span className="mt-1 w-fit rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    Waiting for the CEO's approval — not mailed yet
                  </span>
                )}
                {slip.approvalStatus === 'held' && (
                  <span className="mt-1 w-fit rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                    On hold by the CEO — not mailed or paid until released
                  </span>
                )}
                {slip.approvalStatus === 'rejected' && (
                  <span className="mt-1 w-fit rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                    Sent back by the CEO — generate it again
                  </span>
                )}
                {slip.paymentStatus === 'paid' && (
                  <span className="mt-1 w-fit rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Paid</span>
                )}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => onDownload(slip._id, slip.startDate.slice(0, 10), slip.endDate.slice(0, 10))}
              >
                <Download className="size-3.5" />
                Download
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
