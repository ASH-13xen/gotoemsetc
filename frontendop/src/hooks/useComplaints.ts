import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as complaintsApi from '@/api/complaints.api'
import type { ComplaintStatus } from '@/api/complaints.api'

const KEY = ['complaints']

export function useComplaints(status?: ComplaintStatus) {
  return useQuery({
    queryKey: [...KEY, status ?? 'all'],
    queryFn: () => complaintsApi.listComplaints(status),
  })
}

export function useMarkComplaintCompleted() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => complaintsApi.markComplaintCompleted(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
