import { useState } from 'react'
import { toast } from 'sonner'
import { CalendarPlus, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useCreateLeaveApplication, usePaidLeaveEligibility } from '@/hooks/useAttendanceRequests'
import { LEAVE_APPLICATION_STATUS_LABEL, type LeaveApplicationStatus } from '@/api/attendanceRequests.api'

function todayValue() {
  return new Date().toISOString().slice(0, 10)
}

// Earliest backdatable date — 2 days ago, matching the backend's shared
// REQUEST_SUBMISSION_CUTOFF_DAYS. Unlike EMS's free-text "Request
// Modification" dialog (which is strictly for correcting a day that already
// happened, so it caps at today), this is for applying in advance — the
// whole point is picking a future date, so there's deliberately no max here.
function minDateValue() {
  const d = new Date()
  d.setDate(d.getDate() - 2)
  return d.toISOString().slice(0, 10)
}

const PAID_LEAVE: LeaveApplicationStatus = 'O'
const EARLY_DEPARTURE = 'EARLY_DEPARTURE' as const
type ApplyType = LeaveApplicationStatus | typeof EARLY_DEPARTURE

export function ApplyLeaveDialog() {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(todayValue())
  const [endDate, setEndDate] = useState(todayValue())
  const [applyType, setApplyType] = useState<ApplyType>('SL')
  const [reason, setReason] = useState('')
  const createLeaveApplication = useCreateLeaveApplication()
  // Re-checked against whichever start date is currently picked — a worker
  // who's already used this month's paid leave (or has one pending/approved)
  // simply never sees the option below.
  const { data: eligibilityData } = usePaidLeaveEligibility(date)
  const paidLeaveEligible = eligibilityData?.eligible ?? false
  const statusOptions = (Object.keys(LEAVE_APPLICATION_STATUS_LABEL) as LeaveApplicationStatus[]).filter(
    (key) => key !== PAID_LEAVE || paidLeaveEligible
  )

  const onDateChange = (value: string) => {
    setDate(value)
    if (endDate < value) setEndDate(value)
    if (applyType === PAID_LEAVE) setApplyType('SL')
  }

  const onSubmit = () => {
    if (!reason.trim()) {
      toast.error('Please add a short reason')
      return
    }
    if (endDate < date) {
      toast.error('End date cannot be before the start date')
      return
    }
    createLeaveApplication.mutate(
      applyType === EARLY_DEPARTURE
        ? { date, endDate, reason, requestedEarlyDeparture: true }
        : { date, endDate, reason, requestedStatus: applyType },
      {
        onSuccess: () => {
          toast.success('Leave application sent for review')
          setOpen(false)
          setReason('')
        },
        onError: () => toast.error('Could not send your application'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl">
          <CalendarPlus className="size-4" />
          Apply for leave
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply for leave</DialogTitle>
          <DialogDescription>
            Pick a date range and type — HR will review and you'll see the outcome on your dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="leaveDate">From</Label>
              <Input
                id="leaveDate"
                type="date"
                min={minDateValue()}
                value={date}
                onChange={(e) => onDateChange(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="leaveEndDate">To</Label>
              <Input
                id="leaveEndDate"
                type="date"
                min={date}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="leaveType">Type</Label>
            <Select value={applyType} onValueChange={(v) => setApplyType(v as ApplyType)}>
              <SelectTrigger id="leaveType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((key) => (
                  <SelectItem key={key} value={key}>
                    {LEAVE_APPLICATION_STATUS_LABEL[key]}
                    {key === PAID_LEAVE ? ' (1 per month)' : ''}
                  </SelectItem>
                ))}
                <SelectItem value={EARLY_DEPARTURE}>Early Departure</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="leaveReason">Reason</Label>
            <Textarea
              id="leaveReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why do you need this?"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={createLeaveApplication.isPending}>
            {createLeaveApplication.isPending && <Loader2 className="size-4 animate-spin" />}
            Send application
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
