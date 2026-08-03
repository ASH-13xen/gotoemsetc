import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableCell, TableRow } from '@/components/ui/table'
import { useSendWarning } from '@/hooks/useAttendanceWarnings'
import { formatPunchTime } from './formatPunchTime'
import { WARNING_TEMPLATES, type DailyReportRow, type WarningCategory } from '@/api/attendanceWarnings.api'

export function WarningRow({ row, category, date }: { row: DailyReportRow; category: WarningCategory; date: string }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const sendWarning = useSendWarning()
  const templates = WARNING_TEMPLATES[category]

  const onSend = () => {
    if (!message.trim()) {
      toast.error('Enter or select a warning message')
      return
    }
    sendWarning.mutate(
      { employeeId: row.employee._id, date, category, message: message.trim() },
      {
        onSuccess: () => {
          toast.success('Warning sent')
          setOpen(false)
        },
        onError: (err: unknown) => {
          const msg =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not send warning'
          toast.error(msg)
        },
      }
    )
  }

  return (
    <TableRow>
      <TableCell className="font-semibold text-foreground">
        {row.employee.firstName} {row.employee.lastName ?? ''}
        {row.provisional && (
          <Badge variant="outline" className="ml-2">
            Provisional
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{row.employee.designation}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{formatPunchTime(row.firstPunchAt)}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{formatPunchTime(row.lastPunchAt)}</TableCell>
      <TableCell>
        {row.alreadyWarned ? (
          <div className="max-w-xs text-xs text-muted-foreground">
            <Badge variant="warning" className="mb-1">
              Warned
            </Badge>
            <p>{row.alreadyWarned.message}</p>
          </div>
        ) : (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <label className="flex cursor-pointer items-center gap-2 select-none text-sm">
                <input
                  type="checkbox"
                  checked={open}
                  // Toggling is driven entirely by the Popover trigger's own
                  // click handling (via `asChild` on the wrapping label) —
                  // this onChange only exists to satisfy React's controlled-
                  // input requirement. Wiring a second, independent toggle
                  // here raced with Radix's own click handler on every
                  // click (both fire off the same click, canceling each
                  // other out), which is why the checkbox looked broken.
                  onChange={() => {}}
                  className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
                />
                Not informed
              </label>
            </PopoverTrigger>
            <PopoverContent className="w-96 space-y-3">
              <Select onValueChange={(v) => setMessage(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="PICK A TEMPLATE (OPTIONAL)" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                placeholder="Warning message to send to the employee"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
              <Button onClick={onSend} disabled={sendWarning.isPending} className="w-full">
                {sendWarning.isPending && <Loader2 className="size-4 animate-spin" />}
                Send
              </Button>
            </PopoverContent>
          </Popover>
        )}
      </TableCell>
    </TableRow>
  )
}
