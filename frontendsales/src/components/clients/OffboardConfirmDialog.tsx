import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, UserX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useOffboardClient } from '@/hooks/useClients'

export function OffboardConfirmDialog({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [open, setOpen] = useState(false)
  const offboardClient = useOffboardClient(clientId)

  const onConfirm = () => {
    offboardClient.mutate(undefined, {
      onSuccess: () => {
        toast.success(`${clientName} marked as offboarded`)
        setOpen(false)
      },
      onError: () => toast.error('Could not offboard client'),
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-white">
          <UserX className="size-4" />
          Offboard Client
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-none border-2 border-white bg-black text-white">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-widest">Are you sure?</DialogTitle>
          <DialogDescription className="text-neutral-400">
            This will mark <span className="font-bold text-white">{clientName}</span> as offboarded. This
            action can be reviewed later but should only be done when the relationship has ended.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={onConfirm}
            disabled={offboardClient.isPending}
          >
            {offboardClient.isPending && <Loader2 className="size-4 animate-spin" />}
            Yes, Offboard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
