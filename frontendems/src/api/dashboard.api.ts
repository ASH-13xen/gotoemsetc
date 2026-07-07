import { apiClient } from './client'

export interface DashboardStats {
  totalEmployees: number
  pendingUploadRequests: number
  documentsGeneratedThisMonth: number
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await apiClient.get('/dashboard/stats')
  return data
}
