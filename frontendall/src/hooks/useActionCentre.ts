import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { listSalaryBatches } from '@/api/salaryApprovals.api'
import { listFnfForApproval, listFnfForHr } from '@/api/fnf.api'
import { listEditRequests } from '@/api/attendanceEditRequests.api'
import { useAuth } from '@/hooks/useAuth'
import { useReimbursementsAwaitingCeo } from '@/hooks/useReimbursements'
import { useOvertimeQueue } from '@/hooks/useOvertimeRequests'
import { useMyPendingCmReviews } from '@/hooks/useAttendanceRequests'
import { usePendingBillReminders } from '@/hooks/useMonthlyBills'
import { can } from '@/lib/access'

// Everything waiting on this person, counted for the Action centre button.
// Each count uses the same query (key and fetcher) as the card that shows
// it, so opening the Action centre costs no extra requests.
export function useActionCentreCounts() {
  const { user } = useAuth()
  const payout = can(user, 'payout_approval')
  const hr = can(user, 'hrms')
  const finalApproval = can(user, 'attendance_final_approval')

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
  const ceoLeave = useQuery({
    queryKey: ['attendance-requests', 'ceo-stage'],
    queryFn: async () =>
      (await apiClient.get<{ requests: { approvalStage: string }[] }>('/attendance-requests', { params: { status: 'pending' } })).data.requests,
    enabled: finalApproval,
    refetchInterval: 60_000,
  })
  const reimbursements = useReimbursementsAwaitingCeo(payout)
  const overtime = useOvertimeQueue(Boolean(user))
  const cmReviews = useMyPendingCmReviews()
  const bills = usePendingBillReminders()

  const s = salary.data
  const salaryCount = s
    ? s.pending.length +
      s.recent.filter((b) => b.emailResults.some((r) => r.status !== 'sent') || b.masterSheetEmail?.status === 'failed').length +
      (s.held ?? []).length
    : 0
  const counts = {
    people: people.data?.length ?? 0,
    salary: salaryCount,
    fnf: (hr ? fnfHr.data?.length ?? 0 : 0) + (payout ? fnfApproval.data?.length ?? 0 : 0),
    reimbursements: payout ? reimbursements.data?.length ?? 0 : 0,
    attendanceEdits: finalApproval ? edits.data?.length ?? 0 : 0,
    ceoLeave: finalApproval ? (ceoLeave.data ?? []).filter((r) => r.approvalStage === 'ceo').length : 0,
    overtime: (overtime.data?.contentManager.length ?? 0) + (overtime.data?.hr.length ?? 0),
    leaveReviews: cmReviews.data?.requests.length ?? 0,
    bills: bills.data?.reminders.length ?? 0,
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  // Shown to the people who decide things (and to anyone with something
  // waiting, e.g. a content manager) — nobody else sees the button.
  const relevant = total > 0 || payout || hr || finalApproval || can(user, 'finance')
  return { counts, total, relevant }
}
