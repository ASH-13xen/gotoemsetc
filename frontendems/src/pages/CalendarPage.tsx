import { useState } from 'react'
import { toast } from 'sonner'
import { CalendarOff, CalendarDays, ChevronLeft, ChevronRight, Cake, PartyPopper, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { isAdminLike } from '@/lib/permissions'
import { useCreateHoliday, useDeleteHoliday, useHolidays } from '@/hooks/useHolidays'
import { useCreateCompanyEvent, useDeleteCompanyEvent, useCompanyEvents } from '@/hooks/useCompanyEvents'
import { useEmployeeBirthdays } from '@/hooks/useEmployees'
import type { CompanyEvent, CompanyEventType } from '@/api/companyEvents.api'
import type { EmployeeBirthday } from '@/api/employees.api'

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

// Recurring events (employee birthdays, client birthdays/anniversaries,
// brand anniversary) only ever compare month/day — the stored year is
// whatever the record happened to be entered with, never compared, same
// convention as the birthday reminder cron. 'important' markers are the
// one exception — they don't recur, see isEventOnDate below.
function dayOfMonthUTC(dateStr: string) {
  return new Date(dateStr).getUTCDate()
}

function isEventOnDate(event: CompanyEvent, dateKey: string) {
  if (event.type === 'important') return event.date.slice(0, 10) === dateKey
  return dayOfMonthUTC(event.date) === Number(dateKey.slice(8, 10))
}

// Small icon + colour used everywhere this event type shows up — the day
// grid, the per-day popover, the legend, and the upcoming strip.
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

function addDaysUTC(date: Date, days: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days))
}

export default function CalendarPage() {
  const { user } = useAuth()
  const canManage = isAdminLike(user)

  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date()
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  })
  const [openDay, setOpenDay] = useState<string | null>(null)

  const month = monthDate.getUTCMonth() + 1
  const year = monthDate.getUTCFullYear()

  const { data: holidaysData, isLoading: holidaysLoading } = useHolidays(month, year)
  const { data: eventsData } = useCompanyEvents(month, year)
  const { data: birthdaysData } = useEmployeeBirthdays()
  const createHoliday = useCreateHoliday()
  const deleteHoliday = useDeleteHoliday()
  const createEvent = useCreateCompanyEvent()
  const deleteEvent = useDeleteCompanyEvent()

  // Upcoming strip covers today .. today+2, which can spill into next
  // month near a month boundary — fetched independently of whichever month
  // the grid above happens to be showing.
  const todayDate = new Date()
  const nextMonthDate = new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth() + 1, 1))
  const needsNextMonth = month !== nextMonthDate.getUTCMonth() + 1 || year !== nextMonthDate.getUTCFullYear()
  const { data: holidaysNextData } = useHolidays(nextMonthDate.getUTCMonth() + 1, nextMonthDate.getUTCFullYear(), {
    enabled: needsNextMonth,
  })
  const { data: eventsNextData } = useCompanyEvents(nextMonthDate.getUTCMonth() + 1, nextMonthDate.getUTCFullYear(), {
    enabled: needsNextMonth,
  })

  const holidayByDate = new Map((holidaysData?.holidays ?? []).map((h) => [h.date.slice(0, 10), h]))

  const birthdaysByDay = new Map<number, EmployeeBirthday[]>()
  for (const e of birthdaysData?.employees ?? []) {
    if (!e.dob) continue
    const dob = new Date(e.dob)
    if (dob.getUTCMonth() + 1 !== month) continue
    const day = dob.getUTCDate()
    const list = birthdaysByDay.get(day) ?? []
    list.push(e)
    birthdaysByDay.set(day, list)
  }

  const eventsByDay = new Map<number, CompanyEvent[]>()
  for (const e of eventsData?.events ?? []) {
    const day = dayOfMonthUTC(e.date)
    const list = eventsByDay.get(day) ?? []
    list.push(e)
    eventsByDay.set(day, list)
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const today = todayKey()

  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`),
  ]

  // --- Upcoming (next 3 days, including today) -----------------------------
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
  const hasUpcoming = upcomingRows.some((row) => row.holiday || row.birthdays.length > 0 || row.events.length > 0)

  const onToggleHoliday = (dateKey: string) => {
    const existing = holidayByDate.get(dateKey)
    if (existing) {
      deleteHoliday.mutate(existing._id, {
        onSuccess: () => toast.success('Holiday removed'),
        onError: () => toast.error('Could not remove holiday'),
      })
    } else {
      const label = window.prompt('Label for this holiday?', 'Holiday')
      if (label === null) return
      createHoliday.mutate(
        { date: dateKey, label: label || 'Holiday' },
        {
          onSuccess: () => toast.success('Holiday marked'),
          onError: () => toast.error('Could not mark holiday'),
        }
      )
    }
  }

  const onAddEvent = (dateKey: string, type: CompanyEventType, promptLabel: string) => {
    const name = window.prompt(promptLabel)
    if (!name) return
    createEvent.mutate(
      { date: dateKey, type, name },
      {
        onSuccess: () => toast.success('Event added'),
        onError: () => toast.error('Could not add event'),
      }
    )
  }

  const onRemoveEvent = (id: string) => {
    deleteEvent.mutate(id, {
      onSuccess: () => toast.success('Event removed'),
      onError: () => toast.error('Could not remove event'),
    })
  }

  return (
    <div className="space-y-8 py-4">
      <main className="mx-auto max-w-4xl space-y-8">
        {/* UPCOMING — next 3 days, including today. Only shown at all when
            something is actually coming up. */}
        {hasUpcoming && (
          <div className="bg-card/90 backdrop-blur-md rounded-2xl p-6 shadow-diffuse space-y-3">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <CalendarDays className="size-4" />
              Upcoming — next 3 days
            </h2>
            <div className="grid gap-2 sm:grid-cols-3">
              {upcomingRows
                .filter((row) => row.holiday || row.birthdays.length > 0 || row.events.length > 0)
                .map((row) => (
                  <div key={row.dateKey} className="rounded-xl bg-secondary/40 p-3 space-y-1.5">
                    <p className="text-xs font-bold uppercase tracking-widest text-foreground">
                      {row.date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}
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
          </div>
        )}

        <div className="bg-card/90 backdrop-blur-md rounded-2xl shadow-diffuse overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/15 p-6">
            <div className="flex items-center gap-2.5">
              <CalendarDays className="size-5 text-foreground" />
              <h1 className="text-lg font-bold uppercase tracking-widest text-foreground">Company Calendar</h1>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="size-9"
                onClick={() => setMonthDate((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-36 text-center text-sm font-bold uppercase tracking-widest text-foreground">
                {monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="size-9"
                onClick={() => setMonthDate((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <div className="p-6">
            {holidaysLoading ? (
              <Skeleton className="h-64 w-full bg-neutral-800" />
            ) : (
              <>
                <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-black uppercase tracking-widest text-neutral-400">
                  {WEEKDAYS.map((d) => (
                    <div key={d} className="py-1">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 grid grid-cols-7 gap-1.5">
                  {cells.map((dateKey, i) => {
                    if (!dateKey) return <div key={`blank-${i}`} />
                    const dayNum = Number(dateKey.slice(8, 10))
                    const holiday = holidayByDate.get(dateKey)
                    const isSunday = new Date(dateKey).getUTCDay() === 0
                    const birthdays = birthdaysByDay.get(dayNum) ?? []
                    const dayEvents = (eventsByDay.get(dayNum) ?? []).filter((e) => isEventOnDate(e, dateKey))

                    return (
                      <Popover
                        key={dateKey}
                        open={openDay === dateKey}
                        onOpenChange={(open) => setOpenDay(open ? dateKey : null)}
                      >
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className={cn(
                              'relative flex aspect-square flex-col items-center justify-center border text-sm font-bold transition-all duration-200 rounded-xl',
                              'border-border/30 bg-secondary/50 text-foreground hover:border-primary/50 hover:bg-secondary/85 hover:-translate-y-0.5',
                              (isSunday || holiday) && 'border-secondary/50 bg-secondary/35 text-muted-foreground/60',
                              dateKey === today && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                            )}
                          >
                            <span>{dayNum}</span>
                            <div className="absolute bottom-0.5 flex items-center gap-0.5">
                              {birthdays.length > 0 && <Cake className="size-3 text-yellow-500" />}
                              {dayEvents.map((e) => {
                                const { Icon, color } = eventVisual(e.type)
                                return <Icon key={e._id} className={cn('size-3', color)} />
                              })}
                            </div>
                            {holiday && <CalendarOff className="absolute top-1 left-1 size-3 text-neutral-400" />}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 rounded-2xl border-0 bg-card p-4 shadow-xl text-foreground">
                          <div className="grid gap-3">
                            <p className="text-sm font-bold uppercase tracking-widest text-foreground">
                              {new Date(dateKey).toLocaleDateString('en-US', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                timeZone: 'UTC',
                              })}
                            </p>
                            {isSunday && <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">Sunday — off</p>}
                            {holiday && (
                              <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">Holiday: {holiday.label}</p>
                            )}
                            {birthdays.length > 0 && (
                              <div className="grid gap-1">
                                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-yellow-500">
                                  <Cake className="size-3" /> Employee birthdays
                                </p>
                                {birthdays.map((b) => (
                                  <p key={b._id} className="text-xs font-semibold text-foreground">{b.firstName} {b.lastName}</p>
                                ))}
                              </div>
                            )}
                            {dayEvents.length > 0 && (
                              <div className="grid gap-1">
                                {dayEvents.map((e) => {
                                  const { Icon, color, label } = eventVisual(e.type)
                                  return (
                                    <div key={e._id} className="flex items-center justify-between gap-2">
                                      <p className={cn('flex items-center gap-1.5 text-xs font-semibold', color)}>
                                        <Icon className="size-3" />
                                        {e.name}
                                        {e.type !== 'important' && ` — ${label}`}
                                        {e.type === 'important' && e.notes && ` — ${e.notes}`}
                                      </p>
                                      {canManage && (
                                        <button
                                          type="button"
                                          className="text-[10px] font-bold uppercase text-muted-foreground hover:text-destructive"
                                          onClick={() => onRemoveEvent(e._id)}
                                        >
                                          Remove
                                        </button>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                            {!holiday && !isSunday && birthdays.length === 0 && dayEvents.length === 0 && (
                              <p className="text-xs font-semibold text-muted-foreground">Nothing marked on this day.</p>
                            )}
                            {canManage && (
                              <div className="grid gap-1.5 border-t border-border/15 pt-3">
                                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => onToggleHoliday(dateKey)}>
                                  <CalendarOff className="size-3.5" />
                                  {holiday ? 'Remove Holiday' : 'Mark as Holiday'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl"
                                  onClick={() => onAddEvent(dateKey, 'client_birthday', "Client's name for this birthday?")}
                                >
                                  <Cake className="size-3.5 text-blue-500" />
                                  Add Client Birthday
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl"
                                  onClick={() => onAddEvent(dateKey, 'client_anniversary', "Client's name for this anniversary?")}
                                >
                                  <PartyPopper className="size-3.5 text-blue-500" />
                                  Add Client Anniversary
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl"
                                  onClick={() => onAddEvent(dateKey, 'brand_anniversary', 'Brand/company name for this anniversary?')}
                                >
                                  <PartyPopper className="size-3.5 text-emerald-500" />
                                  Add Brand Anniversary
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl"
                                  onClick={() => onAddEvent(dateKey, 'important', 'What is this important marker about?')}
                                >
                                  <Star className="size-3.5 text-red-500" />
                                  Mark Important
                                </Button>
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )
                  })}
                </div>
                <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t-2 border-neutral-900 pt-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-400">
                    <Cake className="size-3.5 text-yellow-500" />
                    Employee birthday
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-400">
                    <Cake className="size-3.5 text-blue-500" />
                    Client birthday
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-400">
                    <PartyPopper className="size-3.5 text-blue-500" />
                    Client anniversary
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-400">
                    <PartyPopper className="size-3.5 text-emerald-500" />
                    Brand anniversary
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-400">
                    <Star className="size-3.5 text-red-500" />
                    Important
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-400">
                    <CalendarOff className="size-3" />
                    Sunday / Holiday
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
