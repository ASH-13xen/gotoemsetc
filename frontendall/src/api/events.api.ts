import { apiClient } from './client'
import type { EmployeeSummary } from './employees.api'

export type EventMode = 'online' | 'offline'
export type EventStatus = 'upcoming' | 'completed' | 'cancelled'
export type ResponsibilityStatus = 'pending' | 'done'

export interface RescheduleEntry {
  fromStartAt: string
  toStartAt: string
  note?: string
  changedBy?: EmployeeSummary | null
  changedAt: string
}

export interface EventSummary {
  highlights?: string
  improvements?: string
  filledBy?: EmployeeSummary | null
  filledAt?: string
}

export interface EventItem {
  _id: string
  title: string
  description?: string
  client?: { _id: string; clientName: string; brandName: string; logoUrl?: string } | null
  mode: EventMode
  location?: string
  startAt: string
  endAt?: string
  coordinator?: EmployeeSummary | null
  status: EventStatus
  rescheduleHistory: RescheduleEntry[]
  summary?: EventSummary
  createdBy?: EmployeeSummary | null
}

export interface EventResponsibility {
  _id: string
  event: string | { _id: string; title: string; startAt: string; status: EventStatus }
  title: string
  assignedEmployees: EmployeeSummary[]
  assignedTeam?: { _id: string; name: string } | null
  dueDate?: string
  startTime?: string
  endTime?: string
  status: ResponsibilityStatus
  completedBy?: EmployeeSummary | null
  completedAt?: string
}

export interface EventFormInput {
  title: string
  description?: string
  client?: string | null
  mode: EventMode
  location?: string
  startAt: string
  endAt?: string | null
  coordinator?: string | null
}

export async function listEvents(): Promise<EventItem[]> {
  const { data } = await apiClient.get('/events')
  return data.events
}

export async function getEvent(id: string): Promise<{ event: EventItem; responsibilities: EventResponsibility[] }> {
  const { data } = await apiClient.get(`/events/${id}`)
  return data
}

export async function createEvent(input: EventFormInput): Promise<EventItem> {
  const { data } = await apiClient.post('/events', input)
  return data.event
}

export async function updateEvent(id: string, input: Partial<EventFormInput>): Promise<EventItem> {
  const { data } = await apiClient.patch(`/events/${id}`, input)
  return data.event
}

export async function rescheduleEvent(id: string, input: { newStartAt: string; newEndAt?: string; note?: string }): Promise<EventItem> {
  const { data } = await apiClient.post(`/events/${id}/reschedule`, input)
  return data.event
}

export async function completeEvent(id: string): Promise<EventItem> {
  const { data } = await apiClient.post(`/events/${id}/complete`)
  return data.event
}

export async function cancelEvent(id: string): Promise<EventItem> {
  const { data } = await apiClient.post(`/events/${id}/cancel`)
  return data.event
}

export async function fillEventSummary(id: string, input: { highlights?: string; improvements?: string }): Promise<EventItem> {
  const { data } = await apiClient.patch(`/events/${id}/summary`, input)
  return data.event
}

export async function deleteEvent(id: string): Promise<void> {
  await apiClient.delete(`/events/${id}`)
}

export interface ResponsibilityFormInput {
  title: string
  assignedEmployees?: string[]
  assignedTeam?: string | null
  dueDate?: string | null
  startTime?: string | null
  endTime?: string | null
}

export async function createResponsibility(eventId: string, input: ResponsibilityFormInput): Promise<EventResponsibility> {
  const { data } = await apiClient.post(`/events/${eventId}/responsibilities`, input)
  return data.responsibility
}

export async function updateResponsibility(id: string, input: Partial<ResponsibilityFormInput>): Promise<EventResponsibility> {
  const { data } = await apiClient.patch(`/events/responsibilities/${id}`, input)
  return data.responsibility
}

export async function setResponsibilityStatus(id: string, status: ResponsibilityStatus): Promise<EventResponsibility> {
  const { data } = await apiClient.post(`/events/responsibilities/${id}/status`, { status })
  return data.responsibility
}

export async function deleteResponsibility(id: string): Promise<void> {
  await apiClient.delete(`/events/responsibilities/${id}`)
}

export async function listMyResponsibilities(): Promise<EventResponsibility[]> {
  const { data } = await apiClient.get('/events/my-responsibilities')
  return data.responsibilities
}
