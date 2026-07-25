import { Link } from 'react-router-dom'
import { Cake, CalendarClock, CalendarDays, CalendarOff, PartyPopper, Star, Users } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/api/client'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useMyEventResponsibilities } from '@/hooks/useEvents'
import { useBirthdays } from '@/hooks/useBirthdays'
import { useCompanyEvents } from '@/hooks/useCompanyEvents'
import { useHolidays } from '@/hooks/useHolidays'
import type { CompanyEvent, CompanyEventType } from '@/api/companyEvents.api'

interface DashboardStats {
  totalEmployees: number
  pendingUploadRequests: number
  documentsGeneratedThisMonth: number
  activeEmployees: number
  offboardedEmployees: number
}

async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await apiClient.get('/dashboard/stats')
  return data
}

async function getApplicantsCount(status?: string): Promise<number> {
  const params = status ? { status, limit: 1 } : { limit: 1 }
  const { data } = await apiClient.get('/applicants', { params })
  return data.total
}

function StatCard({ label, value }: { label: string; value: number | undefined }) {
  return (
    <Card className="bg-card/90 backdrop-blur-md p-6 rounded-2xl border border-border/10 shadow-diffuse hover:-translate-y-0.5 transition-all duration-300">
      <CardContent className="flex flex-col justify-between p-0">
        <div className="flex flex-col">
          {value === undefined ? (
            <Skeleton className="h-16 w-20 bg-secondary/40 rounded-xl" />
          ) : (
            <p className="text-6xl font-extrabold leading-none tracking-tighter text-foreground">
              {value}
            </p>
          )}
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const isAdminLike = user?.role === 'admin' || user?.role === 'hr'

  const { data: stats } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: getDashboardStats,
    enabled: isAdminLike,
  })

  const { data: totalApplicants } = useQuery({
    queryKey: ['applicantsCount', 'all'],
    queryFn: () => getApplicantsCount(),
    enabled: isAdminLike,
  })

  const { data: upcomingMeetings } = useQuery({
    queryKey: ['applicantsCount', 'interview_scheduled'],
    queryFn: () => getApplicantsCount('interview_scheduled'),
    enabled: isAdminLike,
  })

  if (!isAdminLike) {
    return (
      <div className="space-y-8 py-4">
        <h1 className="text-3xl font-light tracking-tight text-foreground/90">
          Welcome, <span className="font-semibold text-primary">{user?.username}</span>
        </h1>
        <UpcomingCalendarWidget />
      </div>
    )
  }

  return (
    <div className="space-y-8 py-4">
      <div>
        <h1 className="text-3xl font-light tracking-tight text-foreground/90">
          Welcome, <span className="font-semibold text-primary">{user?.username}</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Here is a quick snapshot of the telemetry metrics, summary reports, and active recruitment pipelines.
        </p>
      </div>

      {/* STATS PANEL */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="grid gap-6 grid-cols-2 md:grid-cols-4"
      >
        <StatCard label="Total applicants" value={totalApplicants} />
        <StatCard label="Upcoming meetings" value={upcomingMeetings} />
        <StatCard label="Active employees" value={stats?.activeEmployees} />
        <StatCard label="Offboarded employees" value={stats?.offboardedEmployees} />
      </motion.div>

      <UpcomingCalendarWidget />

      <MyEventResponsibilitiesWidget />
    </div>
  )
}

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
// 2 days — mirrors the "Upcoming" strip on the EMS Company Calendar page,
// just inline on the dashboard instead of its own page. Only rendered when
// something is actually coming up.
function UpcomingCalendarWidget() {
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
    <Card className="bg-card/90 backdrop-blur-md rounded-2xl border border-border/10 shadow-diffuse p-6">
      <CardContent className="p-0 space-y-3">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <CalendarDays className="size-4" />
          Upcoming — next 3 days
        </h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {rowsWithSomething.map((row) => (
            <div key={row.dateKey} className="rounded-xl bg-secondary/40 p-3 space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-widest text-foreground">
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

function MyEventResponsibilitiesWidget() {
  const { data: responsibilities, isLoading } = useMyEventResponsibilities()

  return (
    <Card className="bg-card/90 backdrop-blur-md rounded-2xl border border-border/10 shadow-diffuse p-6">
      <CardContent className="p-0">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">
            <PartyPopper className="size-4 text-primary" />
            My event responsibilities
          </h2>
          <Link to="/events" className="text-xs font-semibold text-primary hover:underline">
            View all events →
          </Link>
        </div>

        {isLoading ? (
          <div className="mt-4 grid gap-2">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : !responsibilities || responsibilities.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nothing pending — you're all caught up.</p>
        ) : (
          <div className="mt-4 grid gap-2">
            {responsibilities.slice(0, 6).map((r) => {
              const event = typeof r.event === 'object' ? r.event : null
              const isOverdue = r.dueDate && new Date(r.dueDate) < new Date()
              return (
                <Link
                  key={r._id}
                  to={event ? `/events/${event._id}` : '/events'}
                  className="flex items-center justify-between gap-3 rounded-xl bg-secondary/30 p-3 hover:bg-secondary/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{r.title}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      {event?.title}
                      {r.assignedTeam && (
                        <span className="flex items-center gap-0.5">
                          <Users className="size-3" />
                          {r.assignedTeam.name}
                        </span>
                      )}
                    </p>
                  </div>
                  {r.dueDate && (
                    <span
                      className={`flex shrink-0 items-center gap-1 text-xs font-bold uppercase tracking-wide ${
                        isOverdue ? 'text-destructive' : 'text-primary'
                      }`}
                    >
                      <CalendarClock className="size-3" />
                      {new Date(r.dueDate).toLocaleDateString()}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
