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
import { OvertimeApprovalsCard } from '@/components/attendance/OvertimeApprovalsCard'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useMyOvertimeRequests } from '@/hooks/useOvertimeRequests'
import { CreateAnnouncementDialog, canCreateAnnouncements } from '@/components/announcements/CreateAnnouncementDialog'
import { PendingAnnouncementsModal } from '@/components/announcements/PendingAnnouncementsModal'
import { PlanNextDayCard } from '@/components/tasks/PlanNextDayCard'
import { UpcomingCalendarWidget } from '@/components/calendar/UpcomingCalendarWidget'
import { CompanyCalendarGrid } from '@/components/calendar/CompanyCalendarGrid'
import { featureOn } from '@/lib/access'
import {
  CeoLeaveApprovalsCard,
  DashboardToggle,
  FinanceDashboard,
  OperationsDashboard,
  VIEW_META,
  availableViews,
  type DashboardView,
} from '@/components/dashboard/RoleDashboards'

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

const VIEW_KEY = 'dashboard:view'

export default function DashboardPage() {
  const { user } = useAuth()
  const rootRef = useRef<HTMLDivElement>(null)
  const tasksOn = featureOn(user, 'TASK_MANAGEMENT')

  // One dashboard per hat (see RoleDashboards.tsx) — the person picks with
  // the big toggle; the choice is remembered on this device.
  const views = availableViews(user)
  const [picked, setPicked] = useState<DashboardView>(() => {
    try {
      return (localStorage.getItem(VIEW_KEY) as DashboardView) || views[0]
    } catch {
      return views[0]
    }
  })
  const view = views.includes(picked) ? picked : views[0]
  const choose = (v: DashboardView) => {
    setPicked(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      // storage unavailable — the choice just isn't remembered
    }
  }
  const isOverview = view === 'admin' || view === 'ceo' || view === 'hr'

  const { data: stats } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: getDashboardStats,
    enabled: isOverview,
  })

  const { data: totalApplicants } = useQuery({
    queryKey: ['applicantsCount', 'all'],
    queryFn: () => getApplicantsCount(),
    enabled: isOverview,
  })

  const { data: upcomingMeetings } = useQuery({
    queryKey: ['applicantsCount', 'interview_scheduled'],
    queryFn: () => getApplicantsCount('interview_scheduled'),
    enabled: isOverview,
  })

  // A quiet entrance whenever the dashboard (or the chosen view) appears —
  // header, then every card-sized unit in one staggered pass. Skipped under
  // prefers-reduced-motion.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || prefersReducedMotion()) return

    const ctx = gsap.context(() => {
      // Flat on purpose: nesting a section fade around already-animated cards
      // compounds the opacity tweens and can leave cards stuck half-faded.
      const tl = gsap.timeline({ defaults: { ease: 'power2.out', duration: 0.45 } })
      tl.from('.dashboard-view-title', { y: 10, opacity: 0 }).from('.dashboard-card', { y: 12, opacity: 0, stagger: 0.06 }, 0.1)
    }, root)

    return () => ctx.revert()
  }, [view])

  const name = user?.displayName ?? user?.username

  return (
    <div className="space-y-8 py-4" ref={rootRef}>
      {/* Pop-ups that apply whichever view is showing. */}
      <PendingWarningsModal />
      <AttendanceOutcomeModal />
      <ComplaintReviewModal />
      <PendingLeaveApprovalsModal />
      <MonthlyBillReminderModal />
      <PendingAnnouncementsModal />

      <DashboardToggle views={views} value={view} onChange={choose} />

      <div className="dashboard-view-title flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground capitalize sm:text-4xl">
            Welcome, <span className="text-primary">{name?.toLowerCase()}</span>
          </h1>
          {view !== 'me' && (
            <p className="mt-2 text-sm text-muted-foreground">
              {VIEW_META[view].label} dashboard
              {view === 'ceo' ? ' — your approvals and the company at a glance.' : ''}
              {view === 'hr' ? ' — people, recruitment and leave at a glance.' : ''}
              {view === 'admin' ? ' — the whole company at a glance.' : ''}
              {view === 'cfo' ? ' — what Finance needs to act on.' : ''}
              {view === 'operations' ? ' — complaints and office keys.' : ''}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <KeysDialog />
          {canCreateAnnouncements(user) && <CreateAnnouncementDialog />}
          {view === 'me' && user?.employeeLink && (
            <>
              <RegisterComplaintDialog />
              <ApplyLeaveDialog />
              <ClaimReimbursementDialog />
            </>
          )}
        </div>
      </div>

      {/* Overtime waiting on this person — a content manager's team queue, HR's
          final approvals. Shown whichever view is open; nothing when empty. */}
      <OvertimeApprovalsCard />

      {view === 'me' && (
        <>
          <OrgChartTeaser />

          {tasksOn && (
            <div className="dashboard-card">
              <PlanNextDayCard />
            </div>
          )}

          {/* My registered complaints and My leave applications sit last,
              directly above the calendar. No animation class on this wrapper —
              each card inside already carries .dashboard-card. */}
          <div className="space-y-3">
            <SectionLabel>Your work</SectionLabel>
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              <MyOvertimeCard />
              {tasksOn && <MyUpcomingTasksWidget />}
              <MyUploadRequestsCard />
              <MyReimbursementsCard />
              <MyComplaintsCard />
              <MyLeaveApplicationsCard />
            </div>
          </div>
        </>
      )}

      {isOverview && (
        <>
          <div className="space-y-3">
            <SectionLabel>Overview</SectionLabel>
            <div className="grid gap-4 grid-cols-2 sm:gap-6 md:grid-cols-4">
              <StatCard label="Total applicants" value={totalApplicants} icon={<Users className="size-4" />} />
              <StatCard label="Upcoming meetings" value={upcomingMeetings} icon={<CalendarClock className="size-4" />} />
              <StatCard label="Active employees" value={stats?.activeEmployees} icon={<UserCheck className="size-4" />} />
              <StatCard label="Offboarded employees" value={stats?.offboardedEmployees} icon={<UserMinus className="size-4" />} />
            </div>
          </div>

          {(view === 'ceo' || view === 'admin') && (
            <>
              <AttendanceChangeRequestsCard />
              <div className="grid items-stretch gap-6 lg:grid-cols-2">
                <CeoLeaveApprovalsCard />
                <MyEventResponsibilitiesWidget />
              </div>
            </>
          )}
          {view === 'hr' && (
            <div className="grid items-stretch gap-6 lg:grid-cols-2">
              <MyEventResponsibilitiesWidget />
            </div>
          )}

          <OrgChartTeaser />
        </>
      )}

      {view === 'cfo' && <FinanceDashboard />}
      {view === 'operations' && <OperationsDashboard />}

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

// Events is hidden for now — the card keeps its place with a heading only.
function MyEventResponsibilitiesWidget() {
  return (
    <DashboardCard icon={<PartyPopper className="size-4" />} title="My event responsibilities">
      <DashboardCardEmpty icon={<PartyPopper className="size-4" />} message="Coming soon" />
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
  // Overtime only counts once HR approves it — what is still on its way is
  // listed under the total.
  const now = new Date()
  const { data: otRequests = [] } = useMyOvertimeRequests(employeeId, { month: now.getMonth() + 1, year: now.getFullYear() })
  if (!employeeId) return null

  const totalMinutes = data?.summary.totalOvertimeMinutes
  const waiting = otRequests.filter((r) => r.status === 'pending')
  const waitingMinutes = waiting.reduce((sum, r) => sum + (r.cmMinutes ?? r.appliedMinutes ?? r.biometricMinutes ?? 0), 0)
  const turnedDown = otRequests.filter((r) => r.status === 'rejected')

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
          {unit === 'minutes' ? 'Minutes' : 'Hours'} approved so far this month
        </p>
        {waiting.length > 0 && (
          <div className="mt-3 rounded-xl bg-amber-500/10 p-2.5">
            <p className="text-xs font-bold text-amber-700">
              {unit === 'minutes' ? `${waitingMinutes} min` : formatOvertimeHoursMinutes(waitingMinutes)} waiting for approval
            </p>
            <div className="mt-1 grid max-h-20 gap-0.5 overflow-y-auto text-[11px] text-amber-800/80">
              {waiting.map((r) => (
                <span key={r._id}>
                  {new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })} ·{' '}
                  {r.cmMinutes ?? r.appliedMinutes ?? r.biometricMinutes} min · with {r.stage === 'hr' ? 'HR' : 'your content manager'}
                </span>
              ))}
            </div>
          </div>
        )}
        {turnedDown.length > 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Not approved:{' '}
            {turnedDown
              .map((r) => `${new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })}${r.rejectionReason ? ` (${r.rejectionReason})` : ''}`)
              .join(', ')}
          </p>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground/80">Overtime above 60 minutes in a day counts once HR approves it.</p>
      </div>
    </DashboardCard>
  )
}

function humanizeDocType(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function uploadRequestState(req: { status: string; expiresAt: string }) {
  const stillOpen = req.status === 'pending' || req.status === 'partially_fulfilled'
  if (stillOpen && new Date(req.expiresAt).getTime() <= Date.now()) return 'expired'
  return req.status
}

const UPLOAD_STATE_LABEL: Record<string, string> = {
  pending: 'Pending',
  partially_fulfilled: 'Partly uploaded',
  fulfilled: 'Uploaded',
  expired: 'Link expired',
  revoked: 'Cancelled',
}

// Read-only visibility into documents HR is still waiting on — fulfilled
// through the existing public upload-link flow, not from here. A request
// drops off the card the moment it's uploaded or its link expires; the full
// history stays under "See all".
function MyUploadRequestsCard() {
  const { user } = useAuth()
  const employeeId = user?.employeeLink ?? undefined
  const { data, isLoading } = useMyUploadRequests(employeeId)
  const [allOpen, setAllOpen] = useState(false)
  const all = data?.uploadRequests ?? []
  const requests = all.filter((r) => ['pending', 'partially_fulfilled'].includes(uploadRequestState(r)))

  if (!employeeId) return null

  return (
    <DashboardCard
      icon={<Inbox className="size-4" />}
      title="Pending document requests"
      headerRight={
        all.length > 0 ? (
          <button type="button" onClick={() => setAllOpen(true)} className="shrink-0 text-xs font-semibold text-primary hover:underline">
            See all →
          </button>
        ) : undefined
      }
    >
      <Dialog open={allOpen} onOpenChange={setAllOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>All document requests</DialogTitle>
            <DialogDescription>Every document HR has asked you for, newest first.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {[...all]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((req) => {
                const state = uploadRequestState(req)
                return (
                  <div key={req._id} className="flex items-start justify-between gap-3 rounded-xl bg-secondary/30 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{req.requestedDocTypes.map(humanizeDocType).join(', ')}</p>
                      <p className="text-xs text-muted-foreground">
                        Asked {new Date(req.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })} · link{' '}
                        {state === 'expired' ? 'expired' : 'valid till'} {new Date(req.expiresAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      </p>
                    </div>
                    <Badge variant={state === 'fulfilled' ? 'success' : state === 'expired' || state === 'revoked' ? 'secondary' : 'warning'}>
                      {UPLOAD_STATE_LABEL[state] ?? state}
                    </Badge>
                  </div>
                )
              })}
          </div>
        </DialogContent>
      </Dialog>
      {isLoading ? (
        <Skeleton className="h-12 w-full rounded-xl" />
      ) : requests.length === 0 ? (
        <DashboardCardEmpty icon={<Inbox className="size-4" />} message="Nothing pending — you're all caught up." />
      ) : (
        <div className="grid max-h-72 gap-2 overflow-y-auto pr-0.5">
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
