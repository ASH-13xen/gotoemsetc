import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CalendarClock, PartyPopper } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { OvertimeApprovalsCard } from '@/components/attendance/OvertimeApprovalsCard'
import { CmLeaveReviews } from '@/components/attendance/CmLeaveReviews'
import { CeoLeaveQueue, HrLeaveQueue } from '@/components/attendance/LeaveStageQueues'
import { AckScope } from './ActionAck'

const SHOWN_KEY = 'action-popup:auto-shown'

function readShown(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SHOWN_KEY) || '[]'))
  } catch {
    return new Set()
  }
}
function writeShown(keys: Set<string>) {
  try {
    sessionStorage.setItem(SHOWN_KEY, JSON.stringify([...keys]))
  } catch {
    // storage may be unavailable — it just pops up again next time
  }
}

// Leave and overtime waiting on this person pop up by themselves, the way
// announcements do: once per browser session for each new one, never
// blocking — close it with the ×, or "Later", and everything stays in the
// Action centre. It waits for any other pop-up (announcements) to close, and
// for the person to stop typing, first.
export function LeaveOvertimePopup({ popKeys }: { popKeys: string[] }) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const signature = popKeys.join(',')

  useEffect(() => {
    const shown = readShown()
    const unseen = popKeys.filter((k) => !shown.has(k))
    if (unseen.length === 0) return
    const tryOpen = () => {
      // Not over another pop-up, and not while they're typing somewhere.
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return false
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName ?? '')) return false
      unseen.forEach((k) => shown.add(k))
      writeShown(shown)
      setOpen(true)
      return true
    }
    if (tryOpen()) return
    const timer = setInterval(() => tryOpen() && clearInterval(timer), 1500)
    return () => clearInterval(timer)
  }, [signature]) // eslint-disable-line react-hooks/exhaustive-deps

  // Following a link out of it closes it (only a real change of page — not
  // the first render, which may be the very moment it opens).
  const lastPath = useRef(pathname)
  useEffect(() => {
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    setOpen(false)
  }, [pathname])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-4xl overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white">
              <CalendarClock className="size-4" />
            </span>
            Leave & overtime waiting for you
            {popKeys.length > 0 && <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-black text-sky-700 dark:text-sky-300">{popKeys.length}</span>}
          </DialogTitle>
          <DialogDescription>Decide them now, acknowledge them, or close this with the × — they stay in the Action centre next to the bell.</DialogDescription>
        </DialogHeader>
        {popKeys.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <PartyPopper className="size-8 opacity-50" />
            <p className="text-sm">All done — nothing left here.</p>
          </div>
        ) : (
          <AckScope mode="open">
            <div className="grid gap-5">
              <CmLeaveReviews />
              <HrLeaveQueue />
              <CeoLeaveQueue />
              <OvertimeApprovalsCard />
            </div>
          </AckScope>
        )}
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>
            {popKeys.length === 0 ? 'Close' : 'Later — keep them in the Action centre'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
