import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Users } from 'lucide-react'
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
import { EmployeePicker } from '@/components/teams/EmployeePicker'
import { useUpdateClientChatAccess } from '@/hooks/useClientChat'
import type { AssignedEmployee } from '@/api/clients.api'

// Admin-only — who can read/post in this client's chat, independent of who
// is actually assigned to the client's tasks.
export function ClientChatAccessEditor({
  clientId,
  currentAllowed,
}: {
  clientId: string
  currentAllowed: AssignedEmployee[]
}) {
  const [open, setOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const updateAccess = useUpdateClientChatAccess(clientId)

  useEffect(() => {
    if (open) setSelectedIds(currentAllowed.map((e) => e._id))
  }, [open, currentAllowed])

  const onSave = () => {
    updateAccess.mutate(selectedIds, {
      onSuccess: () => {
        toast.success('Chat access updated')
        setOpen(false)
      },
      onError: () => toast.error('Could not update chat access'),
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users className="size-3.5" />
          Manage chat access
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Who can chat about this client</DialogTitle>
          <DialogDescription>Separate from task assignment — pick who can read and post here.</DialogDescription>
        </DialogHeader>
        <EmployeePicker selectedIds={selectedIds} onChange={setSelectedIds} />
        <DialogFooter>
          <Button onClick={onSave} disabled={updateAccess.isPending}>
            {updateAccess.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
