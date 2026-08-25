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

export interface PlanNextDayBucket {
  overdue: UpcomingEmployeeTask[]
  tomorrow: UpcomingEmployeeTask[]
}

export interface PlanNextDayTeamDigest extends PlanNextDayBucket {
  team: { _id: string; name: string }
}

export interface PlanNextDayDigest {
  mine: PlanNextDayBucket
  teams: PlanNextDayTeamDigest[]
}

// Null before 6:30pm IST or once the board is genuinely clear — see
// planNextDay.service.js#getDigest. The frontend renders nothing either way.
export async function getPlanNextDay(): Promise<{ digest: PlanNextDayDigest | null }> {
  const { data } = await apiClient.get('/employee-tasks/plan-next-day')
  return data
}
