import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as attendanceWarningsApi from '@/api/attendanceWarnings.api'
import type { WarningCategory } from '@/api/attendanceWarnings.api'

export function useDailyReport(date?: string) {
  return useQuery({
    queryKey: ['attendance-daily-report', date ?? 'previous-working-day'],
    queryFn: () => attendanceWarningsApi.getDailyReport(date),
  })
}

export function useSendWarning() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { employeeId: string; date: string; category: WarningCategory; message: string }) =>
      attendanceWarningsApi.sendWarning(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-daily-report'] })
      queryClient.invalidateQueries({ queryKey: ['attendance-warnings-monthly'] })
    },
  })
}

export function useMonthlyWarnings(employeeId: string | undefined, year: number, month: number) {
  return useQuery({
    queryKey: ['attendance-warnings-monthly', employeeId, year, month],
    queryFn: () => attendanceWarningsApi.getMonthlyWarnings(employeeId as string, year, month),
    enabled: Boolean(employeeId),
  })
}

export function usePendingWarnings() {
  return useQuery({
    queryKey: ['attendance-warnings-pending'],
    queryFn: () => attendanceWarningsApi.getPendingWarnings(),
  })
}
