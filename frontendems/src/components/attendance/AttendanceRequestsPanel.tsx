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
import type { AttendanceModificationRequest } from '@/api/attendanceRequests.api'

const NO_STATUS = '__none__'

const REQUEST_STATUS_BADGE_VARIANT: Record<AttendanceModificationRequest['status'], 'warning' | 'success' | 'destructive'> = {
  pending: 'warning',
  resolved: 'success',
  rejected: 'destructive',
  revoked: 'destructive',
}

const LEAVE_TYPE_LABEL: Record<'SL' | 'L' | 'H' | 'O', string> = {
  SL: 'Short Leave',
  L: 'Late',
  H: 'Half Day',
  O: 'Leave',
}

function RequestRow({ request }: { request: AttendanceModificationRequest }) {
  const [status, setStatus] = useState<string>(NO_STATUS)
  const [overtimeMinutes, setOvertimeMinutes] = useState('')
  const [isLate, setIsLate] = useState(false)
  const resolve = useResolveAttendanceRequest()

  const employeeName =
    typeof request.employee === 'string'
      ? request.employee
      : `${request.employee.firstName} ${request.employee.lastName ?? ''}`.trim()

  const onResolve = () => {
    resolve.mutate(
      {
        id: request._id,
        status: status === NO_STATUS ? undefined : (status as AttendanceStatus),
        overtimeMinutes: overtimeMinutes.trim() ? Number(overtimeMinutes) : undefined,
        isLate,
      },
      {
        onSuccess: () => toast.success('Request resolved'),
        onError: () => toast.error('Could not resolve request'),
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
      {request.requestedStatus && (
        <p className="text-xs font-semibold text-primary">
          Employee applied for: {LEAVE_TYPE_LABEL[request.requestedStatus]}
        </p>
      )}
      <p className="text-sm text-foreground/80">{request.reason}</p>
      {request.status === 'pending' && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Status</label>
            <Select
              value={status}
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
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
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
      <CardContent className="grid gap-2 px-0 pb-0">
        {isLoading ? (
          <Skeleton className="h-16 w-full bg-secondary/40 rounded-xl" />
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No requests yet.</p>
        ) : (
          requests.map((request) => <RequestRow key={request._id} request={request} />)
        )}
      </CardContent>
    </Card>
  )
}
