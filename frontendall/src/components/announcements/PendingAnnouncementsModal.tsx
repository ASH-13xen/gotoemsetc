import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useMyPendingAnnouncements, useAcknowledgeAnnouncement } from '@/hooks/useAnnouncements'

// Shown the moment the logged-in employee has any unacknowledged
// announcements — same shell-level, fires-right-after-login pattern as
// PendingWarningsModal. Backend self-scopes to req.user.employeeLink and
// returns [] for accounts with no linked employee (pure admin/HR logins),
// so this is safe to mount unconditionally. Deliberately not dismissible via
// Escape/outside click/the corner X — each announcement has to be
// individually acknowledged; the dialog closes itself once the list empties.
export function PendingAnnouncementsModal() {
  const { data } = useMyPendingAnnouncements()
  const announcements = data?.announcements ?? []
  const acknowledge = useAcknowledgeAnnouncement()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (announcements.length > 0) setOpen(true)
  }, [announcements.length])

  if (announcements.length === 0) return null

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="max-h-[85vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Announcement{announcements.length > 1 ? 's' : ''}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {announcements.map((announcement) => (
            <div key={announcement._id} className="rounded-xl bg-secondary/40 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-foreground">{announcement.title}</p>
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                  {new Date(announcement.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground">{announcement.message}</p>
              <Button
                size="sm"
                className="mt-3 w-full"
                onClick={() => acknowledge.mutate(announcement._id)}
                disabled={acknowledge.isPending}
              >
                Acknowledge
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
