import { Cake, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { monthDayKey, type BirthdayEntry } from '@/lib/birthdays'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function BirthdayCalendar({
  month,
  onMonthChange,
  birthdaysByDay,
}: {
  month: Date
  onMonthChange: (next: Date) => void
  birthdaysByDay: Map<string, BirthdayEntry[]>
}) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const firstOfMonth = new Date(year, monthIndex, 1)
  const startOffset = firstOfMonth.getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="rounded-2xl border border-border/10 bg-card p-5 shadow-diffuse">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-bold uppercase tracking-widest text-foreground">
          {month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg"
            onClick={() => onMonthChange(new Date(year, monthIndex - 1, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg"
            onClick={() => onMonthChange(new Date(year, monthIndex + 1, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {WEEKDAYS.map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} className="aspect-square" />
          const entries = birthdaysByDay.get(monthDayKey(monthIndex, day)) ?? []
          const isToday = isCurrentMonth && today.getDate() === day
          const hasBirthday = entries.length > 0
          return (
            <div
              key={i}
              title={entries.map((e) => e.name).join(', ')}
              className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-semibold transition-colors ${
                isToday
                  ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                  : hasBirthday
                    ? 'bg-amber-500/10 text-foreground'
                    : 'text-foreground hover:bg-secondary/50'
              }`}
            >
              <span>{day}</span>
              {hasBirthday && <Cake className="size-3 text-amber-600" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
