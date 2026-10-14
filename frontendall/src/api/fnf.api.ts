import { apiClient } from './client'

// Full & final settlement on the dashboard: HR confirms the last working day,
// then the CEO/admin approves it together with the final salary slip — see
// backend fnfSettlement.service.js.

export interface FnfSettlement {
  _id: string
  employee: { _id: string; firstName: string; lastName?: string; employeeCode?: string; designation?: string; status?: string }
  stage: 'hr' | 'ceo' | 'finance' | null
  // The day HR is offered: their record's last day, else the document's separation date.
  suggestedLastDay: string | null
  lastWorkingDay?: string
  separationDate?: string
  salarySlip?: { _id: string; startDate: string; endDate: string; netPayable: number } | null
  finalSalary: number
  severance: number
  total: number
  companyEmail: string | null
  sendBackNote?: string
  createdAt: string
  isOwn?: boolean
}

export async function listFnfForHr() {
  const { data } = await apiClient.get<{ settlements: FnfSettlement[] }>('/fnf-settlements/hr')
  return data.settlements
}

export async function confirmFnfLastDay(id: string, lastWorkingDay: string) {
  const { data } = await apiClient.post<{ settlement: FnfSettlement }>(`/fnf-settlements/${id}/last-day`, { lastWorkingDay })
  return data.settlement
}

export async function listFnfForApproval() {
  const { data } = await apiClient.get<{ settlements: FnfSettlement[] }>('/fnf-settlements/approvals')
  return data.settlements
}

export async function approveFnf(id: string) {
  const { data } = await apiClient.post<{ settlement: FnfSettlement }>(`/fnf-settlements/${id}/approve`, {})
  return data.settlement
}

export async function sendBackFnf(id: string, note: string) {
  const { data } = await apiClient.post<{ settlement: FnfSettlement }>(`/fnf-settlements/${id}/send-back`, { note })
  return data.settlement
}

export async function fetchFnfDocument(id: string): Promise<Blob> {
  const { data } = await apiClient.get(`/fnf-settlements/${id}/document`, { responseType: 'blob' })
  return data
}

export async function fetchFnfSlip(id: string): Promise<Blob> {
  const { data } = await apiClient.get(`/fnf-settlements/${id}/slip`, { responseType: 'blob' })
  return data
}
