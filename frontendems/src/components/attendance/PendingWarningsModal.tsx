import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { usePendingWarnings } from '@/hooks/useAttendanceWarnings'
import { useMarkNotificationRead } from '@/hooks/useNotifications'
import { CATEGORY_LABEL } from '@/api/attendanceWarnings.api'

// Shown to an employee, on their own record, the moment they have any
// unacknowledged "not informed" warnings. Deliberately not dismissible via
// Escape/outside-click/the corner X — the only way out is the "Mark as
// read" button below, which then marks each shown notification read, same
// as dismissing it from the notification bell, so it doesn't nag again.
export function PendingWarningsModal({ employeeId }: { employeeId: string }) {
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
        key={employeeId}
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
