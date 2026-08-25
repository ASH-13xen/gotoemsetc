import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as complaintsApi from '@/api/complaints.api'
import type { ComplaintCategory } from '@/api/complaints.api'

const AWAITING_REVIEW_KEY = ['my-complaints-awaiting-review']

export function useFileComplaint() {
  return useMutation({
    mutationFn: (input: { category: ComplaintCategory; description: string }) => complaintsApi.fileComplaint(input),
  })
}

export function useMyComplaintsAwaitingReview() {
  return useQuery({
    queryKey: AWAITING_REVIEW_KEY,
    queryFn: () => complaintsApi.listMyComplaintsAwaitingReview(),
  })
}

export function useSubmitComplaintReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; speedRating: number; qualityRating: number; comments?: string }) =>
      complaintsApi.submitComplaintReview(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AWAITING_REVIEW_KEY }),
  })
}
