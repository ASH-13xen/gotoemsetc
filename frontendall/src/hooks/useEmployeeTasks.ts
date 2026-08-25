import { useQuery } from '@tanstack/react-query'
import * as employeeTasksApi from '@/api/employeeTasks.api'

export function useMyUpcomingTasks() {
  return useQuery({
    queryKey: ['employee-tasks', 'mine', 'upcoming'],
    queryFn: () => employeeTasksApi.listMyUpcomingTasks(),
  })
}

export function usePlanNextDay() {
  return useQuery({
    queryKey: ['employee-tasks', 'plan-next-day'],
    queryFn: () => employeeTasksApi.getPlanNextDay(),
  })
}
