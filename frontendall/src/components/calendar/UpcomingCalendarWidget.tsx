import { Cake, CalendarDays, CalendarOff, PartyPopper, Star } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useBirthdays } from '@/hooks/useBirthdays'
import { useCompanyEvents } from '@/hooks/useCompanyEvents'
import { useHolidays } from '@/hooks/useHolidays'
import type { CompanyEvent, CompanyEventType } from '@/api/companyEvents.api'

function addDaysUTC(date: Date, days: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days))
}

// 'important' markers don't recur (matched on the full date); every other
// company event type recurs yearly on month/day only — same convention as
// employee birthdays. See companyEvent.service.js#listForMonth.
function isEventOnDate(event: CompanyEvent, dateKey: string) {
  if (event.type === 'important') return event.date.slice(0, 10) === dateKey
  return new Date(event.date).getUTCDate() === Number(dateKey.slice(8, 10))
}

function eventVisual(type: CompanyEventType) {
  switch (type) {
    case 'client_birthday':
      return { Icon: Cake, color: 'text-blue-500', label: 'birthday' }
    case 'client_anniversary':
      return { Icon: PartyPopper, color: 'text-blue-500', label: 'anniversary' }
    case 'brand_anniversary':
      return { Icon: PartyPopper, color: 'text-emerald-500', label: 'brand anniversary' }
    case 'important':
      return { Icon: Star, color: 'text-red-500', label: 'important' }
  }
}

// Holidays, employee birthdays, and company events (client birthdays/
// anniversaries, brand anniversary, important markers) for today + the next
// 2 days — mirrors the "Upcoming" strip on the full Company Calendar page
// (see CompanyCalendarGrid.tsx), just inline on the dashboard instead of its
// own page. Only rendered when something is actually coming up.
export function UpcomingCalendarWidget() {
  const todayDate = new Date()
  const month = todayDate.getUTCMonth() + 1
  const year = todayDate.getUTCFullYear()
  const today = todayDate.toISOString().slice(0, 10)

  const { data: holidaysData } = useHolidays(month, year)
  const { data: eventsData } = useCompanyEvents(month, year)
  const { data: birthdaysData } = useBirthdays()

  const nextMonthDate = new Date(Date.UTC(year, month, 1))
  const needsNextMonth = month !== nextMonthDate.getUTCMonth() + 1 || year !== nextMonthDate.getUTCFullYear()
  const { data: holidaysNextData } = useHolidays(nextMonthDate.getUTCMonth() + 1, nextMonthDate.getUTCFullYear(), {
    enabled: needsNextMonth,
  })
  const { data: eventsNextData } = useCompanyEvents(nextMonthDate.getUTCMonth() + 1, nextMonthDate.getUTCFullYear(), {
    enabled: needsNextMonth,
  })

  const upcomingDates = [0, 1, 2].map((offset) => addDaysUTC(todayDate, offset))
  const upcomingRows = upcomingDates.map((d) => {
    const dateKey = d.toISOString().slice(0, 10)
    const isNextMonth = d.getUTCMonth() + 1 !== month || d.getUTCFullYear() !== year
    const holidays = isNextMonth ? holidaysNextData?.holidays : holidaysData?.holidays
    const events = isNextMonth ? eventsNextData?.events : eventsData?.events
    const holiday = (holidays ?? []).find((h) => h.date.slice(0, 10) === dateKey)
    const dayBirthdays = (birthdaysData?.employees ?? []).filter((e) => {
      if (!e.dob) return false
      const dob = new Date(e.dob)
      return dob.getUTCMonth() === d.getUTCMonth() && dob.getUTCDate() === d.getUTCDate()
    })
    const dayEvents = (events ?? []).filter((e) => isEventOnDate(e, dateKey))
    return { dateKey, date: d, holiday, birthdays: dayBirthdays, events: dayEvents }
  })

  const rowsWithSomething = upcomingRows.filter(
    (row) => row.holiday || row.birthdays.length > 0 || row.events.length > 0
  )
  if (rowsWithSomething.length === 0) return null

  return (
    <Card className="rounded-xl border border-border p-6">
      <CardContent className="p-0 space-y-3">
        <h2 className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
          <CalendarDays className="size-4" />
          Upcoming — next 3 days
        </h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {rowsWithSomething.map((row) => (
            <div key={row.dateKey} className="rounded-xl bg-secondary/40 p-3 space-y-1.5">
              <p className="text-xs font-bold text-foreground">
                {row.date.toLocaleDateString('en-US', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  timeZone: 'UTC',
                })}
                {row.dateKey === today && ' · Today'}
              </p>
              {row.holiday && (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-neutral-400">
                  <CalendarOff className="size-3" /> {row.holiday.label}
                </p>
              )}
              {row.birthdays.map((b) => (
                <p key={b._id} className="flex items-center gap-1.5 text-xs font-semibold text-yellow-500">
                  <Cake className="size-3" /> {b.firstName} {b.lastName}
                </p>
              ))}
              {row.events.map((e) => {
                const { Icon, color } = eventVisual(e.type)
                return (
                  <p key={e._id} className={cn('flex items-center gap-1.5 text-xs font-semibold', color)}>
                    <Icon className="size-3" /> {e.name}
                  </p>
                )
              })}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
