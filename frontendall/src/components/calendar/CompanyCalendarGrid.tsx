import { useState } from 'react'
import { toast } from 'sonner'
import { Cake, CalendarDays, CalendarOff, ChevronLeft, ChevronRight, Clock3, LogOut, PartyPopper, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useCreateHoliday, useDeleteHoliday, useHolidays } from '@/hooks/useHolidays'
import { useCreateCompanyEvent, useDeleteCompanyEvent, useCompanyEvents } from '@/hooks/useCompanyEvents'
import { useBirthdays } from '@/hooks/useBirthdays'
import { useWhosOut } from '@/hooks/useCompanyCalendar'
import { STATUS_CONFIG } from '@/lib/attendanceStatusColors'
import type { CompanyEvent, CompanyEventType } from '@/api/companyEvents.api'
import type { HolidayType } from '@/api/holidays.api'
import type { WhosOutEntry } from '@/api/companyCalendar.api'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function offDayTypeLabel(type: HolidayType): string {
  if (type === 'half_day') return 'Half Day'
  if (type === 'sl_day') return 'SL Day'
  return 'Holiday'
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

function whosOutLabel(entry: WhosOutEntry) {
  const parts: string[] = []
  if (entry.status) parts.push(STATUS_CONFIG[entry.status].label.split(' — ')[1])
  if (entry.earlyDeparture) parts.push('Early Departure')
  return parts.join(' + ')
}

// The full company calendar — Holidays, Half Days, client/employee
// birthdays & anniversaries, and (new) who's out on leave, all in one month
// grid. Ported from the old frontendems CalendarPage.tsx (now removed —
// HR Work links here instead) and extended with the who's-out layer. Lives
// in frontendall itself, not a remote, so it's reachable at all times from
// every role's dashboard as well as its own /calendar route — see
// CompanyCalendarPage.tsx and ShellLayout.tsx's nav entry.
export function CompanyCalendarGrid() {
  const { user } = useAuth()
  // Matches ShellLayout.tsx's canAccessHrWork exactly (admin/hr/ceo), which
  // in turn matches the backend's requireHrWorkAccess() gate on
  // holiday.routes.js — the only roles that can actually call those writes.
  const canManage = user?.role === 'admin' || user?.role === 'hr' || user?.role === 'ceo'

  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date()
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  })
  const [openDay, setOpenDay] = useState<string | null>(null)

  const month = monthDate.getUTCMonth() + 1
  const year = monthDate.getUTCFullYear()

  const { data: holidaysData, isLoading: holidaysLoading } = useHolidays(month, year)
  const { data: eventsData } = useCompanyEvents(month, year)
  const { data: birthdaysData } = useBirthdays()
  const { data: whosOutData } = useWhosOut(month, year)
  const createHoliday = useCreateHoliday()
  const deleteHoliday = useDeleteHoliday()
  const createEvent = useCreateCompanyEvent()
  const deleteEvent = useDeleteCompanyEvent()

  const holidayByDate = new Map((holidaysData?.holidays ?? []).map((h) => [h.date.slice(0, 10), h]))

  const birthdaysByDay = new Map<number, { _id: string; firstName: string; lastName?: string }[]>()
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

  const outByDate = new Map<string, WhosOutEntry[]>()
  for (const entry of whosOutData?.entries ?? []) {
    const dateKey = entry.date.slice(0, 10)
    const list = outByDate.get(dateKey) ?? []
    list.push(entry)
    outByDate.set(dateKey, list)
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const today = todayKey()

  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`),
  ]

  const onMarkOffDay = (dateKey: string, type: HolidayType) => {
    const typeLabel = offDayTypeLabel(type)
    const label = window.prompt(`Label for this ${typeLabel.toLowerCase()}?`, typeLabel)
    if (label === null) return
    createHoliday.mutate(
      { date: dateKey, label: label || typeLabel, type },
      {
        onSuccess: () => {
          if (type === 'half_day') toast.success('Half day marked — arriving within grace still gets full-day credit')
          else if (type === 'sl_day') toast.success('SL day marked — minor lateness gets forgiven up to Short Leave')
          else toast.success('Holiday marked')
        },
        onError: () => toast.error(`Could not mark ${typeLabel.toLowerCase()}`),
      }
    )
  }

  const onRemoveOffDay = (dateKey: string) => {
    const existing = holidayByDate.get(dateKey)
    if (!existing) return
    deleteHoliday.mutate(existing._id, {
      onSuccess: () => toast.success(`${offDayTypeLabel(existing.type)} removed`),
      onError: () => toast.error('Could not remove'),
    })
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
    <Card className="overflow-hidden rounded-xl border border-border p-0">
      <div className="flex items-center justify-between border-b border-border p-5">
        <div className="flex items-center gap-2.5">
          <CalendarDays className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Company Calendar</h2>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setMonthDate((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-32 text-center text-sm font-medium text-foreground">
            {monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setMonthDate((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <CardContent className="p-5">
        {holidaysLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-medium text-muted-foreground">
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
                const isHalfDay = holiday?.type === 'half_day'
                const isSlDay = holiday?.type === 'sl_day'
                const isSunday = new Date(dateKey).getUTCDay() === 0
                const isPastDate = dateKey < today
                const birthdays = birthdaysByDay.get(dayNum) ?? []
                const dayEvents = (eventsByDay.get(dayNum) ?? []).filter((e) => isEventOnDate(e, dateKey))
                const whosOut = outByDate.get(dateKey) ?? []

                return (
                  <Popover key={dateKey} open={openDay === dateKey} onOpenChange={(open) => setOpenDay(open ? dateKey : null)}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          'relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm font-medium transition-colors duration-150',
                          'bg-secondary/50 text-foreground hover:bg-secondary/80',
                          (isSunday || holiday) && !isHalfDay && !isSlDay && 'bg-secondary/25 text-muted-foreground/60',
                          isHalfDay && 'bg-indigo-500/10 text-indigo-700',
                          isSlDay && 'bg-teal-500/10 text-teal-700',
                          dateKey === today && 'ring-1 ring-inset ring-primary'
                        )}
                      >
                        <span>{dayNum}</span>
                        <div className="absolute bottom-0.5 flex items-center gap-0.5">
                          {birthdays.length > 0 && <Cake className="size-3 text-yellow-500" />}
                          {dayEvents.map((e) => {
                            const { Icon, color } = eventVisual(e.type)
                            return <Icon key={e._id} className={cn('size-3', color)} />
                          })}
                          {whosOut.slice(0, 4).map((entry, idx) => (
                            <span
                              key={idx}
                              className={cn('size-1.5 rounded-full', entry.status ? STATUS_CONFIG[entry.status].dot : 'bg-rose-500')}
                            />
                          ))}
                          {whosOut.length > 4 && <span className="text-[9px] font-bold text-muted-foreground">+{whosOut.length - 4}</span>}
                        </div>
                        {holiday && (
                          <span className="absolute top-1 left-1">
                            {isHalfDay ? (
                              <Clock3 className="size-3 text-indigo-600" />
                            ) : isSlDay ? (
                              <Clock3 className="size-3 text-teal-600" />
                            ) : (
                              <CalendarOff className="size-3 text-muted-foreground" />
                            )}
                          </span>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-4">
                      <div className="grid gap-3">
                        <p className="text-sm font-semibold text-foreground">
                          {new Date(dateKey).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
                        </p>
                        {isSunday && <p className="text-xs text-muted-foreground">Sunday — off</p>}
                        {holiday && (
                          <p className="text-xs text-muted-foreground">
                            {offDayTypeLabel(holiday.type)}: {holiday.label}
                          </p>
                        )}
                        {birthdays.length > 0 && (
                          <div className="grid gap-1">
                            <p className="flex items-center gap-1.5 text-xs text-yellow-600">
                              <Cake className="size-3" /> Employee birthdays
                            </p>
                            {birthdays.map((b) => (
                              <p key={b._id} className="text-xs font-medium text-foreground">
                                {b.firstName} {b.lastName}
                              </p>
                            ))}
                          </div>
                        )}
                        {dayEvents.length > 0 && (
                          <div className="grid gap-1">
                            {dayEvents.map((e) => {
                              const { Icon, color, label } = eventVisual(e.type)
                              return (
                                <div key={e._id} className="flex items-center justify-between gap-2">
                                  <p className={cn('flex items-center gap-1.5 text-xs', color)}>
                                    <Icon className="size-3" />
                                    {e.name}
                                    {e.type !== 'important' && ` — ${label}`}
                                    {e.type === 'important' && e.notes && ` — ${e.notes}`}
                                  </p>
                                  {canManage && (
                                    <button
                                      type="button"
                                      className="text-xs text-muted-foreground hover:text-destructive"
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
                        {whosOut.length > 0 && (
                          <div className="grid gap-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Who's out</p>
                            {whosOut.map((entry, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 text-xs">
                                <span className={cn('size-2 rounded-full', entry.status ? STATUS_CONFIG[entry.status].dot : 'bg-rose-500')} />
                                <span className="font-medium text-foreground">
                                  {entry.employee.firstName} {entry.employee.lastName}
                                </span>
                                <span className="text-muted-foreground">— {whosOutLabel(entry)}</span>
                                {entry.earlyDeparture && (
                                  <LogOut className="size-3 text-rose-500" />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {!holiday && !isSunday && birthdays.length === 0 && dayEvents.length === 0 && whosOut.length === 0 && (
                          <p className="text-xs text-muted-foreground">Nothing marked on this day.</p>
                        )}
                        {canManage && (
                          <div className="grid gap-1.5 border-t border-border pt-3">
                            {holiday ? (
                              <Button size="sm" variant="outline" onClick={() => onRemoveOffDay(dateKey)}>
                                <CalendarOff className="size-3.5" />
                                Remove {offDayTypeLabel(holiday.type).toLowerCase()}
                              </Button>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onMarkOffDay(dateKey, 'holiday')}
                                  disabled={isPastDate}
                                  title={isPastDate ? "Past dates can't be marked as a holiday" : undefined}
                                >
                                  <CalendarOff className="size-3.5" />
                                  Mark as holiday
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onMarkOffDay(dateKey, 'half_day')}
                                  disabled={isPastDate}
                                  title={isPastDate ? "Past dates can't be marked as a half day" : undefined}
                                >
                                  <Clock3 className="size-3.5" />
                                  Mark as half day
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onMarkOffDay(dateKey, 'sl_day')}
                                  disabled={isPastDate}
                                  title={isPastDate ? "Past dates can't be marked as an SL day" : undefined}
                                >
                                  <Clock3 className="size-3.5" />
                                  Mark as SL day
                                </Button>
                              </>
                            )}
                            <Button size="sm" variant="outline" onClick={() => onAddEvent(dateKey, 'client_birthday', "Client's name for this birthday?")}>
                              <Cake className="size-3.5 text-blue-500" />
                              Add client birthday
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => onAddEvent(dateKey, 'client_anniversary', "Client's name for this anniversary?")}>
                              <PartyPopper className="size-3.5 text-blue-500" />
                              Add client anniversary
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => onAddEvent(dateKey, 'brand_anniversary', 'Brand/company name for this anniversary?')}>
                              <PartyPopper className="size-3.5 text-emerald-500" />
                              Add brand anniversary
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => onAddEvent(dateKey, 'important', 'What is this important marker about?')}>
                              <Star className="size-3.5 text-red-500" />
                              Mark important
                            </Button>
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )
              })}
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Cake className="size-3.5 text-yellow-500" />
                Employee birthday
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Cake className="size-3.5 text-blue-500" />
                Client birthday
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <PartyPopper className="size-3.5 text-blue-500" />
                Client anniversary
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <PartyPopper className="size-3.5 text-emerald-500" />
                Brand anniversary
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Star className="size-3.5 text-red-500" />
                Important
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarOff className="size-3" />
                Sunday / Holiday
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock3 className="size-3 text-indigo-600" />
                Half Day
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock3 className="size-3 text-teal-600" />
                SL Day
              </div>
              {(['O', 'H', 'SL', 'W'] as const).map((key) => (
                <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn('size-2.5 rounded-full', STATUS_CONFIG[key].dot)} />
                  {STATUS_CONFIG[key].label}
                </div>
              ))}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <LogOut className="size-3 text-rose-500" />
                Early Departure
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
