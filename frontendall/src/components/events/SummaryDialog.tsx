import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useFillEventSummary } from '@/hooks/useEvents'
import type { EventItem } from '@/api/events.api'

export function SummaryDialog({
  open,
  onOpenChange,
  event,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  event: EventItem
}) {
  const fillSummary = useFillEventSummary(event._id)
  const [highlights, setHighlights] = useState('')
  const [improvements, setImprovements] = useState('')

  useEffect(() => {
    if (open) {
      setHighlights(event.summary?.highlights ?? '')
      setImprovements(event.summary?.improvements ?? '')
    }
  }, [open, event.summary])

  const onSubmit = () => {
    fillSummary.mutate(
      { highlights: highlights.trim() || undefined, improvements: improvements.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Summary saved — visible to every employee')
          onOpenChange(false)
        },
        onError: () => toast.error('Could not save the summary'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Event summary</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>What went well</Label>
            <Textarea value={highlights} onChange={(e) => setHighlights(e.target.value)} rows={3} />
          </div>
          <div className="grid gap-1.5">
            <Label>What needs improvement</Label>
            <Textarea value={improvements} onChange={(e) => setImprovements(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={fillSummary.isPending}>
            {fillSummary.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Save summary
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
