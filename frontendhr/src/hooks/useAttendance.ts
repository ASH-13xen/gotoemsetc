import { useQuery } from '@tanstack/react-query'
import * as attendanceApi from '@/api/attendance.api'

export function useMonthlyOverview(month: number, year: number) {
  return useQuery({
    queryKey: ['attendance-monthly-overview', month, year],
    queryFn: () => attendanceApi.listMonthlyOverview(month, year),
  })
}
