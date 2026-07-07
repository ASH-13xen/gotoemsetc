import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
  const hireApplicant = useHireApplicant(applicantId)

  const onSubmit = () => {
    if (!selectionNotes.trim()) {
      toast.error('Please note why this applicant was selected')
      return
    }
    hireApplicant.mutate(
      { selectionNotes, decisionDate },
      {
        onSuccess: ({ employee }) => {
          toast.success('Applicant hired — continue filling their employee details')
          setOpen(false)
          navigate(`/employees/${employee._id}/wizard`)
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
            This creates their employee record and takes you straight into generating their
            onboarding documents.
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
