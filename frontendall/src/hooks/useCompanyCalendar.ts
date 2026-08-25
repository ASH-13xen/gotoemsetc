import { useQuery } from '@tanstack/react-query'
import * as companyCalendarApi from '@/api/companyCalendar.api'

export function useWhosOut(month: number, year: number) {
  return useQuery({
    queryKey: ['company-calendar', 'whos-out', month, year],
    queryFn: () => companyCalendarApi.listWhosOut(month, year),
  })
}
