import type { CalendarView } from '@/api/cms.api'
import { firstWeekdayOffset, istDateKey, istInstant, istToday } from '@/lib/istDate'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// The month grid. Cells show only each item's heading, colour-coded by stage —
// clicking a day opens the full detail in a modal, per the spec. Keeping the
// cells to headings is also what makes a day with a post, a reel and three
// stories still readable.
export function CalendarGrid({
  view,
  onSelectDay,
}: {
  view: CalendarView
  onSelectDay: (dateKey: string) => void
}) {
  const { calendar, byDate, daysInMonth } = view
  const offset = firstWeekdayOffset(calendar.year, calendar.month)
  const todayKey = istDateKey(new Date())
  const today = istToday()
  const isCurrentMonth = today.year === calendar.year && today.month === calendar.month

  const cells: Array<number | null> = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[42rem] rounded-2xl bg-card/90 p-4 shadow-diffuse backdrop-blur-md">
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAYS.map((day) => (
            <div key={day} className="pb-2 text-center text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}

          {cells.map((day, i) => {
            if (day === null) return <div key={`pad-${i}`} />

            const dateKey = istDateKey(istInstant(calendar.year, calendar.month, day, 12, 0))
            const items = byDate[dateKey] ?? []
            const isToday = isCurrentMonth && dateKey === todayKey

            return (
              <button
                key={dateKey}
                onClick={() => onSelectDay(dateKey)}
                className={`flex min-h-24 flex-col gap-1 rounded-xl border p-2 text-left transition-colors hover:bg-secondary/60 ${
                  isToday ? 'border-primary/60 bg-primary/5' : 'border-border/40'
                }`}
              >
                <span
                  className={`text-xs font-medium tabular-nums ${
                    isToday ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {day}
                </span>

                <div className="flex flex-col gap-1">
                  {items.slice(0, 3).map((item) => (
                    <span
                      key={item._id}
                      className="truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                      style={{ backgroundColor: item.color }}
                      title={`${item.label} — ${item.stage.replace(/_/g, ' ')}`}
                    >
                      {item.label}
                    </span>
                  ))}
                  {items.length > 3 && (
                    <span className="px-1 text-[10px] text-muted-foreground">
                      +{items.length - 3} more
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
