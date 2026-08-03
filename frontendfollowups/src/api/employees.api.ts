import { apiClient } from './client'

// Thin directory-lookup surface — just enough for assignment pickers.
// Full employee CRUD lives in frontendems.
export interface EmployeeSummary {
  _id: string
  firstName: string
  lastName?: string
  designation?: string
  employeeCode?: string
}

export interface ListEmployeesParams {
  search?: string
  status?: 'draft' | 'active' | 'offboarded'
  limit?: number
  page?: number
}

// GET /employees itself is gated behind directory-access permissions most
// plain workers don't have (correct for HR's full directory) — a team
// leader with zero granted permissions still needs to pick colleagues for
// task/subtask assignment, so this hits the dedicated, open-to-everyone
// /employees/directory endpoint instead. `params` is accepted for call-site
// compatibility but unused — that endpoint is always active-only/unpaginated.
export async function listEmployees(
  _params: ListEmployeesParams = {}
): Promise<{ items: EmployeeSummary[]; total: number }> {
  const { data } = await apiClient.get('/employees/directory')
  return { items: data.items, total: data.items.length }
}
