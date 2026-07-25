import { useQuery } from '@tanstack/react-query'
import * as companyEventsApi from '@/api/companyEvents.api'

export function useCompanyEvents(month?: number, year?: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['companyEvents', month, year],
    queryFn: () => companyEventsApi.listCompanyEvents(month, year),
    enabled: options?.enabled ?? true,
  })
}
