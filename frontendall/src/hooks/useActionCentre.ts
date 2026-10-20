import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { listSalaryBatches } from '@/api/salaryApprovals.api'
import { listFnfForApproval, listFnfForHr } from '@/api/fnf.api'
import { listEditRequests } from '@/api/attendanceEditRequests.api'
import { useAuth } from '@/hooks/useAuth'
import { useReimbursementsAwaitingCeo } from '@/hooks/useReimbursements'
import { useOvertimeQueue } from '@/hooks/useOvertimeRequests'
import { useMyPendingCmReviews, usePendingLeaveAll } from '@/hooks/useAttendanceRequests'
import { usePendingBillReminders } from '@/hooks/useMonthlyBills'
import { useActionAcks } from '@/hooks/useActionAcks'
import { isHrPerson } from '@/components/attendance/LeaveStageQueues'
import { ACTION_KEY, POPS_UP } from '@/lib/actionKeys'
import { can } from '@/lib/access'

// Everything waiting on this person, counted for the Action centre button.
// Each count uses the same query (key and fetcher) as the card that shows
// it, so opening the Action centre costs no extra requests. Acknowledged
// items don't count; `acknowledged` is how many of them still wait for a
// decision (the centre's Acknowledged list), and `popKeys` the leave and
// overtime still open — what the pop-up shows.
export function useActionCentreCounts() {
  const { user } = useAuth()
  const payout = can(user, 'payout_approval')
  const hr = can(user, 'hrms')
  const hrPerson = isHrPerson(user)
  const finalApproval = can(user, 'attendance_final_approval')
  const { acked, loaded } = useActionAcks()

  const people = useQuery({
    queryKey: ['people-alerts'],
    queryFn: async () => (await apiClient.get<{ notifications: unknown[] }>('/notifications/alerts')).data.notifications,
    refetchInterval: 60_000,
    enabled: Boolean(user),
  })
  const salary = useQuery({ queryKey: ['salary-batches'], queryFn: listSalaryBatches, enabled: payout, refetchInterval: 60_000 })
  const fnfHr = useQuery({ queryKey: ['fnf-settlements', 'hr'], queryFn: listFnfForHr, enabled: hr, refetchInterval: 60_000 })
  const fnfApproval = useQuery({ queryKey: ['fnf-settlements', 'approvals'], queryFn: listFnfForApproval, enabled: payout, refetchInterval: 60_000 })
  const edits = useQuery({
    queryKey: ['attendance-edit-requests', 'pending'],
    queryFn: () => listEditRequests('pending'),
    enabled: finalApproval,
    refetchInterval: 60_000,
  })
  const leaveAll = usePendingLeaveAll(finalApproval || hrPerson)
  const reimbursements = useReimbursementsAwaitingCeo(payout)
  const overtime = useOvertimeQueue(Boolean(user))
  const cmReviews = useMyPendingCmReviews()
  const bills = usePendingBillReminders()

  // Every decision-type item as its key, by section.
  const s = salary.data
  const keys = {
    salary: [
      ...(s?.pending ?? []).map((b) => ACTION_KEY.salaryBatch(b._id)),
      ...(s?.held ?? []).map((h) => ACTION_KEY.heldSlip(h._id)),
    ],
    fnf: [
      ...(hr ? (fnfHr.data ?? []).map((f) => ACTION_KEY.fnfHr(f._id)) : []),
      ...(payout ? (fnfApproval.data ?? []).map((f) => ACTION_KEY.fnfApproval(f._id)) : []),
    ],
    reimbursements: payout ? (reimbursements.data ?? []).map((r) => ACTION_KEY.reimbursement(r._id)) : [],
    attendanceEdits: finalApproval ? (edits.data ?? []).map((r) => ACTION_KEY.attendanceEdit(r._id)) : [],
    ceoLeave: finalApproval ? (leaveAll.data ?? []).filter((r) => r.approvalStage === 'ceo').map((r) => ACTION_KEY.leaveCeo(r._id)) : [],
    hrLeave: hrPerson ? (leaveAll.data ?? []).filter((r) => r.approvalStage === 'hr').map((r) => ACTION_KEY.leaveHr(r._id)) : [],
    overtime: [
      ...(overtime.data?.contentManager ?? []).map((r) => ACTION_KEY.overtimeCm(r._id)),
      ...(overtime.data?.hr ?? []).map((r) => ACTION_KEY.overtimeHr(r._id)),
    ],
    leaveReviews: (cmReviews.data?.requests ?? []).map((r) => ACTION_KEY.leaveCm(r._id)),
  }
  const open = (list: string[]) => list.filter((k) => !acked.has(k)).length
  const mailFailures = (s?.recent ?? []).filter(
    (b) => (b.emailResults.some((r) => r.status !== 'sent') || b.masterSheetEmail?.status === 'failed') && !acked.has(ACTION_KEY.salaryMail(b._id))
  ).length

  const counts = {
    people: people.data?.length ?? 0,
    salary: open(keys.salary) + mailFailures,
    fnf: open(keys.fnf),
    reimbursements: open(keys.reimbursements),
    attendanceEdits: open(keys.attendanceEdits),
    ceoLeave: open(keys.ceoLeave),
    hrLeave: open(keys.hrLeave),
    overtime: open(keys.overtime),
    leaveReviews: open(keys.leaveReviews),
    bills: bills.data?.reminders.length ?? 0,
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const all = Object.values(keys).flat()
  const acknowledged = all.filter((k) => acked.has(k)).length
  // Until the acknowledgements have loaded nothing pops up — else it would
  // flash things the person already put away.
  const popKeys = loaded ? all.filter((k) => POPS_UP.test(k) && !acked.has(k)) : []
  // Shown to the people who decide things (and to anyone with something
  // waiting, e.g. a content manager) — nobody else sees the button.
  const relevant = total > 0 || acknowledged > 0 || payout || hr || finalApproval || can(user, 'finance')
  return { counts, total, acknowledged, popKeys, relevant }
}
