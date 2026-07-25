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

function RequestRow({ request }: { request: AttendanceModificationRequest }) {
  const [status, setStatus] = useState<string>(NO_STATUS)
  const [overtimeHours, setOvertimeHours] = useState('')
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
        overtimeHours: overtimeHours.trim() ? Number(overtimeHours) : undefined,
        isLate,
      },
      {
        onSuccess: () => toast.success('Request resolved'),
        onError: () => toast.error('Could not resolve request'),
      }
    )
  }

  return (
    <div className="grid gap-3 rounded-xl bg-secondary/30 p-4 border border-border/5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-bold text-foreground">{employeeName}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(request.date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
          </p>
        </div>
        <Badge variant={request.status === 'pending' ? 'warning' : 'success'} className="rounded-lg">
          {request.status}
        </Badge>
      </div>
      <p className="text-sm text-foreground/80">{request.reason}</p>
      {request.status === 'pending' && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</label>
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
              <SelectTrigger className="w-40 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_STATUS}>— No change —</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    {cfg.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">OT Hours</label>
            <Input
              type="number"
              min="0"
              step="0.5"
              value={overtimeHours}
              onChange={(e) => setOvertimeHours(e.target.value)}
              className="w-24 rounded-xl"
            />
          </div>
          <div className="grid gap-1 pb-2">
            <label
              className={cn(
                'flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground select-none',
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
              <p className="text-[10px] font-semibold text-muted-foreground">Already covered by the L status</p>
            )}
          </div>
          <Button size="sm" className="rounded-xl" onClick={onResolve} disabled={resolve.isPending}>
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
