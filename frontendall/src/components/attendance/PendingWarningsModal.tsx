import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { usePendingWarnings } from '@/hooks/useAttendanceWarnings'
import { useMarkNotificationRead } from '@/hooks/useNotifications'
import { CATEGORY_LABEL } from '@/api/attendanceWarnings.api'

// Shown on the dashboard, the moment the logged-in employee has any
// unacknowledged "not informed" attendance warnings — this is the shell's
// own copy so it fires right after login regardless of whether the
// employee ever opens the EMS module. Backend self-scopes the query to
// req.user.employeeLink and returns an empty list for accounts with no
// linked employee record (e.g. pure admin/HR logins), so this is safe to
// mount unconditionally. Deliberately not dismissible via Escape/outside
// click/the corner X — the only way out is the "Mark as read" button,
// which marks each shown notification read so it doesn't nag again.
export function PendingWarningsModal() {
  const { data } = usePendingWarnings()
  const warnings = data?.warnings ?? []
  const markRead = useMarkNotificationRead()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (warnings.length > 0) setOpen(true)
  }, [warnings.length])

  const onAcknowledge = () => {
    for (const warning of warnings) markRead.mutate(warning.notificationId)
    setOpen(false)
  }

  if (warnings.length === 0) return null

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Attendance Warnings</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {warnings.map((warning) => (
            <div key={warning.notificationId} className="rounded-xl bg-amber-500/10 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <Badge variant="warning">{CATEGORY_LABEL[warning.category]}</Badge>
                <span className="text-xs font-semibold text-muted-foreground">
                  {new Date(warning.date).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-foreground">{warning.message}</p>
              <p className="mt-2 text-xs font-bold uppercase tracking-widest text-amber-700">
                You have done this {warning.countThisMonth} time{warning.countThisMonth === 1 ? '' : 's'} this month
              </p>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={onAcknowledge} disabled={markRead.isPending} className="w-full">
            Mark as read
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
