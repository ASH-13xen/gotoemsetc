import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, UserCheck } from 'lucide-react'

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
import { useHireApplicant } from '@/hooks/useApplicants'

function todayValue() {
  return new Date().toISOString().slice(0, 10)
}

export function HireDialog({
  applicantId,
  positionAppliedFor,
  trigger,
}: {
  applicantId: string
  positionAppliedFor?: string
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [selectionNotes, setSelectionNotes] = useState('')
  const [decisionDate, setDecisionDate] = useState(todayValue())
  const [startDate, setStartDate] = useState(todayValue())
  const [hiredPosition, setHiredPosition] = useState('')
  const hireApplicant = useHireApplicant(applicantId)

  const appliedPositions = (positionAppliedFor || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  const needsPositionChoice = appliedPositions.length > 1

  const onSubmit = () => {
    if (!selectionNotes.trim()) {
      toast.error('Please note why this applicant was selected')
      return
    }
    if (!startDate) {
      toast.error('Please enter a start date')
      return
    }
    if (needsPositionChoice && !hiredPosition) {
      toast.error('Select which position you’re hiring them for')
      return
    }
    hireApplicant.mutate(
      { selectionNotes, decisionDate, startDate, hiredPosition: hiredPosition || undefined },
      {
        onSuccess: () => {
          toast.success('Applicant hired — a welcome email has been sent automatically')
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
            This creates their employee record and automatically emails them a welcome message
            (plus a WhatsApp button you send yourself).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {needsPositionChoice && (
            <div className="grid gap-1.5">
              <Label htmlFor="hiredPosition">Which position are you hiring them for?</Label>
              <Select value={hiredPosition} onValueChange={setHiredPosition}>
                <SelectTrigger id="hiredPosition" className="w-full rounded-xl">
                  <SelectValue placeholder="Select a position" />
                </SelectTrigger>
                <SelectContent>
                  {appliedPositions.map((position) => (
                    <SelectItem key={position} value={position}>
                      {position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                They applied for multiple roles — pick the one this hire is for.
              </p>
            </div>
          )}
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
