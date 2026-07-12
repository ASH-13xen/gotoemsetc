import { toast } from 'sonner'
import { Download, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useSalarySlips } from '@/hooks/useSalarySlips'
import { downloadSalarySlip } from '@/api/salarySlips.api'

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    value
  )
}

export function SalarySlipsList({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const { data, isLoading } = useSalarySlips(employeeId)
  const slips = data?.slips ?? []

  const onDownload = async (slipId: string, startDate: string, endDate: string) => {
    try {
      await downloadSalarySlip(slipId, `${employeeName}-${startDate}_to_${endDate}.pdf`)
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
