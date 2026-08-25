import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmployeePickerList } from '@/components/employees/EmployeePickerList'
import { AttendanceCalendar } from '@/components/attendance/AttendanceCalendar'
import { AttendanceSummaryCard } from '@/components/attendance/AttendanceSummaryCard'
import { DevicePunchFeed } from '@/components/attendance/DevicePunchFeed'
import { RequestModificationDialog } from '@/components/attendance/RequestModificationDialog'
import { AttendanceRequestsPanel } from '@/components/attendance/AttendanceRequestsPanel'
import { useEmployee, useEmployees } from '@/hooks/useEmployees'
import { useAttendanceMarkedToday } from '@/hooks/useAttendance'
import { useAuth } from '@/hooks/useAuth'
import { hasPermission } from '@/lib/permissions'

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timeout)
  }, [value, delayMs])
  return debounced
}

export default function AttendancePage() {
  const { employeeId } = useParams<{ employeeId?: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManage = hasPermission(user, 'mark_attendance')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)

  const { data: employeesData, isLoading: employeesLoading } = useEmployees(
    { search: debouncedSearch || undefined, limit: 100 },
    { enabled: canManage }
  )
  const { data: selectedEmployeeData } = useEmployee(employeeId)
  const { data: markedTodayData } = useAttendanceMarkedToday({ enabled: canManage })

  const markedTodayIds = useMemo(() => new Set(markedTodayData?.employeeIds ?? []), [markedTodayData])

  // Unmarked employees first (who still needs marking today), marked ones
  // sink to the bottom — stable within each group (server order preserved).
  const employees = useMemo(() => {
    const items = employeesData?.items ?? []
    const unmarked = items.filter((e) => !markedTodayIds.has(e._id))
    const marked = items.filter((e) => markedTodayIds.has(e._id))
    return [...unmarked, ...marked]
  }, [employeesData, markedTodayIds])

  const selectedEmployee = selectedEmployeeData?.employee

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 py-8">
      <PageHeader
        eyebrow="Workforce tracking"
        title="Attendance"
        actions={
          <Button variant="outline" onClick={() => navigate('/')}>
            Back to dashboard
          </Button>
        }
      />

      {!canManage && (
        <div className="flex justify-end">
          <RequestModificationDialog />
        </div>
      )}

      {canManage && <DevicePunchFeed />}

      {canManage ? (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <EmployeePickerList
              search={search}
              onSearchChange={setSearch}
              isLoading={employeesLoading}
              items={employees}
              activeId={employeeId}
              onSelect={(employee) => navigate(`/attendance/${employee._id}`)}
              itemClassName={(employee) => (markedTodayIds.has(employee._id) ? 'opacity-60' : '')}
              renderTrailing={(employee) =>
                markedTodayIds.has(employee._id) ? (
                  <Badge variant="success" className="shrink-0">
                    <CheckCircle2 className="size-3" />
                    Marked
                  </Badge>
                ) : null
              }
            />
          </div>

          <div className="space-y-8 lg:col-span-2">
            {!employeeId ? (
              <Card className="flex flex-col items-center justify-center gap-3 py-24 text-center">
                <CalendarDays className="size-10 text-muted-foreground/40" />
                <p className="text-base font-semibold text-foreground">Select an employee</p>
                <p className="text-sm text-muted-foreground">
                  Choose someone from the list to view or mark attendance.
                </p>
              </Card>
            ) : (
              <div className="space-y-6">
                <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div>
                    <p className="text-xs text-muted-foreground">Viewing attendance for</p>
                    <h2 className="text-lg font-semibold text-foreground">
                      {selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : '…'}
                    </h2>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/employees/${employeeId}`)}>
                    View profile
                  </Button>
                </Card>
                <AttendanceSummaryCard employeeId={employeeId} showViewFullButton={false} />
                <AttendanceCalendar employeeId={employeeId} />
              </div>
            )}
            <AttendanceRequestsPanel />
          </div>
        </div>
      ) : (
        employeeId && (
          <div className="space-y-6">
            <AttendanceSummaryCard employeeId={employeeId} showViewFullButton={false} />
            <AttendanceCalendar employeeId={employeeId} />
          </div>
        )
      )}
    </div>
  )
}
