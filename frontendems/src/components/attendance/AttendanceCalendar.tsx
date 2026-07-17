import { useState } from 'react'
import { toast } from 'sonner'
import { CalendarOff, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAttendance, useMarkAttendance } from '@/hooks/useAttendance'
import { useCreateHoliday, useDeleteHoliday, useHolidays } from '@/hooks/useHolidays'
import { useAuth } from '@/hooks/useAuth'
import { useDevicePunches } from '@/hooks/useDevicePunches'
import { STATUS_CONFIG } from './statusConfig'
import type { AttendanceStatus } from '@/api/attendance.api'

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const NO_STATUS = '__none__'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

// Raw biometric scans for one employee on one day — shown inside the
// day-popover so an admin can see exactly what the classifier (or they
// themselves) is working from, not just the resulting status.
function DayScans({ employeeId, date }: { employeeId: string; date: string }) {
  const { data, isLoading } = useDevicePunches({ employeeId, date })
  const punches = data?.punches ?? []

  if (isLoading) return <p className="text-xs text-muted-foreground">Loading scans…</p>
  if (punches.length === 0) {
    return <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">No scans this day</p>
  }

  // API returns newest-first; show chronologically (arrival first).
  const chronological = [...punches].reverse()
  return (
    <div className="grid gap-1">
      <p className="text-xs font-black uppercase tracking-widest text-neutral-400">Scans</p>
      <div className="flex flex-wrap gap-1.5">
        {chronological.map((punch) => (
          <span
            key={punch._id}
            className="rounded-lg bg-secondary/60 px-2 py-1 text-xs font-bold text-foreground"
          >
            {new Date(punch.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        ))}
      </div>
    </div>
  )
}

// Backend normalizes attendance dates to UTC midnight and compares "today"
// in UTC too, so the calendar grid and today/future checks stay in UTC —
// otherwise a browser west of UTC could see "today" shift by a day.
function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export function AttendanceCalendar({ employeeId }: { employeeId: string }) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date()
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  })
  const [openDay, setOpenDay] = useState<string | null>(null)
  const [pendingStatus, setPendingStatus] = useState<string>(NO_STATUS)
  const [pendingOvertimeHours, setPendingOvertimeHours] = useState('')

  const month = monthDate.getUTCMonth() + 1
  const year = monthDate.getUTCFullYear()
  const { data, isLoading } = useAttendance(employeeId, month, year)
  const { data: holidaysData } = useHolidays(month, year)
  const markAttendance = useMarkAttendance(employeeId)
  const createHoliday = useCreateHoliday()
  const deleteHoliday = useDeleteHoliday()

  const recordByDate = new Map((data?.records ?? []).map((r) => [r.date.slice(0, 10), r]))
  const holidayByDate = new Map((holidaysData?.holidays ?? []).map((h) => [h.date.slice(0, 10), h]))
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const today = todayKey()

  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`),
  ]

  const onSave = (dateKey: string) => {
    const overtimeHours = pendingOvertimeHours.trim() ? Number(pendingOvertimeHours) : undefined
    const status = pendingStatus === NO_STATUS ? undefined : (pendingStatus as AttendanceStatus)
    if (status === undefined && overtimeHours === undefined) {
      toast.error('Set a status or overtime hours (or both)')
      return
    }
    markAttendance.mutate(
      { date: dateKey, status, overtimeHours },
      {
        onSuccess: () => {
          toast.success('Attendance saved')
          setOpenDay(null)
        },
        onError: () => toast.error('Could not save attendance'),
      }
    )
  }

  const onToggleHoliday = (dateKey: string) => {
    const existing = holidayByDate.get(dateKey)
    if (existing) {
      deleteHoliday.mutate(existing._id, {
        onSuccess: () => toast.success('Holiday removed'),
        onError: () => toast.error('Could not remove holiday'),
      })
    } else {
      const label = window.prompt('Label for this holiday?', 'Holiday')
      if (label === null) return
      createHoliday.mutate(
        { date: dateKey, label: label || 'Holiday' },
        {
          onSuccess: () => toast.success('Holiday marked'),
          onError: () => toast.error('Could not mark holiday'),
        }
      )
    }
  }

  return (
    <div className="bg-card/90 backdrop-blur-md rounded-2xl shadow-diffuse border-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/15 p-6 bg-card">
        <h3 className="text-lg font-bold uppercase tracking-widest text-foreground">Calendar</h3>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            onClick={() =>
              setMonthDate((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)))
            }
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-36 text-center text-sm font-bold uppercase tracking-widest text-foreground">
            {monthDate.toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            onClick={() =>
              setMonthDate((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)))
            }
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
      <div className="p-6">
        {isLoading ? (
          <Skeleton className="h-64 w-full bg-neutral-800" />
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-black uppercase tracking-widest text-neutral-400">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="mt-1.5 grid grid-cols-7 gap-1.5">
              {cells.map((dateKey, i) => {
                if (!dateKey) return <div key={`blank-${i}`} />
                const record = recordByDate.get(dateKey)
                const holiday = holidayByDate.get(dateKey)
                const isFuture = dateKey > today
                const dayNum = Number(dateKey.slice(8, 10))
                const isSunday = new Date(dateKey).getUTCDay() === 0
                const isOffDay = isSunday || Boolean(holiday)
                const config = record?.status ? STATUS_CONFIG[record.status] : null

                return (
                  <Popover
                    key={dateKey}
                    open={openDay === dateKey}
                    onOpenChange={(open) => {
                      if (isFuture) return
                      setOpenDay(open ? dateKey : null)
                      setPendingStatus(record?.status ?? NO_STATUS)
                      setPendingOvertimeHours(record?.overtimeHours ? String(record.overtimeHours) : '')
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        disabled={isFuture}
                        className={cn(
                          'relative flex aspect-square flex-col items-center justify-center border text-sm font-bold transition-all duration-200 rounded-xl',
                          isFuture
                            ? 'cursor-not-allowed border-secondary bg-secondary/20 text-muted-foreground'
                            : 'border-border/30 bg-secondary/50 text-foreground hover:border-primary/50 hover:bg-secondary/85 hover:-translate-y-0.5',
                          !config && isOffDay && 'border-secondary/50 bg-secondary/35 text-muted-foreground/60',
                          config && config.cell,
                          dateKey === today && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                        )}
                      >
                        <span>{dayNum}</span>
                        {record?.overtimeHours ? (
                          <span className="text-[9px] font-black text-neutral-400">+{record.overtimeHours}h</span>
                        ) : null}
                        {record?.isBackdated && (
                          <Clock3 className="absolute top-1 right-1 size-3 text-neutral-400" />
                        )}
                        {holiday && (
                          <CalendarOff className="absolute top-1 left-1 size-3 text-neutral-400" />
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 rounded-2xl border-0 bg-card p-4 shadow-xl text-foreground">
                      <div className="grid gap-3">
                        <p className="text-sm font-bold uppercase tracking-widest text-foreground">
                          {new Date(dateKey).toLocaleDateString('en-US', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            timeZone: 'UTC',
                          })}
                        </p>
                        {isSunday && (
                          <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">Sunday — off</p>
                        )}
                        {holiday && (
                          <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">
                            Holiday: {holiday.label}
                          </p>
                        )}
                        <DayScans employeeId={employeeId} date={dateKey} />
                        {record?.isAutoMarked && (
                          <p className="text-xs font-bold uppercase tracking-widest text-primary">
                            Auto-marked from biometric scans
                          </p>
                        )}
                        <Select value={pendingStatus} onValueChange={setPendingStatus}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_STATUS}>— No status —</SelectItem>
                            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                              <SelectItem key={key} value={key}>
                                {cfg.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="grid gap-1.5">
                          <Label htmlFor={`ot-${dateKey}`} className="text-xs font-black uppercase tracking-widest text-neutral-400">
                            Overtime Hours
                          </Label>
                          <Input
                            id={`ot-${dateKey}`}
                            type="number"
                            min="0"
                            step="0.5"
                            value={pendingOvertimeHours}
                            onChange={(e) => setPendingOvertimeHours(e.target.value)}
                            className="rounded-xl"
                          />
                        </div>
                        <Button
                          size="sm"
                          className="bg-emerald-600 text-white hover:bg-emerald-500 rounded-xl"
                          onClick={() => onSave(dateKey)}
                          disabled={markAttendance.isPending}
                        >
                          Save
                        </Button>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => onToggleHoliday(dateKey)}
                            disabled={createHoliday.isPending || deleteHoliday.isPending}
                          >
                            <CalendarOff className="size-4" />
                            {holiday ? 'Remove Holiday' : 'Mark as Holiday'}
                          </Button>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )
              })}
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t-2 border-neutral-900 pt-4">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-400">
                  <span className={cn('size-2.5', cfg.dot)} />
                  {cfg.label}
                </div>
              ))}
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-400">
                <Clock3 className="size-3" />
                Backdated
              </div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-400">
                <CalendarOff className="size-3" />
                Sunday / Holiday
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
