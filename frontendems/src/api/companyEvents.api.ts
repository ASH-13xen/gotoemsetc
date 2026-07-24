import { apiClient } from './client'

export type CompanyEventType = 'client_birthday' | 'client_anniversary' | 'brand_anniversary' | 'important'

export interface CompanyEvent {
  _id: string
  type: CompanyEventType
  name: string
  date: string
  notes?: string
}

// `year` only matters for 'important' markers, which don't recur — see
// companyEvent.service.js#listForMonth. Harmless to always pass it.
export async function listCompanyEvents(month?: number, year?: number): Promise<{ events: CompanyEvent[] }> {
  const { data } = await apiClient.get('/company-events', { params: { month, year } })
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
