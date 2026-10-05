import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as complaintsApi from '@/api/complaints.api'
import type { ComplaintCategory } from '@/api/complaints.api'

const AWAITING_REVIEW_KEY = ['my-complaints-awaiting-review']
const MY_COMPLAINTS_KEY = ['my-complaints']

export function useFileComplaint() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { category: ComplaintCategory; description: string }) => complaintsApi.fileComplaint(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_COMPLAINTS_KEY }),
  })
}

export function useMyComplaintsAwaitingReview() {
  return useQuery({
    queryKey: AWAITING_REVIEW_KEY,
    queryFn: () => complaintsApi.listMyComplaintsAwaitingReview(),
  })
}

// Dashboard widget feed — every complaint this employee has filed, any
// status, newest first.
export function useMyComplaints() {
  return useQuery({
    queryKey: MY_COMPLAINTS_KEY,
    queryFn: () => complaintsApi.listMyComplaints(),
  })
}

export function useAcknowledgeComplaint() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => complaintsApi.acknowledgeComplaint(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_COMPLAINTS_KEY }),
  })
}

export function useSubmitComplaintReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; speedRating: number; qualityRating: number; comments?: string }) =>
      complaintsApi.submitComplaintReview(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AWAITING_REVIEW_KEY })
      queryClient.invalidateQueries({ queryKey: MY_COMPLAINTS_KEY })
    },
  })
}
