import { apiClient } from './client'

export type CompanyEventType = 'client_birthday' | 'client_anniversary' | 'brand_anniversary'

export interface CompanyEvent {
  _id: string
  type: CompanyEventType
  name: string
  date: string
  notes?: string
}

export async function listCompanyEvents(month?: number): Promise<{ events: CompanyEvent[] }> {
  const { data } = await apiClient.get('/company-events', { params: { month } })
  return data
}

export async function createCompanyEvent(input: {
  type: CompanyEventType
  name: string
  date: string
  notes?: string
}): Promise<{ event: CompanyEvent }> {
  const { data } = await apiClient.post('/company-events', input)
  return data
}

export async function deleteCompanyEvent(id: string): Promise<void> {
  await apiClient.delete(`/company-events/${id}`)
}
