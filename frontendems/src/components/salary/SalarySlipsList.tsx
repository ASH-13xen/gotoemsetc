import { toast } from 'sonner'
import { Download, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useSalarySlips } from '@/hooks/useSalarySlips'
import { downloadSalarySlip } from '@/api/salarySlips.api'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    value
  )
}

export function SalarySlipsList({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const { data, isLoading } = useSalarySlips(employeeId)
  const slips = data?.slips ?? []

  const onDownload = async (slipId: string, month: number, year: number) => {
    try {
      await downloadSalarySlip(slipId, `${employeeName}-${year}-${String(month).padStart(2, '0')}.pdf`)
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
          <Skeleton className="h-10 w-full" />
        ) : slips.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="size-4" />
            No salary slips generated yet.
          </p>
        ) : (
          slips.map((slip) => (
            <div key={slip._id} className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <span className="flex flex-col text-sm">
                <span className="font-medium">
                  {MONTH_NAMES[slip.month - 1]} {slip.year}
                </span>
                <span className="text-xs text-muted-foreground">
                  Net Payable: {formatCurrency(slip.netPayable)} · through{' '}
                  {new Date(slip.cutoffDate).toLocaleDateString()}
                </span>
              </span>
              <Button variant="outline" size="sm" onClick={() => onDownload(slip._id, slip.month, slip.year)}>
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
