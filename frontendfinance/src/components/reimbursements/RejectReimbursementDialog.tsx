import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useRejectReimbursement } from '@/hooks/useReimbursements'

export function RejectReimbursementDialog({ id }: { id: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const reject = useRejectReimbursement()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive">
          Reject
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject this claim</DialogTitle>
        </DialogHeader>
        <Textarea
          rows={3}
          placeholder="Why is this being rejected?"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!reason.trim() || reject.isPending}
            onClick={() =>
              reject.mutate(
                { id, reason: reason.trim() },
                {
                  onSuccess: () => {
                    toast.success('Claim rejected')
                    setOpen(false)
                    setReason('')
                  },
                  onError: () => toast.error('Could not reject claim'),
                }
              )
            }
          >
            {reject.isPending ? 'Rejecting…' : 'Reject claim'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
