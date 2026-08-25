import { useQuery } from '@tanstack/react-query'
import * as employeesApi from '@/api/employees.api'

export function useEmployeeDirectory(search?: string) {
  return useQuery({
    queryKey: ['employee-directory', search],
    queryFn: () => employeesApi.listEmployees(search),
  })
}

// Backed by the permission-free GET /employees/directory — usable by any
// authenticated account, including CEO/global-Team-Leader, who hold zero
// permissions and would 403 against the gated listEmployees above. Use this
// for "assign to anyone, team or outside" pickers (e.g. MOM-spawned tasks).
export function useOpenEmployeeDirectory() {
  return useQuery({ queryKey: ['employee-directory', 'open'], queryFn: employeesApi.listOpenEmployeeDirectory, staleTime: 60_000 })
}
