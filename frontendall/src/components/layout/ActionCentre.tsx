import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ChevronDown, ClipboardCheck, PartyPopper } from 'lucide-react'
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
import { CeoLeaveQueue, HrLeaveQueue } from '@/components/attendance/LeaveStageQueues'
import { BillReminders } from '@/components/finance/BillReminders'
import { AckScope } from './ActionAck'
import { LeaveOvertimePopup } from './LeaveOvertimePopup'
import { cn } from '@/lib/utils'

// Everything waiting on this person in one place, next to the notification
// bell: salary approvals (and mails that didn't go out), full & final,
// reimbursements, leave and overtime, attendance changes, bills due, who
// joined or left. Each section shows nothing when it's empty. Every item can
// be acknowledged: a notice then goes away; something still waiting for a
// decision leaves the list and the count and waits under "Acknowledged".
// Only people who decide things (or have something waiting) see the button.
export function ActionCentre() {
  const { total, acknowledged, popKeys, relevant } = useActionCentreCounts()
  const [open, setOpen] = useState(false)
  const [showAcked, setShowAcked] = useState(false)
  const { pathname } = useLocation()
  // Following a link out of it closes it (only a real change of page — not
  // the first render, which may be the very moment it opens).
  const lastPath = useRef(pathname)
  useEffect(() => {
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    setOpen(false)
  }, [pathname])
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
            <DialogDescription>Everything waiting for you to approve, confirm or look at. Acknowledge anything to clear it from this list.</DialogDescription>
          </DialogHeader>
          {total === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center text-muted-foreground">
              <PartyPopper className="size-8 opacity-50" />
              <p className="text-sm">Nothing waiting on you — all caught up.</p>
            </div>
          ) : (
            <AckScope mode="open">
              <div className="grid gap-5">
                <PeopleChangeAlerts />
                <CmLeaveReviews />
                <HrLeaveQueue />
                <CeoLeaveQueue />
                <OvertimeApprovalsCard />
                <SalaryApprovalCard />
                <FnfCards />
                <ReimbursementApprovalsCard />
                <AttendanceChangeRequestsCard />
                <BillReminders />
              </div>
            </AckScope>
          )}

          {acknowledged > 0 && (
            <div className="rounded-2xl border border-dashed border-border">
              <button
                type="button"
                onClick={() => setShowAcked((v) => !v)}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-bold text-muted-foreground hover:text-foreground"
                aria-expanded={showAcked}
              >
                <ChevronDown className={cn('size-4 transition-transform', !showAcked && '-rotate-90')} />
                Acknowledged · {acknowledged}
                <span className="font-normal">— still waiting for a decision, out of your list and count</span>
              </button>
              {showAcked && (
                <AckScope mode="acked">
                  <div className="grid gap-5 px-4 pb-4">
                    <CmLeaveReviews />
                    <HrLeaveQueue />
                    <CeoLeaveQueue />
                    <OvertimeApprovalsCard />
                    <SalaryApprovalCard />
                    <FnfCards />
                    <ReimbursementApprovalsCard />
                    <AttendanceChangeRequestsCard />
                  </div>
                </AckScope>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <LeaveOvertimePopup popKeys={popKeys} />
    </>
  )
}
