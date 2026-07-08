import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as salarySlipsApi from '@/api/salarySlips.api'
import type { GenerateSalarySlipInput } from '@/api/salarySlips.api'

export function useSalarySlips(employeeId: string) {
  return useQuery({
    queryKey: ['salary-slips', employeeId],
    queryFn: () => salarySlipsApi.listSalarySlips(employeeId),
  })
}

export function useGenerateSalarySlip(employeeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: GenerateSalarySlipInput) => salarySlipsApi.generateSalarySlip(employeeId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['salary-slips', employeeId] }),
  })
}
