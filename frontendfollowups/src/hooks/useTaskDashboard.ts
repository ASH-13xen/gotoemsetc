import { useQuery } from '@tanstack/react-query'
import * as api from '@/api/taskDashboard.api'

export function useDashboard() {
  return useQuery({ queryKey: ['task-dashboard'], queryFn: api.getDashboard })
}

export function useWorkloadSummary() {
  return useQuery({ queryKey: ['workload-summary'], queryFn: api.getWorkloadSummary })
}

export function useWorkloadForEmployee(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['workload', employeeId],
    queryFn: () => api.getWorkloadForEmployee(employeeId as string),
    enabled: Boolean(employeeId),
  })
}

export function useContentCalendar(from: string, to: string) {
  return useQuery({
    queryKey: ['content-calendar', from, to],
    queryFn: () => api.getContentCalendar(from, to),
  })
}
