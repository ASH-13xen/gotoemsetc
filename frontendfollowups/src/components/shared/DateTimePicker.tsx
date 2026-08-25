import { useMemo, useRef, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import { CalendarClock } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

// Every 15-minute slot in a day ("00:00".."23:45") — pick from a list
// instead of scrubbing the browser's native time-input spinner arrows.
const TIME_SLOTS = Array.from({ length: 96 }, (_, i) => `${pad(Math.floor(i / 4))}:${pad((i % 4) * 15)}`)

function formatDisplay(value: string) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

// `value` is the same bare "YYYY-MM-DDTHH:mm" (local wall-clock, no
// timezone) shape the old <input type="datetime-local"> produced — parsed
// as calendar-local so `new Date(y, m, d)` below never crosses midnight
// via a timezone shift.
function parseValue(value: string): { date: Date | undefined; time: string } {
  const [datePart, timePart] = value.split('T')
  if (!datePart) return { date: undefined, time: '09:00' }
  const [y, m, d] = datePart.split('-').map(Number)
  if (!y || !m || !d) return { date: undefined, time: timePart || '09:00' }
  return { date: new Date(y, m - 1, d), time: timePart || '09:00' }
}

function buildValue(date: Date, time: string) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${time}`
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = 'SELECT DATE & TIME',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const { date, time } = useMemo(() => parseValue(value), [value])
  const activeTimeRef = useRef<HTMLButtonElement>(null)

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) requestAnimationFrame(() => activeTimeRef.current?.scrollIntoView({ block: 'center' }))
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-10 w-full items-center gap-2 rounded-xl border-0 bg-secondary/80 px-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-secondary',
            !value && 'text-muted-foreground'
          )}
        >
          <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
          {value ? formatDisplay(value) : placeholder}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex divide-x divide-border">
          <DayPicker
            mode="single"
            selected={date}
            defaultMonth={date}
            onSelect={(picked) => {
              if (!picked) return
              onChange(buildValue(picked, time))
            }}
            classNames={{
              root: 'p-3',
              months: 'flex',
              month: 'space-y-2',
              month_caption: 'flex items-center justify-center pt-1 pb-2 relative',
              caption_label: 'text-sm font-semibold text-foreground',
              nav: 'flex items-center justify-between absolute inset-x-1 top-1',
              button_previous: 'size-7 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground',
              button_next: 'size-7 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground',
              month_grid: 'w-full border-collapse',
              weekdays: 'flex',
              weekday: 'text-muted-foreground w-9 text-[11px] font-semibold uppercase',
              week: 'flex w-full mt-1',
              day: 'size-9 p-0 text-center text-sm',
              day_button: 'size-9 rounded-lg font-medium hover:bg-secondary transition-colors',
              today: 'text-primary font-bold',
              selected: '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary',
              outside: 'text-muted-foreground/40',
              disabled: 'text-muted-foreground/30',
            }}
          />
          <div className="max-h-72 w-24 overflow-y-auto p-1.5">
            {TIME_SLOTS.map((slot) => (
              <button
                key={slot}
                ref={slot === time ? activeTimeRef : undefined}
                type="button"
                onClick={() => {
                  onChange(buildValue(date ?? new Date(), slot))
                  if (date) setOpen(false)
                }}
                className={cn(
                  'block w-full rounded-lg px-2 py-1.5 text-left text-xs font-medium hover:bg-secondary/70',
                  slot === time && 'bg-primary text-primary-foreground hover:bg-primary'
                )}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
