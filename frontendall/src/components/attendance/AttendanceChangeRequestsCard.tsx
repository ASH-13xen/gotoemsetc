import { can } from '@/lib/access'
import { useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { toast } from 'sonner'
import { ArrowRight, Check, ClipboardEdit, X } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/useAuth'
import {
  approveEditRequest,
  listEditRequests,
  rejectEditRequest,
  type AttendanceEditRequest,
  type EditRequestChange,
} from '@/api/attendanceEditRequests.api'

// HR can't change attendance more than 2 days old directly — those changes
// land here, for the CEO and admin only. Whichever of them decides first
// settles it; approving applies the change straight away.

const STATUS_LABEL: Record<string, string> = {
  P: 'Present',
  O: 'Paid Off',
  H: 'Half Day',
  L: 'Late',
  SL: 'Short Leave',
  W: 'Work From Home',
  A: 'Absent',
  HL: 'Holiday',
}

function describe(change: EditRequestChange | null, { isPrevious = false } = {}) {
  if (!change) return isPrevious ? 'Nothing marked' : '—'
  const parts: string[] = []
  if (change.status) {
    const label = STATUS_LABEL[change.status] ?? change.status
    parts.push(label)
  } else if (isPrevious) parts.push('No status')
  if (change.overtimeMinutes) parts.push(`${change.overtimeMinutes} min OT`)
  if (change.isLate) parts.push('late')
  if (change.earlyDeparture) parts.push('left early')
  return parts.join(' · ') || '—'
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const apiMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback

function RequestRow({ request }: { request: AttendanceEditRequest }) {
  const queryClient = useQueryClient()
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  // Drop it from the card at once, then re-sync with the server.
  const refresh = () => {
    queryClient.setQueryData<AttendanceEditRequest[]>(['attendance-edit-requests', 'pending'], (old) => old?.filter((r) => r._id !== request._id))
    queryClient.invalidateQueries({ queryKey: ['attendance-edit-requests'] })
  }
  const approve = useMutation({ mutationFn: () => approveEditRequest(request._id, note.trim() || undefined), onSuccess: refresh })
  const reject = useMutation({ mutationFn: () => rejectEditRequest(request._id, note.trim() || undefined), onSuccess: refresh })
  const name = `${request.employee.firstName} ${request.employee.lastName ?? ''}`.trim().toLowerCase()

  return (
    <div className="ecr-row rounded-2xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-foreground capitalize">{name}</p>
          <p className="text-xs font-semibold text-primary">{fmtDate(request.date)}</p>
        </div>
        <p className="text-[11px] text-muted-foreground">
          asked by <span className="font-semibold uppercase">{request.requestedBy?.username}</span> ·{' '}
          {new Date(request.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-lg bg-secondary px-2 py-1 text-muted-foreground line-through decoration-muted-foreground/50">
          {describe(request.previous, { isPrevious: true })}
        </span>
        <ArrowRight className="size-3.5 text-muted-foreground" />
        <span className="rounded-lg bg-emerald-500/12 px-2 py-1 font-semibold text-emerald-700 dark:text-emerald-300">{describe(request.change)}</span>
      </div>
      <p className="mt-2 text-sm text-foreground">“{request.reason}”</p>

      {rejecting ? (
        <div className="mt-3 grid gap-2">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why not? (optional — HR will see it)" rows={2} className="text-sm" />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
              Back
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={reject.isPending}
              onClick={() =>
                reject.mutate(undefined, {
                  onSuccess: () => toast.success('Rejected — HR has been told'),
                  onError: (err) => toast.error(apiMessage(err, 'Could not reject')),
                })
              }
            >
              Reject
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={approve.isPending}
            onClick={() =>
              approve.mutate(undefined, {
                onSuccess: () => toast.success('Approved — the attendance has been changed'),
                onError: (err) => toast.error(apiMessage(err, 'Could not approve')),
              })
            }
          >
            <Check className="size-3.5" /> Approve & apply
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={() => setRejecting(true)}>
            <X className="size-3.5" /> Reject
          </Button>
        </div>
      )}
    </div>
  )
}

export function AttendanceChangeRequestsCard() {
  const { user } = useAuth()
  const canDecide = can(user, 'attendance_final_approval')
  const { data: requests = [] } = useQuery({
    queryKey: ['attendance-edit-requests', 'pending'],
    queryFn: () => listEditRequests('pending'),
    enabled: canDecide,
    refetchInterval: 60_000,
  })
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!ref.current || requests.length === 0) return
    const ctx = gsap.context(() => {
      gsap.fromTo('.ecr-row', { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.06, ease: 'power2.out', clearProps: 'transform,opacity' })
    }, ref)
    return () => ctx.revert()
  }, [requests.length])

  if (!canDecide || requests.length === 0) return null

  return (
    <div ref={ref} className="dashboard-card overflow-hidden rounded-2xl border border-amber-500/40 bg-card">
      <div className="flex items-center gap-3 border-b border-border bg-amber-500/[0.07] px-5 py-3.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow">
          <ClipboardEdit className="size-4" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-black text-foreground">Attendance changes waiting for you</p>
          <p className="text-xs text-muted-foreground">HR asked to change days more than 2 days old. Approving applies the change straight away.</p>
        </div>
        <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-black text-white">{requests.length}</span>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-2">
        {requests.map((r) => (
          <RequestRow key={r._id} request={r} />
        ))}
      </div>
    </div>
  )
}
