import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, UserX } from 'lucide-react'

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
import { useRejectApplicant } from '@/hooks/useApplicants'

function todayValue() {
  return new Date().toISOString().slice(0, 10)
}

export function RejectDialog({ applicantId, trigger }: { applicantId: string; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [decisionDate, setDecisionDate] = useState(todayValue())
  const rejectApplicant = useRejectApplicant(applicantId)

  const onSubmit = () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }
    rejectApplicant.mutate(
      { rejectionReason, decisionDate },
      {
        onSuccess: () => {
          toast.success('Applicant marked as rejected — a decline email has been sent automatically')
          setOpen(false)
        },
        onError: () => toast.error('Could not update applicant'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline">
            <UserX className="size-4" />
            Reject
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject this applicant</DialogTitle>
          <DialogDescription>
            They'll stay on record as rejected, along with your reason. A decline email goes out
            automatically (plus a WhatsApp button you send yourself).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="rejectionReason">Reason</Label>
            <Textarea
              id="rejectionReason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Not enough relevant experience for this role…"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="decisionDate">Decision date</Label>
            <Input
              id="decisionDate"
              type="date"
              value={decisionDate}
              onChange={(e) => setDecisionDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="destructive" onClick={onSubmit} disabled={rejectApplicant.isPending}>
            {rejectApplicant.isPending && <Loader2 className="size-4 animate-spin" />}
            Confirm reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
