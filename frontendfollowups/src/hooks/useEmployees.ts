import { useQuery } from '@tanstack/react-query'
import * as employeesApi from '@/api/employees.api'
import type { ListEmployeesParams } from '@/api/employees.api'

export function useEmployees(params: ListEmployeesParams = {}) {
  return useQuery({
    queryKey: ['employees', params],
    queryFn: () => employeesApi.listEmployees(params),
    staleTime: 60_000,
  })
}
