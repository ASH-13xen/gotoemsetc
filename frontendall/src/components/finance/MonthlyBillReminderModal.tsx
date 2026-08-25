import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { usePendingBillReminders } from '@/hooks/useMonthlyBills'
import { useMarkNotificationRead } from '@/hooks/useNotifications'

// Direct copy of PendingWarningsModal's shape — a non-dismissible modal
// driven purely by unread notifications, shown to account_manager/
// operations_manager (and ceo once a bill is inside its 1-day escalation).
// See jobs/monthlyBillCycle.job.js: a fresh unread notification is created
// every day a bill stays unpaid, which is what makes this reappear daily
// even after being acknowledged — acknowledging only clears today's batch.
// Actually marking a bill paid happens in the Finance module, not here —
// same split as ComplaintReviewModal (review here, resolve elsewhere).
export function MonthlyBillReminderModal() {
  const { data } = usePendingBillReminders()
  const reminders = data?.reminders ?? []
  const markRead = useMarkNotificationRead()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (reminders.length > 0) setOpen(true)
  }, [reminders.length])

  const onAcknowledge = () => {
    for (const reminder of reminders) markRead.mutate(reminder.notificationId)
    setOpen(false)
  }

  if (reminders.length === 0) return null

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Monthly bills due</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {reminders.map((reminder) => (
            <div key={reminder.notificationId} className="rounded-xl bg-amber-500/10 p-4">
              <p className="text-sm text-foreground">{reminder.message}</p>
            </div>
          ))}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button asChild variant="outline" className="w-full">
            <Link to="/finance">Go to Finance to pay</Link>
          </Button>
          <Button onClick={onAcknowledge} disabled={markRead.isPending} className="w-full">
            Mark as read
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
