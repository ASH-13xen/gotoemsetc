import { useQuery } from '@tanstack/react-query'
import * as salarySlipsApi from '@/api/salarySlips.api'

export function useMyRecentSalaryMonths(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['my-salary-months', employeeId],
    queryFn: () => salarySlipsApi.listMyRecentSalaryMonths(employeeId as string),
    enabled: Boolean(employeeId),
  })
}
