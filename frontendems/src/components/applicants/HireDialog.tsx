import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, UserCheck } from 'lucide-react'

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
import { useHireApplicant } from '@/hooks/useApplicants'

function todayValue() {
  return new Date().toISOString().slice(0, 10)
}

export function HireDialog({ applicantId, trigger }: { applicantId: string; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [selectionNotes, setSelectionNotes] = useState('')
  const [decisionDate, setDecisionDate] = useState(todayValue())
  const [startDate, setStartDate] = useState(todayValue())
  const hireApplicant = useHireApplicant(applicantId)

  const onSubmit = () => {
    if (!selectionNotes.trim()) {
      toast.error('Please note why this applicant was selected')
      return
    }
    if (!startDate) {
      toast.error('Please enter a start date')
      return
    }
    hireApplicant.mutate(
      { selectionNotes, decisionDate, startDate },
      {
        onSuccess: () => {
          toast.success('Applicant hired — use the Send buttons below to let them know')
          setOpen(false)
        },
        onError: () => toast.error('Could not hire applicant'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm">
            <UserCheck className="size-4" />
            Hire
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hire this applicant</DialogTitle>
          <DialogDescription>
            This creates their employee record. You'll then get Send Email/Send WhatsApp buttons
            to let them know yourself, with this reason included.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="selectionNotes">Why were they selected?</Label>
            <Textarea
              id="selectionNotes"
              value={selectionNotes}
              onChange={(e) => setSelectionNotes(e.target.value)}
              placeholder="Strong system design skills, great culture fit…"
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
          <div className="grid gap-1.5">
            <Label htmlFor="startDate">Start date</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Included in the hire message you send them, and saved as their employee start date.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={hireApplicant.isPending}>
            {hireApplicant.isPending && <Loader2 className="size-4 animate-spin" />}
            Confirm hire
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
