import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePendingBillReminders } from '@/hooks/useMonthlyBills'
import { useMarkNotificationRead } from '@/hooks/useNotifications'
import { useAckScope } from '@/components/layout/ActionAck'

// Monthly bills that are due — for cfo/finance/operations_manager (and the
// CEO once a bill is inside its 1-day escalation). Driven by unread
// notifications: jobs/monthlyBillCycle.job.js makes a fresh one every day a
// bill stays unpaid, so it comes back daily until the bill is paid in
// Finance. Lives in the Action centre (it used to be a blocking pop-up);
// acknowledging one clears it until tomorrow's reminder.
export function BillReminders() {
  const { data } = usePendingBillReminders()
  const reminders = data?.reminders ?? []
  const markRead = useMarkNotificationRead()
  const queryClient = useQueryClient()
  const { notices } = useAckScope()
  const acknowledge = (ids: string[]) =>
    Promise.all(ids.map((id) => markRead.mutateAsync(id))).finally(() => queryClient.invalidateQueries({ queryKey: ['monthly-bill-reminders-pending'] }))

  if (!notices || reminders.length === 0) return null

  return (
    <div className="dashboard-card overflow-hidden rounded-2xl border border-amber-500/40 bg-card">
      <div className="flex items-center gap-3 border-b border-border bg-amber-500/[0.07] px-5 py-3.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow">
          <Receipt className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-foreground">Monthly bills due</p>
          <p className="text-xs text-muted-foreground">Pay them in Finance — these come back every day a bill stays unpaid.</p>
        </div>
      </div>
      <div className="grid gap-2 p-4">
        {reminders.map((reminder) => (
          <div key={reminder.notificationId} className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-foreground">
            <span className="min-w-0 flex-1">{reminder.message}</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 shrink-0 gap-1 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              disabled={markRead.isPending}
              onClick={() => acknowledge([reminder.notificationId])}
            >
              <Check className="size-3.5" /> Acknowledge
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button asChild size="sm" variant="outline">
            <Link to="/finance">Go to Finance to pay</Link>
          </Button>
          {reminders.length > 1 && (
            <Button size="sm" disabled={markRead.isPending} onClick={() => acknowledge(reminders.map((r) => r.notificationId))}>
              Acknowledge all for today
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
