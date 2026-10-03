import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import {
  CalendarClock,
  Inbox,
  ListChecks,
  PartyPopper,
  Timer,
  UserCheck,
  UserMinus,
  Users,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/api/client'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardCard, DashboardCardEmpty } from '@/components/dashboard/DashboardCard'
import { useMyEventResponsibilities } from '@/hooks/useEvents'
import { useMyUpcomingTasks } from '@/hooks/useEmployeeTasks'
import { useAttendanceSummary } from '@/hooks/useAttendance'
import { useMyUploadRequests } from '@/hooks/useUploadRequests'
import { PendingWarningsModal } from '@/components/attendance/PendingWarningsModal'
import { AttendanceOutcomeModal } from '@/components/attendance/AttendanceOutcomeModal'
import { ApplyLeaveDialog } from '@/components/attendance/ApplyLeaveDialog'
import { PendingLeaveApprovalsModal } from '@/components/attendance/PendingLeaveApprovalsModal'
import { MyLeaveApplicationsCard } from '@/components/attendance/MyLeaveApplicationsCard'
import { RegisterComplaintDialog } from '@/components/complaints/RegisterComplaintDialog'
import { ComplaintReviewModal } from '@/components/complaints/ComplaintReviewModal'
import { MyComplaintsCard } from '@/components/complaints/MyComplaintsCard'
import { MonthlyBillReminderModal } from '@/components/finance/MonthlyBillReminderModal'
import { ClaimReimbursementDialog } from '@/components/reimbursements/ClaimReimbursementDialog'
import { MyReimbursementsCard } from '@/components/reimbursements/MyReimbursementsCard'
import { KeysDialog } from '@/components/keys/KeysDialog'
import { OrgChartTeaser } from '@/components/orgChart/OrgChartTeaser'
import { AttendanceChangeRequestsCard } from '@/components/attendance/AttendanceChangeRequestsCard'
import { CreateAnnouncementDialog, canCreateAnnouncements } from '@/components/announcements/CreateAnnouncementDialog'
import { PendingAnnouncementsModal } from '@/components/announcements/PendingAnnouncementsModal'
import { PlanNextDayCard } from '@/components/tasks/PlanNextDayCard'
import { UpcomingCalendarWidget } from '@/components/calendar/UpcomingCalendarWidget'
import { CompanyCalendarGrid } from '@/components/calendar/CompanyCalendarGrid'

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

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// A small eyebrow label above each section — the same device the login
// page uses ("WELCOME BACK") to separate the page into legible chunks
// instead of one undifferentiated wall of cards.
function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-xs font-bold tracking-widest text-muted-foreground/70 uppercase">
      {children}
    </p>
  )
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: number | undefined
  icon: React.ReactNode
}) {
  return (
    <Card className="dashboard-card group flex h-full flex-col rounded-2xl border border-border p-6 transition-[box-shadow,border-color] duration-200 hover:border-primary/25 hover:shadow-[0_8px_24px_-12px_oklch(0.52_0.16_265/0.25)]">
      <CardContent className="flex flex-1 flex-col justify-between p-0">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <div className="mt-4 flex flex-col">
          {value === undefined ? (
            <Skeleton className="h-11 w-16 bg-secondary/40 rounded-lg" />
          ) : (
            <p className="text-5xl font-black leading-none tracking-tighter text-foreground tabular-nums">
              {value}
            </p>
          )}
          <p className="mt-3 text-xs font-semibold text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const isAdminLike = user?.role === 'admin' || user?.role === 'hr'
  const rootRef = useRef<HTMLDivElement>(null)

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

  // One quiet entrance for the whole page on first mount — header, then
  // each section in turn, each section's own cards staggered — never
  // replays on re-render (empty dep array), and skipped entirely under
  // prefers-reduced-motion. Deliberately quick (well under a second total):
  // this is a page people land on every day, not a one-time landing moment.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || prefersReducedMotion()) return

    const ctx = gsap.context(() => {
      // Exactly one element ever gets its opacity animated more than once in
      // this timeline: nesting a section-level fade around an
      // already-individually-animated card compounds the two opacity
      // tweens (each stage's `.from()` snapshots and fights over the same
      // property), and the outer one can settle before the inner one
      // finishes — cards stuck at partial opacity forever. So this is flat:
      // the header once, then every card-sized unit (including the
      // section-label eyebrows and the calendar block, which aren't
      // DashboardCards themselves but sit at the same visual tier) in one
      // staggered pass.
      const tl = gsap.timeline({ defaults: { ease: 'power2.out', duration: 0.45 } })
      tl.from('.dashboard-header', { y: 10, opacity: 0 }).from(
        '.dashboard-card',
        { y: 12, opacity: 0, stagger: 0.06 },
        0.15
      )
    }, root)

    return () => ctx.revert()
  }, [])

  if (!isAdminLike) {
    return (
      <div className="space-y-8 py-4" ref={rootRef}>
        <PendingWarningsModal />
        <AttendanceOutcomeModal />
        <ComplaintReviewModal />
        <PendingLeaveApprovalsModal />
        <MonthlyBillReminderModal />
        <PendingAnnouncementsModal />
        <div className="dashboard-header flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            Welcome, <span className="text-primary">{user?.username}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <KeysDialog />
            {canCreateAnnouncements(user?.role) && <CreateAnnouncementDialog />}
            <RegisterComplaintDialog />
            <ApplyLeaveDialog />
            <ClaimReimbursementDialog />
          </div>
        </div>

        <AttendanceChangeRequestsCard />

      <OrgChartTeaser />

        <div className="dashboard-card">
          <PlanNextDayCard />
        </div>

        {/* Salary Slips and My Documents moved into EMS (the employee's own
            record there) — not shown here anymore. My registered complaints
            and My leave applications sit last, directly above the calendar.
            No animation class on this wrapper itself — each card inside
            already carries .dashboard-card via DashboardCard, and animating
            both levels compounds into cards stuck at partial opacity. */}
        <div className="space-y-3">
          <SectionLabel>Your work</SectionLabel>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            <MyOvertimeCard />
            <MyUpcomingTasksWidget />
            <MyUploadRequestsCard />
            <MyReimbursementsCard />
            <MyComplaintsCard />
            <MyLeaveApplicationsCard />
          </div>
        </div>

        {/* Calendar is last and small — a glance, not the focus of the page. */}
        <div className="space-y-3">
          <SectionLabel>Calendar</SectionLabel>
          <div className="dashboard-card grid gap-4 max-w-2xl">
            <UpcomingCalendarWidget compact />
            <CompanyCalendarGrid compact />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 py-4" ref={rootRef}>
      <PendingWarningsModal />
      <PendingLeaveApprovalsModal />
      <PendingAnnouncementsModal />
      <div className="dashboard-header flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            Welcome, <span className="text-primary">{user?.username}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Here is a quick snapshot of the telemetry metrics, summary reports, and active recruitment pipelines.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <KeysDialog />
          {canCreateAnnouncements(user?.role) && <CreateAnnouncementDialog />}
        </div>
      </div>

      <div className="space-y-3">
        <SectionLabel>Overview</SectionLabel>
        <div className="grid gap-4 grid-cols-2 sm:gap-6 md:grid-cols-4">
          <StatCard label="Total applicants" value={totalApplicants} icon={<Users className="size-4" />} />
          <StatCard label="Upcoming meetings" value={upcomingMeetings} icon={<CalendarClock className="size-4" />} />
          <StatCard label="Active employees" value={stats?.activeEmployees} icon={<UserCheck className="size-4" />} />
          <StatCard label="Offboarded employees" value={stats?.offboardedEmployees} icon={<UserMinus className="size-4" />} />
        </div>
      </div>

      <AttendanceChangeRequestsCard />

      <OrgChartTeaser />

      <div className="dashboard-card">
        <PlanNextDayCard />
      </div>

      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <MyUpcomingTasksWidget />
        <MyEventResponsibilitiesWidget />
      </div>

      {/* Calendar is last and small — a glance, not the focus of the page. */}
      <div className="space-y-3">
        <SectionLabel>Calendar</SectionLabel>
        <div className="dashboard-card grid gap-4 max-w-2xl">
          <UpcomingCalendarWidget compact />
          <CompanyCalendarGrid compact />
        </div>
      </div>
    </div>
  )
}

const TASK_TYPE_LABEL: Record<string, string> = {
  personal: 'Personal',
  team: 'Team',
  client: 'Client',
  event: 'Event',
}

// Upcoming Employee Task Management tasks for the logged-in employee, due in
// the next 7 days (still includes anything already overdue), soonest-due
// first — self-scoped via /employee-tasks/mine/upcoming, same "mine"
// convention as MyEventResponsibilitiesWidget below. No count cap: every
// task due within the window shows, in a scrollable list rather than a
// fixed top-N. Full task management (create/review/complete, past tasks)
// lives in the Task Management remote at /followups; this is just a
// glance from the dashboard.
function MyUpcomingTasksWidget() {
  const { data, isLoading } = useMyUpcomingTasks()
  const tasks = data?.tasks ?? []

  return (
    <DashboardCard
      icon={<ListChecks className="size-4" />}
      title="Upcoming tasks — next 7 days"
      viewAllHref="/followups"
      viewAllLabel="View all tasks"
    >
      {isLoading ? (
        <div className="grid gap-2">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ) : tasks.length === 0 ? (
        <DashboardCardEmpty icon={<ListChecks className="size-4" />} message="Nothing pending — you're all caught up." />
      ) : (
        <div className="grid gap-2 max-h-96 overflow-y-auto pr-0.5">
          {tasks.map((task) => {
            const isOverdue = new Date(task.endAt) < new Date()
            const subtitle = task.client?.name ?? task.event?.name ?? task.team?.name
            return (
              <Link
                key={task._id}
                to="/followups"
                className="flex items-center justify-between gap-3 rounded-xl bg-secondary/30 p-3 transition-colors hover:bg-secondary/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {TASK_TYPE_LABEL[task.type]}
                    {subtitle && ` · ${subtitle}`}
                  </p>
                </div>
                <span
                  className={cn(
                    'flex shrink-0 items-center gap-1 text-xs font-bold',
                    isOverdue ? 'text-destructive' : 'text-primary'
                  )}
                >
                  <CalendarClock className="size-3" />
                  {new Date(task.endAt).toLocaleDateString()}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </DashboardCard>
  )
}

function MyEventResponsibilitiesWidget() {
  const { data: responsibilities, isLoading } = useMyEventResponsibilities()
  const list = responsibilities ?? []

  return (
    <DashboardCard
      icon={<PartyPopper className="size-4" />}
      title="My event responsibilities"
      viewAllHref="/events"
      viewAllLabel="View all events"
    >
      {isLoading ? (
        <div className="grid gap-2">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ) : list.length === 0 ? (
        <DashboardCardEmpty icon={<PartyPopper className="size-4" />} message="Nothing pending — you're all caught up." />
      ) : (
        <div className="grid gap-2">
          {list.slice(0, 6).map((r) => {
            const event = typeof r.event === 'object' ? r.event : null
            const isOverdue = r.dueDate && new Date(r.dueDate) < new Date()
            return (
              <Link
                key={r._id}
                to={event ? `/events/${event._id}` : '/events'}
                className="flex items-center justify-between gap-3 rounded-xl bg-secondary/30 p-3 transition-colors hover:bg-secondary/60"
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
                    className={cn(
                      'flex shrink-0 items-center gap-1 text-xs font-bold',
                      isOverdue ? 'text-destructive' : 'text-primary'
                    )}
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
    </DashboardCard>
  )
}

function currentMonthRange(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) }
}

// mm:ss-free "2h 15m" style — only the units that are actually non-zero,
// falling back to "0m" for a genuinely empty month rather than blank.
function formatOvertimeHoursMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

// Exact-minute overtime, current month to date — see
// backend/src/services/attendanceClassifier.service.js for how it's earned
// (a 15-minute buffer around the employee's own shift start/end). Same raw
// totalOvertimeMinutes either way; the toggle only changes how it's
// displayed, never what's fetched or stored.
function MyOvertimeCard() {
  const { user } = useAuth()
  const employeeId = user?.employeeLink ?? undefined
  const { data } = useAttendanceSummary(employeeId, currentMonthRange())
  const [unit, setUnit] = useState<'minutes' | 'hours'>('minutes')
  if (!employeeId) return null

  const totalMinutes = data?.summary.totalOvertimeMinutes

  return (
    <DashboardCard
      icon={<Timer className="size-4" />}
      title="Overtime this month"
      headerRight={
        <div className="flex shrink-0 gap-1 rounded-lg bg-secondary/50 p-1">
          <button
            type="button"
            onClick={() => setUnit('minutes')}
            className={cn(
              'rounded-md px-2 py-1 text-xs font-bold transition-colors',
              unit === 'minutes' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            Min
          </button>
          <button
            type="button"
            onClick={() => setUnit('hours')}
            className={cn(
              'rounded-md px-2 py-1 text-xs font-bold transition-colors',
              unit === 'hours' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            Hrs
          </button>
        </div>
      }
    >
      <div className="flex flex-1 flex-col justify-center">
        {totalMinutes === undefined ? (
          <Skeleton className="h-11 w-20 bg-secondary/40 rounded-lg" />
        ) : (
          <p className="text-5xl font-black leading-none tracking-tighter text-foreground tabular-nums">
            {unit === 'minutes' ? totalMinutes : formatOvertimeHoursMinutes(totalMinutes)}
          </p>
        )}
        <p className="mt-3 text-xs font-semibold text-muted-foreground">
          {unit === 'minutes' ? 'Minutes' : 'Hours'} earned so far this month
        </p>
      </div>
    </DashboardCard>
  )
}

function humanizeDocType(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// Read-only visibility into documents HR is still waiting on — fulfilled
// through the existing public upload-link flow, not from here.
function MyUploadRequestsCard() {
  const { user } = useAuth()
  const employeeId = user?.employeeLink ?? undefined
  const { data, isLoading } = useMyUploadRequests(employeeId)
  const requests = (data?.uploadRequests ?? []).filter(
    (r) => r.status === 'pending' || r.status === 'partially_fulfilled'
  )

  if (!employeeId) return null

  return (
    <DashboardCard icon={<Inbox className="size-4" />} title="Pending document requests">
      {isLoading ? (
        <Skeleton className="h-12 w-full rounded-xl" />
      ) : requests.length === 0 ? (
        <DashboardCardEmpty icon={<Inbox className="size-4" />} message="Nothing pending — you're all caught up." />
      ) : (
        <div className="grid gap-2">
          {requests.map((req) => (
            <div key={req._id} className="rounded-xl bg-secondary/30 p-3">
              <p className="text-sm font-semibold text-foreground">
                {req.requestedDocTypes.map(humanizeDocType).join(', ')}
              </p>
              <p className="text-xs text-muted-foreground">
                Expires {new Date(req.expiresAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  )
}
