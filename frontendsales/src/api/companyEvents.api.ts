import { apiClient } from './client'

// Mirrors backend/src/config/constants.js#COMPANY_EVENT_TYPE.
export type CompanyEventType = 'client_birthday' | 'client_anniversary' | 'brand_anniversary' | 'important'

export const COMPANY_EVENT_TYPE_LABEL: Record<CompanyEventType, string> = {
  client_birthday: 'Client birthday',
  client_anniversary: 'Client anniversary',
  brand_anniversary: 'Brand anniversary',
  important: 'Important date',
}

export interface CompanyEvent {
  _id: string
  type: CompanyEventType
  name: string
  date: string
  notes?: string
  client?: string | null
}

// This client's important dates — birthdays, anniversaries, brand
// anniversary. Excluded from HR's general company calendar; see
// backend/src/services/companyEvent.service.js#listForClient.
export async function listEventsForClient(clientId: string): Promise<CompanyEvent[]> {
  const { data } = await apiClient.get(`/company-events/client/${clientId}`)
  return data.events ?? []
}

export async function createClientEvent(input: {
  clientId: string
  type: CompanyEventType
  name: string
  date: string
  notes?: string
}): Promise<CompanyEvent> {
  const { data } = await apiClient.post('/company-events', {
    type: input.type,
    name: input.name,
    date: input.date,
    notes: input.notes,
    client: input.clientId,
  })
  return data.event
}

export async function deleteEvent(id: string): Promise<void> {
  await apiClient.delete(`/company-events/${id}`)
}
