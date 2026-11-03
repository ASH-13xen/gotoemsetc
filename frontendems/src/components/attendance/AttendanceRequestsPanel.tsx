import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Inbox } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useAttendanceRequests, useResolveAttendanceRequest } from '@/hooks/useAttendanceRequests'
import { STATUS_CONFIG } from './statusConfig'
import type { AttendanceStatus } from '@/api/attendance.api'
import type { AttendanceModificationRequest, RequestedStatus } from '@/api/attendanceRequests.api'

const NO_STATUS = '__none__'

const REQUEST_STATUS_BADGE_VARIANT: Record<AttendanceModificationRequest['status'], 'warning' | 'success' | 'destructive'> = {
  pending: 'warning',
  resolved: 'success',
  rejected: 'destructive',
  revoked: 'destructive',
}

const LEAVE_TYPE_LABEL: Record<RequestedStatus, string> = {
  SL: 'Short Leave',
  L: 'Late',
  H: 'Half Day',
  O: 'Paid Leave',
  W: 'Work From Home',
  P: 'Present (correction)',
}

const HALF_DAY_PERIOD_LABEL: Record<'first_half' | 'second_half', string> = {
  first_half: 'First Half (9:30 AM – 2:00 PM)',
  second_half: 'Second Half (2:00 PM – 6:30 PM)',
}

function RequestRow({ request }: { request: AttendanceModificationRequest }) {
  // Pre-filled with what the employee applied for, so Resolve without
  // touching the dropdown still marks attendance — see the matching comment
  // in frontendhr's LeaveApplicationsPage.tsx.
  const [status, setStatus] = useState<string>(request.requestedStatus ?? NO_STATUS)
  // Sundays take no attendance status — only overtime minutes.
  const sundaysOnly = (() => {
    const last = (request.endDate || request.date).slice(0, 10)
    for (let t = Date.parse(`${request.date.slice(0, 10)}T00:00:00Z`); t <= Date.parse(`${last}T00:00:00Z`); t += 86_400_000) {
      if (new Date(t).getUTCDay() !== 0) return false
    }
    return true
  })()
  const [overtimeMinutes, setOvertimeMinutes] = useState('')
  const [isLate, setIsLate] = useState(false)
  const resolve = useResolveAttendanceRequest()

  const employeeName =
    typeof request.employee === 'string'
      ? request.employee
      : `${request.employee.firstName} ${request.employee.lastName ?? ''}`.trim()

  // Approving marks what they applied for — fixed when they applied. Only an
  // old free-text request (no type) still has the controls below.
  const typed = Boolean(request.requestedStatus || request.requestedMultiDayLeave || request.requestedEarlyDeparture)

  const onResolve = () => {
    resolve.mutate(
      typed
        ? { id: request._id }
        : {
            id: request._id,
            status: sundaysOnly || status === NO_STATUS ? undefined : (status as AttendanceStatus),
            overtimeMinutes: overtimeMinutes.trim() ? Number(overtimeMinutes) : undefined,
            isLate,
          },
      {
        onSuccess: () => toast.success('Request resolved'),
        onError: (err) =>
          toast.error(
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not resolve request'
          ),
      }
    )
  }

  return (
    <div className="grid gap-3 rounded-lg border border-border bg-secondary/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-foreground">{employeeName}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(request.date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
          </p>
        </div>
        <Badge variant={REQUEST_STATUS_BADGE_VARIANT[request.status]}>{request.status}</Badge>
      </div>
      {(request.requestedStatus || request.requestedMultiDayLeave || request.requestedEarlyDeparture) && (
        <p className="text-xs font-semibold text-primary">
          Employee applied for:{' '}
          {[
            request.requestedStatus && LEAVE_TYPE_LABEL[request.requestedStatus],
            request.requestedMultiDayLeave && 'Unpaid Leave',
            request.requestedEarlyDeparture && 'Short Leave (2nd half)',
          ]
            .filter(Boolean)
            .join(' + ')}
          {request.requestedHalfDayPeriod && ` — ${HALF_DAY_PERIOD_LABEL[request.requestedHalfDayPeriod]}`}
        </p>
      )}
      <p className="text-sm text-foreground/80">{request.reason}</p>
      {request.status === 'pending' && request.approvalStage === 'ceo' && (
        <p className="text-xs text-amber-600">
          Approved by HR — waiting for the CEO's final approval in HR Work → Leave Applications.
        </p>
      )}
      {request.status === 'pending' && request.approvalStage === 'content_manager' && (
        <p className="text-xs text-muted-foreground">Waiting for their content manager — it can be approved here once they pass it on.</p>
      )}
      {request.status === 'pending' && request.approvalStage === 'hr' && typed && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">
            Approving marks what they applied for{request.requestedMultiDayLeave ? ' — Absent on each working day' : ''}. It can't be changed here.
          </p>
          <Button size="sm" onClick={onResolve} disabled={resolve.isPending}>
            <CheckCircle2 className="size-4" />
            Approve
          </Button>
        </div>
      )}
      {request.status === 'pending' && request.approvalStage === 'hr' && !typed && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">{sundaysOnly ? 'Status — Sundays can only have overtime' : 'Status'}</label>
            <Select
              value={sundaysOnly ? NO_STATUS : status}
              disabled={sundaysOnly}
              onValueChange={(value) => {
                setStatus(value)
                // The L status already means "arrived late" — leaving the
                // checkbox on too would double-count this day in the
                // Late→Short-Leave payroll pool (see attendancePenalties.js).
                if (value === 'L') setIsLate(false)
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_STATUS}>— No change —</SelectItem>
                {Object.entries(STATUS_CONFIG)
                  // An early departure already counts as one short leave —
                  // Short Leave as the day's status would count it twice.
                  .filter(([key]) => !(request.requestedEarlyDeparture && key === 'SL'))
                  .map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      {cfg.code} — {cfg.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">OT minutes</label>
            <Input
              type="number"
              min="0"
              step="1"
              value={overtimeMinutes}
              onChange={(e) => setOvertimeMinutes(e.target.value)}
              className="w-24"
            />
          </div>
          <div className="grid gap-1 pb-2">
            <label
              className={cn(
                'flex items-center gap-2 text-xs text-muted-foreground select-none',
                status === 'L' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
              )}
            >
              <input
                type="checkbox"
                checked={isLate}
                disabled={status === 'L'}
                onChange={(e) => setIsLate(e.target.checked)}
                className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary disabled:cursor-not-allowed"
              />
              Late
            </label>
            {status === 'L' && (
              <p className="text-[10px] text-muted-foreground">Already covered by the L status</p>
            )}
          </div>
          <Button size="sm" onClick={onResolve} disabled={resolve.isPending}>
            <CheckCircle2 className="size-4" />
            Resolve
          </Button>
        </div>
      )}
    </div>
  )
}

export function AttendanceRequestsPanel() {
  const { data, isLoading } = useAttendanceRequests()
  const requests = data?.requests ?? []

  return (
    <Card className="p-6">
      <CardHeader className="px-0 pt-0">
        <div className="flex items-center gap-2">
          <Inbox className="size-4 text-primary" />
          <CardTitle>Attendance modification requests</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {isLoading ? (
          <Skeleton className="h-16 w-full bg-secondary/40 rounded-xl" />
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No requests yet.</p>
        ) : (
          <div className="grid max-h-[36rem] gap-2 overflow-y-auto pr-1">
            {requests.map((request) => (
              <RequestRow key={request._id} request={request} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
