import { useQuery } from '@tanstack/react-query'
import * as employeesApi from '@/api/employees.api'

export function useEmployeeDirectory(search?: string) {
  return useQuery({
    queryKey: ['employee-directory', search],
    queryFn: () => employeesApi.listEmployees(search),
  })
}
