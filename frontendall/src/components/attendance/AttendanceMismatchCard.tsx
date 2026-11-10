import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ScanLine } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { can } from '@/lib/access'
import { listAttendanceMismatches } from '@/api/attendanceMismatches.api'
import { AckButton, useAckScope } from '@/components/layout/ActionAck'
import { ACTION_KEY } from '@/lib/actionKeys'

export const MISMATCHES_KEY = ['attendance-mismatches']

// Days where the scans didn't match the approved request — for HR and the
// CEO. A notice: acknowledging one makes it go away.
export function AttendanceMismatchCard() {
  const { user } = useAuth()
  const allowed = can(user, 'hrms') || can(user, 'payout_approval')
  const { data = [] } = useQuery({ queryKey: MISMATCHES_KEY, queryFn: listAttendanceMismatches, enabled: allowed, refetchInterval: 60_000 })
  const { notices, shows } = useAckScope()
  const open = data.filter((m) => shows(ACTION_KEY.attendanceMismatch(m._id)))
  if (!allowed || !notices || open.length === 0) return null

  return (
    <div className="dashboard-card overflow-hidden rounded-2xl border border-sky-500/30 bg-card">
      <div className="flex items-center gap-3 border-b border-border bg-sky-500/[0.06] px-5 py-3.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow">
          <ScanLine className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-foreground">Attendance didn't match what was applied for</p>
          <p className="text-xs text-muted-foreground">
            When the scans make a real day of it, they decide the day. A part-day leave with no scans, one scan or an odd pattern is Absent until you
            check it — set the day by hand on their attendance and it stands. The person is told whenever their day changes.
          </p>
        </div>
        <span className="rounded-full bg-sky-600 px-2.5 py-0.5 text-xs font-black text-white">{open.length}</span>
      </div>
      <div className="grid gap-2 p-4">
        {open.map((m) => (
          <div
            key={m._id}
            className={`flex items-start gap-2 rounded-xl p-3 text-sm text-foreground ${m.outcome === 'unclear' ? 'bg-amber-500/10' : 'bg-sky-500/10'}`}
          >
            <span className="min-w-0 flex-1">
              {m.outcome === 'unclear' && <span className="mr-1.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-[11px] font-bold text-amber-800">Check</span>}
              {m.message}
            </span>
            {m.employee && (
              <Link to={`/ems/attendance/${m.employee._id}`} className="shrink-0 self-center text-xs font-semibold text-primary hover:underline">
                Open attendance
              </Link>
            )}
            <AckButton keys={[ACTION_KEY.attendanceMismatch(m._id)]} notice />
          </div>
        ))}
        {open.length > 1 && (
          <div className="flex justify-end pt-1">
            <AckButton keys={open.map((m) => ACTION_KEY.attendanceMismatch(m._id))} notice className="text-foreground" />
          </div>
        )}
      </div>
    </div>
  )
}
