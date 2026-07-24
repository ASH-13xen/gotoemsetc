import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as companyEventsApi from '@/api/companyEvents.api'
import type { CompanyEventType } from '@/api/companyEvents.api'

export function useCompanyEvents(month?: number) {
  return useQuery({
    queryKey: ['companyEvents', month],
    queryFn: () => companyEventsApi.listCompanyEvents(month),
  })
}

export function useCreateCompanyEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { type: CompanyEventType; name: string; date: string; notes?: string }) =>
      companyEventsApi.createCompanyEvent(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companyEvents'] }),
  })
}

export function useDeleteCompanyEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => companyEventsApi.deleteCompanyEvent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companyEvents'] }),
  })
}
