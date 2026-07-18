import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as employeesApi from '@/api/employees.api'
import type {
  CreateEmployeeInput,
  ListEmployeesParams,
  UpdateEmployeeInput,
} from '@/api/employees.api'

const EMPLOYEES_KEY = ['employees']

export function useEmployees(params: ListEmployeesParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...EMPLOYEES_KEY, params],
    queryFn: () => employeesApi.listEmployees(params),
    placeholderData: (prev) => prev,
    enabled: options?.enabled ?? true,
  })
}

export function useEmployee(id: string | undefined) {
  return useQuery({
    queryKey: [...EMPLOYEES_KEY, id],
    queryFn: () => employeesApi.getEmployee(id as string),
    enabled: Boolean(id),
  })
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateEmployeeInput) => employeesApi.createEmployee(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY })
    },
  })
}

export function useUpdateEmployee(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateEmployeeInput) => employeesApi.updateEmployee(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY })
    },
  })
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => employeesApi.deleteEmployee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY })
    },
  })
}

export function useAddFlag(employeeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { color: 'red' | 'green'; note: string; date?: string }) =>
      employeesApi.addFlag(employeeId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY })
    },
  })
}

export function useRemoveFlag(employeeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (flagId: string) => employeesApi.removeFlag(employeeId, flagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY })
    },
  })
}
