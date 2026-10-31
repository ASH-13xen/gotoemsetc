import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, MessageSquarePlus } from 'lucide-react'

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
import { useCreateAttendanceRequest } from '@/hooks/useAttendanceRequests'
import type { CreateAttendanceRequestInput } from '@/api/attendanceRequests.api'

function dayValue(daysAgo = 0) {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10)
}

// What the day should be. The employee picks it here and approving marks
// exactly that — nobody changes it along the way. An evening Short Leave is
// the early-departure flag, as in frontendall's ApplyLeaveDialog.
const CORRECTIONS: { key: string; label: string; ask: Pick<CreateAttendanceRequestInput, 'requestedStatus' | 'requestedHalfDayPeriod' | 'requestedEarlyDeparture'> }[] = [
  { key: 'P', label: 'Present', ask: { requestedStatus: 'P' } },
  { key: 'L', label: 'Late', ask: { requestedStatus: 'L' } },
  { key: 'SL_morning', label: 'Short Leave — morning (before 11:30 AM)', ask: { requestedStatus: 'SL' } },
  { key: 'SL_evening', label: 'Short Leave — evening (left early)', ask: { requestedEarlyDeparture: true } },
  { key: 'H_first', label: 'Half Day — first half', ask: { requestedStatus: 'H', requestedHalfDayPeriod: 'first_half' } },
  { key: 'H_second', label: 'Half Day — second half', ask: { requestedStatus: 'H', requestedHalfDayPeriod: 'second_half' } },
  { key: 'W', label: 'Work From Home', ask: { requestedStatus: 'W' } },
]

// Worker-facing — lets them ask for a specific day's attendance to be
// corrected rather than editing it themselves (they only have read access).
export function RequestModificationDialog() {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(dayValue())
  const [correction, setCorrection] = useState('')
  const [reason, setReason] = useState('')
  const createRequest = useCreateAttendanceRequest()

  const onSubmit = () => {
    const chosen = CORRECTIONS.find((c) => c.key === correction)
    if (!chosen) {
      toast.error('Choose what this day should be')
      return
    }
    if (!reason.trim()) {
      toast.error('Please say why')
      return
    }
    createRequest.mutate(
      { date, reason, ...chosen.ask },
      {
        onSuccess: () => {
          toast.success('Request sent for approval')
          setOpen(false)
          setCorrection('')
          setReason('')
        },
        onError: (err) =>
          toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not send request'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl">
          <MessageSquarePlus className="size-4" />
          Request Modification
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request an attendance correction</DialogTitle>
          <DialogDescription>
            Pick the day and what it should be. Approving marks exactly that — it can't be changed later, only approved or
            rejected. One request per day.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="requestDate">Date</Label>
            <Input
              id="requestDate"
              type="date"
              min={dayValue(2)}
              max={dayValue()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>What should this day be?</Label>
            <Select value={correction} onValueChange={setCorrection}>
              <SelectTrigger>
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                {CORRECTIONS.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Worked extra time? Claim it with "Apply for leave / overtime" → Overtime on your dashboard.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="requestReason">Why?</Label>
            <Textarea
              id="requestReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="I scanned in but it's showing as absent…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={createRequest.isPending}>
            {createRequest.isPending && <Loader2 className="size-4 animate-spin" />}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
