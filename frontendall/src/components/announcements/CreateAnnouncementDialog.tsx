import { useState } from 'react'
import { toast } from 'sonner'
import { Megaphone, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { useOpenEmployeeDirectory } from '@/hooks/useEmployees'
import { useCreateAnnouncement } from '@/hooks/useAnnouncements'

// HR/admin and the other 5 leadership roles (ceo, digital_admin, team_lead,
// account_manager, operations_manager) — matches the backend's
// requireAnnouncementCreateAccess() exactly. A plain worker can still read
// and acknowledge an announcement addressed to them; they just can't send
// one, so this trigger is hidden for that role rather than disabled.
export function canCreateAnnouncements(role: string | undefined): boolean {
  return Boolean(role) && role !== 'worker'
}

export function CreateAnnouncementDialog() {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [sendToAll, setSendToAll] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const { data: employees } = useOpenEmployeeDirectory()
  const createAnnouncement = useCreateAnnouncement()

  const toggleEmployee = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]))
  }

  const reset = () => {
    setTitle('')
    setMessage('')
    setSendToAll(true)
    setSelectedIds([])
  }

  const onSubmit = () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are both required')
      return
    }
    if (!sendToAll && selectedIds.length === 0) {
      toast.error('Select at least one employee, or send to everyone')
      return
    }
    createAnnouncement.mutate(
      { title: title.trim(), message: message.trim(), sendToAll, employeeIds: sendToAll ? undefined : selectedIds },
      {
        onSuccess: () => {
          toast.success('Announcement sent')
          setOpen(false)
          reset()
        },
        onError: () => toast.error('Could not send the announcement'),
      }
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl">
          <Megaphone className="size-4" />
          New announcement
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New announcement</DialogTitle>
          <DialogDescription>
            Every recipient sees this as a pop-up the next time they open the app — they have to acknowledge it to
            dismiss it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="announcementTitle">Title</Label>
            <Input id="announcementTitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Office closed Friday" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="announcementMessage">Message</Label>
            <Textarea
              id="announcementMessage"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What do you want everyone to know?"
              rows={4}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium select-none">
            <input
              type="checkbox"
              checked={sendToAll}
              onChange={(e) => setSendToAll(e.target.checked)}
              className="size-4 cursor-pointer rounded border-border text-primary accent-primary focus:ring-primary"
            />
            Send to all employees
          </label>
          {!sendToAll && (
            <div className="grid gap-1.5">
              <Label>Recipients</Label>
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl bg-secondary/30 p-2">
                {(employees ?? []).length === 0 && <p className="p-2 text-xs text-muted-foreground">No employees found.</p>}
                {(employees ?? []).map((emp) => (
                  <label
                    key={emp._id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium select-none hover:bg-secondary/50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(emp._id)}
                      onChange={() => toggleEmployee(emp._id)}
                      className="size-4 cursor-pointer rounded border-border text-primary accent-primary focus:ring-primary"
                    />
                    {emp.firstName} {emp.lastName}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{selectedIds.length} selected</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={createAnnouncement.isPending}>
            {createAnnouncement.isPending && <Loader2 className="size-4 animate-spin" />}
            Send announcement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
