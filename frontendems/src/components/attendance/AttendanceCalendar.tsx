import { useState } from 'react'
import { toast } from 'sonner'
import { CalendarOff, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { hasPermission, isAdminLike } from '@/lib/permissions'
import { useDevicePunches } from '@/hooks/useDevicePunches'
import { STATUS_CONFIG } from './statusConfig'
import type { AttendanceStatus } from '@/api/attendance.api'
import type { HolidayType } from '@/api/holidays.api'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
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
    return <p className="text-xs text-muted-foreground">No scans this day</p>
  }

  // API returns newest-first; show chronologically (arrival first).
  const chronological = [...punches].reverse()
  return (
    <div className="grid gap-1">
      <p className="text-xs text-muted-foreground">Scans</p>
      <div className="flex flex-wrap gap-1.5">
        {chronological.map((punch) => (
          <span key={punch._id} className="rounded-md bg-secondary/60 px-2 py-1 text-xs font-medium text-foreground">
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
  const isAdmin = isAdminLike(user)
  const canMark = hasPermission(user, 'mark_attendance')
  // HR must justify every manual edit with a reason; admin doesn't need to
  // (see attendance.service.js#assertReasonProvidedForHr).
  const reasonRequired = user?.role === 'hr'

  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date()
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  })
  const [openDay, setOpenDay] = useState<string | null>(null)
  const [pendingStatus, setPendingStatus] = useState<string>(NO_STATUS)
  const [pendingOvertimeMinutes, setPendingOvertimeMinutes] = useState('')
  const [pendingIsLate, setPendingIsLate] = useState(false)
  const [pendingEarlyDeparture, setPendingEarlyDeparture] = useState(false)
  const [pendingNotes, setPendingNotes] = useState('')

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
    const overtimeMinutes = pendingOvertimeMinutes.trim() ? Number(pendingOvertimeMinutes) : undefined
    const status = pendingStatus === NO_STATUS ? undefined : (pendingStatus as AttendanceStatus)
    if (status === undefined && overtimeMinutes === undefined && !pendingIsLate && !pendingEarlyDeparture) {
      toast.error('Set a status, overtime minutes, late flag, or early-departure flag (or a combination)')
      return
    }
    if (reasonRequired && !pendingNotes.trim()) {
      toast.error('Reason is required when HR marks or changes attendance')
      return
    }
    markAttendance.mutate(
      {
        date: dateKey,
        status,
        overtimeMinutes,
        isLate: pendingIsLate,
        earlyDeparture: pendingEarlyDeparture,
        notes: pendingNotes.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Attendance saved')
          setOpenDay(null)
        },
        onError: () => toast.error('Could not save attendance'),
      }
    )
  }

  const onMarkOffDay = (dateKey: string, type: HolidayType) => {
    const typeLabel = type === 'half_day' ? 'half day' : 'holiday'
    const label = window.prompt(`Label for this ${typeLabel}?`, type === 'half_day' ? 'Half Day' : 'Holiday')
    if (label === null) return
    createHoliday.mutate(
      { date: dateKey, label: label || (type === 'half_day' ? 'Half Day' : 'Holiday'), type },
      {
        onSuccess: () =>
          toast.success(type === 'half_day' ? 'Half day marked — employees who scan in get full-day credit' : 'Holiday marked'),
        onError: () => toast.error(`Could not mark ${typeLabel}`),
      }
    )
  }

  const onRemoveOffDay = (dateKey: string) => {
    const existing = holidayByDate.get(dateKey)
    if (!existing) return
    deleteHoliday.mutate(existing._id, {
      onSuccess: () => toast.success(existing.type === 'half_day' ? 'Half day removed' : 'Holiday removed'),
      onError: () => toast.error('Could not remove'),
    })
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between border-b border-border p-5">
        <h3 className="text-base font-semibold text-foreground">Calendar</h3>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() =>
              setMonthDate((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)))
            }
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-32 text-center text-sm font-medium text-foreground">
            {monthDate.toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() =>
              setMonthDate((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)))
            }
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
      <div className="p-5">
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <>
            <div className="grid grid-cols-7 gap-2 border-b border-border pb-2 text-center text-xs font-semibold text-muted-foreground">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-2">
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
                      setPendingOvertimeMinutes(record?.overtimeMinutes ? String(record.overtimeMinutes) : '')
                      setPendingIsLate(record?.isLate ?? false)
                      setPendingEarlyDeparture(record?.earlyDeparture ?? false)
                      setPendingNotes(record?.notes ?? '')
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        disabled={isFuture}
                        className={cn(
                          'relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl border text-sm font-semibold transition-colors duration-150',
                          isFuture
                            ? 'cursor-not-allowed border-border/40 bg-secondary/10 text-muted-foreground/40'
                            : 'border-border bg-card text-foreground hover:bg-secondary/60',
                          !config && isOffDay && 'border-border bg-secondary/30 text-muted-foreground/60',
                          config && cn(config.box, 'hover:brightness-95'),
                          dateKey === today && 'ring-2 ring-inset ring-primary'
                        )}
                      >
                        <span className="text-base">{dayNum}</span>
                        {config && <span className="text-[9px] font-bold tracking-wide uppercase opacity-80">{config.code}</span>}
                        {record?.overtimeMinutes ? (
                          <span className="text-[9px] font-medium opacity-70">+{record.overtimeMinutes}min</span>
                        ) : null}
                        {record?.isLate && (
                          <span className="absolute bottom-1 right-1 flex size-3.5 items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold text-white">L</span>
                        )}
                        {record?.earlyDeparture && (
                          <span className="absolute bottom-1 left-1 flex size-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">E</span>
                        )}
                        {record && !record.isSettled && (
                          <span className="absolute top-1 left-1 size-1.5 rounded-full bg-yellow-500" title="Pending" />
                        )}
                        {record?.isBackdated && (
                          <Clock3 className="absolute top-1 right-1 size-3 opacity-70" />
                        )}
                        {holiday && <CalendarOff className="absolute top-1 left-1 size-3 opacity-70" />}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-4">
                      <div className="grid gap-3">
                        <p className="text-sm font-semibold text-foreground">
                          {new Date(dateKey).toLocaleDateString('en-US', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            timeZone: 'UTC',
                          })}
                        </p>
                        {isSunday && <p className="text-xs text-muted-foreground">Sunday — off</p>}
                        {holiday && (
                          <p className="text-xs text-muted-foreground">
                            {holiday.type === 'half_day' ? 'Half Day' : 'Holiday'}: {holiday.label}
                          </p>
                        )}
                        <DayScans employeeId={employeeId} date={dateKey} />
                        {record?.isAutoMarked && (
                          <p className="text-xs text-primary">Auto-marked from biometric scans</p>
                        )}
                        {record?.modifiedByRequest && <p className="text-xs text-amber-600">Modified by HR</p>}
                        {record && !record.isSettled && (
                          <p className="text-xs text-yellow-600">Pending — may still change today</p>
                        )}
                        {!canMark && (
                          <div className="grid gap-1 text-xs text-muted-foreground">
                            <p>
                              Status:{' '}
                              {record?.status
                                ? `${STATUS_CONFIG[record.status].code} — ${STATUS_CONFIG[record.status].label}`
                                : '— none —'}
                            </p>
                            {record?.isLate && <p className="text-amber-600">Late arrival</p>}
                            {record?.earlyDeparture && <p className="text-red-600">Left early</p>}
                            {record?.overtimeMinutes ? <p>Overtime: {record.overtimeMinutes}min</p> : null}
                          </div>
                        )}
                        {canMark && record?.notes && (
                          <div className="grid gap-1 rounded-lg bg-secondary/40 p-2.5">
                            <p className="text-[10px] text-muted-foreground">Reason on file</p>
                            <p className="text-xs font-medium text-foreground">{record.notes}</p>
                          </div>
                        )}
                        {canMark && (
                          <>
                            <Select
                              value={pendingStatus}
                              onValueChange={(value) => {
                                setPendingStatus(value)
                                // The L status already means "arrived late" —
                                // leaving the checkbox on too would double-count
                                // this one day in the Late→Short-Leave payroll
                                // pool (see attendancePenalties.js).
                                if (value === 'L') setPendingIsLate(false)
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NO_STATUS}>— No status —</SelectItem>
                                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                                  <SelectItem key={key} value={key}>
                                    {cfg.code} — {cfg.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="grid gap-1.5">
                              <Label htmlFor={`ot-${dateKey}`} className="text-xs text-muted-foreground">
                                Overtime minutes
                              </Label>
                              <Input
                                id={`ot-${dateKey}`}
                                type="number"
                                min="0"
                                step="1"
                                value={pendingOvertimeMinutes}
                                disabled={pendingEarlyDeparture}
                                onChange={(e) => {
                                  setPendingOvertimeMinutes(e.target.value)
                                  // Overtime and an early departure are opposite
                                  // ends of the same departure scan — can't both
                                  // be true for the same day.
                                  if (Number(e.target.value) > 0) setPendingEarlyDeparture(false)
                                }}
                                className="disabled:opacity-50"
                              />
                              {pendingEarlyDeparture && (
                                <p className="text-[10px] text-muted-foreground">Can't combine with Early departure</p>
                              )}
                            </div>
                            <label
                              htmlFor={`late-${dateKey}`}
                              className={cn(
                                'flex select-none items-center gap-2 text-xs text-muted-foreground',
                                pendingStatus === 'L' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                              )}
                            >
                              <input
                                id={`late-${dateKey}`}
                                type="checkbox"
                                checked={pendingIsLate}
                                disabled={pendingStatus === 'L'}
                                onChange={(e) => setPendingIsLate(e.target.checked)}
                                className="size-4 cursor-pointer rounded border-border text-primary accent-primary focus:ring-primary disabled:cursor-not-allowed"
                              />
                              Late arrival
                            </label>
                            {pendingStatus === 'L' && (
                              <p className="-mt-2 text-[10px] text-muted-foreground">Already covered by the L status</p>
                            )}
                            <label
                              htmlFor={`early-${dateKey}`}
                              className={cn(
                                'flex select-none items-center gap-2 text-xs text-muted-foreground',
                                Number(pendingOvertimeMinutes) > 0 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                              )}
                            >
                              <input
                                id={`early-${dateKey}`}
                                type="checkbox"
                                checked={pendingEarlyDeparture}
                                disabled={Number(pendingOvertimeMinutes) > 0}
                                onChange={(e) => {
                                  setPendingEarlyDeparture(e.target.checked)
                                  if (e.target.checked) setPendingOvertimeMinutes('')
                                }}
                                className="size-4 cursor-pointer rounded border-border text-primary accent-primary focus:ring-primary disabled:cursor-not-allowed"
                              />
                              Early departure
                            </label>
                            {Number(pendingOvertimeMinutes) > 0 && (
                              <p className="-mt-2 text-[10px] text-muted-foreground">Can't combine with Overtime Minutes</p>
                            )}
                            <div className="grid gap-1.5">
                              <Label htmlFor={`notes-${dateKey}`} className="text-xs text-muted-foreground">
                                Reason{reasonRequired ? ' (required)' : ' (optional)'}
                              </Label>
                              <Textarea
                                id={`notes-${dateKey}`}
                                value={pendingNotes}
                                onChange={(e) => setPendingNotes(e.target.value)}
                                placeholder={reasonRequired ? 'Why are you marking/changing this day?' : 'Optional note'}
                                className="min-h-16"
                              />
                            </div>
                            <Button size="sm" onClick={() => onSave(dateKey)} disabled={markAttendance.isPending}>
                              Save
                            </Button>
                          </>
                        )}
                        {isAdmin && holiday && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onRemoveOffDay(dateKey)}
                            disabled={deleteHoliday.isPending}
                          >
                            <CalendarOff className="size-4" />
                            Remove {holiday.type === 'half_day' ? 'half day' : 'holiday'}
                          </Button>
                        )}
                        {isAdmin && !holiday && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onMarkOffDay(dateKey, 'holiday')}
                              disabled={createHoliday.isPending}
                            >
                              <CalendarOff className="size-4" />
                              Mark as holiday
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onMarkOffDay(dateKey, 'half_day')}
                              disabled={createHoliday.isPending}
                            >
                              <CalendarOff className="size-4" />
                              Mark as half day
                            </Button>
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )
              })}
            </div>
            <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <div
                  key={key}
                  className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium', cfg.box)}
                >
                  <span className={cn('size-1.5 shrink-0 rounded-full', cfg.dot)} />
                  {cfg.code} — {cfg.label}
                </div>
              ))}
              <div className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <Clock3 className="size-3" />
                Backdated
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
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
