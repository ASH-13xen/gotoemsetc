import { useState } from 'react'
import { ClipboardCheck, PartyPopper } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useActionCentreCounts } from '@/hooks/useActionCentre'
import { PeopleChangeAlerts } from '@/components/dashboard/PeopleChangeAlerts'
import { SalaryApprovalCard } from '@/components/finance/SalaryApprovalCard'
import { FnfCards } from '@/components/finance/FnfCards'
import { ReimbursementApprovalsCard } from '@/components/reimbursements/ReimbursementApprovalsCard'
import { OvertimeApprovalsCard } from '@/components/attendance/OvertimeApprovalsCard'
import { AttendanceChangeRequestsCard } from '@/components/attendance/AttendanceChangeRequestsCard'
import { CmLeaveReviews } from '@/components/attendance/CmLeaveReviews'
import { BillReminders } from '@/components/finance/BillReminders'
import { CeoLeaveApprovalsCard } from '@/components/dashboard/RoleDashboards'
import { cn } from '@/lib/utils'

// Everything waiting on this person in one place, next to the notification
// bell: salary approvals (and mails that didn't go out), full & final,
// reimbursements, overtime, attendance changes, leave for the CEO, a content
// manager's team requests, bills due, who joined or left. Each section shows
// nothing when it's empty. Only people who decide things (or have something
// waiting) see the button.
export function ActionCentre() {
  const { counts, total, relevant } = useActionCentreCounts()
  const [open, setOpen] = useState(false)
  if (!relevant) return null

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Action centre${total ? ` — ${total} waiting` : ''}`}
        title="Action centre — what's waiting on you"
      >
        <ClipboardCheck className="size-4" />
        {total > 0 && (
          <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
            <span className="absolute inset-0 animate-ping rounded-full bg-amber-500/60 motion-reduce:animate-none" />
            <span className="relative">{total > 9 ? '9+' : total}</span>
          </span>
        )}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-5xl overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black">
              <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                <ClipboardCheck className="size-4" />
              </span>
              Action centre
              {total > 0 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-black text-amber-700 dark:text-amber-300">{total} waiting</span>}
            </DialogTitle>
            <DialogDescription>Everything waiting for you to approve, confirm or look at.</DialogDescription>
          </DialogHeader>
          {total === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center text-muted-foreground">
              <PartyPopper className="size-8 opacity-50" />
              <p className="text-sm">Nothing waiting on you — all caught up.</p>
            </div>
          ) : (
            <div className="grid gap-5">
              <PeopleChangeAlerts />
              <CmLeaveReviews />
              <OvertimeApprovalsCard />
              <SalaryApprovalCard />
              <FnfCards />
              <ReimbursementApprovalsCard />
              <AttendanceChangeRequestsCard />
              {counts.ceoLeave > 0 && <CeoLeaveApprovalsCard />}
              <BillReminders />
            </div>
          )}
          <p className={cn('text-[11px] text-muted-foreground', total === 0 && 'hidden')}>Closing this doesn't skip anything — it all stays here until it's done.</p>
        </DialogContent>
      </Dialog>
    </>
  )
}
