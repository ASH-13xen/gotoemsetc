import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AttendanceCalendar } from '@/components/attendance/AttendanceCalendar'
import { useEmployee, useEmployees } from '@/hooks/useEmployees'
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

  const employees = employeesData?.items ?? []
  const selectedEmployee = selectedEmployeeData?.employee

  return (
    <div className="min-h-screen bg-black p-6 text-white">
      <main className="mx-auto max-w-6xl space-y-8">
        {/* HERO HEADER */}
        <div className="grid grid-cols-1 border-2 border-white bg-black md:grid-cols-3">
          <div className="flex min-h-[180px] flex-col justify-between border-b-2 border-white p-8 md:col-span-2 md:border-r-2 md:border-b-0">
            <span className="text-xs font-black uppercase tracking-widest text-neutral-400">
              WORKFORCE TRACKING
            </span>
            <h1 className="text-5xl font-black tracking-tighter text-white uppercase select-none md:text-7xl">
              ATTENDANCE
            </h1>
          </div>
          <div className="grid grid-cols-1 divide-y-2 divide-white">
            <div
              onClick={() => navigate('/')}
              className="flex min-h-[120px] cursor-pointer flex-col justify-between bg-primary p-8 text-primary-foreground transition-all hover:opacity-90 active:scale-[0.99]"
            >
              <span className="text-xs font-black uppercase tracking-widest opacity-80">NAVIGATION</span>
              <span className="text-3xl font-extrabold tracking-wide uppercase">BACK TO PORTAL</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* EMPLOYEE PICKER */}
          <div className="flex max-h-[calc(100vh-260px)] flex-col border-2 border-white bg-black lg:col-span-1">
            <div className="border-b-2 border-white p-4">
              <div className="relative flex items-center">
                <Search className="pointer-events-none absolute left-3 size-4 text-neutral-400" />
                <Input
                  placeholder="SEARCH EMPLOYEES..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-11 rounded-none border-2 border-white bg-black pl-9 text-sm text-white uppercase"
                />
              </div>
            </div>
            <div className="divide-y-2 divide-neutral-900 overflow-y-auto">
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
                employees.map((employee) => (
                  <button
                    key={employee._id}
                    type="button"
                    onClick={() => navigate(`/attendance/${employee._id}`)}
                    className={cn(
                      'w-full border-l-4 border-transparent p-4 text-left transition-colors hover:bg-neutral-900',
                      employeeId === employee._id && 'border-primary bg-neutral-900'
                    )}
                  >
                    <p className="font-black tracking-wide text-white uppercase">
                      {employee.firstName} {employee.lastName}
                    </p>
                    <p className="mt-0.5 text-xs font-bold tracking-widest text-neutral-400 uppercase">
                      {employee.employeeCode} · {employee.designation}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* CALENDAR */}
          <div className="lg:col-span-2">
            {!employeeId ? (
              <div className="flex flex-col items-center justify-center gap-4 border-2 border-white bg-black py-24 text-center">
                <CalendarDays className="size-16 text-neutral-600" />
                <p className="text-2xl font-black tracking-wider text-white uppercase">Select an employee</p>
                <p className="text-sm font-bold tracking-widest text-neutral-400 uppercase">
                  Choose someone from the list to view or mark attendance.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-2 border-white bg-black p-6">
                  <div>
                    <p className="text-xs font-black tracking-widest text-neutral-400 uppercase">
                      Viewing attendance for
                    </p>
                    <h2 className="text-2xl font-black tracking-tight text-white uppercase">
                      {selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : '…'}
                    </h2>
                  </div>
                  <Button variant="outline" onClick={() => navigate(`/employees/${employeeId}`)}>
                    View Profile
                  </Button>
                </div>
                <AttendanceCalendar employeeId={employeeId} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
