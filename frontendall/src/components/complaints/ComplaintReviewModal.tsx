import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Star } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useMyComplaintsAwaitingReview, useSubmitComplaintReview } from '@/hooks/useComplaints'
import { CATEGORY_LABEL, type Complaint } from '@/api/complaints.api'

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const rating = i + 1
        return (
          <button
            key={rating}
            type="button"
            onClick={() => onChange(rating)}
            className="cursor-pointer"
            aria-label={`${rating} star${rating === 1 ? '' : 's'}`}
          >
            <Star
              className={cn('size-5', rating <= value ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/30')}
            />
          </button>
        )
      })}
    </div>
  )
}

function ReviewCard({ complaint }: { complaint: Complaint }) {
  const [speedRating, setSpeedRating] = useState(0)
  const [qualityRating, setQualityRating] = useState(0)
  const [comments, setComments] = useState('')
  const submitReview = useSubmitComplaintReview()

  const onSubmit = () => {
    if (speedRating === 0 || qualityRating === 0) {
      toast.error('Please rate both speed and quality')
      return
    }
    submitReview.mutate(
      { id: complaint._id, speedRating, qualityRating, comments: comments.trim() || undefined },
      {
        onSuccess: () => toast.success('Thanks for your feedback'),
        onError: () => toast.error('Could not submit your feedback'),
      }
    )
  }

  return (
    <div className="rounded-xl bg-secondary/40 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline">{CATEGORY_LABEL[complaint.category]}</Badge>
        <span className="text-xs text-muted-foreground">
          Filed {new Date(complaint.createdAt).toLocaleDateString()}
        </span>
      </div>
      <p className="text-sm text-foreground">{complaint.description}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs text-muted-foreground">Speed</Label>
          <StarPicker value={speedRating} onChange={setSpeedRating} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs text-muted-foreground">Quality</Label>
          <StarPicker value={qualityRating} onChange={setQualityRating} />
        </div>
      </div>
      <Textarea
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        placeholder="Any extra feedback? (optional)"
        rows={2}
      />
      <Button size="sm" onClick={onSubmit} disabled={submitReview.isPending} className="w-full">
        {submitReview.isPending && <Loader2 className="size-4 animate-spin" />}
        Submit feedback
      </Button>
    </div>
  )
}

// Shown to an employee, on the dashboard, the moment any complaint they
// filed has been marked completed by Operations and is awaiting their
// speed/quality review — same blocking-until-acted-on pattern as
// PendingWarningsModal/AttendanceOutcomeModal, except each complaint here
// gets its own rating widgets and its own Submit button (there isn't one
// combined "OK" action, since each complaint's feedback is independent).
// Closes itself automatically once the list empties.
export function ComplaintReviewModal() {
  const { data } = useMyComplaintsAwaitingReview()
  const complaints = data?.complaints ?? []

  if (complaints.length === 0) return null

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="max-h-[85vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Complaint{complaints.length > 1 ? 's' : ''} awaiting your feedback</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {complaints.map((complaint) => (
            <ReviewCard key={complaint._id} complaint={complaint} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
