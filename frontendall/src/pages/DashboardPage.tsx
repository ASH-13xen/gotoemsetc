import { Link } from 'react-router-dom'
import {
  CalendarClock,
  Download,
  FileText,
  Inbox,
  ListChecks,
  PartyPopper,
  Users,
  Wallet,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/api/client'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { motion } from 'framer-motion'
import { useMyEventResponsibilities } from '@/hooks/useEvents'
import { useMyUpcomingTasks } from '@/hooks/useEmployeeTasks'
import { useAttendanceSummary } from '@/hooks/useAttendance'
import { useMyDocuments } from '@/hooks/useDocuments'
import { useMyUploadRequests } from '@/hooks/useUploadRequests'
import { useMyRecentSalaryMonths } from '@/hooks/useSalarySlips'
import { downloadMySignedDocument } from '@/api/documents.api'
import { downloadMySalarySlip } from '@/api/salarySlips.api'
import { PendingWarningsModal } from '@/components/attendance/PendingWarningsModal'
import { AttendanceOutcomeModal } from '@/components/attendance/AttendanceOutcomeModal'
import { ApplyLeaveDialog } from '@/components/attendance/ApplyLeaveDialog'
import { PendingLeaveApprovalsModal } from '@/components/attendance/PendingLeaveApprovalsModal'
import { RegisterComplaintDialog } from '@/components/complaints/RegisterComplaintDialog'
import { ComplaintReviewModal } from '@/components/complaints/ComplaintReviewModal'
import { MonthlyBillReminderModal } from '@/components/finance/MonthlyBillReminderModal'
import { ClaimReimbursementDialog } from '@/components/reimbursements/ClaimReimbursementDialog'
import { MyReimbursementsCard } from '@/components/reimbursements/MyReimbursementsCard'
import { KeysDialog } from '@/components/keys/KeysDialog'
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

function StatCard({ label, value }: { label: string; value: number | undefined }) {
  return (
    <Card className="rounded-xl border border-border p-6">
      <CardContent className="flex flex-col justify-between p-0">
        <div className="flex flex-col">
          {value === undefined ? (
            <Skeleton className="h-16 w-20 bg-secondary/40 rounded-xl" />
          ) : (
            <p className="text-6xl font-black leading-none tracking-tighter text-foreground">
              {value}
            </p>
          )}
          <p className="mt-4 text-xs font-semibold text-muted-foreground">{label}</p>
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
        <PendingWarningsModal />
        <AttendanceOutcomeModal />
        <ComplaintReviewModal />
        <PendingLeaveApprovalsModal />
        <MonthlyBillReminderModal />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-4xl font-black tracking-tight text-foreground">
            Welcome, <span className="text-primary">{user?.username}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <KeysDialog />
            <RegisterComplaintDialog />
            <ApplyLeaveDialog />
            <ClaimReimbursementDialog />
          </div>
        </div>
        <MyOvertimeCard />
        <PlanNextDayCard />
        <UpcomingCalendarWidget />
        <CompanyCalendarGrid />
        <MyUpcomingTasksWidget />
        <MyDocumentsCard />
        <MyUploadRequestsCard />
        <MySalarySlipsCard />
        <MyReimbursementsCard />
      </div>
    )
  }

  return (
    <div className="space-y-8 py-4">
      <PendingWarningsModal />
      <PendingLeaveApprovalsModal />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-foreground">
            Welcome, <span className="text-primary">{user?.username}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Here is a quick snapshot of the telemetry metrics, summary reports, and active recruitment pipelines.
          </p>
        </div>
        <KeysDialog />
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

      <PlanNextDayCard />

      <UpcomingCalendarWidget />

      <CompanyCalendarGrid />

      <MyUpcomingTasksWidget />

      <MyEventResponsibilitiesWidget />
    </div>
  )
}

const TASK_TYPE_LABEL: Record<string, string> = {
  personal: 'Personal',
  team: 'Team',
  client: 'Client',
  event: 'Event',
}

// Upcoming Employee Task Management tasks for the logged-in employee,
// soonest-due first — self-scoped via /employee-tasks/mine/upcoming, same
// "mine" convention as MyEventResponsibilitiesWidget below. Full task
// management (create/review/complete, past tasks) lives in the Task
// Management remote at /followups; this is just a glance from the
// dashboard.
function MyUpcomingTasksWidget() {
  const { data, isLoading } = useMyUpcomingTasks()
  const tasks = data?.tasks ?? []

  return (
    <Card className="rounded-xl border border-border p-6">
      <CardContent className="p-0">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
            <ListChecks className="size-4 text-primary" />
            Upcoming tasks
          </h2>
          <Link to="/followups" className="text-xs font-semibold text-primary hover:underline">
            View all tasks →
          </Link>
        </div>

        {isLoading ? (
          <div className="mt-4 grid gap-2">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : tasks.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nothing pending — you're all caught up.</p>
        ) : (
          <div className="mt-4 grid gap-2">
            {tasks.slice(0, 6).map((task) => {
              const isOverdue = new Date(task.endAt) < new Date()
              const subtitle = task.client?.name ?? task.event?.name ?? task.team?.name
              return (
                <Link
                  key={task._id}
                  to="/followups"
                  className="flex items-center justify-between gap-3 rounded-xl bg-secondary/30 p-3 hover:bg-secondary/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {TASK_TYPE_LABEL[task.type]}
                      {subtitle && ` · ${subtitle}`}
                    </p>
                  </div>
                  <span
                    className={`flex shrink-0 items-center gap-1 text-xs font-bold ${
                      isOverdue ? 'text-destructive' : 'text-primary'
                    }`}
                  >
                    <CalendarClock className="size-3" />
                    {new Date(task.endAt).toLocaleDateString()}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MyEventResponsibilitiesWidget() {
  const { data: responsibilities, isLoading } = useMyEventResponsibilities()

  return (
    <Card className="rounded-xl border border-border p-6">
      <CardContent className="p-0">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
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
                      className={`flex shrink-0 items-center gap-1 text-xs font-bold ${
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

function currentMonthRange(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) }
}

// Exact-minute overtime, current month to date — see
// backend/src/services/attendanceClassifier.service.js for how it's earned
// (a 15-minute buffer around the employee's own shift start/end).
function MyOvertimeCard() {
  const { user } = useAuth()
  const employeeId = user?.employeeLink ?? undefined
  const { data } = useAttendanceSummary(employeeId, currentMonthRange())
  if (!employeeId) return null
  return <StatCard label="Overtime minutes this month" value={data?.summary.totalOvertimeMinutes} />
}

const DOCUMENT_TEMPLATE_KEYS = ['offer-letter', 'appointment-letter']

// Only ever shows the Offer Letter / Letter of Appointment once HR has
// uploaded the countersigned copy back — never the bare unsigned original.
function MyDocumentsCard() {
  const { user } = useAuth()
  const employeeId = user?.employeeLink ?? undefined
  const { data, isLoading } = useMyDocuments(employeeId)
  const documents = (data?.documents ?? []).filter(
    (d) => d.signedFile && DOCUMENT_TEMPLATE_KEYS.includes(d.template.key)
  )

  if (!employeeId) return null

  return (
    <Card className="rounded-xl border border-border p-6">
      <CardContent className="p-0">
        <h2 className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <FileText className="size-4 text-primary" />
          My documents
        </h2>
        {isLoading ? (
          <div className="mt-4 grid gap-2">
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : documents.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No signed documents on file yet — your Offer Letter and Letter of Appointment will appear here once HR
            uploads the signed copy.
          </p>
        ) : (
          <div className="mt-4 grid gap-2">
            {documents.map((doc) => (
              <button
                key={doc._id}
                type="button"
                onClick={() => downloadMySignedDocument(employeeId, doc._id, `${doc.template.title}.pdf`)}
                className="flex w-full items-center justify-between gap-3 rounded-xl bg-secondary/30 p-3 text-left hover:bg-secondary/50"
              >
                <p className="text-sm font-semibold text-foreground">{doc.template.title}</p>
                <Download className="size-4 shrink-0 text-primary" />
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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
    <Card className="rounded-xl border border-border p-6">
      <CardContent className="p-0">
        <h2 className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <Inbox className="size-4 text-primary" />
          Pending document requests
        </h2>
        {isLoading ? (
          <div className="mt-4 grid gap-2">
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : requests.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nothing pending — you're all caught up.</p>
        ) : (
          <div className="mt-4 grid gap-2">
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
      </CardContent>
    </Card>
  )
}

const MONTH_LABEL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// Never computes or stores a slip of its own — only surfaces whichever
// official slip HR already generated for each of the last 3 completed
// months (see backend/src/services/salarySlip.service.js#listRecentMonthsForEmployee).
function MySalarySlipsCard() {
  const { user } = useAuth()
  const employeeId = user?.employeeLink ?? undefined
  const { data, isLoading } = useMyRecentSalaryMonths(employeeId)
  const months = data?.months ?? []

  if (!employeeId) return null

  return (
    <Card className="rounded-xl border border-border p-6">
      <CardContent className="p-0">
        <h2 className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <Wallet className="size-4 text-primary" />
          Salary slips
        </h2>
        {isLoading ? (
          <div className="mt-4 grid gap-2">
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : months.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nothing to show yet.</p>
        ) : (
          <div className="mt-4 grid gap-2">
            {months.map((m) => (
              <div
                key={`${m.year}-${m.month}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-secondary/30 p-3"
              >
                <p className="text-sm font-semibold text-foreground">
                  {MONTH_LABEL[m.month - 1]} {m.year}
                </p>
                {m.slip ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadMySalarySlip(employeeId, m.slip!._id)}
                  >
                    <Download className="size-3.5" />
                    Download
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Not generated yet</span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
