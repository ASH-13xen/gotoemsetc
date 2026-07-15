import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, CheckCircle2, Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AttendanceCalendar } from '@/components/attendance/AttendanceCalendar'
import { AttendanceSummaryCard } from '@/components/attendance/AttendanceSummaryCard'
import { useEmployee, useEmployees } from '@/hooks/useEmployees'
import { useAttendanceMarkedToday } from '@/hooks/useAttendance'
import { cn } from '@/lib/utils'

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
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)

  const { data: employeesData, isLoading: employeesLoading } = useEmployees({
    search: debouncedSearch || undefined,
    limit: 100,
  })
  const { data: selectedEmployeeData } = useEmployee(employeeId)
  const { data: markedTodayData } = useAttendanceMarkedToday()

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
    <div className="space-y-8 py-4">
      <main className="mx-auto max-w-6xl space-y-8">
        {/* HERO HEADER */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card className="flex min-h-[180px] flex-col justify-between p-8 md:col-span-2">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              WORKFORCE TRACKING
            </span>
            <h1 className="text-5xl font-extrabold tracking-tight text-foreground uppercase select-none md:text-7xl">
              ATTENDANCE
            </h1>
          </Card>
          <div
            onClick={() => navigate('/')}
            className="bg-primary/10 text-primary p-8 rounded-2xl flex flex-col justify-between cursor-pointer hover:shadow-glow hover:-translate-y-0.5 active:scale-[0.99] transition-all min-h-[180px]"
          >
            <span className="text-xs font-bold uppercase tracking-widest opacity-80">NAVIGATION</span>
            <span className="text-3xl font-extrabold tracking-wide uppercase">BACK TO PORTAL</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* EMPLOYEE PICKER */}
          <div className="flex max-h-[calc(100vh-260px)] flex-col bg-card/90 backdrop-blur-md rounded-2xl shadow-diffuse border-0 overflow-hidden lg:col-span-1">
            <div className="border-b border-border/15 p-4">
              <div className="relative flex items-center">
                <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground/60 z-10" />
                <Input
                  placeholder="SEARCH EMPLOYEES..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-11 pl-9 text-sm uppercase"
                />
              </div>
            </div>
            <div className="divide-y divide-border/10 overflow-y-auto">
              {employeesLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full bg-neutral-800" />
                  ))}
                </div>
              ) : employees.length === 0 ? (
                <p className="p-6 text-center text-sm font-bold tracking-widest text-neutral-400 uppercase">
                  No employees found
                </p>
              ) : (
                employees.map((employee) => {
                  const markedToday = markedTodayIds.has(employee._id)
                  return (
                    <button
                      key={employee._id}
                      type="button"
                      onClick={() => navigate(`/attendance/${employee._id}`)}
                      className={cn(
                        'w-full border-l-4 border-transparent p-4 text-left transition-colors hover:bg-secondary/40',
                        employeeId === employee._id && 'border-primary bg-secondary/50',
                        markedToday && 'opacity-60'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold tracking-wide text-foreground uppercase">
                          {employee.firstName} {employee.lastName}
                        </p>
                        {markedToday && (
                          <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                            <CheckCircle2 className="size-3" />
                            Marked
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                        {employee.employeeCode} · {employee.designation}
                      </p>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* CALENDAR */}
          <div className="lg:col-span-2">
            {!employeeId ? (
              <Card className="flex flex-col items-center justify-center gap-4 py-24 text-center">
                <CalendarDays className="size-16 text-muted-foreground/40" />
                <p className="text-2xl font-bold tracking-wider text-foreground uppercase">Select an employee</p>
                <p className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
                  Choose someone from the list to view or mark attendance.
                </p>
              </Card>
            ) : (
              <div className="space-y-6">
                <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
                  <div>
                    <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                      Viewing attendance for
                    </p>
                    <h2 className="text-2xl font-extrabold tracking-tight text-foreground uppercase">
                      {selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : '…'}
                    </h2>
                  </div>
                  <Button variant="outline" onClick={() => navigate(`/employees/${employeeId}`)} className="rounded-xl">
                    View Profile
                  </Button>
                </Card>
                <AttendanceSummaryCard employeeId={employeeId} />
                <AttendanceCalendar employeeId={employeeId} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
