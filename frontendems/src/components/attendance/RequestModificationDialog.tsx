import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, MessageSquarePlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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

function todayValue() {
  return new Date().toISOString().slice(0, 10)
}

// Worker-facing — lets them ask an admin to correct a specific day's
// attendance rather than editing it themselves (they only have read access).
export function RequestModificationDialog() {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(todayValue())
  const [reason, setReason] = useState('')
  const createRequest = useCreateAttendanceRequest()

  const onSubmit = () => {
    if (!reason.trim()) {
      toast.error('Please describe what needs to change')
      return
    }
    createRequest.mutate(
      { date, reason },
      {
        onSuccess: () => {
          toast.success('Request sent to your admin')
          setOpen(false)
          setReason('')
        },
        onError: () => toast.error('Could not send request'),
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
            Pick the date and explain what's wrong — an admin will review and update it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="requestDate">Date</Label>
            <Input
              id="requestDate"
              type="date"
              max={todayValue()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="requestReason">What needs to change?</Label>
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
