import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Inbox, RotateCcw, XCircle } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  useAttendanceRequests,
  useResolveAttendanceRequest,
  useRejectAttendanceRequest,
  useRevokeAttendanceRequest,
} from '@/hooks/useAttendanceRequests'
import { STATUS_CONFIG } from '@/components/attendance/statusConfig'
import type { AttendanceStatus } from '@/api/attendance.api'
import type { AttendanceModificationRequest } from '@/api/attendanceRequests.api'
import { LEAVE_APPLICATION_STATUS_LABEL } from '@/api/attendanceRequests.api'

const NO_STATUS = '__none__'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function formatDateRange(request: AttendanceModificationRequest) {
  if (!request.endDate || request.endDate.slice(0, 10) === request.date.slice(0, 10)) {
    return formatDate(request.date)
  }
  return `${formatDate(request.date)} – ${formatDate(request.endDate)}`
}

const REQUEST_STATUS_BADGE_VARIANT: Record<
  AttendanceModificationRequest['status'],
  'warning' | 'success' | 'destructive'
> = {
  pending: 'warning',
  resolved: 'success',
  rejected: 'destructive',
  revoked: 'destructive',
}

function RequestRow({ request }: { request: AttendanceModificationRequest }) {
  const [status, setStatus] = useState<string>(NO_STATUS)
  const [overtimeMinutes, setOvertimeMinutes] = useState('')
  const [isLate, setIsLate] = useState(false)
  const [earlyDeparture, setEarlyDeparture] = useState(request.requestedEarlyDeparture ?? false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const resolve = useResolveAttendanceRequest()
  const reject = useRejectAttendanceRequest()
  const revoke = useRevokeAttendanceRequest()

  const employeeName =
    typeof request.employee === 'string'
      ? request.employee
      : `${request.employee.firstName} ${request.employee.lastName ?? ''}`.trim()
  const awaitingContentManager = request.status === 'pending' && request.approvalStage === 'content_manager'

  const onApprove = () => {
    resolve.mutate(
      {
        id: request._id,
        status: status === NO_STATUS ? undefined : (status as AttendanceStatus),
        overtimeMinutes: overtimeMinutes.trim() ? Number(overtimeMinutes) : undefined,
        isLate,
        earlyDeparture,
      },
      {
        onSuccess: () => toast.success('Application approved'),
        onError: () => toast.error('Could not approve application'),
      }
    )
  }

  const onReject = () => {
    reject.mutate(
      { id: request._id, reason: rejectReason.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Application rejected')
          setRejecting(false)
        },
        onError: () => toast.error('Could not reject application'),
      }
    )
  }

  const onRevoke = () => {
    revoke.mutate(request._id, {
      onSuccess: () => toast.success('Approval revoked — attendance restored'),
      onError: () => toast.error('Could not revoke this approval'),
    })
  }

  return (
    <div className="grid gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-foreground">{employeeName}</p>
          <p className="text-xs text-muted-foreground">{formatDateRange(request)}</p>
        </div>
        <div className="flex items-center gap-2">
          {request.requestedStatus && (
            <Badge variant="outline">Applied: {LEAVE_APPLICATION_STATUS_LABEL[request.requestedStatus]}</Badge>
          )}
          {request.requestedEarlyDeparture && <Badge variant="outline">Applied: Early Departure</Badge>}
          {awaitingContentManager && <Badge variant="warning">Awaiting Content Manager</Badge>}
          <Badge variant={REQUEST_STATUS_BADGE_VARIANT[request.status]}>{request.status}</Badge>
        </div>
      </div>
      <p className="text-sm text-foreground/80">{request.reason}</p>
      {request.status === 'rejected' && request.rejectionReason && (
        <p className="text-xs text-muted-foreground">Reason: {request.rejectionReason}</p>
      )}
      {request.status === 'revoked' && (
        <p className="text-xs text-muted-foreground">This approval was later revoked and attendance was restored.</p>
      )}

      {/* Still with the Content Manager — read-only here; HR can only
          reject at this stage, never approve/override the attendance
          record directly (see requireCmOrHrApprovalAccess on the backend). */}
      {awaitingContentManager && !rejecting && (
        <div>
          <Button size="sm" variant="outline" onClick={() => setRejecting(true)}>
            <XCircle className="size-4" />
            Reject
          </Button>
        </div>
      )}

      {request.status === 'pending' && request.approvalStage === 'hr' && request.endDate && request.endDate.slice(0, 10) !== request.date.slice(0, 10) && (
        <p className="text-xs text-amber-600">
          Multi-day span — approving applies the chosen status to every day from {formatDate(request.date)} to{' '}
          {formatDate(request.endDate)}.
        </p>
      )}

      {request.status === 'pending' && request.approvalStage === 'hr' && !rejecting && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Status</label>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value)
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
                    {cfg.label}
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
          </div>
          <div className="grid gap-1 pb-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
              <input
                type="checkbox"
                checked={earlyDeparture}
                onChange={(e) => setEarlyDeparture(e.target.checked)}
                className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
              />
              Early departure
            </label>
          </div>
          <Button size="sm" onClick={onApprove} disabled={resolve.isPending}>
            <CheckCircle2 className="size-4" />
            Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => setRejecting(true)}>
            <XCircle className="size-4" />
            Reject
          </Button>
        </div>
      )}

      {request.status === 'pending' && rejecting && (
        <div className="grid gap-2">
          <Textarea
            placeholder="Reason for rejecting (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={2}
          />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={onReject} disabled={reject.isPending}>
              Confirm reject
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {request.status === 'resolved' && (
        <div>
          <Button size="sm" variant="outline" onClick={onRevoke} disabled={revoke.isPending}>
            <RotateCcw className="size-4" />
            Revoke approval
          </Button>
        </div>
      )}
    </div>
  )
}

export default function LeaveApplicationsPage() {
  const { data, isLoading } = useAttendanceRequests()
  const requests = data?.requests ?? []

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 py-8">
      <PageHeader
        eyebrow="HR Work"
        title="Leave/Modification Requests"
        description="Structured leave applications and free-text attendance correction requests — approve, reject, or revoke."
      />
      <Card className="p-6">
        <CardContent className="grid gap-2 p-0">
          {isLoading ? (
            <Skeleton className="h-16 w-full bg-secondary/40 rounded-xl" />
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Inbox className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No requests yet.</p>
            </div>
          ) : (
            requests.map((request) => <RequestRow key={request._id} request={request} />)
          )}
        </CardContent>
      </Card>
    </div>
  )
}
