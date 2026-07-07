import { useNavigate } from 'react-router-dom'
import { CalendarCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAttendance } from '@/hooks/useAttendance'
import { STATUS_CONFIG } from './statusConfig'
import type { AttendanceStatus } from '@/api/attendance.api'

// Read-only "visibility" widget for the employee profile — actual marking
// and history browsing happens in the centralized Attendance system.
export function AttendanceSummaryCard({ employeeId }: { employeeId: string }) {
  const navigate = useNavigate()
  const now = new Date()
  const { data, isLoading } = useAttendance(employeeId, now.getUTCMonth() + 1, now.getUTCFullYear())
  const records = data?.records ?? []

  const counts = records.reduce<Partial<Record<AttendanceStatus, number>>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})

  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })

  return (
    <div className="border-2 border-white bg-black p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-white pb-3">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-widest text-white">Attendance</h2>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-neutral-400">{monthLabel}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate(`/attendance/${employeeId}`)}
        >
          <CalendarCheck className="size-4" />
          View Full Attendance
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-20 w-full bg-neutral-800" />
      ) : records.length === 0 ? (
        <p className="text-sm font-bold uppercase tracking-widest text-neutral-400">
          No attendance marked yet this month.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {(Object.entries(STATUS_CONFIG) as [AttendanceStatus, (typeof STATUS_CONFIG)[AttendanceStatus]][])
            .filter(([key]) => counts[key])
            .map(([key, cfg]) => (
              <div key={key} className={cn('border-2 p-4', cfg.solid)}>
                <p className="text-3xl font-black leading-none tracking-tighter">{counts[key]}</p>
                <p className="mt-2 text-xs font-black uppercase tracking-widest">{cfg.label}</p>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
