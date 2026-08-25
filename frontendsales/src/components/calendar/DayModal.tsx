import { useState } from 'react'
import { Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useCmsAccess } from '@/hooks/useCmsAccess'
import type { CalendarView } from '@/api/cms.api'
import { ItemPanel } from './ItemPanel'
import { ScheduleDialog } from './ScheduleDialog'
import { formatIstDate, istInstant, istParts } from '@/lib/istDate'

// Clicking a calendar cell opens this: everything scheduled that day, each
// expandable into its brief, assignments, workflow state, and the actions the
// signed-in user is actually allowed to take.
export function DayModal({
  view,
  dateKey,
  onClose,
}: {
  view: CalendarView
  dateKey: string | null
  onClose: () => void
}) {
  const { canSchedule } = useCmsAccess()
  const [scheduleOpen, setScheduleOpen] = useState(false)

  if (!dateKey) return null

  const items = view.byDate[dateKey] ?? []
  const [year, month, day] = dateKey.split('-').map(Number)
  const dayDate = istInstant(year, month, day, 12, 0)
  const isClosed = Boolean(view.calendar.closedAt)
  const maySchedule = canSchedule(view.calendar.team) && !isClosed

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{formatIstDate(dayDate)}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nothing scheduled for this day.
              </p>
            ) : (
              items.map((item) => <ItemPanel key={item._id} item={item} view={view} />)
            )}

            {maySchedule && (
              <Button variant="secondary" className="w-full" onClick={() => setScheduleOpen(true)}>
                <Plus className="mr-2 size-4" />
                Schedule something for {istParts(dayDate).day} {formatIstDate(dayDate).split(' ')[1]}
              </Button>
            )}

            {isClosed && (
              <p className="rounded-xl bg-secondary/60 px-4 py-2 text-center text-xs text-muted-foreground">
                This month is closed. Its report is frozen and nothing further can be scheduled.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        view={view}
        defaultDate={dayDate}
      />
    </>
  )
}
