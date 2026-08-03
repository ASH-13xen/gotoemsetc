import { apiClient } from './client'

export type EmployeeTaskType = 'personal' | 'team' | 'client' | 'event'

export interface UpcomingEmployeeTask {
  _id: string
  title: string
  type: EmployeeTaskType
  endAt: string
  client?: { name: string }
  event?: { name: string }
  team?: { name: string }
}

// Self-scoping — the backend resolves "mine" from the JWT's employeeLink,
// same convention as /events/my-responsibilities. No id sent from here.
export async function listMyUpcomingTasks(): Promise<{ tasks: UpcomingEmployeeTask[] }> {
  const { data } = await apiClient.get('/employee-tasks/mine/upcoming')
  return data
}
