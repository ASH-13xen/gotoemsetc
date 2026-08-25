import { useState } from 'react'
import { toast } from 'sonner'
import { MessageSquareWarning, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
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
import { useFileComplaint } from '@/hooks/useComplaints'
import { CATEGORY_LABEL, type ComplaintCategory } from '@/api/complaints.api'

// Any employee can file one — who's filing and when is derived server-side
// from the logged-in account, never asked for here.
export function RegisterComplaintDialog() {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<ComplaintCategory>('wifi')
  const [description, setDescription] = useState('')
  const fileComplaint = useFileComplaint()

  const onSubmit = () => {
    if (!description.trim()) {
      toast.error('Please describe the complaint')
      return
    }
    fileComplaint.mutate(
      { category, description: description.trim() },
      {
        onSuccess: () => {
          toast.success('Complaint filed — Operations has been notified')
          setOpen(false)
          setDescription('')
        },
        onError: () => toast.error('Could not file your complaint'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl">
          <MessageSquareWarning className="size-4" />
          Register a complaint
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register a complaint</DialogTitle>
          <DialogDescription>
            Pick a category and describe the issue — Operations will be notified right away.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="complaintCategory">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ComplaintCategory)}>
              <SelectTrigger id="complaintCategory">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="complaintDescription">Description</Label>
            <Textarea
              id="complaintDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's the issue?"
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={fileComplaint.isPending}>
            {fileComplaint.isPending && <Loader2 className="size-4 animate-spin" />}
            Submit complaint
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
