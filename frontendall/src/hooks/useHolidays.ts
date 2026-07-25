import { useQuery } from '@tanstack/react-query'
import * as holidaysApi from '@/api/holidays.api'

export function useHolidays(month: number, year: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['holidays', month, year],
    queryFn: () => holidaysApi.listHolidays(month, year),
    enabled: options?.enabled ?? true,
  })
}
