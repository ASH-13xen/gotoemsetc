import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CalendarPlus, Eye, Loader2 } from 'lucide-react'

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
import {
  useCreateLeaveApplication,
  useMyMonthlyLeaveCounts,
  usePaidLeaveEligibility,
} from '@/hooks/useAttendanceRequests'
import {
  HALF_DAY_PERIOD_LABEL,
  LEAVE_APPLICATION_STATUS_LABEL,
  SHORT_LEAVE_PERIOD_LABEL,
  UNPAID_LEAVE_LABEL,
  type HalfDayPeriod,
  type LeaveApplicationStatus,
} from '@/api/attendanceRequests.api'
import { useApplyForOvertime } from '@/hooks/useOvertimeRequests'
import { MonthlyLeaveCountsNote } from './MonthlyLeaveCountsNote'

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
// "Unpaid Leave" — a general, uncapped multi-day leave request with no
// specific requestedStatus, unlike Work From Home ('W'). HR picks the
// actual per-day status, then it goes to the CEO for final approval.
const MULTIPLE_DAYS = 'MULTIPLE_DAYS' as const
// Overtime isn't leave, but it is applied for from the same place — it
// goes to the content manager, then HR (overtimeRequest.service.js), and
// only counts once HR approves it.
const OVERTIME = 'OVERTIME' as const
type ApplyType = LeaveApplicationStatus | typeof MULTIPLE_DAYS | typeof OVERTIME
// Every type except Paid Leave, which is only offered when eligible.
const ALWAYS_OFFERED: LeaveApplicationStatus[] = ['SL', 'L', 'H', 'W']
// The types whose month-to-date count is shown while applying.
const COUNTED_TYPES: ApplyType[] = ['SL', 'L', 'H']

export function ApplyLeaveDialog() {
  const [open, setOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [date, setDate] = useState(todayValue())
  const [endDate, setEndDate] = useState(todayValue())
  const [applyType, setApplyType] = useState<ApplyType>('SL')
  // Which half — used by both Half Day and Short Leave.
  const [halfDayPeriod, setHalfDayPeriod] = useState<HalfDayPeriod | undefined>()
  const [reason, setReason] = useState('')
  const [overtimeMinutes, setOvertimeMinutes] = useState('')
  const createLeaveApplication = useCreateLeaveApplication()
  const applyForOvertime = useApplyForOvertime()
  // Re-checked against whichever start date is currently picked. Paid Leave
  // is only offered once HR has marked probation completed AND this
  // month's one paid leave hasn't been used or applied for — otherwise the
  // option is hidden entirely.
  const { data: eligibilityData } = usePaidLeaveEligibility(date)
  const paidLeaveEligible = eligibilityData?.eligible ?? false
  const { data: countsData } = useMyMonthlyLeaveCounts(date)

  const isHalfDay = applyType === 'H'
  const isShortLeave = applyType === 'SL'
  const needsPeriod = isHalfDay || isShortLeave
  const isPaidLeave = applyType === PAID_LEAVE
  const isMultipleDays = applyType === MULTIPLE_DAYS
  const isOvertime = applyType === OVERTIME
  // Only Work From Home and Unpaid Leave span more than one date — every
  // other type is a single date.
  const isRange = applyType === 'W' || isMultipleDays

  // A date change can take Paid Leave away (e.g. into a month it's already
  // used in) — never leave a hidden option selected.
  useEffect(() => {
    if (isPaidLeave && eligibilityData && !paidLeaveEligible) setApplyType('SL')
  }, [isPaidLeave, eligibilityData, paidLeaveEligible])

  const onDateChange = (value: string) => {
    setDate(value)
    if (!isRange) {
      setEndDate(value)
    } else if (endDate < value) {
      setEndDate(value)
    }
  }

  const onApplyTypeChange = (value: ApplyType) => {
    setApplyType(value)
    setHalfDayPeriod(undefined)
    if (value !== 'W' && value !== MULTIPLE_DAYS) setEndDate(date)
    // Overtime is for a day that has happened — never ahead of time.
    if (value === OVERTIME && date > todayValue()) {
      setDate(todayValue())
      setEndDate(todayValue())
    }
  }

  const onSubmit = () => {
    if (!reason.trim()) {
      toast.error('Please add a short reason')
      return
    }
    if (isOvertime) {
      const minutes = Number(overtimeMinutes)
      if (!Number.isInteger(minutes) || minutes < 1) {
        toast.error('Enter the overtime in whole minutes')
        return
      }
      applyForOvertime.mutate(
        { date, minutes, reason: reason.trim() },
        {
          onSuccess: () => {
            toast.success('Overtime sent for approval')
            setOpen(false)
            setReason('')
            setOvertimeMinutes('')
          },
          onError: (err) =>
            toast.error(
              (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not send your overtime for approval'
            ),
        }
      )
      return
    }
    if (needsPeriod && !halfDayPeriod) {
      toast.error('Please choose which half of the day')
      return
    }
    if (isPaidLeave && !paidLeaveEligible) {
      toast.error('Paid leave is not available for this month')
      return
    }
    if (isRange && endDate < date) {
      toast.error('End date cannot be before the start date')
      return
    }

    const payload = {
      date,
      endDate: isRange ? endDate : date,
      reason,
      // An evening (second-half) Short Leave is recorded as an early
      // departure, which payroll counts as a Short Leave — see
      // SHORT_LEAVE_PERIOD_LABEL in attendanceRequests.api.ts.
      ...(isShortLeave && halfDayPeriod === 'second_half'
        ? { requestedEarlyDeparture: true }
        : isMultipleDays
          ? { requestedMultiDayLeave: true }
          : {
              requestedStatus: applyType,
              ...(isHalfDay ? { requestedHalfDayPeriod: halfDayPeriod } : {}),
            }),
    }

    createLeaveApplication.mutate(payload, {
      onSuccess: () => {
        toast.success('Leave application sent for review')
        setOpen(false)
        setReason('')
        setHalfDayPeriod(undefined)
      },
      onError: () => toast.error('Could not send your application'),
    })
  }

  return (
    <div className="inline-flex items-stretch overflow-hidden rounded-xl border border-border">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 px-4 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-secondary/60"
          >
            <CalendarPlus className="size-4" />
            Apply for leave / overtime
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply for leave or overtime</DialogTitle>
            <DialogDescription>
              Pick a type and date — HR will review and you'll see the outcome on your dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="leaveType">Type</Label>
              <Select value={applyType} onValueChange={(v) => onApplyTypeChange(v as ApplyType)}>
                <SelectTrigger id="leaveType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALWAYS_OFFERED.map((key) => (
                    <SelectItem key={key} value={key}>
                      {LEAVE_APPLICATION_STATUS_LABEL[key]}
                    </SelectItem>
                  ))}
                  <SelectItem value={MULTIPLE_DAYS}>{UNPAID_LEAVE_LABEL}</SelectItem>
                  <SelectItem value={OVERTIME}>Overtime</SelectItem>
                  {paidLeaveEligible && (
                    <SelectItem value={PAID_LEAVE}>{LEAVE_APPLICATION_STATUS_LABEL[PAID_LEAVE]} (1 per month)</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {isMultipleDays && (
              <p className="rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
                For one or more days off without pay. Approved by your Content Manager (if you have one), then HR,
                then the CEO.
              </p>
            )}

            {isOvertime && (
              <>
                <p className="rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
                  For extra time you worked today or in the last 2 days. It goes to your Content Manager (if you have
                  one), then HR — it is added to your overtime only once HR approves it.
                </p>
                <div className="grid gap-1.5">
                  <Label htmlFor="overtimeMinutes">Overtime worked (minutes)</Label>
                  <Input
                    id="overtimeMinutes"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    placeholder="e.g. 90"
                    value={overtimeMinutes}
                    onChange={(e) => setOvertimeMinutes(e.target.value)}
                  />
                </div>
              </>
            )}

            {needsPeriod && (
              <div className="grid gap-1.5">
                <Label htmlFor="halfDayPeriod">Which half?</Label>
                <Select
                  value={halfDayPeriod ?? ''}
                  onValueChange={(v) => setHalfDayPeriod(v as HalfDayPeriod)}
                >
                  <SelectTrigger id="halfDayPeriod">
                    <SelectValue placeholder="Choose a half" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(HALF_DAY_PERIOD_LABEL) as HalfDayPeriod[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {isShortLeave ? SHORT_LEAVE_PERIOD_LABEL[key] : HALF_DAY_PERIOD_LABEL[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {isPaidLeave && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                You have 1 paid leave available this month. Sending this application will use it.
              </p>
            )}

            {COUNTED_TYPES.includes(applyType) && countsData?.counts && (
              <MonthlyLeaveCountsNote counts={countsData.counts} highlight={applyType as 'SL' | 'L' | 'H'} />
            )}

            {isRange ? (
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
            ) : (
              <div className="grid gap-1.5">
                <Label htmlFor="leaveDate">Date</Label>
                <Input
                  id="leaveDate"
                  type="date"
                  min={minDateValue()}
                  max={isOvertime ? todayValue() : undefined}
                  value={date}
                  onChange={(e) => onDateChange(e.target.value)}
                />
              </div>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="leaveReason">Reason</Label>
              <Textarea
                id="leaveReason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={isOvertime ? 'What was the overtime for?' : 'Why do you need this?'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={onSubmit} disabled={createLeaveApplication.isPending || applyForOvertime.isPending}>
              {(createLeaveApplication.isPending || applyForOvertime.isPending) && <Loader2 className="size-4 animate-spin" />}
              {isOvertime ? 'Send for approval' : 'Send application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="my-1.5 w-px bg-border" />

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center px-2.5 text-muted-foreground transition-colors duration-150 hover:bg-secondary/60 hover:text-foreground"
            aria-label="How leave applications work"
          >
            <Eye className="size-4" />
          </button>
        </DialogTrigger>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>How leave applications work</DialogTitle>
            <DialogDescription>What each type means, and what happens after you apply.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 text-sm">
            <div className="grid gap-1">
              <p className="font-semibold text-foreground">Short Leave</p>
              <p className="text-muted-foreground">
                Single day only. Choose the half — {SHORT_LEAVE_PERIOD_LABEL.first_half} or{' '}
                {SHORT_LEAVE_PERIOD_LABEL.second_half}. Either one counts as 1 Short Leave this month.
              </p>
            </div>
            <div className="grid gap-1">
              <p className="font-semibold text-foreground">Late</p>
              <p className="text-muted-foreground">
                Single day only. For a late arrival you already know about — arriving between 9:30 AM and 10:00 AM.
              </p>
            </div>
            <div className="grid gap-1">
              <p className="font-semibold text-foreground">Half Day</p>
              <p className="text-muted-foreground">
                Single day only. Choose which half you'll be out for — {HALF_DAY_PERIOD_LABEL.first_half} or{' '}
                {HALF_DAY_PERIOD_LABEL.second_half}.
              </p>
            </div>
            <div className="grid gap-1">
              <p className="font-semibold text-foreground">Work From Home</p>
              <p className="text-muted-foreground">Pick a From and To date for the whole span.</p>
            </div>
            <div className="grid gap-1">
              <p className="font-semibold text-foreground">{UNPAID_LEAVE_LABEL}</p>
              <p className="text-muted-foreground">
                One or more days off without pay — pick a From and To date. Approved by your Content Manager (if
                you have one), then HR, then the CEO.
              </p>
            </div>
            <div className="grid gap-1">
              <p className="font-semibold text-foreground">Paid Leave</p>
              <p className="text-muted-foreground">
                Single day only, one per calendar month, and only after your probation period is completed. It
                appears in the list only when you can use it.
              </p>
            </div>
            <div className="grid gap-1">
              <p className="font-semibold text-foreground">Overtime</p>
              <p className="text-muted-foreground">
                For extra time worked today or in the last 2 days. Reviewed by your Content Manager (if you have one),
                then HR — it counts only once HR approves it. Biometric overtime of more than 60 minutes in a day is
                sent for the same approval automatically the next day; up to 60 minutes counts by itself.
              </p>
            </div>
            <div className="grid gap-1 border-t border-border pt-3">
              <p className="font-semibold text-foreground">What happens after you apply</p>
              <p className="text-muted-foreground">
                If you're on a team with a tagged Content Manager, they review it first; otherwise (or once they
                approve) it goes to HR for the final decision. Unpaid Leave also needs the CEO's approval after HR. You can backdate up to 2 days, or apply for any
                future date. You'll get a notification on your dashboard once it's approved, rejected, or later
                revoked.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInfoOpen(false)} className="w-full">
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
