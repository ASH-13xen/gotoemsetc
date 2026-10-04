import { can } from '@/lib/access'
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
import {
  HALF_DAY_PERIOD_LABEL,
  SHORT_LEAVE_SECOND_HALF_LABEL,
  leaveApplicationLabel,
} from '@/api/attendanceRequests.api'
import { MonthlyLeaveCountsNote } from '@/components/attendance/MonthlyLeaveCountsNote'
import { useAuth } from '@/hooks/useAuth'

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
  // Pre-filled with what the employee actually applied for (when there is
  // one) so clicking Approve without touching the dropdown still marks
  // attendance correctly — leaving this at "no change" was a silent way for
  // an approved leave application to never reach AttendanceRecord, and
  // therefore never show up on the company calendar's "who's out" layer.
  // "Multiple Days" applications carry no requestedStatus by design (see
  // AttendanceModificationRequest.js), so those still start unset and HR
  // must choose explicitly.
  const [status, setStatus] = useState<string>(request.requestedStatus ?? NO_STATUS)
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
  const awaitingCeo = request.status === 'pending' && request.approvalStage === 'ceo'
  // Unpaid Leave goes CM -> HR -> CEO: HR's approval only forwards it (with
  // HR's chosen statuses) and the CEO's applies it. The CEO or admin
  // approving at the HR stage finalizes it directly — see
  // attendanceRequest.service.js#resolveRequest.
  const { user } = useAuth()
  const isFinalApprover = can(user, 'attendance_final_approval')
  const forwardsToCeo = Boolean(request.requestedMultiDayLeave) && !isFinalApprover
  const appliedLabel = leaveApplicationLabel(request)
  const pendingUpdate = request.pendingAttendanceUpdate

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
        onSuccess: () =>
          toast.success(forwardsToCeo ? 'Approved — sent to the CEO for final approval' : 'Application approved'),
        onError: (err) =>
          toast.error(
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not approve application'
          ),
      }
    )
  }

  const onCeoApprove = () => {
    resolve.mutate(
      { id: request._id },
      {
        onSuccess: () => toast.success('Unpaid leave approved'),
        onError: (err) =>
          toast.error(
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not approve application'
          ),
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
          {appliedLabel && <Badge variant="outline">Applied: {appliedLabel}</Badge>}
          {request.requestedHalfDayPeriod && (
            <Badge variant="outline">{HALF_DAY_PERIOD_LABEL[request.requestedHalfDayPeriod]}</Badge>
          )}
          {awaitingContentManager && <Badge variant="warning">Awaiting Content Manager</Badge>}
          {awaitingCeo && <Badge variant="warning">Awaiting CEO</Badge>}
          <Badge variant={REQUEST_STATUS_BADGE_VARIANT[request.status]}>{request.status}</Badge>
        </div>
      </div>
      <p className="text-sm text-foreground/80">{request.reason}</p>
      {request.monthlyCounts && <MonthlyLeaveCountsNote counts={request.monthlyCounts} />}
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

      {/* Unpaid Leave HR has already approved — HR's choice is shown, and
          only the CEO (or admin) can give the final approval. */}
      {awaitingCeo && (
        <div className="grid gap-2 rounded-lg bg-secondary/40 p-3 text-xs">
          <p className="text-muted-foreground">
            Approved by HR. On final approval this will be applied to every day from {formatDate(request.date)} to{' '}
            {formatDate(request.endDate)}:{' '}
            <span className="font-medium text-foreground">
              {pendingUpdate?.status ? STATUS_CONFIG[pendingUpdate.status].label : 'no status change'}
              {pendingUpdate?.isLate ? ', Late' : ''}
              {pendingUpdate?.earlyDeparture ? `, ${SHORT_LEAVE_SECOND_HALF_LABEL}` : ''}
              {pendingUpdate?.overtimeMinutes ? `, ${pendingUpdate.overtimeMinutes} OT min` : ''}
            </span>
          </p>
          {isFinalApprover ? (
            !rejecting && (
              <div className="flex gap-2">
                <Button size="sm" onClick={onCeoApprove} disabled={resolve.isPending}>
                  <CheckCircle2 className="size-4" />
                  Final approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRejecting(true)}>
                  <XCircle className="size-4" />
                  Reject
                </Button>
              </div>
            )
          ) : (
            <p className="text-muted-foreground">Waiting for the CEO's final approval.</p>
          )}
        </div>
      )}

      {request.status === 'pending' && request.approvalStage === 'hr' && request.endDate && request.endDate.slice(0, 10) !== request.date.slice(0, 10) && (
        <p className="text-xs text-amber-600">
          Multi-day span — approving applies the chosen status to every day from {formatDate(request.date)} to{' '}
          {formatDate(request.endDate)}.
          {request.requestedMultiDayLeave &&
            ' This application carries no default status — leaving Status at "No change" will approve it without marking any attendance.'}
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
              {SHORT_LEAVE_SECOND_HALF_LABEL}
            </label>
          </div>
          <Button size="sm" onClick={onApprove} disabled={resolve.isPending}>
            <CheckCircle2 className="size-4" />
            {forwardsToCeo ? 'Approve & send to CEO' : 'Approve'}
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

const STATUS_FILTERS: { key: AttendanceModificationRequest['status'] | 'all'; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'resolved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'revoked', label: 'Revoked' },
  { key: 'all', label: 'All' },
]

export default function LeaveApplicationsPage() {
  // Defaults to Pending — the queue HR actually needs to act on — rather
  // than dumping every request ever filed (approved/rejected/revoked included)
  // into one endless list.
  const [filter, setFilter] = useState<AttendanceModificationRequest['status'] | 'all'>('pending')
  const { data, isLoading } = useAttendanceRequests(filter === 'all' ? undefined : filter)
  const requests = data?.requests ?? []

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 py-8">
      <PageHeader
        eyebrow="HRMS"
        title="Leave/Modification Requests"
        description="Structured leave applications and free-text attendance correction requests — approve, reject, or revoke."
      />

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.key}
            type="button"
            size="sm"
            variant={filter === f.key ? 'default' : 'outline'}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <Card className="p-6">
        <CardContent className="p-0">
          {isLoading ? (
            <Skeleton className="h-16 w-full bg-secondary/40 rounded-xl" />
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Inbox className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No requests here.</p>
            </div>
          ) : (
            <div className="grid max-h-168 gap-2 overflow-y-auto pr-1">
              {requests.map((request) => (
                <RequestRow key={request._id} request={request} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
