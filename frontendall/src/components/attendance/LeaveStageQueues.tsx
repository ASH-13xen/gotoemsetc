import { Link } from 'react-router-dom'
import { ArrowRight, CalendarCheck2, Crown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { can } from '@/lib/access'
import type { StoredUser } from '@/lib/authStorage'
import { usePendingLeaveAll } from '@/hooks/useAttendanceRequests'
import { HALF_DAY_PERIOD_LABEL, leaveApplicationLabel, type AttendanceModificationRequest } from '@/api/attendanceRequests.api'
import { AckButton, useAckScope } from '@/components/layout/ActionAck'
import { ACTION_KEY } from '@/lib/actionKeys'

// Leave and modification requests waiting at HR (after the content manager,
// or straight from someone with none), and Unpaid Leave waiting for the CEO's
// final approval. They're decided in HR Work → Leave applications; here each
// is listed with a way there, and can be acknowledged.

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const range = (r: AttendanceModificationRequest) => (r.endDate?.slice(0, 10) === r.date.slice(0, 10) ? fmt(r.date) : `${fmt(r.date)} – ${fmt(r.endDate)}`)
const nameOf = (r: AttendanceModificationRequest) =>
  typeof r.employee === 'string' ? r.employee : `${r.employee.firstName} ${r.employee.lastName ?? ''}`.trim().toLowerCase()
const LEAVE_PAGE = '/hr/leave-applications'

// Whoever holds the HR post (by login or on the Organisation chart).
export const isHrPerson = (user: StoredUser | null | undefined) => Boolean(user && (user.roles ?? [user.role]).includes('hr'))

function Queue({
  icon,
  title,
  hint,
  tone,
  requests,
  keyOf,
}: {
  icon: React.ReactNode
  title: string
  hint: string
  tone: string
  requests: AttendanceModificationRequest[]
  keyOf: (id: string) => string
}) {
  return (
    <div className={`dashboard-card overflow-hidden rounded-2xl border bg-card ${tone}`}>
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-secondary/40 px-5 py-3.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <span className="rounded-full bg-sky-500 px-2.5 py-0.5 text-xs font-black text-white">{requests.length}</span>
      </div>
      <div className="grid gap-2 p-4 md:grid-cols-2">
        {requests.map((r) => (
          <div key={r._id} className="flex min-w-0 flex-col gap-2 rounded-xl bg-secondary/40 p-3">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground capitalize">{nameOf(r)}</p>
                <p className="text-xs text-muted-foreground">{range(r)}</p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1">
                <Badge variant="outline">{leaveApplicationLabel(r) || 'Modification request'}</Badge>
                {r.requestedHalfDayPeriod && <Badge variant="outline">{HALF_DAY_PERIOD_LABEL[r.requestedHalfDayPeriod]}</Badge>}
              </div>
            </div>
            {r.reason && <p className="line-clamp-2 text-sm text-foreground/80">{r.reason}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                to={LEAVE_PAGE}
                // HR Work runs its own router; this makes it follow the address at once.
                onClick={() => setTimeout(() => window.dispatchEvent(new PopStateEvent('popstate')), 0)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                Decide in Leave applications <ArrowRight className="size-3" />
              </Link>
              <AckButton keys={[keyOf(r._id)]} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function HrLeaveQueue() {
  const { user } = useAuth()
  const hr = isHrPerson(user)
  const { data = [] } = usePendingLeaveAll(hr || can(user, 'attendance_final_approval'))
  const { shows } = useAckScope()
  if (!hr) return null
  const requests = data.filter((r) => r.approvalStage === 'hr' && shows(ACTION_KEY.leaveHr(r._id)))
  if (requests.length === 0) return null
  return (
    <Queue
      icon={<CalendarCheck2 className="size-4" />}
      title="Leave & modification requests waiting for HR"
      hint="Past the content manager (or from someone with none) — approve or reject them in HR Work → Leave applications."
      tone="border-sky-500/40"
      requests={requests}
      keyOf={ACTION_KEY.leaveHr}
    />
  )
}

export function CeoLeaveQueue() {
  const { user } = useAuth()
  const finalApproval = can(user, 'attendance_final_approval')
  const { data = [] } = usePendingLeaveAll(finalApproval || isHrPerson(user))
  const { shows } = useAckScope()
  if (!finalApproval) return null
  const requests = data.filter((r) => r.approvalStage === 'ceo' && shows(ACTION_KEY.leaveCeo(r._id)))
  if (requests.length === 0) return null
  return (
    <Queue
      icon={<Crown className="size-4" />}
      title="Leave waiting for the CEO's final approval"
      hint="Unpaid Leave goes Content Manager → HR → CEO. HR has approved these; give the final word in HR Work → Leave applications."
      tone="border-amber-500/40"
      requests={requests}
      keyOf={ACTION_KEY.leaveCeo}
    />
  )
}
